import { isLockVisible, lockShieldA11y } from '../lock';

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
