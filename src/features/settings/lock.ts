/**
 * S-23 App lock (pure part): when the app locks, which unlock method a phone gets, the app PIN (phones with no
 * biometrics and no passcode), and the lock state machine the root layout's gate runs. The same unlock guards leaving
 * Applicant mode (S-08a/b, 2B) — see `landlordUnlockMethod`.
 */
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import type { AppSettings } from '@/db/repos/settings';

export type LockAfter = AppSettings['lockAfter'];
/**
 * Which biometric the system prompt will ask for, as far as the app can know. Android only reports what the HARDWARE
 * supports, not what is enrolled or strong enough for BiometricPrompt (A13: face is Class 2, the prompt asks for a
 * fingerprint — B-103), so with several kinds the label stays neutral: 'faceOrFingerprint' / 'biometric'.
 */
export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'faceOrFingerprint' | 'biometric';

/** BiometricKind from what the phone reports (enrolled = some biometric is set up). */
export function biometricKind(enrolled: boolean, types: { face: boolean; fingerprint: boolean; iris: boolean }, ios: boolean): BiometricKind | null {
  if (!enrolled) return null;
  const kinds = (['face', 'fingerprint', 'iris'] as const).filter((k) => types[k]);
  // iOS phones have exactly one (Face ID or Touch ID), and it is the one the prompt uses.
  if (ios) return kinds[0] ?? 'biometric';
  if (kinds.length === 1) return kinds[0];
  if (kinds.length === 2 && types.face && types.fingerprint) return 'faceOrFingerprint';
  return 'biometric';
}

/** S-23 "Lock after": Immediately / 1 min / 5 min (time in the background). */
export const LOCK_AFTER_MS: Record<LockAfter, number> = { immediately: 0, '1min': 60_000, '5min': 300_000 };
export const LOCK_AFTER_OPTIONS: readonly LockAfter[] = ['immediately', '1min', '5min'];

/** What the phone offers (from expo-local-authentication, see lockNative.ts). */
export interface AuthCapability {
  /** Biometric enrolled and usable (strongest kind first). */
  biometric: BiometricKind | null;
  /** Phone has a PIN / pattern / passcode (the system prompt falls back to it). */
  deviceSecure: boolean;
}

/**
 * How the landlord proves it is them: the system prompt (biometrics, falling back to the phone's passcode) or, on a
 * phone with neither, the app's own 4–6 digit PIN. 'needs_pin' = no system lock and no app PIN set yet.
 */
export type UnlockMethod = 'system' | 'pin' | 'needs_pin';

export function landlordUnlockMethod(cap: AuthCapability, s: Pick<AppSettings, 'appPinHash'>): UnlockMethod {
  if (cap.biometric || cap.deviceSecure) return 'system';
  return s.appPinHash ? 'pin' : 'needs_pin';
}

/** Turning App lock on needs some way to unlock; on a phone with no system lock the screen asks for a PIN first. */
export function canEnableLock(cap: AuthCapability, s: Pick<AppSettings, 'appPinHash'>): boolean {
  return landlordUnlockMethod(cap, s) !== 'needs_pin';
}

/**
 * A moment on two clocks: `wall` = Date.now(), `mono` = a monotonic clock (performance.now(); the landlord can't set
 * it). The monotonic one may stop while the phone sleeps deeply, the wall one can be moved back (B-76) — so time away
 * is the larger of the two, and a wall clock that went backwards counts as "long enough".
 */
export interface ClockReading {
  wall: number;
  mono?: number | null;
}

/** Time spent away between two readings (see ClockReading). Infinity when the wall clock was moved back. */
export function awayMs(from: ClockReading, to: ClockReading): number {
  const wall = to.wall - from.wall;
  if (wall < 0) return Infinity;
  const mono = from.mono != null && to.mono != null ? to.mono - from.mono : 0;
  return Math.max(wall, mono);
}

/** After "Lock after" in the background the app locks again (only when App lock is on). */
export function shouldLockOnReturn(
  s: Pick<AppSettings, 'appLock' | 'lockAfter'>,
  backgroundedAt: ClockReading | number | null,
  now: ClockReading | number,
): boolean {
  if (!s.appLock || backgroundedAt == null) return false;
  const from = typeof backgroundedAt === 'number' ? { wall: backgroundedAt } : backgroundedAt;
  const to = typeof now === 'number' ? { wall: now } : now;
  return awayMs(from, to) >= LOCK_AFTER_MS[s.lockAfter];
}

/**
 * Root layout: the lock screen is up (and LockShield hides the screens behind it) only after onboarding and never in
 * Applicant mode — the applicant holding the phone has 2B's own exit lock.
 */
