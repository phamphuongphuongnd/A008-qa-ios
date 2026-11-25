/**
 * Display text for money (integer cents, USD), ISO dates ('YYYY-MM-DD'), months ('YYYY-MM') and timestamps.
 * Exact integer / string maths on stored values — no floating point (fact money-precision). English (US) only.
 */

const MAX_INT_DIGITS = 9; // $9,999,999.99 — far above any rent or income.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function group(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Filters what was typed or pasted into a money field. Returns the cleaned text, or null to refuse the change (a third
 * decimal, a second dot, a letter): the field then keeps its previous text. Pasting "$1,234.50" gives "1234.50".
 */
export function cleanMoneyTyped(text: string): string | null {
  let t = text.replace(/[\s$,]/g, '');
  if (!/^\d*\.?\d*$/.test(t)) return null;
  if (t.startsWith('.')) t = `0${t}`;
  const [i, f] = t.split('.');
  if (f !== undefined && f.length > 2) return null;
  const int = i.replace(/^0+(?=\d)/, '');
  if (int.length > MAX_INT_DIGITS) return null;
  return f === undefined ? int : `${int}.${f}`;
}

/** "1234.5" → 123450 cents. Empty → null. */
export function parseCents(text: string): number | null {
  const t = cleanMoneyTyped(text);
  if (t === null || t === '') return null;
  const [i, f = ''] = t.split('.');
  return Number(i || '0') * 100 + Number((f + '00').slice(0, 2));
}

/** Text of a stored amount inside a money field: "1,650" / "5,351.67" (grouped) or "1650" / "5351.67" (editing). */
export function centsToInput(cents: number | null | undefined, grouped = true): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '';
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const int = String(Math.floor(abs / 100));
  const frac = abs % 100;
  const body = `${grouped ? group(int) : int}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
  return neg ? `-${body}` : body;
}

/**
 * "$1,650" (whole dollars hide ".00") · "$5,351.67" · "-$250". `cents: 'always'` keeps ".00" (letters, PDF tables).
 */
export function formatUsd(cents: number, opts: { cents?: 'auto' | 'always' } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const int = group(String(Math.floor(abs / 100)));
  const frac = abs % 100;
  const showFrac = opts.cents === 'always' || frac !== 0;
  return `${neg ? '-' : ''}$${int}${showFrac ? `.${String(frac).padStart(2, '0')}` : ''}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a Date → 'YYYY-MM-DD'. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local month of a Date → 'YYYY-MM'. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
/** 'YYYY-MM-DD' or 'YYYY-MM' → local Date at noon (no time-zone day shift). */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

/** '2027-01-01' → "Jan 1, 2027"; `year: false` → "Jan 1". */
export function formatDay(key: string, opts: { year?: boolean } = {}): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return `${MONTHS[m - 1]} ${d}${opts.year === false ? '' : `, ${y}`}`;
}

/** '2022-03' → "Mar 2022". */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

/** "9:14 AM" in the phone's time zone. */
export function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** ISO timestamp → "Dec 2, 9:14 AM" (S-06, S-09) or with year "Dec 2, 2026, 9:14 AM". */
export function formatDateTime(iso: string, opts: { year?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDay(dayKey(d), { year: opts.year ?? false })}, ${formatTime(d)}`;
}

/** Initials for an avatar: "Jordan Ellis" → "JE", "Priya" → "P". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
