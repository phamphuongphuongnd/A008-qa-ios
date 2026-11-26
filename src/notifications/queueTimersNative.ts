/**
 * The phone's QueueNotifier (expo-notifications, local only). Kept tiny so Jest never loads it.
 *
 * 2E owns the permission prompt and the Android channels (`setupNativeNotifications`, `askNotificationPermission`):
 * timers go to 2E's 'timers' channel and the "ask once" rule lives in `askNotificationPermission()`.
 */
import * as Notifications from 'expo-notifications';

import { askNotificationPermission } from './index';
import { CHANNELS } from './adapter';
import { expoNotifications } from './native';
import type { PermissionState, QueueNotifier } from './queueTimers';

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
    if (await askNotificationPermission()) return 'granted';
    return expoNotifications.permission();
  },
};