export function isLockVisible(onboarded: boolean, locked: boolean, applicantModeActive: boolean): boolean {
  return onboarded && locked && !applicantModeActive;
}

/** The props LockShield (components/LockScreen.tsx) puts around the app's screens: hidden from screen readers while locked (B-70). */
export function lockShieldA11y(hidden: boolean) {
  return {
    importantForAccessibility: hidden ? ('no-hide-descendants' as const) : ('auto' as const),
    accessibilityElementsHidden: hidden,
  };
}

// ---------------------------------------------------------------------------
// App PIN (stored only as a salted hash: settings.appPinHash = "p1:<iterations>:<salt hex>:<hash hex>")
// ---------------------------------------------------------------------------

export const PIN_PATTERN = /^\d{4,6}$/;
const PIN_ITERATIONS = 20_000;

export type PinError = 'format' | 'mismatch';

/** S-23 set PIN: 4–6 digits, typed twice. */
export function validateNewPin(pin: string, confirm: string): PinError | null {
  if (!PIN_PATTERN.test(pin)) return 'format';
  if (pin !== confirm) return 'mismatch';
  return null;
}

export function hashPin(pin: string, salt: Uint8Array, iterations = PIN_ITERATIONS): string {
  const hash = pbkdf2(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
  return `p1:${iterations}:${bytesToHex(salt)}:${bytesToHex(hash)}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored || !PIN_PATTERN.test(pin)) return false;
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'p1') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = hexToBytes(parts[2]);
    expected = hexToBytes(parts[3]);
  } catch {
    return false;
  }
  const got = pbkdf2(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: expected.length });
  let diff = got.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}

/** Wrong PINs in a row → wait: 5 → 30 s, then doubling, capped at 15 min. 0 = no wait. */
export function pinWaitMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30_000 * 2 ** (failures - 5), 15 * 60_000);
}

// ---------------------------------------------------------------------------
// Lock state machine (root layout gate)
// ---------------------------------------------------------------------------

export interface LockState {
  locked: boolean;
  /** When the app last went to the background (wall ms), null while in front. */
  backgroundedAt: number | null;
  /** The same moment on the monotonic clock (B-76: moving the phone's clock back must not skip the lock). */
  backgroundedMono: number | null;
  /** System pickers / share sheet / camera open: going to the background then must not lock. */
  suspended: number;
  /** Wrong app PINs in a row and the time before which no PIN is accepted. */
  pinFailures: number;
  pinBlockedUntil: number;
}

export type LockEvent =
  | { type: 'start'; settings: Pick<AppSettings, 'appLock'> }
  /** `now` = Date.now(); `mono` = performance.now() (optional: tests and old callers use the wall clock only). */
  | { type: 'background'; now: number; mono?: number }
  | { type: 'foreground'; now: number; mono?: number; settings: Pick<AppSettings, 'appLock' | 'lockAfter'> }
  | { type: 'unlocked' }
  | { type: 'pin_failed'; now: number }
  | { type: 'suspend' }
  | { type: 'resume' }
  /** App lock turned off in S-23 (or all data deleted). */
  | { type: 'disabled' };

export const INITIAL_LOCK: LockState = { locked: false, backgroundedAt: null, backgroundedMono: null, suspended: 0, pinFailures: 0, pinBlockedUntil: 0 };

export function lockReducer(state: LockState, e: LockEvent): LockState {
  switch (e.type) {
    case 'start':
      return { ...state, locked: e.settings.appLock };
    case 'background':
      if (state.suspended > 0 || state.backgroundedAt != null) return state;
      return { ...state, backgroundedAt: e.now, backgroundedMono: e.mono ?? null };
    case 'foreground': {
      const from = state.backgroundedAt == null ? null : { wall: state.backgroundedAt, mono: state.backgroundedMono };
      const lock = state.suspended === 0 && shouldLockOnReturn(e.settings, from, { wall: e.now, mono: e.mono });
      return { ...state, backgroundedAt: null, backgroundedMono: null, locked: state.locked || lock };
    }
    case 'unlocked':
      return { ...state, locked: false, pinFailures: 0, pinBlockedUntil: 0 };
    case 'pin_failed': {
      const pinFailures = state.pinFailures + 1;
      return { ...state, pinFailures, pinBlockedUntil: e.now + pinWaitMs(pinFailures) };
    }
    case 'suspend':
      return { ...state, suspended: state.suspended + 1 };
    case 'resume':
      return { ...state, suspended: Math.max(0, state.suspended - 1) };
    case 'disabled':
      return { ...INITIAL_LOCK };
  }
}
