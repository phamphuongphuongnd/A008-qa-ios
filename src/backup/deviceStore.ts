/**
 * Values that belong to this phone, not to the landlord's data: they never go into a backup file, and a restore keeps
 * the phone's own. Stored as extra rows of the settings table under "device.*" (1C's `getSettings` ignores them).
 */
import { eq, like } from 'drizzle-orm';

import type { AppSettings } from '@/db/repos/settings';
import { settings } from '@/db/schema';
import type { AppDb } from '@/db/types';

export const DEVICE_PREFIX = 'device.';

export const DEVICE_KEYS = {
  /** Key derived from the backup password (format.ts `keyToJson`) — lets weekly backups run without asking. */
  backupKey: 'device.backupKey',
  /** S-02 backup banner "Later" (ISO time until which it stays hidden). */
  backupSnoozedUntil: 'device.backupSnoozedUntil',
  /** Last automatic backup failure (ISO) — S-22 shows "couldn't reach the folder"; cleared by a good backup. */
  autoBackupFailedAt: 'device.autoBackupFailedAt',
  /** Shown name of the picked backup folder ("Evenlease" in Google Drive). */
  backupFolderLabel: 'device.backupFolderLabel',
} as const;
export type DeviceKey = (typeof DEVICE_KEYS)[keyof typeof DEVICE_KEYS];

/** AppSettings keys tied to this phone (folder permission, lock, onboarding, last backup) — not carried in backups. */
export const DEVICE_LOCAL_SETTINGS: readonly (keyof AppSettings)[] = [
  'onboarded',
  'legalAcceptedAt',
  'appLock',
  'lockAfter',
  'appPinHash',
  'lastBackupAt',
  'lastBackupBytes',
  'autoBackup',
  'backupFolderUri',
  'notificationsAsked',
  'exactAlarmsAsked',
];

export const isDeviceRow = (key: string) => key.startsWith(DEVICE_PREFIX) || (DEVICE_LOCAL_SETTINGS as readonly string[]).includes(key);

export function getDeviceValue(db: AppDb, key: DeviceKey): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

/** null deletes the row. */
export function setDeviceValue(db: AppDb, key: DeviceKey, value: string | null): void {
  if (value == null) {
    db.delete(settings).where(eq(settings.key, key)).run();
    return;
  }
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

/** Every device.* row (restore keeps them). */
export function deviceRows(db: AppDb): { key: string; value: string }[] {
  return db.select().from(settings).where(like(settings.key, `${DEVICE_PREFIX}%`)).all();
}
