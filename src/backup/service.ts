/**
 * S-22 Backup & restore (F-18): make one encrypted file of all data + attachments, and restore one.
 * Native parts (files, picker, share sheet, folder) come in through `AppFileIO` / native.ts so Jest runs all of it.
 * Never logs data or file contents.
 */
import { TABLE_NAMES, countDump, dumpAll, replaceAllData, type DataDump } from '@/db/repos/data';
import { getSettings, updateSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';
import { FILE_ROOTS } from '@/files/paths';

import { DEVICE_KEYS, deviceRows, getDeviceValue, isDeviceRow, setDeviceValue } from './deviceStore';
import { BackupError, keyForFile, keyFromJson, keyToJson, newBackupKey, open, seal, type BackupKey, type Rng } from './format';
import { pack, unpack, type Manifest } from './pack';

/** The app's own files (relative to the document directory). */
export interface AppFileIO {
  /** Every file under `root` (recursive), as relative paths "applicants/3/doc-7.jpg". Missing root → []. */
  listFiles(root: string): Promise<string[]>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /** Missing is fine. */
  deleteDir(path: string): Promise<void>;
  /** Moves a folder into place (replacing `to`); missing `from` is fine. */
  moveDir(from: string, to: string): Promise<void>;
}

export interface BackupDeps {
  db: AppDb;
  io: AppFileIO;
  rng: Rng;
  now?: () => Date;
  appVersion?: string | null;
  /**
   * Tell open screens which tables changed (the phone passes @/db `markTablesChanged`). Restore empties tables with
   * DELETE without WHERE — SQLite's truncate shortcut sends no change event, so useLive screens kept showing the old
   * data (B-120 family, as Delete all).
   */
  tablesChanged?: (tables: readonly string[]) => void;
}

export type BackupStep = 'deriving' | 'packing' | 'encrypting' | 'reading' | 'checking' | 'restoring';
export type OnStep = (step: BackupStep) => void;

/** Restore writes here first, so a failure never leaves half the old files and half the new. */
export const RESTORE_STAGING = 'restore-staging';
export const BACKUP_EXTENSION = 'evenlease';
export const BACKUP_MIME = 'application/octet-stream';
export const BACKUP_NAME_PATTERN = /^Evenlease-backup-\d{4}-\d{2}-\d{2}-\d{4}\.evenlease$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** "Evenlease-backup-2026-11-30-0930.evenlease" (phone's local time; sorts by time). */
export function backupFileName(at: Date): string {
  return `Evenlease-backup-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.${BACKUP_EXTENSION}`;
}

/** Local ISO time with offset (same style as the rest of the app's timestamps). */
export function localIso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds(),
  )}.${String(d.getMilliseconds()).padStart(3, '0')}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// ---------------------------------------------------------------------------
// Backup password (set once, typed twice; the derived key stays on the phone)
// ---------------------------------------------------------------------------

export function storedBackupKey(db: AppDb): BackupKey | null {
  return keyFromJson(getDeviceValue(db, DEVICE_KEYS.backupKey));
}

export const hasBackupPassword = (db: AppDb) => storedBackupKey(db) != null;

/** Derives (slow, async) and stores the key. Older backup files still need the password they were made with. */
export async function setBackupPassword(db: AppDb, password: string, rng: Rng, iterations?: number): Promise<void> {
  const k = await newBackupKey(password, rng, iterations);
  setDeviceValue(db, DEVICE_KEYS.backupKey, keyToJson(k));
}

// ---------------------------------------------------------------------------
// Make a backup
// ---------------------------------------------------------------------------

export interface MadeBackup {
  bytes: Uint8Array;
  fileName: string;
  createdAt: string;
  counts: { rentals: number; applicants: number; files: number };
}

/** The data part of a backup: every row except this phone's own settings. */
export function backupDump(db: AppDb): DataDump {
  const dump = dumpAll(db);
  return { ...dump, settings: dump.settings.filter((r) => !isDeviceRow(r.key)) };
}

async function readAppFiles(io: AppFileIO): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for (const root of FILE_ROOTS) {
    for (const path of await io.listFiles(root)) out[path] = await io.readBytes(path);
  }
  return out;
}

