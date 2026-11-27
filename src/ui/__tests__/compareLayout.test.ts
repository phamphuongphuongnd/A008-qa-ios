/** @jest-environment node */
import { criterionCompareLabel, defaultCriteria } from '@/engine';

import { COMPARE_PIN_WIDTH, COMPARE_WINDOW, compareColumnWidth, comparePinWidth } from '../compareLayout';

describe('S-17 column width (B-46, B-71)', () => {
  // "Needs review" badge: 33 dp fixed (padding, icon, gap) + ~78 dp of text at 100 %, plus 16 dp cell padding.
  const needed = (scale: number) => 16 + 33 + 78 * scale;
  it.each([0.85, 1, 1.1, 1.15, 1.29])('fits the widest badge at %s× text', (s) => {
    expect(compareColumnWidth(s)).toBeGreaterThanOrEqual(needed(s));
  });
  it('one fixed width per text size (needed for getItemLayout), never below the 120 dp mockup column', () => {
    expect(compareColumnWidth(1)).toBe(compareColumnWidth(1));
    expect(compareColumnWidth(0.5)).toBe(120);
  });
  it('mounts a few columns first, not all 20', () => {
    expect(COMPARE_WINDOW.initialNumToRender).toBeLessThanOrEqual(4);
  });
});

describe('S-17 pinned criteria column (B-146)', () => {
  // Longest word of the built-in row labels ("Background", "Documents", "Occupancy"…), 13 px medium ≈ 7.8 dp a letter.
  const words = defaultCriteria().flatMap((c) => criterionCompareLabel(c).split(/\s+/));
  const longest = Math.max(...words.map((w) => w.length));
  const wordWidth = (scale: number) => longest * 7.8 * scale;
  it('is the mockup 104 dp at 100 % text', () => {
    expect(comparePinWidth(1)).toBe(COMPARE_PIN_WIDTH);
    expect(comparePinWidth(0.85)).toBe(COMPARE_PIN_WIDTH);
  });
  it.each([1, 1.1, 1.15, 1.2, 1.29])('keeps every label word on one line at %s× text (no "Document/s")', (s) => {
    expect(longest).toBeGreaterThanOrEqual('Background'.length);
    expect(comparePinWidth(s) - 20).toBeGreaterThanOrEqual(wordWidth(s));
  });
  it('grows with the text: 115 % is wider than 100 %', () => {
    expect(comparePinWidth(1.15)).toBeGreaterThan(comparePinWidth(1));
  });
});
