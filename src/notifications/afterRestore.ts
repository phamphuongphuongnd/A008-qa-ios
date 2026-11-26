/**
 * After S-22 "Replace" (or anything else that swaps all data): the scheduled notifications belong to the old data.
 * Cancel them all, schedule again the First-come timers still running (2D's `scheduleTimerNotifications`, ids saved
 * on the timer rows), then re-plan the 2E reminders. Never throws.
 */
import { getApplicant } from '@/db/repos/applicants';
import { listActiveTimers, setTimerNotifications } from '@/db/repos/decisions';
import { toEngineTimers } from '@/db/toEngine';
import type { AppDb } from '@/db/types';

import type { NotificationAdapter } from './adapter';
import { scheduleTimerNotifications, type QueueNotifier } from './queueTimers';
import { syncReminders } from './reminders';

export async function rescheduleAllNotifications(db: AppDb, adapter: NotificationAdapter, queue: QueueNotifier, now: Date = new Date()): Promise<void> {
  try {
    await adapter.cancelAll();
  } catch {
    // Nothing scheduled.
  }
  if ((await adapter.permission().catch(() => 'denied')) !== 'granted') return;
  for (const t of listActiveTimers(db)) {
    const a = getApplicant(db, t.applicantId);
    if (!a || a.deletedAt) continue;
    const ids = await scheduleTimerNotifications(queue, {
      timer: toEngineTimers([t])[0],
      applicant: { id: String(a.id), fullName: a.fullName },
      rentalId: a.rentalId,
      now: now.toISOString(),
    });
    setTimerNotifications(db, t.id, ids);
  }
  await syncReminders(db, adapter, now).catch(() => []);
}
