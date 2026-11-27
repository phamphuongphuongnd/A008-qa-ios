/**
 * S-21 / S-23 / S-24 setting changes with their side effects (permission prompt, reminder re-plan, PIN hash).
 * Take the database + adapters so Jest runs them; screens use the bound versions in ./index.ts.
 */
import { getSettings, updateSettings, type AppSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';
import type { Rng } from '@/backup/format';
import type { NotificationAdapter } from '@/notifications/adapter';
import { ensureNotificationPermission, syncReminders } from '@/notifications/reminders';

import { canEnableLock, hashPin, validateNewPin, type AuthCapability, type PinError } from './lock';
import { normalizeContact, validateContact, type ContactErrors, type LandlordContact } from './summary';

export type CleanupAfter = AppSettings['cleanupAfterDays'];
export const CLEANUP_OPTIONS: readonly CleanupAfter[] = [30, 60, 90, 180, null];

/** S-21 "Your name" / "Mailing address & phone": errors, or saved (normalized). */
export function saveContact(db: AppDb, c: LandlordContact): ContactErrors {
  const errors = validateContact(c);
  if (Object.keys(errors).length === 0) updateSettings(db, normalizeContact(c));
  return errors;
}

/**
 * S-23 switch. On: needs a way to unlock — 'needs_pin' tells the screen to ask for a PIN first (phone without
 * biometrics or passcode). Off: also forgets the app PIN.
 */
export function setAppLock(db: AppDb, on: boolean, cap: AuthCapability): 'ok' | 'needs_pin' {
  if (!on) {
    updateSettings(db, { appLock: false, appPinHash: null });
    return 'ok';
  }
  if (!canEnableLock(cap, getSettings(db))) return 'needs_pin';
  updateSettings(db, { appLock: true });
  return 'ok';
}

/** S-23 PIN (phones with no system lock; also guards leaving Applicant mode). Saves only the salted hash. */
export async function setAppPin(db: AppDb, pin: string, confirm: string, rng: Rng, opts: { enableLock?: boolean } = {}): Promise<PinError | null> {
  const err = validateNewPin(pin, confirm);
  if (err) return err;
  const appPinHash = await hashPin(pin, rng(16)); // B-105: async, off the JS thread when native
  updateSettings(db, { appPinHash, ...(opts.enableLock ? { appLock: true } : {}) });
  return null;
}

/**
 * S-21 Reminders. Turning one on asks for notification permission (once ever). Returns whether notifications may
 * show (false → the screen explains how to allow them in system settings).
 */
export async function setReminders(db: AppDb, n: NotificationAdapter, reminders: AppSettings['reminders'], now?: Date): Promise<boolean> {
  const before = getSettings(db).reminders;
  updateSettings(db, { reminders });
  const turnedOn = (Object.keys(reminders) as (keyof typeof reminders)[]).some((k) => reminders[k] && !before[k]);
  const allowed = turnedOn ? await ensureNotificationPermission(db, n) : (await n.permission()) === 'granted';
  await syncReminders(db, n, now);
  return allowed;
}

/** S-24 "Remind me after a rental closes": 30 / 60 / 90 / 180 days / Off. */
export async function setCleanupAfter(db: AppDb, n: NotificationAdapter, days: CleanupAfter, now?: Date): Promise<void> {
  updateSettings(db, { cleanupAfterDays: days });
  await syncReminders(db, n, now);
}
