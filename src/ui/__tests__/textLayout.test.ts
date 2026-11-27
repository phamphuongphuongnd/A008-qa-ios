import fs from 'fs';
import path from 'path';

import { atLeastScale, keyValueStacked } from '../textLayout';

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
