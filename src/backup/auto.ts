/**
 * S-22 "Automatic backup: Weekly" into the folder the landlord picked (Android SAF → Google Drive; iOS Files → iCloud
 * Drive), run by the background task (backgroundTask.ts) or when the app opens. Keeps the newest 3 files there.
 * Also the "> 30 days since the last backup" reminder (S-02 banner, notification).
 */
import { getSettings, type AppSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';
import { t } from '@/i18n';

import { DEVICE_KEYS, getDeviceValue, setDeviceValue } from './deviceStore';
import { BackupError } from './format';
import { BACKUP_NAME_PATTERN, buildBackup, hasBackupPassword, recordBackup, type BackupDeps } from './service';

const DAY_MS = 24 * 60 * 60 * 1000;
export const AUTO_INTERVAL_DAYS = 7;
export const AUTO_KEEP = 3;
/** product.md S-22 / §6: remind when the last backup is more than 30 days old. */
export const REMIND_AFTER_DAYS = 30;

/** The picked folder, as the background task sees it. */
export interface FolderPort {
  /** File names in the folder (real display names — not Drive document ids, fact expo-native-v2-gotchas B-45). */
  list(): Promise<string[]>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
}

/** Weekly backup is due: on, a folder picked, a password set, and 7 days (less 1 h of scheduling slack) since the last one. */
export function autoBackupDue(s: Pick<AppSettings, 'autoBackup' | 'backupFolderUri' | 'lastBackupAt'>, now: Date): boolean {
  if (s.autoBackup !== 'weekly' || !s.backupFolderUri) return false;
  if (!s.lastBackupAt) return true;
  return now.getTime() - new Date(s.lastBackupAt).getTime() >= AUTO_INTERVAL_DAYS * DAY_MS - 60 * 60 * 1000;
}

/** Our backup files beyond the newest `keep` (other files in the folder are never touched). */
export function filesToPrune(names: readonly string[], keep: number = AUTO_KEEP): string[] {
  return names
    .filter((n) => BACKUP_NAME_PATTERN.test(n))
    .sort()
    .reverse()
    .slice(keep);
}

export type AutoResult = 'off' | 'not_due' | 'no_password' | 'done' | 'failed';

/**
 * One automatic backup if due. A failure (folder gone / permission lost / full) is remembered for S-22 and never
 * throws — the background task must finish.
 */
export async function runAutoBackup(
  deps: BackupDeps,
  folder: (uri: string) => FolderPort,
  opts: { force?: boolean } = {},
): Promise<AutoResult> {
  const now = deps.now?.() ?? new Date();
  const s = getSettings(deps.db);
  if (s.autoBackup !== 'weekly' || !s.backupFolderUri) return 'off';
  if (!opts.force && !autoBackupDue(s, now)) return 'not_due';
  if (!hasBackupPassword(deps.db)) return 'no_password';
  try {
    const port = folder(s.backupFolderUri);
    const made = await buildBackup({ ...deps, now: () => now });
    await port.write(made.fileName, made.bytes);
    recordBackup(deps.db, made);
    try {
      for (const old of filesToPrune(await port.list())) await port.remove(old);
    } catch {
      // Pruning is best effort; the new file is saved.
    }
    return 'done';
  } catch {
    setDeviceValue(deps.db, DEVICE_KEYS.autoBackupFailedAt, now.toISOString());
    return 'failed';
  }
}

/** S-22 shows "Automatic backup couldn't reach the folder. Choose it again." */
export function autoBackupFailedAt(db: AppDb): string | null {
  return getDeviceValue(db, DEVICE_KEYS.autoBackupFailedAt);
}

// ---------------------------------------------------------------------------
// 30-day reminder
// ---------------------------------------------------------------------------

export interface BackupReminder {
  /** Show the S-02 banner "Back up your data — last backup 34 days ago". */
  show: boolean;
  /** Days since the last backup; null = never backed up. */
  days: number | null;
}

/**
 * Banner state. Never backed up: due 30 days after the first real (non-sample) rental was created — nothing to lose
 * before that. "Later" hides it for 7 days.
 */
export function backupReminder(
  s: Pick<AppSettings, 'lastBackupAt'>,
  firstDataAt: string | null,
  snoozedUntil: string | null,
  now: Date,
): BackupReminder {
  const since = s.lastBackupAt ?? firstDataAt;
  if (!since) return { show: false, days: null };
  const days = Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS);
  const due = days > REMIND_AFTER_DAYS;
  const snoozed = !!snoozedUntil && new Date(snoozedUntil).getTime() > now.getTime();
  return { show: due && !snoozed, days: s.lastBackupAt ? days : null };
}

export const SNOOZE_DAYS = 7;

/** S-02 banner "Later". */
export function snoozeBackupReminder(db: AppDb, now: Date = new Date()): void {
  setDeviceValue(db, DEVICE_KEYS.backupSnoozedUntil, new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString());
}

export const backupSnoozedUntil = (db: AppDb) => getDeviceValue(db, DEVICE_KEYS.backupSnoozedUntil);

/** Message for a failed backup / restore (screens show it as is). */
export function backupErrorText(e: unknown): string {
  if (!(e instanceof BackupError)) return t('system:s22.errors.failed');
  switch (e.code) {
    case 'wrong_password':
      return t('system:s22.errors.wrongPassword');
    case 'not_backup':
      return t('system:s22.errors.notBackup');
    case 'corrupt':
      return t('system:s22.errors.corrupt');
    case 'newer_version':
      return t('system:s22.errors.newer');
    case 'no_space':
      return t('system:s22.errors.noSpace');
    case 'folder_gone':
      return t('system:s22.errors.folderGone');
    default:
      return t('system:s22.errors.failed');
  }
}
