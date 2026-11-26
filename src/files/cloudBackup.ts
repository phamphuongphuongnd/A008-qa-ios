/**
 * G-05 (product.md §10): applicant files and the database never go into iCloud / computer backups — the only backup
 * is the app's own encrypted file (S-22). Android: `allowBackup: false`. iOS: the folders below are flagged
 * "excluded from backup" (modules/ios-files), which covers everything inside them.
 * Pure (no Expo import) so it is unit-tested; the phone's port is in `cloudBackupNative.ts`.
 */
import { FILE_ROOTS } from './paths';

/** Folders under the document directory: applicant + rental files, and expo-sqlite's `SQLite/` (DB + -wal/-shm). */
export const BACKUP_EXCLUDED_ROOTS: readonly string[] = [...FILE_ROOTS, 'SQLite'];

export interface CloudBackupPort {
  /** Creates the folder (relative to the document directory) when missing and flags it "excluded from backup". */
  excludeDir(path: string): void;
}

/** First folder of a document-relative path ("applicants/3/doc-1.jpg" → "applicants"). */
export function rootOf(path: string): string {
  return path.split('/').find(Boolean) ?? '';
}

/**
 * Flags every excluded root (app start, after a restore replaced the folders). Never throws: a failure must not stop
 * the app; returns the roots that failed (for logs / tests). No port (Android, Jest) → nothing to do.
 */
export function excludeAppDataFromBackup(port: CloudBackupPort | null, roots: readonly string[] = BACKUP_EXCLUDED_ROOTS): string[] {
  if (!port) return [];
  const failed: string[] = [];
  for (const root of roots) {
    try {
      port.excludeDir(root);
    } catch {
      failed.push(root);
    }
  }
  return failed;
}

/**
 * Before a file is written under `path`: flags its root folder again — the root may have just been (re)created after
 * "Delete everything" or a restore, and a new folder is backed up by default. Cheap (one attribute write).
 */
export function excludeRootOf(port: CloudBackupPort | null, path: string): void {
  const root = rootOf(path);
  if (!port || !BACKUP_EXCLUDED_ROOTS.includes(root)) return;
  try {
    port.excludeDir(root);
  } catch {
    // Saving the file matters more; the next app start flags the folder again.
  }
}
