/**
 * Local timestamps for intake (product.md §3.1: "Dấu giờ: ISO có múi giờ của máy").
 * `localIso(new Date())` → '2026-12-02T09:14:00-05:00' (seconds kept, no milliseconds).
 */
const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');

/** ISO 8601 with the device's UTC offset, as the landlord saw it on the clock. */
export function localIso(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

/** Local calendar date 'YYYY-MM-DD'. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar month 'YYYY-MM'. */
export function localMonth(d: Date = new Date()): string {
  return localDate(d).slice(0, 7);
}

/** Instant of an ISO timestamp (with offset or Z). NaN when malformed. */
export function instantOf(ts: string): number {
  return Date.parse(ts);
}

export const isIsoDate = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);

export const isYearMonth = (v: string | null | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** 'YYYY-MM' → month number since year 0. */
export const monthNumber = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
