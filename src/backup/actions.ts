/**
 * S-22 buttons as one object per environment: `makeBackupActions(env)` — the phone's instance is `backupActions`
 * in ./index.ts, tests pass fakes. Every action updates "Last backup" and re-plans the reminders.
 */
import { getSettings, updateSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';

import { runAutoBackup, type AutoResult, type FolderPort } from './auto';
import { DEVICE_KEYS, getDeviceValue, setDeviceValue } from './deviceStore';
import { readHeader, type Rng } from './format';
import {
  buildBackup,
  openBackup,
  recordBackup,
  restoreBackup,
  setBackupPassword,
  type AppFileIO,
  type BackupDeps,
  type MadeBackup,
  type OnStep,
  type OpenedBackup,
} from './service';

export interface BackupEnv {
  db: AppDb;
  io: AppFileIO;
  rng: Rng;
  appVersion?: string | null;
  now?: () => Date;
  folder: (uri: string) => FolderPort;
  pickFolder: () => Promise<{ uri: string; label: string } | null>;
  pickFile: () => Promise<Uint8Array | null>;
  writeCache: (name: string, bytes: Uint8Array) => string;
  /** false when the phone has no share sheet. */
  share: (uri: string) => Promise<boolean>;
  /** Re-plan reminders (never throws). */
  refreshReminders: () => Promise<void>;
}

export type BackUpResult = { where: 'folder' | 'shared'; made: MadeBackup } | { where: 'not_shared' };

export function makeBackupActions(env: BackupEnv) {
  const deps = (): BackupDeps => ({ db: env.db, io: env.io, rng: env.rng, appVersion: env.appVersion, now: env.now });

  return {
    /** First backup: password typed twice (validate with `validateBackupPassword`), derived once, kept on the phone. */
    setPassword: (password: string) => setBackupPassword(env.db, password, env.rng),

    /** "Back up now": into the picked folder when there is one, else the share sheet. */
    async backUpNow(onStep?: OnStep): Promise<BackUpResult> {
      const made = await buildBackup(deps(), onStep);
      const { backupFolderUri } = getSettings(env.db);
      if (backupFolderUri) {
        await env.folder(backupFolderUri).write(made.fileName, made.bytes);
        recordBackup(env.db, made);
        await env.refreshReminders();
        return { where: 'folder', made };
      }
      const uri = env.writeCache(made.fileName, made.bytes);
      if (!(await env.share(uri))) return { where: 'not_shared' };
      recordBackup(env.db, made);
      await env.refreshReminders();
      return { where: 'shared', made };
    },

    /** "Automatic backup: Weekly" (picks the folder first when none) / "Off". Weekly runs one backup right away. */
    async setAutomatic(mode: 'off' | 'weekly'): Promise<AutoResult | 'cancelled'> {
      if (mode === 'off') {
        updateSettings(env.db, { autoBackup: 'off' });
        return 'off';
      }
      if (!getSettings(env.db).backupFolderUri) {
        const picked = await env.pickFolder();
        if (!picked) return 'cancelled';
        updateSettings(env.db, { backupFolderUri: picked.uri });
        setDeviceValue(env.db, DEVICE_KEYS.backupFolderLabel, picked.label);
      }
      updateSettings(env.db, { autoBackup: 'weekly' });
      const r = await runAutoBackup(deps(), env.folder, { force: true });
      await env.refreshReminders();
      return r;
    },

    /** "Change folder" (also the fix after "couldn't reach the folder"). */
    async changeFolder(): Promise<boolean> {
      const picked = await env.pickFolder();
      if (!picked) return false;
      updateSettings(env.db, { backupFolderUri: picked.uri });
      setDeviceValue(env.db, DEVICE_KEYS.backupFolderLabel, picked.label);
      setDeviceValue(env.db, DEVICE_KEYS.autoBackupFailedAt, null);
      return true;
    },

    folderLabel: (): string | null => getDeviceValue(env.db, DEVICE_KEYS.backupFolderLabel),

    /** Weekly backup if due (app start / background task). */
    runAutoIfDue: () => runAutoBackup(deps(), env.folder),

    /**
     * "Restore from backup" step 1: pick the file and check it is a backup this app can open (throws BackupError
     * not_backup / newer_version / corrupt before asking for the password). null = cancelled.
     */
    async pickRestoreFile(): Promise<Uint8Array | null> {
      const bytes = await env.pickFile();
      if (bytes) readHeader(bytes);
      return bytes;
    },

    /** Step 2: password → decrypted + checked, nothing changed yet (confirm shows its date and counts). */
    open: (file: Uint8Array, password: string, onStep?: OnStep): Promise<OpenedBackup> => openBackup(file, password, onStep),

    /** Step 3: "Replace". */
    async restore(opened: OpenedBackup, onStep?: OnStep): Promise<void> {
      await restoreBackup(deps(), opened, onStep);
      await env.refreshReminders();
    },
  };
}

export type BackupActions = ReturnType<typeof makeBackupActions>;
