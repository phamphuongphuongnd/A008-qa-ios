import type { ModeState } from '@/features/intake/applicantMode/machine';

import { settings } from '../schema';
import type { AppDb } from '../types';

export interface AppSettings {
  /** S-01 finished (Start / sample). */
  onboarded: boolean;
  /** S-01 "Not legal advice" accepted (timestamp). */
  legalAcceptedAt: string | null;
  /** S-21 Appearance. */
  theme: 'system' | 'light' | 'dark';
  /** Printed on letters (S-16). */
  landlordName: string;
  landlordAddress: string;
  landlordPhone: string;
  /** S-23 App lock: require biometrics / device PIN to open; also guards leaving applicant mode. */
  appLock: boolean;
  lockAfter: 'immediately' | '1min' | '5min';
  /** Set when the phone has no lock: hash of the app PIN (salted, never the PIN). */
  appPinHash: string | null;
  /** S-22. */
  lastBackupAt: string | null;
  lastBackupBytes: number | null;
  autoBackup: 'off' | 'weekly';
  backupFolderUri: string | null;
  /** S-24: remind N days after a rental closes (null = Off). */
  cleanupAfterDays: 30 | 60 | 90 | 180 | null;
  /** S-21 Reminders. */
  reminders: { backup: boolean; cleanup: boolean; timers: boolean };
  /** The notification permission was asked once (first-come on / reminder on). */
  notificationsAsked: boolean;
  /** S-08a: the Applicant mode session that is on (survives an app restart), null when off. */
  applicantMode: ModeState | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  legalAcceptedAt: null,
  theme: 'system',
  landlordName: '',
  landlordAddress: '',
  landlordPhone: '',
  appLock: false,
  lockAfter: 'immediately',
  appPinHash: null,
  lastBackupAt: null,
  lastBackupBytes: null,
  autoBackup: 'off',
  backupFolderUri: null,
  cleanupAfterDays: 60,
  reminders: { backup: true, cleanup: true, timers: true },
  notificationsAsked: false,
  applicantMode: null,
};

type Key = keyof AppSettings;

/** All settings, defaults filled in for keys never written (and for a value that fails to parse). */
export function getSettings(db: AppDb): AppSettings {
  const out: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const row of db.select().from(settings).all()) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      (out as unknown as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {
      // Keep the default.
    }
  }
  return out;
}

export function getSetting<K extends Key>(db: AppDb, key: K): AppSettings[K] {
  return getSettings(db)[key];
}

/** Writes only the keys given (whole value per key: pass the full `reminders` object). */
export function updateSettings(db: AppDb, patch: Partial<AppSettings>): void {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      tx.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
    }
  });
}
