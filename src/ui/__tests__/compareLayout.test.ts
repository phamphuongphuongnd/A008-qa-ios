/** @jest-environment node */
import { COMPARE_WINDOW, compareColumnWidth } from '../compareLayout';

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
