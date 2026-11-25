import { gapBelow, keyboardTop, modalFocusDelayMs, REMEASURE_MS } from '../keyboardMath';

// Galaxy A13-like numbers (dp): screen 803, gesture/3-button bar 48, keyboard 300.
const SCREEN = 803;
const NAV = 48;

describe('keyboard top edge', () => {
  it('takes the higher of screenY and screen − keyboard − nav bar (B-153)', () => {
    // screenY stuck at the visible-frame bottom (doesn't follow the keyboard): the height estimate wins.
    expect(keyboardTop({ screenY: 755, height: 300 }, SCREEN, NAV)).toBe(455);
    // screenY right: it is the higher edge.
    expect(keyboardTop({ screenY: 440, height: 300 }, SCREEN, NAV)).toBe(440);
  });

  it('S-17: an event with height 0 right after resume falls back to the last good height', () => {
    expect(keyboardTop({ screenY: SCREEN, height: 0 }, SCREEN, NAV, 300)).toBe(455);
    // Nothing known at all → unknown (no padding instead of a wrong one).
    expect(keyboardTop({ screenY: SCREEN, height: 0 }, SCREEN, NAV, 0)).toBeNull();
  });
});

describe('gap under the keyboard', () => {
  it('what the view still reaches below the keyboard top', () => {
    expect(gapBelow(0, 803, 455)).toBe(348);
    expect(gapBelow(0, 450, 455)).toBe(0);
    expect(gapBelow(0, 803, null)).toBe(0);
    expect(gapBelow(0, 0, 455)).toBe(0);
  });

  it('measures again later (the view can shrink late while the JS thread is busy)', () => {
    expect(REMEASURE_MS.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...REMEASURE_MS)).toBeGreaterThanOrEqual(800);
  });
});

describe('autoFocus delay in a sheet', () => {
  it('250 ms normally, waits until the app has been active ~800 ms after a resume / cold start', () => {
    expect(modalFocusDelayMs(10_000, 0)).toBe(250);
    expect(modalFocusDelayMs(10_100, 10_000)).toBe(700);
    expect(modalFocusDelayMs(10_600, 10_000)).toBe(250);
  });
});