/** Builds the encrypted file in memory. Throws BackupError('no_password') before the password is set. */
export async function buildBackup(deps: BackupDeps, onStep?: OnStep): Promise<MadeBackup> {
  const key = storedBackupKey(deps.db);
  if (!key) throw new BackupError('no_password');
  const at = deps.now?.() ?? new Date();
  onStep?.('packing');
  const dump = backupDump(deps.db);
  const files = await readAppFiles(deps.io);
  const counts = countDump(dump);
  const zip = pack({ dump, files, createdAt: localIso(at), appVersion: deps.appVersion, counts });
  onStep?.('encrypting');
  const bytes = seal(zip, key, deps.rng);
  return { bytes, fileName: backupFileName(at), createdAt: localIso(at), counts: { ...counts, files: Object.keys(files).length } };
}

/** After the file was saved / shared: S-22 "Last backup: Nov 30, 2026 · 12.4 MB", the 30-day reminder restarts. */
export function recordBackup(db: AppDb, made: Pick<MadeBackup, 'createdAt' | 'bytes'>): void {
  updateSettings(db, { lastBackupAt: made.createdAt, lastBackupBytes: made.bytes.length });
  setDeviceValue(db, DEVICE_KEYS.autoBackupFailedAt, null);
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export interface OpenedBackup {
  manifest: Manifest;
  dump: DataDump;
  files: Record<string, Uint8Array>;
  key: BackupKey;
  /** For the confirm text: "backup from Nov 30, 2026 (2 rentals · 7 applicants)". */
  counts: { rentals: number; applicants: number };
  createdAt: string;
}

/**
 * Decrypts and checks the whole file — nothing on the phone changes yet. BackupError codes: not_backup ·
 * newer_version · wrong_password · corrupt.
 */
export async function openBackup(file: Uint8Array, password: string, onStep?: OnStep): Promise<OpenedBackup> {
  onStep?.('deriving');
  const key = await keyForFile(file, password);
  onStep?.('checking');
  const zip = open(file, key);
  const { manifest, dump, files } = unpack(zip);
  return { manifest, dump, files, key, counts: countDump(dump), createdAt: manifest.createdAt };
}

/**
 * "Replace": files to a staging folder, then all rows in one transaction (1C `replaceAllData`), then the staged
 * folders swap in. This phone's own settings (lock, folder, onboarding, device.*) are kept; the backup password
 * that opened the file becomes this phone's backup password.
 */
export async function restoreBackup(deps: BackupDeps, opened: OpenedBackup, onStep?: OnStep): Promise<void> {
  const { db, io } = deps;
  onStep?.('restoring');
  await io.deleteDir(RESTORE_STAGING);
  try {
    for (const [path, bytes] of Object.entries(opened.files)) await io.writeBytes(`${RESTORE_STAGING}/${path}`, bytes);
  } catch (e) {
    await io.deleteDir(RESTORE_STAGING);
    throw e;
  }

  const current = dumpAll(db).settings.filter((r) => isDeviceRow(r.key));
  const keep = new Map(current.map((r) => [r.key, r.value]));
  for (const r of deviceRows(db)) keep.set(r.key, r.value);
  keep.set(DEVICE_KEYS.backupKey, keyToJson(opened.key));
  const fromFile = (opened.dump.settings ?? []).filter((r) => !isDeviceRow(r.key));
  const merged: DataDump = { ...opened.dump, settings: [...fromFile, ...[...keep].map(([key, value]) => ({ key, value }))] };

  try {
    replaceAllData(db, merged);
  } catch (e) {
    await io.deleteDir(RESTORE_STAGING);
    throw e;
  }
  try {
    for (const root of FILE_ROOTS) {
      await io.deleteDir(root);
      await io.moveDir(`${RESTORE_STAGING}/${root}`, root);
    }
    await io.deleteDir(RESTORE_STAGING);
  } finally {
    // Every table was replaced: announce all of them (after the files are in place, even if a move failed).
    deps.tablesChanged?.(TABLE_NAMES);
  }
}

/** Last backup line for S-22, or null ("No backup yet"). */
export function lastBackupInfo(db: AppDb): { at: string; bytes: number | null } | null {
  const s = getSettings(db);
  return s.lastBackupAt ? { at: s.lastBackupAt, bytes: s.lastBackupBytes } : null;
}

/** "12.4 MB" · "850 KB" (decimal units, like the phone's Files app). */
export function formatBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${Math.round(n / 1000)} KB`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${(n / 1_000_000_000).toFixed(1)} GB`;
}
