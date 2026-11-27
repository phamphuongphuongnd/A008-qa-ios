/**
 * Small pure helpers shared by the 2C verify screens (S-11 … S-14): money / month / date input parsing and the
 * attempt-log labels. No React, no DB — unit-tested in __tests__/common.test.ts.
 */
import { formatMonth, type AttemptMethod, type AttemptResult, type Cents, type IsoDate, type YearMonth } from '@/engine';

/** Validation result for one field: an i18n key under `verify:errors.*` (screens translate it). */
export interface FieldError<F extends string = string> {
  field: F;
  code: VerifyErrorCode;
}

export type VerifyErrorCode =
  | 'required'
  | 'money_invalid'
  | 'money_zero'
  | 'month_invalid'
  | 'date_invalid'
  | 'date_future'
  | 'range_order'
  | 'sentence_before_conviction'
  | 'score_invalid'
  | 'too_many_factors'
  | 'url_invalid';

const MONEY_RE = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{0,2})?$/;

/**
 * "$2,310.00" / "2310" / "2,310.5" → 231050 cents. Empty → null. Anything else (letters, 3 decimals, negative) → NaN.
 * Integer math only (no float rounding): the 2-decimal rule of product.md §5.0.
 */
export function parseMoneyInput(text: string | null | undefined): Cents | null {
  const s = (text ?? '').trim();
  if (!s) return null;
  if (!MONEY_RE.test(s)) return Number.NaN;
  const clean = s.replace(/[$,\s]/g, '');
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/** 231050 → "2,310.50" (the value shown back in a money field when it loses focus). */
export function moneyInputText(cents: Cents | null | undefined): string {
  if (cents == null) return '';
  const whole = Math.floor(cents / 100).toLocaleString('en-US');
  return `${whole}.${String(cents % 100).padStart(2, '0')}`;
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isMonth(v: string | null | undefined): v is YearMonth {
  return !!v && MONTH_RE.test(v);
}

export function isIsoDate(v: string | null | undefined): v is IsoDate {
  const m = v ? DATE_RE.exec(v) : null;
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Local calendar date of a Date ("today" on the device) as YYYY-MM-DD. */
export function localDate(now: Date): IsoDate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Local ISO timestamp with the device offset (product.md §3.1: "ISO có múi giờ của máy"). */
export function localTimestamp(now: Date): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${localDate(now)}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** Whole months from `from` to `to` (both YYYY-MM-DD), floored, plus the remaining whole years. */
export function yearsAndMonthsBetween(from: IsoDate, to: IsoDate): { years: number; months: number } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let total = (ty - fy) * 12 + (tm - fm);
  if (td < fd) total -= 1;
  total = Math.max(0, total);
  return { years: Math.floor(total / 12), months: total % 12 };
}

/** "2023-01" → "Jan 2023"; null → "". */
export function monthText(v: YearMonth | null | undefined): string {
  return isMonth(v) ? formatMonth(v) : '';
}

/** Attempt log label (S-11 / S-12): an email with no answer reads "No reply yet" (mockup v2). i18n keys under `verify:attempts.*`. */
export function attemptResultKey(method: AttemptMethod, result: AttemptResult): string {
  if (result === 'no_answer' && method !== 'call') return 'attempts.result.no_reply';
  return `attempts.result.${result}`;
}

export const ATTEMPT_METHODS: readonly AttemptMethod[] = ['call', 'email', 'text'];
export const ATTEMPT_RESULTS: readonly AttemptResult[] = ['reached', 'no_answer', 'left_message', 'wrong_number'];

/** Only http(s) links are ever opened (the "Open service" / county-records buttons): nothing is sent, no data in the URL. */
export function isSafeWebUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(url.trim());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Attempt time as recorded (wall clock of the stored ISO timestamp): "Dec 3, 10:02 AM" (mockup v2). */
export function attemptTimeText(at: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(at);
  if (!m) return at;
  const h = Number(m[4]);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${h % 12 === 0 ? 12 : h % 12}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Jun 2020" from a date (S-14 conviction line). */
export function monthYearOfDate(d: IsoDate): string {
  return isIsoDate(d) ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '';
}

/** "MM/YYYY" typed in a month field → "YYYY-MM"; "" → null; anything else → undefined (invalid). */
export function parseMonthInput(text: string): YearMonth | null | undefined {
  const s = text.trim();
  if (!s) return null;
  const m = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(s);
  if (!m) return undefined;
  const ym = `${m[2]}-${m[1].padStart(2, '0')}`;
  return isMonth(ym) ? ym : undefined;
}

/** "YYYY-MM" → "MM/YYYY" for the month field. */
export function monthInputText(ym: YearMonth | null | undefined): string {
  return isMonth(ym) ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '';
}

/** Same field values (sheet forms are plain JSON: strings, numbers, booleans, null, arrays, small objects). */
export const sameForm = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);
