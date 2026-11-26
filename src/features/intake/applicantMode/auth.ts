/**
 * The landlord's lock for Applicant mode (S-08a): biometrics or the phone's own code (expo-local-authentication,
 * behind `LocalAuthAdapter` so Jest mocks it). A phone with no lock at all must use the app PIN of S-23 (2E), which
 * has to exist BEFORE Applicant mode starts (product.md S-08a).
 */
export type SecurityLevel = 'none' | 'secret' | 'biometric_weak' | 'biometric_strong';

export interface LocalAuthAdapter {
  /** What the phone can do: none = no screen lock; secret = PIN / pattern / passcode; biometric_* = enrolled biometrics. */
  securityLevel(): Promise<SecurityLevel>;
  /** System prompt; falls back to the device code. */
  authenticate(opts: { promptMessage: string; cancelLabel?: string }): Promise<{ success: true } | { success: false; error: string }>;
}

/** How the landlord will unlock: the phone's lock, or the app PIN when the phone has none. */
export type LockMethod = 'device' | 'app_pin';

export type EnterCheck = { ok: true; method: LockMethod } | { ok: false; reason: 'set_app_pin' };

/** "Hand the phone to the applicant" (S-07 → S-08a): allowed only when a way out exists. */
export async function checkCanEnter(adapter: LocalAuthAdapter, opts: { appPinSet: boolean }): Promise<EnterCheck> {
  const level = await adapter.securityLevel().catch((): SecurityLevel => 'none');
  if (level !== 'none') return { ok: true, method: 'device' };
  return opts.appPinSet ? { ok: true, method: 'app_pin' } : { ok: false, reason: 'set_app_pin' };
}

export type UnlockResult = 'ok' | 'cancelled' | 'failed' | 'needs_app_pin';

/** "Landlord" button / S-08b triple tap. `needs_app_pin` → the screen shows the PIN pad and calls `unlockWithPin`. */
export async function unlockLandlord(adapter: LocalAuthAdapter, opts: { promptMessage: string; cancelLabel?: string }): Promise<UnlockResult> {
  const level = await adapter.securityLevel().catch((): SecurityLevel => 'none');
  if (level === 'none') return 'needs_app_pin';
  try {
    const r = await adapter.authenticate(opts);
    if (r.success) return 'ok';
    return /cancel/i.test(r.error) ? 'cancelled' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Checks the app PIN of S-23. */
export type PinVerifier = (pin: string) => Promise<boolean>;

/**
 * TODO(merge 2B): replace with 2E's app-PIN check (settings.appPinHash, salted hash owned by S-23). Until then no PIN
 * is accepted, so a phone without a screen lock cannot enter Applicant mode (checkCanEnter → set_app_pin).
 */
export const verifyAppPinPending: PinVerifier = async () => false;

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const isPinShape = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

export async function unlockWithPin(pin: string, verify: PinVerifier = verifyAppPinPending): Promise<'ok' | 'failed'> {
  if (!isPinShape(pin)) return 'failed';
  try {
    return (await verify(pin)) ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
