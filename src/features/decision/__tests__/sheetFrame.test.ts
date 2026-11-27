import { decisionSheetHeight, keyboardOverlap } from '../components/SheetFrame';

describe('S-15 sheet frame (B-48)', () => {
  it('fixed height under the status bar, never taller than the window', () => {
    // 411×914 dp phone: the Deny form no longer grows the sheet past the screen.
    expect(decisionSheetHeight(914, { top: 24, bottom: 48 }, 'android')).toBe(878);
    expect(decisionSheetHeight(914, { top: 47, bottom: 34 }, 'ios')).toBe(809);
    // Tablet landscape / small windows keep a usable minimum.
    expect(decisionSheetHeight(600, { top: 24, bottom: 0 }, 'android')).toBe(564);
    expect(decisionSheetHeight(200, { top: 24, bottom: 0 }, 'android')).toBe(240);
  });

  it('keyboard overlap uses the higher keyboard top (Samsung reports screenY wrong)', () => {
    const frame = { y: 36, height: 878 }; // bottom at 914
    expect(keyboardOverlap(frame, { screenY: 614, height: 300 }, 914)).toBe(300);
    expect(keyboardOverlap(frame, { screenY: 914, height: 300 }, 914)).toBe(300);
    expect(keyboardOverlap(frame, { screenY: 1000, height: 0 }, 914)).toBe(0);
  });
});
