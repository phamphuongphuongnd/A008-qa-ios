import { centsToInput, cleanMoneyTyped, dayKey, formatDateTime, formatDay, formatMonth, formatUsd, initials, parseCents, parseKey } from '../format';

describe('money', () => {
  it('formats cents for display', () => {
    expect(formatUsd(165000)).toBe('$1,650');
    expect(formatUsd(535167)).toBe('$5,351.67');
    expect(formatUsd(-25000)).toBe('-$250');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(165000, { cents: 'always' })).toBe('$1,650.00');
    expect(formatUsd(99999999999)).toBe('$999,999,999.99');
  });

  it('cleans typed / pasted text and parses exact cents', () => {
    expect(cleanMoneyTyped('$1,234.50')).toBe('1234.50');
    expect(cleanMoneyTyped('12.345')).toBeNull();
    expect(cleanMoneyTyped('1.2.3')).toBeNull();
    expect(cleanMoneyTyped('abc')).toBeNull();
    expect(cleanMoneyTyped('.5')).toBe('0.5');
    expect(cleanMoneyTyped('0012')).toBe('12');
    expect(parseCents('5351.67')).toBe(535167);
    expect(parseCents('0.1')).toBe(10);
    expect(parseCents('1650')).toBe(165000);
    expect(parseCents('')).toBeNull();
    // 0.1 + 0.2 style drift never happens: string maths.
    expect(parseCents('4.35')).toBe(435);
    expect(parseCents('1.15')).toBe(115);
  });

  it('shows field text grouped on blur, plain while editing', () => {
    expect(centsToInput(535167)).toBe('5,351.67');
    expect(centsToInput(535167, false)).toBe('5351.67');
    expect(centsToInput(165000)).toBe('1,650');
    expect(centsToInput(165050)).toBe('1,650.50');
    expect(centsToInput(null)).toBe('');
  });
});

describe('dates', () => {
  it('formats keys and timestamps', () => {
    expect(formatDay('2027-01-01')).toBe('Jan 1, 2027');
    expect(formatDay('2026-12-02', { year: false })).toBe('Dec 2');
    expect(formatMonth('2022-03')).toBe('Mar 2022');
    expect(dayKey(parseKey('2026-12-31'))).toBe('2026-12-31');
    const d = new Date(2026, 11, 2, 9, 14);
    expect(formatDateTime(d.toISOString())).toBe('Dec 2, 9:14 AM');
    expect(formatDateTime(new Date(2026, 11, 2, 14, 40).toISOString(), { year: true })).toBe('Dec 2, 2026, 2:40 PM');
    expect(formatDateTime(new Date(2026, 11, 2, 0, 5).toISOString())).toBe('Dec 2, 12:05 AM');
  });

  it('makes initials', () => {
    expect(initials('Jordan Ellis')).toBe('JE');
    expect(initials('  priya  ')).toBe('P');
    expect(initials('Dana M. Ortiz')).toBe('DO');
  });
});
