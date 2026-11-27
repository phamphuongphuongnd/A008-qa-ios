/**
 * Phone side of backup (Jest never loads this file; tests pass fakes for AppFileIO / FolderPort / Rng):
 * expo-file-system (document dir + SAF folder), expo-document-picker, expo-sharing, expo-crypto.
 */
import * as DocumentPicker from 'expo-document-picker';
import { getRandomBytes } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { withLockSuspended } from '@/features/settings/lockController';
import { excludeRootOf } from '@/files/cloudBackup';
import { cloudBackupPort } from '@/files/cloudBackupNative';

import { IosFiles } from '../../modules/ios-files';
import type { FolderPort } from './auto';
import { BackupError, type Rng } from './format';
import { bookmarkFolderPort, folderSetting, isBookmarkUri, type TempFiles } from './iosFolder';
import { BACKUP_MIME, type AppFileIO } from './service';

/** Hermes has no crypto.getRandomValues; expo-crypto uses the OS generator. */
export const nativeRng: Rng = (n) => getRandomBytes(n);

const docFile = (path: string) => new File(Paths.document, path);
const docDir = (path: string) => new Directory(Paths.document, path);

function ensureParent(path: string) {
  const parts = path.split('/');
  parts.pop();
  if (parts.length) new Directory(Paths.document, ...parts).create({ idempotent: true, intermediates: true });
  excludeRootOf(cloudBackupPort, path); // G-05 (iOS)
}

function walk(dir: Directory, prefix: string, out: string[]) {
  for (const item of dir.list()) {
    if (item instanceof Directory) walk(item, `${prefix}/${item.name}`, out);
    else out.push(`${prefix}/${item.name}`);
  }
}

export const expoAppFileIO: AppFileIO = {
  async listFiles(root) {
    const d = docDir(root);
    if (!d.exists) return [];
    const out: string[] = [];
    walk(d, root, out);
    return out;
  },
  async readBytes(path) {
    return docFile(path).bytes();
  },
  async writeBytes(path, bytes) {
    if (Paths.availableDiskSpace < bytes.length + 5_000_000) throw new BackupError('no_space');
    ensureParent(path);
    const f = docFile(path);
    if (f.exists) f.delete();
    f.create();
    f.write(bytes);
  },
  async deleteDir(path) {
    const d = docDir(path);
    if (d.exists) d.delete();
  },
  async moveDir(from, to) {
    const src = docDir(from);
    if (!src.exists) return;
    const dest = docDir(to);
    if (dest.exists) dest.delete();
    // move() into the parent keeps the folder's own name; the staged folder is named like the root already.
    src.move(new Directory(Paths.document));
  },
};

/** Writes the made backup into the cache (for the share sheet); returns its uri. */
export function writeCacheFile(name: string, bytes: Uint8Array): string {
  const dir = new Directory(Paths.cache, 'backup');
  if (!dir.exists) dir.create({ intermediates: true });
  const f = new File(dir, name);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
  return f.uri;
}

/** Old exported files in the cache (after sharing). */
export function clearBackupCache(): void {
  try {
    const dir = new Directory(Paths.cache, 'backup');
    if (dir.exists) dir.delete();
  } catch {
    // The OS cleans the cache anyway.
  }
}

/**
 * "Back up now" without a folder: the share sheet (Drive, Files, email…). true = the sheet was shown and closed —
 * NOT that the file was saved: expo-sharing resolves the same way when the landlord cancels (B-68), so S-22 asks.
 */
export async function shareBackupFile(uri: string, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await withLockSuspended(() => Sharing.shareAsync(uri, { mimeType: BACKUP_MIME, dialogTitle }));
  return true;
}

/** "Restore from backup": system file picker → the file's bytes, or null when cancelled. */
export async function pickBackupFile(): Promise<Uint8Array | null> {
  const r = await withLockSuspended(() => DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }));
  if (r.canceled || !r.assets?.length) return null;
  const f = new File(r.assets[0].uri);
  try {
    return await f.bytes();
  } finally {
    try {
      f.delete();
    } catch {
      // Cache copy.
    }
  }
}

/**
 * "Automatic backup" folder picker. Android: SAF tree uri (permission kept across restarts). iOS: the picked URL is
 * security-scoped and lapses when the app restarts → a bookmark is stored instead (G-06, ./iosFolder.ts).
 */
export async function pickBackupFolder(): Promise<{ uri: string; label: string } | null> {
  let dir: Directory | null;
  try {
    dir = await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch {
    return null; // cancelled
  }
  if (!dir) return null;
  const label = folderLabel(dir.uri, dir.name);
  if (Platform.OS !== 'ios') return { uri: dir.uri, label };
  try {
    return { uri: folderSetting(IosFiles, dir.uri), label };
  } catch {
    // No bookmark for this folder: the plain URL works until the app restarts, then S-22 asks to choose it again.
    return { uri: dir.uri, label };
  }
}

/** The iOS bookmark port writes the backup to the cache first, then the module copies it into the folder. */
const cacheTemp: TempFiles = {
  write: (name, bytes) => writeCacheFile(name, bytes),
  remove: (uri) => {
    const f = new File(uri);
    if (f.exists) f.delete();
  },
};

/** "Evenlease" from a SAF tree uri like content://…/tree/primary%3ADocuments%2FEvenlease. */
export function folderLabel(uri: string, name?: string | null): string {
  if (name && !name.includes(';') && !name.includes('%')) return name;
  const last = decodeURIComponent(uri).split(/[/:]/).filter(Boolean).pop();
  return last ?? uri;
}

/**
 * The picked folder. Android Drive lists children by document id, so the real names come from `info().files`
 * (same order as `list()`; fact expo-native-v2-gotchas, A006 B-45).
 */
export function folderPort(uri: string): FolderPort {
  if (isBookmarkUri(uri)) return bookmarkFolderPort(IosFiles, uri, cacheTemp);
  const dir = () => {
    const d = new Directory(uri);
    if (!d.exists) throw new BackupError('folder_gone');
    return d;
  };
  const children = () => {
    const d = dir();
    const items = d.list();
    const names = d.info().files ?? [];
    const same = names.length === items.length;
    return items.flatMap((f, i) => (f instanceof File ? [{ file: f, name: same ? names[i] : f.name }] : []));
  };
  return {
    async list() {
      return children().map((c) => c.name);
    },
    async write(name, bytes) {
      // Replace, not overwrite: some providers keep the old tail when a shorter file is written over it.
      children()
        .find((c) => c.name === name)
        ?.file.delete();
      const f = dir().createFile(name, BACKUP_MIME);
      f.write(bytes);
    },
    async remove(name) {
      children()
        .find((c) => c.name === name)
        ?.file.delete();
    },
  };
}

export const isIos = Platform.OS === 'ios';
