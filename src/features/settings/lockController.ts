/**
 * App lock at runtime: one store for the whole app (the root layout's gate reads it), plus the unlock action shared
 * with Applicant mode (2B). Pure transitions live in lock.ts; the phone prompt in lockNative.ts.
 */
import type { AppSettings } from '@/db/repos/settings';

import { INITIAL_LOCK, landlordUnlockMethod, lockReducer, verifyPin, type LockEvent, type LockState } from './lock';
import type { AuthAdapter, AuthResult } from './lockNative';

type Listener = () => void;

export function createLockStore(initial: LockState = INITIAL_LOCK) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    dispatch(e: LockEvent) {
      const next = lockReducer(state, e);
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
export type LockStore = ReturnType<typeof createLockStore>;

/** The app's lock store. */
export const lockStore = createLockStore();

/**
 * Run a system sheet we open (share sheet, document / folder picker, camera, print) without it counting as leaving the
 * app — "Lock after: Immediately" would otherwise lock the landlord out after every share.
 */
export async function withLockSuspended<T>(fn: () => Promise<T>, store: LockStore = lockStore): Promise<T> {
  store.dispatch({ type: 'suspend' });
  try {
    return await fn();
  } finally {
    store.dispatch({ type: 'resume' });
  }
}

export type UnlockOutcome = AuthResult | 'needs_pin' | 'use_pin';

/**
 * Ask the landlord to prove it is them (App lock gate, leaving Applicant mode). 'use_pin' = this phone uses the app
 * PIN: show the PIN pad and call `unlockWithPin`. 'needs_pin' = no system lock and no PIN yet (S-23 sets one).
 */
export async function unlockLandlord(
  adapter: AuthAdapter,
  settings: Pick<AppSettings, 'appPinHash'>,
  text: { prompt: string; cancel: string },
  store: LockStore = lockStore,
): Promise<UnlockOutcome> {
  const method = landlordUnlockMethod(await adapter.capability(), settings);
  if (method === 'needs_pin') return 'needs_pin';
  if (method === 'pin') return 'use_pin';
  // A prompt the system dropped without answering would block the next one (B-53).
  await adapter.cancel();
  const r = await withLockSuspended(() => adapter.authenticate(text.prompt, text.cancel), store);
  if (r === 'success') store.dispatch({ type: 'unlocked' });
  return r;
}

export type PinOutcome = 'success' | 'wrong' | 'blocked';

/** PIN pad submit. Wrong PINs in a row block entry for a while (`pinBlockedUntil`, shown as a countdown). */
export function unlockWithPin(
  pin: string,
  settings: Pick<AppSettings, 'appPinHash'>,
  now: number = Date.now(),
  store: LockStore = lockStore,
): PinOutcome {
  if (store.get().pinBlockedUntil > now) return 'blocked';
  if (verifyPin(pin, settings.appPinHash)) {
    store.dispatch({ type: 'unlocked' });
    return 'success';
  }
  store.dispatch({ type: 'pin_failed', now });
  return 'wrong';
}
