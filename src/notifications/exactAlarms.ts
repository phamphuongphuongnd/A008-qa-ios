/**
 * Exact alarms for the First-come clocks (product.md §3.14, §6). expo-notifications schedules with
 * `setExactAndAllowWhileIdle` only while the app may schedule exact alarms; otherwise Android may deliver the
 * "2 hours left" / "time is up" reminders up to about an hour late (B-58).
 *
 * The app declares SCHEDULE_EXACT_ALARM (app.json; never USE_EXACT_ALARM). Android 12–13 grants it at install;
 * Android 14+ asks the landlord on the system "Alarms & reminders" screen. We ask once — the first time First-come is
 * turned on or the first clock starts, like the notification permission — with one sentence first. Declined: the app
 * works the same with inexact reminders worded "about 2 hours left". Allowed later in system settings: the next sync
 * (foreground) notices and re-schedules every clock exactly (`syncTimerNotifications`).
 */
import { getSettings, updateSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';

export interface ExactAlarmAdapter {
  /** false where reminders are always on time (iOS, Android < 12). */
  needsPermission(): boolean;
  /** The app may schedule exact alarms now. */
  granted(): Promise<boolean>;
  /** The one-sentence explanation; true = the landlord chose to open the system screen. */
  explain(): Promise<boolean>;
  /** Opens "Alarms & reminders"; resolves with the state when the landlord comes back. */
  request(): Promise<boolean>;
}

/** Reminders fire on time (no permission needed, or granted). Never throws. */
export async function exactAlarmsOn(a: ExactAlarmAdapter): Promise<boolean> {
  if (!a.needsPermission()) return true;
  return a.granted().catch(() => false);
}

/**
 * Ask at most once (`settings.exactAlarmsAsked`). Returns whether reminders will fire on time. Never throws.
 * Call only after the notification permission is granted (no point asking otherwise).
 */
export async function ensureExactAlarmPermission(db: AppDb, a: ExactAlarmAdapter): Promise<boolean> {
  if (await exactAlarmsOn(a)) return true;
  if (getSettings(db).exactAlarmsAsked) return false;
  updateSettings(db, { exactAlarmsAsked: true });
  try {
    if (!(await a.explain())) return false;
    return await a.request();
  } catch {
    return false;
  }
}
