/**
 * Backup on the phone: the S-22 actions bound to expo modules, plus hooks for S-22 and the S-02 banner.
 * Jest imports the inner files (format, pack, service, auto, actions) directly.
 */
import Constants from 'expo-constants';

import { db, useLive } from '@/db';
import { getSettings } from '@/db/repos/settings';
import { excludeAppDataFromBackup } from '@/files/cloudBackup';
import { cloudBackupPort } from '@/files/cloudBackupNative';
import { t } from '@/i18n';
import { expoNotifications, firstDataAt, refreshReminders } from '@/notifications';
import { rescheduleAllNotifications } from '@/notifications/afterRestore';
import { expoQueueNotifier } from '@/notifications/queueTimersNative';

import { EvenleaseCrypto } from '../../modules/evenlease-crypto';
import { makeBackupActions } from './actions';
import { autoBackupFailedAt, backupReminder, backupSnoozedUntil, snoozeBackupReminder, type BackupReminder } from './auto';
import { clearBackupCache, expoAppFileIO, folderPort, nativeRng, pickBackupFile, pickBackupFolder, shareBackupFile, writeCacheFile } from './native';
import { installPbkdf2, makePbkdf2 } from './kdf';
import { hasBackupPassword, lastBackupInfo } from './service';

// B-101: PBKDF2 in native code when the module is in this build and passes its self-check, else JS.
installPbkdf2(makePbkdf2(EvenleaseCrypto));

export const backupActions = makeBackupActions({
  db,
  io: expoAppFileIO,
  rng: nativeRng,
  appVersion: Constants.expoConfig?.version ?? null,
  folder: folderPort,
  pickFolder: pickBackupFolder,
  pickFile: pickBackupFile,
  writeCache: (name, bytes) => {
    clearBackupCache();
    return writeCacheFile(name, bytes);
  },
  share: (uri) => shareBackupFile(uri, t('system:s22.backUpNow')),
  refreshReminders,
  afterRestore: () => {
    // G-05 (iOS): the restored applicants/ and rentals/ folders are new folders — flag them again.
    excludeAppDataFromBackup(cloudBackupPort);
    return rescheduleAllNotifications(db, expoNotifications, expoQueueNotifier);
  },
});

export { backupErrorText, autoBackupDue, AUTO_KEEP, REMIND_AFTER_DAYS } from './auto';
export { BackupError, validateBackupPassword, MIN_PASSWORD_LENGTH, BACKUP_KDF } from './format';
export { formatBytes, type MadeBackup, type OpenedBackup, type BackupStep } from './service';

export interface BackupStatus {
  hasPassword: boolean;
  last: { at: string; bytes: number | null } | null;
  autoBackup: 'off' | 'weekly';
  folderLabel: string | null;
  /** Last automatic backup failed (show "choose the folder again"). */
  autoFailedAt: string | null;
}

/** S-22 state. */
export function useBackupStatus(): BackupStatus {
  'use no memo';
  return useLive(
    () => {
      const s = getSettings(db);
      return {
        hasPassword: hasBackupPassword(db),
        last: lastBackupInfo(db),
        autoBackup: s.autoBackup,
        folderLabel: s.backupFolderUri ? backupActions.folderLabel() : null,
        autoFailedAt: autoBackupFailedAt(db),
      };
    },
    [],
    ['settings'],
  );
}

/** S-02 banner "Back up your data — last backup 34 days ago" [Back up] [Later] (2A renders it). */
export function useBackupReminder(now: Date = new Date()): BackupReminder & { later: () => void } {
  'use no memo';
  const r = useLive(() => backupReminder(getSettings(db), firstDataAt(db), backupSnoozedUntil(db), now), [now.toDateString()], [
    'settings',
    'rentals',
  ]);
  return { ...r, later: () => snoozeBackupReminder(db) };
}
