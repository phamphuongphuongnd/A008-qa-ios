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
export type BiometricKind = 'face' | 'fingerprint' | 'iris';

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

/** After `ms` in the background the app locks again (only when App lock is on). */
export function shouldLockOnReturn(
  s: Pick<AppSettings, 'appLock' | 'lockAfter'>,
  backgroundedAt: number | null,
  now: number,
): boolean {
  if (!s.appLock || backgroundedAt == null) return false;
  return now - backgroundedAt >= LOCK_AFTER_MS[s.lockAfter];
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
  /** When the app last went to the background (ms), null while in front. */
  backgroundedAt: number | null;
  /** System pickers / share sheet / camera open: going to the background then must not lock. */
  suspended: number;
  /** Wrong app PINs in a row and the time before which no PIN is accepted. */
  pinFailures: number;
  pinBlockedUntil: number;
}

export type LockEvent =
  | { type: 'start'; settings: Pick<AppSettings, 'appLock'> }
  | { type: 'background'; now: number }
  | { type: 'foreground'; now: number; settings: Pick<AppSettings, 'appLock' | 'lockAfter'> }
  | { type: 'unlocked' }
  | { type: 'pin_failed'; now: number }
  | { type: 'suspend' }
  | { type: 'resume' }
  /** App lock turned off in S-23 (or all data deleted). */
  | { type: 'disabled' };

export const INITIAL_LOCK: LockState = { locked: false, backgroundedAt: null, suspended: 0, pinFailures: 0, pinBlockedUntil: 0 };

export function lockReducer(state: LockState, e: LockEvent): LockState {
  switch (e.type) {
    case 'start':
      return { ...state, locked: e.settings.appLock };
    case 'background':
      if (state.suspended > 0 || state.backgroundedAt != null) return state;
      return { ...state, backgroundedAt: e.now };
    case 'foreground': {
      const lock = state.suspended === 0 && shouldLockOnReturn(e.settings, state.backgroundedAt, e.now);
      return { ...state, backgroundedAt: null, locked: state.locked || lock };
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
