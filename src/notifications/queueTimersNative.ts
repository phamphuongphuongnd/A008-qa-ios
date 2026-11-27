/**
 * The phone's QueueNotifier (expo-notifications, local only). Kept tiny so Jest never loads it.
 *
 * 2E owns the permission prompt and the Android channels (`setupNativeNotifications`, `askNotificationPermission`):
 * timers go to 2E's 'timers' channel and the "ask once" rule lives in `askNotificationPermission()`.
 */
import * as Notifications from 'expo-notifications';

import { db } from '@/db';
import { isApplicantModeActive } from '@/features/intake/applicantMode/store';

import { CHANNELS } from './adapter';
import { ensureExactAlarmPermission, exactAlarmsOn } from './exactAlarms';
import { expoExactAlarms, expoNotifications } from './native';
import type { PermissionState, QueueNotifier } from './queueTimers';
import { ensureNotificationPermission } from './reminders';

export const expoQueueNotifier: QueueNotifier = {
  async schedule({ title, body, at, data }) {
    return Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNELS.timers },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  getPermission(): Promise<PermissionState> {
    return expoNotifications.permission();
  },
  async requestPermission(): Promise<PermissionState> {
    // Same as askNotificationPermission() in ./index (ask at most once), without importing index (cycle).
    if (await ensureNotificationPermission(db, expoNotifications).catch(() => false)) return 'granted';
    return expoNotifications.permission();
  },
  isPrivate: isApplicantModeActive,
  exactAlarms: () => exactAlarmsOn(expoExactAlarms),
  ensureExactAlarms: () => ensureExactAlarmPermission(db, expoExactAlarms),
};
