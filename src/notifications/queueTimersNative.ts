/**
 * The phone's QueueNotifier (expo-notifications, local only). Kept tiny so Jest never loads it.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { Platform } from 'react-native';

import type { PermissionState, QueueNotifier } from './queueTimers';

const CHANNEL_ID = 'first-come-timers';
let channelReady: Promise<unknown> | null = null;

function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'First-come timers',
    importance: AndroidImportance.HIGH,
  }).catch(() => undefined);
  return channelReady;
}

function toState(p: Notifications.NotificationPermissionsStatus): PermissionState {
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export const expoQueueNotifier: QueueNotifier = {
  async schedule({ title, body, at, data }) {
    await ensureChannel();
    return Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async getPermission() {
    return toState(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    await ensureChannel();
    return toState(await Notifications.requestPermissionsAsync());
  },
};
