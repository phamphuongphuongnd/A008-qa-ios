/**
 * Local notifications. 2E: reminders (backup, data cleanup), permission, channels, tap routing. 2D: queueTimers*.
 * Root layout plug-in (TODO(merge 2E), coordinator): `useNotificationSetup()` once inside the root layout.
 */
import type { Href } from 'expo-router';
import { useEffect } from 'react';

import { db } from '@/db';
import { isApplicantModeActive } from '@/features/intake/applicantMode/store';
import { t } from '@/i18n';
import { router } from '@/services/router';

import { expoNotifications, onNotificationTap, setupNativeNotifications } from './native';
import { ensureNotificationPermission, syncReminders } from './reminders';

export * from './adapter';
export { planReminders, syncReminders, ensureNotificationPermission, REMINDER_IDS, firstDataAt } from './reminders';
export { expoNotifications } from './native';

/** Channels + foreground display + tap → screen; refreshes the reminders at start. */
export function useNotificationSetup(): void {
  useEffect(() => {
    setupNativeNotifications(
      { reminders: t('system:notifications.channelReminders'), timers: t('system:notifications.channelTimers') },
      isApplicantModeActive,
    )
      .then(() => syncReminders(db, expoNotifications))
      .catch(() => {});
    // Reminders (2E) and First-come timers (2D, route S-18) both carry `data.url`. Never while the applicant holds the phone.
    return onNotificationTap((url) => {
      if (!isApplicantModeActive()) router.push(url as Href);
    });
  }, []);
}

/** Re-plan the 2E reminders now (after a backup, a rental closing, cleanup, settings change). Never throws. */
export function refreshReminders(): Promise<void> {
  return syncReminders(db, expoNotifications).then(
    () => undefined,
    () => undefined,
  );
}

/** Permission prompt at most once (2D: First-come turned on; 2E: a reminder turned on). */
export function askNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermission(db, expoNotifications).catch(() => false);
}
