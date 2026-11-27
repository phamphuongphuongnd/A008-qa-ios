/**
 * After S-22 "Replace" (or anything else that swaps all data): the scheduled notifications belong to the old data.
 * Cancel them all, forget the notification ids the restored timer rows carry (they point at nothing now), schedule
 * again the First-come timers still running (`syncTimerNotifications` — also later, once notifications are allowed),
 * then re-plan the 2E reminders. Never throws.
 */
import { listActiveTimers, setTimerNotifications } from '@/db/repos/decisions';
import type { AppDb } from '@/db/types';

import type { NotificationAdapter } from './adapter';
import type { QueueNotifier } from './queueTimers';
import { syncReminders } from './reminders';
import { syncTimerNotifications } from './timerSync';

export async function rescheduleAllNotifications(db: AppDb, adapter: NotificationAdapter, queue: QueueNotifier, now: Date = new Date()): Promise<void> {
  try {
    await adapter.cancelAll();
  } catch {
    // Nothing scheduled.
  }
  try {
    for (const t of listActiveTimers(db)) if (t.notificationIds?.length) setTimerNotifications(db, t.id, []);
  } catch {
    // Best-effort.
  }
  await syncTimerNotifications(db, queue, { now: now.toISOString() });
  await syncReminders(db, adapter, now).catch(() => []);
}
