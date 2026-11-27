/**
 * Local notifications. 2E: reminders (backup, data cleanup), permission, channels, tap routing. 2D: queueTimers*.
 * Root layout plug-in (app/_layout.tsx): `useNotificationSetup()` once inside the root layout.
 */
import type { Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { db, useLive } from '@/db';
import { getSettings } from '@/db/repos/settings';
import { isApplicantModeActive, subscribeApplicantMode } from '@/features/intake/applicantMode/store';
import { t } from '@/i18n';
import { router } from '@/services/router';

import { expoNotifications, onNotificationTap, setupNativeNotifications } from './native';
import { expoQueueNotifier } from './queueTimersNative';
import { ensureNotificationPermission, syncReminders } from './reminders';
import { syncTimerNotifications } from './timerSync';

export * from './adapter';
export { planReminders, syncReminders, ensureNotificationPermission, REMINDER_IDS, firstDataAt } from './reminders';
export { expoNotifications } from './native';

/**
 * First-come clocks → scheduled notifications (B-58: a clock started while notifications were off gets them once
 * they are allowed). `force` re-schedules every clock (Applicant mode switched: names hidden / shown again, B-60).
 */
export function syncTimers(force = false): Promise<void> {
  return syncTimerNotifications(db, expoQueueNotifier, { force }).then(() => undefined);
}

/**
 * Channels + foreground display + tap → screen; refreshes the reminders and the First-come clock notifications at
 * start and every time the app comes back to the foreground (the landlord may have allowed notifications in the
 * system settings meanwhile — B-58), and re-schedules the clocks when Applicant mode turns on / off (B-60).
 */
export function useNotificationSetup(): void {
  'use no memo';
  const timersOn = useLive(() => getSettings(db).reminders.timers, [], ['settings']);
  useEffect(() => {
    setupNativeNotifications(
      { reminders: t('system:notifications.channelReminders'), timers: t('system:notifications.channelTimers') },
      isApplicantModeActive,
    )
      .then(() => syncReminders(db, expoNotifications))
      .catch(() => {});
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void syncTimers();
      void refreshReminders();
    });
    let privateMode = isApplicantModeActive();
    const unsubscribeMode = subscribeApplicantMode(() => {
      const now = isApplicantModeActive();
      if (now === privateMode) return;
      privateMode = now;
      void syncTimers(true);
    });
    // Reminders (2E) and First-come timers (2D, route S-18) both carry `data.url`. Never while the applicant holds the phone.
    const unsubscribeTap = onNotificationTap((url) => {
      if (!isApplicantModeActive()) router.push(url as Href);
    });
    return () => {
      app.remove();
      unsubscribeMode();
      unsubscribeTap();
    };
  }, []);
  // At start (with the Applicant mode of the restored session) and when Settings › Reminders › timers is switched.
  useEffect(() => {
    void syncTimers(true);
  }, [timersOn]);
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
