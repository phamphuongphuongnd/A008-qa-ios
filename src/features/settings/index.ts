/**
 * Settings area (S-21…S-24, S-26, S-27) for screens and the root layout. Jest imports the inner files.
 * Root layout plug-ins (TODO(merge 2E), coordinator): `useOnboarded()` gate → S-01, `useAppLockGate()` → lock screen,
 * `useThemePreference()` → 1D theme provider.
 */
import { db } from '@/db';
import { nativeRng } from '@/backup/native';
import { fileStore } from '@/files';
import { expoNotifications } from '@/notifications/native';

import * as A from './actions';
import type { AuthCapability } from './lock';
import { lockStore } from './lockController';
import { deleteEverything, deleteNotSelected } from './dataCleanup';
import type { LandlordContact } from './summary';

export * from './hooks';
export * from './summary';
export { cleanupRows, cleanupConfirmTitle, isDeleteConfirmed } from './dataCleanup';
export { LOCK_AFTER_OPTIONS, PIN_PATTERN, landlordUnlockMethod, type AuthCapability, type LockAfter } from './lock';
export { lockStore, unlockLandlord, unlockWithPin, withLockSuspended } from './lockController';
export { expoAuthAdapter } from './lockNative';
export { CLEANUP_OPTIONS } from './actions';

export const settingsActions = {
  saveContact: (c: LandlordContact) => A.saveContact(db, c),
  setAppLock: (on: boolean, cap: AuthCapability) => A.setAppLock(db, on, cap),
  setAppPin: (pin: string, confirm: string, enableLock = false) => A.setAppPin(db, pin, confirm, nativeRng, { enableLock }),
  setReminders: (r: Parameters<typeof A.setReminders>[2]) => A.setReminders(db, expoNotifications, r),
  setCleanupAfter: (d: A.CleanupAfter) => A.setCleanupAfter(db, expoNotifications, d),
  /** S-24 "Delete their data". */
  deleteNotSelected: (rentalId: number) => deleteNotSelected(db, fileStore, rentalId, { notifications: expoNotifications }),
  /** S-27: then `router.replace(routes.onboarding())`. */
  async deleteAll() {
    await deleteEverything(db, fileStore, expoNotifications);
    lockStore.dispatch({ type: 'disabled' });
  },
};
