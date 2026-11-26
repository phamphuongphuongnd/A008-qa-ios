import { cleanMoneyTyping, editMoneyField, formatMoneyField, MAX_CENTS, parseMoney } from '../moneyInput';

describe('money field', () => {
  it('cleans what is typed', () => {
    expect(cleanMoneyTyping('1,650.509')).toBe('1650.50');
    expect(cleanMoneyTyping('$12')).toBe('12');
    expect(cleanMoneyTyping('1.2.3')).toBe('1.23');
    expect(cleanMoneyTyping('007')).toBe('7');
    expect(cleanMoneyTyping('0.5')).toBe('0.5');
    expect(cleanMoneyTyping('.5')).toBe('.5');
    expect(cleanMoneyTyping('abc')).toBe('');
  });

  it('parses to integer cents', () => {
    expect(parseMoney('')).toEqual({ cents: null });
    expect(parseMoney('1650')).toEqual({ cents: 165000 });
    expect(parseMoney('1,650.5')).toEqual({ cents: 165050 });
    expect(parseMoney('$5,351.67')).toEqual({ cents: 535167 });
    expect(parseMoney('0.07')).toEqual({ cents: 7 });
    expect(parseMoney('.5')).toEqual({ cents: 50 });
    expect(parseMoney('12.345').error).toBe('invalid');
    expect(parseMoney('.').error).toBe('invalid');
    expect(parseMoney('-5').error).toBe('invalid');
    expect(parseMoney('100000000').error).toBe('tooLarge');
    expect(parseMoney('99999999.99')).toEqual({ cents: MAX_CENTS });
  });

  it('formats when leaving the field and when editing', () => {
    expect(formatMoneyField(165000)).toBe('1,650.00');
    expect(formatMoneyField(535167)).toBe('5,351.67');
    expect(formatMoneyField(7)).toBe('0.07');
    expect(formatMoneyField(null)).toBe('');
    expect(editMoneyField(165000)).toBe('1650');
    expect(editMoneyField(165050)).toBe('1650.50');
    expect(editMoneyField(null)).toBe('');
  });

  it('round-trips', () => {
    for (const c of [0, 1, 99, 100, 165000, 535167, MAX_CENTS]) {
      expect(parseMoney(formatMoneyField(c)).cents).toBe(c);
      expect(parseMoney(editMoneyField(c)).cents).toBe(c);
    }
  });
});
