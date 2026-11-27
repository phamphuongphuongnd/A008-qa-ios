import { isLockVisible, lockScreenPadding, lockShieldA11y, turnOffNeedsPin } from '../lock';

describe('B-70 LockShield', () => {
  it('hides the screens behind the lock from TalkBack / VoiceOver while locked', () => {
    expect(lockShieldA11y(true)).toEqual({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true });
  });
  it('leaves them alone when unlocked', () => {
    expect(lockShieldA11y(false)).toEqual({ importantForAccessibility: 'auto', accessibilityElementsHidden: false });
  });
  it('lock (and shield) only after onboarding, never in Applicant mode', () => {
    expect(isLockVisible(true, true, false)).toBe(true);
    expect(isLockVisible(false, true, false)).toBe(false);
    expect(isLockVisible(true, false, false)).toBe(false);
    expect(isLockVisible(true, true, true)).toBe(false);
  });
});

describe('B-140 lock screen with the keyboard up (app PIN)', () => {
  const insets = { top: 24, bottom: 48 };

  it('no keyboard: as before (top 48, bottom 24, plus the insets)', () => {
    expect(lockScreenPadding(0, insets)).toEqual({ top: 72, bottom: 72 });
  });

  it('keyboard up: the bottom padding is what the keyboard covers, so PIN field + Unlock sit above it', () => {
    // Tablet landscape (B-140 report): window 1600 high, keyboard from ~845 → ~755 covered.
    expect(lockScreenPadding(755, insets)).toEqual({ top: 40, bottom: 771 });
    // The inset is not added on top: the keyboard already covers the navigation bar.
    expect(lockScreenPadding(500, { top: 24, bottom: 200 }).bottom).toBe(516);
  });
});

describe('B-145 turning App lock off', () => {
  it('asks for the app PIN when this phone uses it, nothing extra otherwise', () => {
    expect(turnOffNeedsPin(true, 'p1:20000:aa:bb')).toBe(true);
    expect(turnOffNeedsPin(true, null)).toBe(false);
    expect(turnOffNeedsPin(false, 'p1:20000:aa:bb')).toBe(false); // system prompt phone: unchanged
  });
});
