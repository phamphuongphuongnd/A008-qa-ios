/**
 * First-come timer notifications (product.md §3.14, §6): "Jordan Ellis — 2 hours left to provide missing info",
 * "Offer to Jordan Ellis expires in 2 hours", and one when the clock ends. Tap → S-18 Order queue (`data.url`).
 *
 * Pure scheduling logic over a tiny adapter (`QueueNotifier`) so Jest never loads expo-notifications; the phone's
 * adapter is `expoQueueNotifier` in ./queueTimersNative. The engine decides what to send and when
 * (`timerNotifications`, which never reads the clock); this file only schedules / cancels.
 *
 * The app-wide tap handler (open `data.url`), the Android 'timers' channel and the permission prompt are 2E's.
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
  /**
   * true while someone other than the landlord may see the phone (Applicant mode): notifications then carry no
   * applicant name (B-60). The phone's adapter reads the Applicant mode store; absent = false.
   */
  isPrivate?(): boolean;
  /**
   * Reminders fire on time (Android exact alarms allowed, or not needed). false → worded "about 2 hours" (Android may
   * deliver them up to ~1 h late). Absent = on time.
   */
  exactAlarms?(): Promise<boolean>;
  /** Ask once for exact alarms (./exactAlarms); resolves with exactAlarms(). Absent = nothing to ask. */
  ensureExactAlarms?(): Promise<boolean>;
}

/** Body line under the §6 title (no applicant data beyond the name already in the title). */
export const TIMER_NOTIFICATION_BODY = 'Open the order queue to decide what happens next.';

/** Titles without the applicant's name, used while Applicant mode is on (S-08a: the applicant holds the phone). */
export const PRIVATE_TIMER_TITLES = {
  two_hours_left: 'A first-come clock has 2 hours left',
  expired: 'A first-come clock has run out',
} as const;

/** "2 hours" → "about 2 hours" when the alarm may come late (no exact alarms). Only the 2-hours-left reminder. */
export function approximateTitle(title: string): string {
  return title.replace(/\b2 hours\b/, 'about 2 hours');
}

/** Title of a timer notification for the current privacy / alarm precision. */
export function timerTitle(n: { type: 'two_hours_left' | 'expired'; title: string }, opts: { anonymous?: boolean; approximate?: boolean }): string {
  const base = opts.anonymous ? PRIVATE_TIMER_TITLES[n.type] : n.title;
  return opts.approximate && n.type === 'two_hours_left' ? approximateTitle(base) : base;
}

/**
 * Schedule the 2-hours-left + ended notifications still in the future for one running timer.
 * Returns the ids to store on the timer row (`setTimerNotifications`). Scheduling errors are swallowed per item —
 * a missing reminder must never block saving a decision — but the ids of those that worked are kept.
 */
export async function scheduleTimerNotifications(
  notifier: QueueNotifier,
  input: {
    timer: Timer;
    applicant: { id: string; fullName: string };
    rentalId: number | string;
    now: string;
    /** No applicant name in the title (Applicant mode on, B-60). */
    anonymous?: boolean;
    /** Alarms may come late (no exact alarms): "about 2 hours left". */
    approximate?: boolean;
  },
): Promise<string[]> {
  const items = timerNotifications(input.timer, input.applicant, input.now);
  const url = String(routes.orderQueue(input.rentalId));
  const ids: string[] = [];
  for (const n of items) {
    const title = timerTitle(n, input);
    try {
      ids.push(await notifier.schedule({ title, body: TIMER_NOTIFICATION_BODY, at: new Date(n.at), data: { url, key: n.key } }));
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
 * Permission before scheduling a timer's notifications. The "ask only the first time" rule (§6: first time First-come
 * mode is turned on) belongs to 2E: the phone's `requestPermission` is `askNotificationPermission()`, which prompts at
 * most once and remembers it in `settings.notificationsAsked`. Returns the state after asking.
 */
export async function ensureTimerPermission(notifier: QueueNotifier): Promise<PermissionState> {
  const current = await notifier.getPermission();
  if (current !== 'undetermined') return current;
  return notifier.requestPermission();
}
