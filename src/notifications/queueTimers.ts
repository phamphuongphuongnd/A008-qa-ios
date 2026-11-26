/**
 * First-come timer notifications (product.md §3.14, §6): "Jordan Ellis — 2 hours left to provide missing info",
 * "Offer to Jordan Ellis expires in 2 hours", and one when the clock ends. Tap → S-18 Order queue (`data.url`).
 *
 * Pure scheduling logic over a tiny adapter (`QueueNotifier`) so Jest never loads expo-notifications; the phone's
 * adapter is `expoQueueNotifier` in ./queueTimersNative. The engine decides what to send and when
 * (`timerNotifications`, which never reads the clock); this file only schedules / cancels.
 *
 * The app-wide tap handler (open `data.url`) belongs to 2E's notification setup — TODO(merge 2E).
 */
import { timerNotifications, type Timer } from '@/engine';
import { routes } from '@/routes';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface QueueNotifier {
  /** Schedule a local notification at `at`; returns its id. */
  schedule(n: { title: string; body: string; at: Date; data: { url: string; key: string } }): Promise<string>;
  cancel(id: string): Promise<void>;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
}

/** Body line under the §6 title (no applicant data beyond the name already in the title). */
export const TIMER_NOTIFICATION_BODY = 'Open the order queue to decide what happens next.';

/**
 * Schedule the 2-hours-left + ended notifications still in the future for one running timer.
 * Returns the ids to store on the timer row (`setTimerNotifications`). Scheduling errors are swallowed per item —
 * a missing reminder must never block saving a decision — but the ids of those that worked are kept.
 */
export async function scheduleTimerNotifications(
  notifier: QueueNotifier,
  input: { timer: Timer; applicant: { id: string; fullName: string }; rentalId: number | string; now: string },
): Promise<string[]> {
  const items = timerNotifications(input.timer, input.applicant, input.now);
  const url = String(routes.orderQueue(input.rentalId));
  const ids: string[] = [];
  for (const n of items) {
    try {
      ids.push(await notifier.schedule({ title: n.title, body: TIMER_NOTIFICATION_BODY, at: new Date(n.at), data: { url, key: n.key } }));
    } catch {
      // Permission denied / OS limit: the clock still shows in the app.
    }
  }
  return ids;
}

export async function cancelTimerNotifications(notifier: QueueNotifier, ids: readonly string[] | null | undefined): Promise<void> {
  for (const id of ids ?? []) {
    try {
      await notifier.cancel(id);
    } catch {
      // Already delivered or gone.
    }
  }
}

/**
 * Cancel the notifications of timer rows that were stopped elsewhere (e.g. 2A switching a rental to Compare returns
 * `stoppedTimers`). Takes the DB rows (`notificationIds`); never throws.
 */
export async function cancelStoppedTimers(
  notifier: QueueNotifier,
  timers: readonly { notificationIds?: readonly string[] | null }[],
): Promise<void> {
  for (const t of timers) await cancelTimerNotifications(notifier, t.notificationIds);
}

/**
 * Ask for notification permission once (§6: "Hỏi quyền thông báo lần đầu khi bật First-come mode"). Call when the
 * landlord turns First-come on (S-03, 2A) and before starting a timer. `asked` / `markAsked` read and write
 * `settings.notificationsAsked`. Never asks again after the first time; returns the current state.
 */
export async function ensureTimerPermission(
  notifier: QueueNotifier,
  settings: { asked: boolean; markAsked: () => void },
): Promise<PermissionState> {
  const current = await notifier.getPermission();
  if (current !== 'undetermined' || settings.asked) return current;
  settings.markAsked();
  return notifier.requestPermission();
}
