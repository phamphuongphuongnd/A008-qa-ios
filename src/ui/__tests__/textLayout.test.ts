import fs from 'fs';
import path from 'path';

import { atLeastScale, formCellBasis, keyValueStacked } from '../textLayout';

const src = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

describe('KeyValue layout (B-74a "No" → "N/o")', () => {
  it('stacks the value under the label from 150 % text, side by side below', () => {
    expect(keyValueStacked(1)).toBe(false);
    expect(keyValueStacked(1.3)).toBe(false);
    expect(keyValueStacked(1.5)).toBe(true);
    expect(keyValueStacked(1.4999999)).toBe(true); // Android float (B-69)
    expect(keyValueStacked(2)).toBe(true);
    expect(atLeastScale(1.2999999, 1.3)).toBe(true);
  });

  it('side by side, the value keeps its own width (no shrinking into "N/o"), the label wraps', () => {
    const card = src('Card.tsx');
    expect(card).toMatch(/kvValue: \{ textAlign: 'right', flexShrink: 0, maxWidth: '60%' \}/);
    expect(card).toMatch(/kvLabel: \{ flex: 1, flexShrink: 1 \}/);
  });
});

describe('ButtonBar row (B-63 family)', () => {
  it('buttons fill their cell', () => {
    expect(src('Layout.tsx')).toMatch(/<ButtonFillContext value=\{true\}>/);
    expect(src('Button.tsx')).toMatch(/block \|\| fill \? styles\.block : styles\.inline/);
  });
});

describe('Form cells (B-81 "Choos/e" at iOS AX-XL)', () => {
  it('ask for more width as the text grows, so cells stack instead of breaking words', () => {
    expect(formCellBasis(1)).toBe(140);
    expect(formCellBasis(0.85)).toBe(140); // smaller text: never narrower than the design
    expect(formCellBasis(2)).toBe(280);
    // Phone 375 pt, AX-XL ≈ 2.35: 2 cells of 329 + gap 12 > 343 content width → State and ZIP on their own rows.
    expect(2 * formCellBasis(2.35) + 12).toBeGreaterThan(375 - 32);
    // Normal text on a 360 dp phone: still side by side (2 × 140 + 12 ≤ 328), as designed.
    expect(2 * formCellBasis(1) + 12).toBeLessThanOrEqual(360 - 32);
  });
});
