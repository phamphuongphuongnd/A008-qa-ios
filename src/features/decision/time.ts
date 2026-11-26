/**
 * Clock helpers for 2D. Timestamps are stored as ISO with the device offset (product.md §3.1: "Dấu giờ: ISO có múi giờ
 * của máy"), so `dateTime()` in PDFs prints the wall-clock time the landlord saw. Timer ends (`endsAt`) are UTC ISO from
 * the engine and are formatted in the device's local time here.
 */
import { formatDate } from '@/engine';

const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');

/** Minutes east of UTC on the device at that instant (-300 for New York in winter). */
export const deviceOffset = (d: Date) => -d.getTimezoneOffset();

/** Wall-clock parts at `d` for a UTC offset (minutes), read with UTC getters so any device zone gives the same text. */
function wall(d: Date, offsetMin: number) {
  const w = new Date(d.getTime() + offsetMin * 60_000);
  return { y: w.getUTCFullYear(), mo: w.getUTCMonth() + 1, d: w.getUTCDate(), h: w.getUTCHours(), mi: w.getUTCMinutes(), s: w.getUTCSeconds() };
}

/** `2026-12-06T15:12:00-05:00` in the device's time zone (or a given offset, for tests). */
export function localIso(d: Date = new Date(), offsetMin: number = deviceOffset(d)): string {
  const p = wall(d, offsetMin);
  const sign = offsetMin >= 0 ? '+' : '-';
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(offsetMin / 60)}:${pad(offsetMin % 60)}`;
}

/** Today in the device's time zone, `YYYY-MM-DD`. */
export function localDate(d: Date = new Date(), offsetMin: number = deviceOffset(d)): string {
  return localIso(d, offsetMin).slice(0, 10);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-12-06` → "December 6, 2026" (letter date line). */
export function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function time12(h: number, min: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Any ISO instant → "Dec 8, 2026 at 3:12 PM" in the device's local time (timer ends, reply-by). */
export function localDateTime(iso: string, offsetMin?: number): string {
  const d = new Date(iso);
  const off = offsetMin ?? deviceOffset(d);
  const p = wall(d, off);
  return `${formatDate(localDate(d, off))} at ${time12(p.h, p.mi)}`;
}

/** Stored local timestamp → "Dec 2, 9:14 AM" (wall clock in the string, no year) for lists. */
export function shortStamp(ts: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(ts);
  if (!m) return ts;
  return `${formatDate(m[1]).replace(/, \d{4}$/, '')}, ${time12(Number(m[2]), Number(m[3]))}`;
}
