/**
 * expo-notifications on the phone (Jest never loads this file). Local only: no push registration.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationAdapter, PermissionState } from './adapter';
import { askExactAlarmPrompt } from './exactAlarmPrompt';
import type { ExactAlarmAdapter } from './exactAlarms';

const toState = (p: Notifications.NotificationPermissionsStatus): PermissionState =>
  p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

export const expoNotifications: NotificationAdapter = {
  async permission() {
    return toState(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    const now = await Notifications.getPermissionsAsync();
    if (now.granted || !now.canAskAgain) return toState(now);
    return toState(await Notifications.requestPermissionsAsync());
  },
  async schedule(n) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: n.channel },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async scheduledIds() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  },
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  },
};

/**
 * Android 12+ "Alarms & reminders" through expo-notifications' own API (it schedules with
 * `setExactAndAllowWhileIdle` once allowed). Rules in ./exactAlarms.
 */
export const expoExactAlarms: ExactAlarmAdapter = {
  needsPermission: () => Platform.OS === 'android' && Number(Platform.Version) >= 31,
  async granted() {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  },
  // B-151: the app's own confirm dialog (Not now left, Allow right), not the system Alert.
  explain: askExactAlarmPrompt,
  async request() {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  },
};

/** Foreground display + Android channels. Call once at start (root layout). */
export async function setupNativeNotifications(
  channelNames: { reminders: string; timers: string },
  /** true → nothing is shown while the app is open (Applicant mode: the applicant holds the phone). */
  suppress: () => boolean = () => false,
): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const show = !suppress();
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: channelNames.reminders,
    importance: AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('timers', {
    name: channelNames.timers,
    importance: AndroidImportance.HIGH,
  });
}

/** Tap on a notification → its in-app path (`data.url`). Also the tap that cold-started the app. */
export function onNotificationTap(open: (url: string) => void): () => void {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  };
  handle(Notifications.getLastNotificationResponse());
  Notifications.clearLastNotificationResponse();
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
