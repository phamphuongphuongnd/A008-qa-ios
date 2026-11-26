/**
 * Money field text ⇄ integer cents (product.md §5.0: number keyboard, 2 decimals, commas when leaving the field).
 * Pure: unit-tested in __tests__/moneyInput.test.ts.
 */

/** Largest amount a field accepts ($99,999,999.99) — keeps cents a safe integer and the layout sane. */
export const MAX_CENTS = 9_999_999_999;

/**
 * What the user may have typed so far, cleaned while typing: digits, one '.', at most 2 decimals; commas / '$' /
 * spaces dropped. "1,650.509" → "1650.50", "$12" → "12", "1.2.3" → "1.23".
 */
export function cleanMoneyTyping(text: string): string {
  let s = text.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  const [whole, dec] = s.split('.');
  const w = (whole ?? '').replace(/^0+(?=\d)/, '');
  return dec === undefined ? w : `${w}.${dec.slice(0, 2)}`;
}

export type MoneyParse = { cents: number | null; error?: 'invalid' | 'tooLarge' };

/** Field text → cents. Empty → null (no error: "required" is the screen's rule). */
export function parseMoney(text: string): MoneyParse {
  const s = text.replace(/[\s,$]/g, '');
  if (s === '') return { cents: null };
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === '.') return { cents: null, error: 'invalid' };
  const [whole, dec = ''] = s.split('.');
  const cents = Number(whole || '0') * 100 + Number(dec.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return { cents: null, error: 'tooLarge' };
  return { cents };
}

/** Cents → field text when not focused: "1,650.00" (always 2 decimals, commas, no '$' — the field shows it). */
export function formatMoneyField(cents: number | null | undefined): string {
  if (cents == null) return '';
  const abs = Math.abs(Math.round(cents));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}${whole}.${String(abs % 100).padStart(2, '0')}`;
}

/** Cents → text while editing: "1650.5" stays as typed; from a stored value "1650" / "1650.50". */
export function editMoneyField(cents: number | null | undefined): string {
  if (cents == null) return '';
  const abs = Math.abs(Math.round(cents));
  const rest = abs % 100;
  return `${Math.floor(abs / 100)}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}
