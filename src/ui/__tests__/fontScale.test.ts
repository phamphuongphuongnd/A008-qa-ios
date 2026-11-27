/** @jest-environment node */
import { COMPARE_CARDS_FONT_SCALE, fontScaleAtLeast } from '../fontScale';

describe('fontScaleAtLeast (B-69)', () => {
  it("Android's 130 % step (1.3f read as 1.2999999523) switches S-17 to cards", () => {
    expect(fontScaleAtLeast(Math.fround(1.3), COMPARE_CARDS_FONT_SCALE)).toBe(true);
    expect(fontScaleAtLeast(1.2999999, COMPARE_CARDS_FONT_SCALE)).toBe(true);
    expect(fontScaleAtLeast(1.3, COMPARE_CARDS_FONT_SCALE)).toBe(true);
    expect(fontScaleAtLeast(1.5, COMPARE_CARDS_FONT_SCALE)).toBe(true);
  });
  it('smaller steps keep the table', () => {
    for (const s of [0.85, 1, 1.1, 1.15, 1.2, Math.fround(1.15)]) expect(fontScaleAtLeast(s, COMPARE_CARDS_FONT_SCALE)).toBe(false);
  });
});
