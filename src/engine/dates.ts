import type { IsoDate, IsoDateTime, YearMonth } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** Local calendar date of a timestamp written with the device offset ('2026-12-02T09:14:00-05:00' → '2026-12-02'). */
export function dateOf(ts: IsoDateTime): IsoDate {
  return ts.slice(0, 10);
}

/** Epoch ms of an ISO timestamp (offset-aware). Throws on bad input. */
export function instantMs(ts: IsoDateTime): number {
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${ts}`);
  return ms;
}

export function parseDate(d: IsoDate): { y: number; m: number; d: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, d: day };
}

/** 0-based month index: y × 12 + (m − 1). */
export function monthIndex(ym: YearMonth): number {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Month index plus the fraction of the month already passed (day 1 = .0). */
export function monthPosition(d: IsoDate): number {
  const p = parseDate(d);
  return p.y * 12 + (p.m - 1) + (p.d - 1) / daysInMonth(p.y, p.m);
}

function utcDay(d: IsoDate): number {
  const p = parseDate(d);
  return Date.UTC(p.y, p.m - 1, p.d);
}

/** b − a in whole days. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

export function firstDayOf(ym: YearMonth): IsoDate {
  return `${ym}-01`;
}

/** Same month/day n years earlier (Feb 29 → Feb 28). */
export function minusYears(d: IsoDate, years: number): IsoDate {
  const p = parseDate(d);
  const y = p.y - years;
  const day = Math.min(p.d, daysInMonth(y, p.m));
  return `${String(y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whole years from `from` to `to` (S-14 "How long ago was it?"). */
export function wholeYearsBetween(from: IsoDate, to: IsoDate): number {
  const a = parseDate(from);
  const b = parseDate(to);
  let years = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) years -= 1;
  return Math.max(0, years);
}

/** 'Mar 2022'. */
export function formatMonth(ym: YearMonth): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 'Dec 2, 2026'. */
export function formatDate(d: IsoDate): string {
  const p = parseDate(d);
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/**
 * Where a possibly partial date ('YYYY', 'YYYY-MM', 'YYYY-MM-DD') sits against a cutoff date:
 * 'in' (on or after), 'out' (before) or 'boundary' (the partial date includes the cutoff, e.g. year 2021 vs 2021-12-04).
 */
export function partialDateVsCutoff(date: string, cutoff: IsoDate): 'in' | 'out' | 'boundary' {
  const c = parseDate(cutoff);
  const parts = date.split('-').map(Number);
  if (parts.length >= 3) return date >= cutoff ? 'in' : 'out';
  if (parts.length === 2) {
    const v = parts[0] * 12 + parts[1];
    const cv = c.y * 12 + c.m;
    if (v > cv) return 'in';
    if (v < cv) return 'out';
    return c.d === 1 ? 'in' : 'boundary';
  }
  if (parts[0] > c.y) return 'in';
  if (parts[0] < c.y) return 'out';
  return c.m === 1 && c.d === 1 ? 'in' : 'boundary';
}
