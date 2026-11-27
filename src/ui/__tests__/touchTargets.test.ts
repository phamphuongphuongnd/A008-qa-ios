import fs from 'fs';
import path from 'path';

import { TOUCH_MIN, appBarSideWidth } from '../touch';

/**
 * B-75 / B-41 guards on the UI kit source (components can't render in Jest here — lucide is ESM-only).
 * Overlays.tsx (fix-nav) and CompareTable.tsx (fix-review-ui) are checked by their owners.
 */
const UI = path.resolve(__dirname, '..');
const OWNED_ELSEWHERE = new Set(['Overlays.tsx', 'CompareTable.tsx']);
const files = fs
  .readdirSync(UI)
  .filter((f) => f.endsWith('.tsx') && !OWNED_ELSEWHERE.has(f))
  .map((f) => ({ f, src: fs.readFileSync(path.join(UI, f), 'utf8') }));

describe('UI kit touch targets (B-75)', () => {
  it('the touch minimum is 48 dp', () => {
    expect(TOUCH_MIN).toBe(48);
  });

  it('no pressable reaches 48 with hitSlop — the frame itself is 48 (TalkBack uses the frame, not the slop)', () => {
    const offenders = files.filter(({ src }) => /hitSlop=/.test(src)).map(({ f }) => f);
    expect(offenders).toEqual([]);
  });

  it('frames of the small controls are TOUCH_MIN', () => {
    const src = (f: string) => files.find((x) => x.f === f)!.src;
    expect(src('Button.tsx')).toMatch(/iconFrame: \{ width: TOUCH_MIN, height: TOUCH_MIN/);
    expect(src('Button.tsx')).toMatch(/text: \{ minHeight: TOUCH_MIN/);
    expect(src('Button.tsx')).toMatch(/Math\.max\(minHeight, TOUCH_MIN\)/);
    expect(src('Selection.tsx')).toMatch(/segFrame: \{ flex: 1, minHeight: TOUCH_MIN/);
    expect(src('Selection.tsx')).toMatch(/pillFrame: \{ minHeight: TOUCH_MIN/);
    expect(src('Selection.tsx')).toMatch(/switchFrame: \{ minHeight: TOUCH_MIN, minWidth: TOUCH_MIN/);
    expect(src('Selection.tsx')).toMatch(/stepBtn: \{ width: TOUCH_MIN/);
    expect(src('Rows.tsx')).toMatch(/actFrame: \{ minHeight: TOUCH_MIN/);
    expect(src('Feedback.tsx')).toMatch(/act: \{ minHeight: TOUCH_MIN/);
    expect(src('Layout.tsx')).toMatch(/lockFrame: \{ minHeight: TOUCH_MIN/);
    expect(src('Card.tsx')).toMatch(/sectionAction: \{ minHeight: TOUCH_MIN/);
  });
});

describe('Section label (B-41)', () => {
  it('SectionHeader has no negative bottom margin (the group below must not cover the label)', () => {
    const card = files.find((x) => x.f === 'Card.tsx')!.src;
    const section = /\n  section: \{[^}]*\}/.exec(card)?.[0] ?? '';
    expect(section).toMatch(/paddingBottom: 8/);
    expect(section).not.toMatch(/marginBottom: -/);
  });
});

describe('AppBar sides (B-74)', () => {
  it('as wide as the back button or the measured right actions, not a fixed 88', () => {
    expect(appBarSideWidth(true, 0)).toBe(48);
    expect(appBarSideWidth(true, 96)).toBe(96);
    expect(appBarSideWidth(false, 0)).toBe(0);
    expect(appBarSideWidth(false, 47.2)).toBe(48);
    // 320 dp phone, back only: 320 − 2×16 padding − 2×8 gap − 2×48 = 176 dp for the title (was 96).
    expect(320 - 32 - 16 - 2 * appBarSideWidth(true, 0)).toBe(176);
  });
});
