/**
 * Keeps the scheduled First-come notifications in step with the running clocks (product.md §3.14, §6).
 *
 * A clock can start while notifications are off (permission denied / not asked yet, or Settings › Reminders › timers
 * off). Its row then has no `notificationIds`, and nothing would ever fire even after the landlord turns notifications
 * on (B-58). `syncTimerNotifications` fixes that: every running clock without scheduled notifications gets them, and
 * when notifications are off the stale ones are cancelled so they are scheduled afresh once allowed again.
 * Called at start, when the app comes back to the foreground, when S-18 opens, after a clock starts, after a restore,
 * when a closed rental is reopened, and (with `force`) when Applicant mode turns on / off: while the applicant holds
 * the phone the notifications carry no applicant name (B-60, S-08a "tắt thông báo").
 *
 * Calls are serialised (one at a time per process) so a foreground sync and a clock that just started never schedule
 * the same reminders twice. Never throws.
 */
import { getApplicant } from '@/db/repos/applicants';
import { listActiveTimers, setTimerNotifications } from '@/db/repos/decisions';
import { getSettings } from '@/db/repos/settings';
import { toEngineTimers } from '@/db/toEngine';
import type { AppDb, Timer as TimerRow } from '@/db/types';

import { cancelTimerNotifications, scheduleTimerNotifications, type QueueNotifier } from './queueTimers';

export interface TimerSyncOptions {
  /** ISO instant (default: now). */
  now?: string;
  /** Cancel and schedule again every running clock (Applicant mode switched, data restored). */
  force?: boolean;
  /** Only these timer rows (default: all running clocks). */
  timerIds?: readonly number[];
}

export interface TimerSyncResult {
  /** Clocks whose notifications were (re)scheduled. */
  scheduled: number;
  /** Clocks whose notifications were cancelled because notifications are off. */
  cleared: number;
}

let chain: Promise<unknown> = Promise.resolve();

/** Runs `job` after every sync already queued (in-process mutex). */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}

async function clearRow(db: AppDb, notifier: QueueNotifier, t: TimerRow) {
  await cancelTimerNotifications(notifier, t.notificationIds);
  setTimerNotifications(db, t.id, []);
}

export function syncTimerNotifications(db: AppDb, notifier: QueueNotifier, opts: TimerSyncOptions = {}): Promise<TimerSyncResult> {
  return serial(async () => {
    const result: TimerSyncResult = { scheduled: 0, cleared: 0 };
    try {
      const now = opts.now ?? new Date().toISOString();
      const only = opts.timerIds ? new Set(opts.timerIds) : null;
      const rows = listActiveTimers(db).filter((t) => !only || only.has(t.id));
      if (!rows.length) return result;
      const on = getSettings(db).reminders.timers && (await notifier.getPermission()) === 'granted';
      const anonymous = notifier.isPrivate?.() ?? false;
      for (const t of rows) {
        const has = (t.notificationIds?.length ?? 0) > 0;
        if (!on) {
          if (has) {
            await clearRow(db, notifier, t);
            result.cleared += 1;
          }
          continue;
        }
        if (has && !opts.force) continue;
        const a = getApplicant(db, t.applicantId);
        if (!a || a.deletedAt) continue;
        if (has) await cancelTimerNotifications(notifier, t.notificationIds);
        const ids = await scheduleTimerNotifications(notifier, {
          timer: toEngineTimers([t])[0],
          applicant: { id: String(a.id), fullName: a.fullName },
          rentalId: a.rentalId,
          now,
          anonymous,
        });
        setTimerNotifications(db, t.id, ids);
        result.scheduled += 1;
      }
    } catch {
      // Reminders are best-effort: the clocks always show in the app.
    }
    return result;
  });
}
