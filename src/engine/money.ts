import type { Cents, PayFrequency } from './types';

/** Pay periods per year (§3.3). */
export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

/** Exact half-up division of integers: round(num / den), .5 away from zero. */
export function divHalfUp(num: number, den: number): number {
  if (den <= 0) throw new Error('divHalfUp: den must be > 0');
  if (num < 0) return -divHalfUp(-num, den);
  return Math.floor((2 * num + den) / (2 * den));
}

/** Ceiling division of non-negative integers. */
export function divCeil(num: number, den: number): number {
  if (den <= 0) throw new Error('divCeil: den must be > 0');
  return Math.floor((num + den - 1) / den);
}

/** Gross pay per period → monthly, rounded to the cent once (§3.3). */
export function payToMonthly(grossCents: Cents, frequency: PayFrequency): Cents {
  return divHalfUp(grossCents * PERIODS_PER_YEAR[frequency], 12);
}

/** "$5,351.67"; whole dollars drop the cents ("$5,400"). */
export function formatUsd(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}${rest === 0 ? '' : `.${String(rest).padStart(2, '0')}`}`;
}

/** Ratio × 100 → "3.24". */
export function formatRatio(hundredths: number): string {
  return (hundredths / 100).toFixed(2);
}

/** Multiple in tenths → "3.0". */
export function formatMultiple(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

/** Signed whole percent of (actual − expected) / expected, half away from zero: "−12%" / "+29%". */
export function percentDiff(actual: Cents, expected: Cents): number {
  if (expected <= 0) return 0;
  return divHalfUp((actual - expected) * 100, expected);
}

export function formatPercentDiff(pct: number): string {
  return pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : '0%';
}
