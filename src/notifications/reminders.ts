/**
 * product.md §6 reminders owned by 2E: "Time to back up — last backup 31 days ago." (→ S-22) and
 * "2 closed rentals still hold applicant data." (→ S-24). Planned as pure data, then synced to the phone: call
 * `syncReminders` at start, after a backup / restore, after a rental closes or its data is deleted, after the
 * Reminders / cleanup settings change, and from the background task.
 * Once due, a reminder repeats weekly at 10:00 until the landlord acts. First-come timers are 2D's (queueTimers*).
 */
import { asc, eq } from 'drizzle-orm';

import { listCleanupCandidates } from '@/db/repos/rentals';
import { getSettings, updateSettings, type AppSettings } from '@/db/repos/settings';
import { rentals } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { t } from '@/i18n';
import { routes } from '@/routes';

import { CHANNELS, type LocalNotification, type NotificationAdapter } from './adapter';

const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_REMIND_DAYS = 31;
export const REPEAT_DAYS = 7;
export const REMIND_HOUR = 10;
export const REMINDER_IDS = { backup: 'reminder-backup', cleanup: 'reminder-cleanup' } as const;

export interface ReminderInput {
  settings: Pick<AppSettings, 'reminders' | 'lastBackupAt' | 'cleanupAfterDays'>;
  /** Creation time of the first real (non-sample) rental: "never backed up" counts from there. */
  firstDataAt: string | null;
  /** Closed real rentals still holding not-selected applicants' data. */
  closedWithData: { closedAt: string }[];
}

/** Same day at 10:00 local. */
function atHour(d: Date): Date {
  const x = new Date(d);
  x.setHours(REMIND_HOUR, 0, 0, 0);
  return x;
}

/** Calendar days between two times in the phone's zone. */
function calendarDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

/** `due` if still ahead, else the next weekly repeat after `now`. */
function nextFire(due: Date, now: Date): Date {
  if (due.getTime() > now.getTime()) return due;
  const steps = Math.floor((now.getTime() - due.getTime()) / (REPEAT_DAYS * DAY_MS)) + 1;
  return new Date(due.getTime() + steps * REPEAT_DAYS * DAY_MS);
}

export function planReminders(input: ReminderInput, now: Date): LocalNotification[] {
  const out: LocalNotification[] = [];
  const s = input.settings;

  const base = s.lastBackupAt ?? input.firstDataAt;
  if (s.reminders.backup && base) {
    const at = nextFire(atHour(new Date(new Date(base).getTime() + BACKUP_REMIND_DAYS * DAY_MS)), now);
    const days = calendarDays(new Date(base), at);
    out.push({
      id: REMINDER_IDS.backup,
      title: t('system:notifications.backupTitle'),
      body: s.lastBackupAt ? t('system:notifications.backupBody', { count: days }) : t('system:notifications.backupNeverBody'),
      at,
      channel: CHANNELS.reminders,
      url: routes.backup() as string,
    });
  }

  if (s.reminders.cleanup && s.cleanupAfterDays != null && input.closedWithData.length) {
    const dues = input.closedWithData.map((r) => atHour(new Date(new Date(r.closedAt).getTime() + s.cleanupAfterDays! * DAY_MS)));
    const at = new Date(Math.min(...dues.map((d) => nextFire(d, now).getTime())));
    const count = dues.filter((d) => d.getTime() <= at.getTime()).length;
    out.push({
      id: REMINDER_IDS.cleanup,
      title: t('system:notifications.cleanupTitle'),
      body: t('system:notifications.cleanupBody', { count }),
      at,
      channel: CHANNELS.reminders,
      url: routes.dataCleanup() as string,
    });
  }
  return out;
}

/** First real rental's creation time. */
export function firstDataAt(db: AppDb): string | null {
  return (
    db
      .select({ at: rentals.createdAt })
      .from(rentals)
      .where(eq(rentals.isSample, false))
      .orderBy(asc(rentals.createdAt))
      .get()?.at ?? null
  );
}

export function reminderInput(db: AppDb): ReminderInput {
  return {
    settings: getSettings(db),
    firstDataAt: firstDataAt(db),
    closedWithData: listCleanupCandidates(db).flatMap((c) => (c.rental.closedAt ? [{ closedAt: c.rental.closedAt }] : [])),
  };
}

/** Replaces the scheduled 2E reminders with the current plan. Never prompts for permission. */
export async function syncReminders(db: AppDb, adapter: NotificationAdapter, now: Date = new Date()): Promise<LocalNotification[]> {
  const plan = planReminders(reminderInput(db), now);
  if ((await adapter.permission()) !== 'granted') return plan;
  const planned = new Set(plan.map((n) => n.id));
  for (const id of Object.values(REMINDER_IDS)) if (!planned.has(id)) await adapter.cancel(id);
  for (const n of plan) await adapter.schedule(n);
  return plan;
}

/**
 * The permission prompt, at most once (product.md §6: first time First-come mode or a reminder is turned on).
 * Returns whether notifications may be shown. 2D calls this when First-come is turned on.
 */
export async function ensureNotificationPermission(db: AppDb, adapter: NotificationAdapter): Promise<boolean> {
  const state = await adapter.permission();
  if (state === 'granted') return true;
  if (state === 'denied' || getSettings(db).notificationsAsked) return false;
  updateSettings(db, { notificationsAsked: true });
  return (await adapter.requestPermission()) === 'granted';
}
