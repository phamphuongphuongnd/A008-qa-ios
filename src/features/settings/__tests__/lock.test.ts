import {
  INITIAL_LOCK,
  awayMs,
  canEnableLock,
  hashPin,
  landlordUnlockMethod,
  lockReducer,
  pinWaitMs,
  shouldLockOnReturn,
  validateNewPin,
  verifyPin,
  type LockState,
} from '../lock';
import { createLockStore, unlockLandlord, unlockWithPin, withLockSuspended } from '../lockController';
import type { AuthAdapter } from '../lockNative';

jest.mock('../lockNative', () => ({ expoAuthAdapter: {} }));

const SALT = new Uint8Array(16).fill(3);
const on = { appLock: true, lockAfter: '1min' as const };

describe('lock timing', () => {
  it('locks only when on and away at least "Lock after"', () => {
    expect(shouldLockOnReturn(on, 0, 59_999)).toBe(false);
    expect(shouldLockOnReturn(on, 0, 60_000)).toBe(true);
    expect(shouldLockOnReturn({ ...on, lockAfter: 'immediately' }, 1000, 1000)).toBe(true);
    expect(shouldLockOnReturn({ ...on, lockAfter: '5min' }, 0, 299_000)).toBe(false);
    expect(shouldLockOnReturn({ ...on, appLock: false }, 0, 10_000_000)).toBe(false);
    expect(shouldLockOnReturn(on, null, 10_000_000)).toBe(false);
  });
});

describe('unlock method', () => {
  it('uses the system prompt when the phone has biometrics or a passcode, else the app PIN', () => {
    expect(landlordUnlockMethod({ biometric: 'face', deviceSecure: true }, { appPinHash: null })).toBe('system');
    expect(landlordUnlockMethod({ biometric: null, deviceSecure: true }, { appPinHash: null })).toBe('system');
    expect(landlordUnlockMethod({ biometric: null, deviceSecure: false }, { appPinHash: null })).toBe('needs_pin');
    expect(landlordUnlockMethod({ biometric: null, deviceSecure: false }, { appPinHash: 'x' })).toBe('pin');
    expect(canEnableLock({ biometric: null, deviceSecure: false }, { appPinHash: null })).toBe(false);
  });
});

describe('app PIN', () => {
  it('validates 4–6 digits typed twice', () => {
    expect(validateNewPin('123', '123')).toBe('format');
    expect(validateNewPin('1234567', '1234567')).toBe('format');
    expect(validateNewPin('12a4', '12a4')).toBe('format');
    expect(validateNewPin('1234', '1235')).toBe('mismatch');
    expect(validateNewPin('123456', '123456')).toBeNull();
  });

  it('stores a salted hash, never the PIN, and verifies', () => {
    const stored = hashPin('2468', SALT, 1000);
    expect(stored).toMatch(/^p1:1000:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(stored).not.toContain('2468');
    expect(verifyPin('2468', stored)).toBe(true);
    expect(verifyPin('2469', stored)).toBe(false);
    expect(verifyPin('2468', null)).toBe(false);
    expect(verifyPin('2468', 'garbage')).toBe(false);
    expect(verifyPin('2468', 'p1:1000:zz:zz')).toBe(false);
    expect(hashPin('2468', new Uint8Array(16).fill(4), 1000)).not.toBe(stored);
  });

  it('waits after 5 wrong PINs, doubling up to 15 min', () => {
    expect(pinWaitMs(4)).toBe(0);
    expect(pinWaitMs(5)).toBe(30_000);
    expect(pinWaitMs(6)).toBe(60_000);
    expect(pinWaitMs(20)).toBe(15 * 60_000);
  });
});

describe('lock state machine', () => {
  const run = (events: Parameters<typeof lockReducer>[1][], from: LockState = INITIAL_LOCK) => events.reduce(lockReducer, from);

  it('locks at start when on; unlock clears', () => {
    expect(run([{ type: 'start', settings: { appLock: true } }]).locked).toBe(true);
    expect(run([{ type: 'start', settings: { appLock: false } }]).locked).toBe(false);
    expect(run([{ type: 'start', settings: { appLock: true } }, { type: 'unlocked' }]).locked).toBe(false);
  });

  it('locks on return after Lock after, not before', () => {
    const away = (ms: number) =>
      run([
        { type: 'background', now: 1000 },
        { type: 'foreground', now: 1000 + ms, settings: on },
      ]);
    expect(away(30_000).locked).toBe(false);
    expect(away(61_000).locked).toBe(true);
    expect(away(61_000).backgroundedAt).toBeNull();
  });

  it('B-76: moving the wall clock back while away still locks (monotonic clock / backwards clock)', () => {
    // Away 70 s by the monotonic clock, wall clock set back 30 s → wall says 40 s.
    const setBack = run([
      { type: 'background', now: 100_000, mono: 5_000 },
      { type: 'foreground', now: 140_000, mono: 75_000, settings: on },
    ]);
    expect(setBack.locked).toBe(true);
    expect(setBack.backgroundedMono).toBeNull();
    // Wall clock moved back past the moment we left: can't tell how long → lock.
    expect(run([{ type: 'background', now: 100_000, mono: 5_000 }, { type: 'foreground', now: 40_000, mono: 6_000, settings: on }]).locked).toBe(true);
    // Phone asleep (monotonic clock stopped) but 2 min passed on the wall clock → lock.
    expect(run([{ type: 'background', now: 0, mono: 5_000 }, { type: 'foreground', now: 120_000, mono: 5_100, settings: on }]).locked).toBe(true);
    // Short trip on both clocks → no lock.
    expect(run([{ type: 'background', now: 0, mono: 5_000 }, { type: 'foreground', now: 30_000, mono: 35_000, settings: on }]).locked).toBe(false);
  });

  it('awayMs takes the larger clock; a backwards wall clock is Infinity', () => {
    expect(awayMs({ wall: 0, mono: 0 }, { wall: 10, mono: 50 })).toBe(50);
    expect(awayMs({ wall: 0, mono: 0 }, { wall: 90, mono: 50 })).toBe(90);
    expect(awayMs({ wall: 0 }, { wall: 90, mono: 50 })).toBe(90);
    expect(awayMs({ wall: 100, mono: 0 }, { wall: 99, mono: 1 })).toBe(Infinity);
    expect(shouldLockOnReturn(on, 0, 61_000)).toBe(true);
  });

  it('a system sheet we opened (share, picker) never locks', () => {
    const s = run([
      { type: 'suspend' },
      { type: 'background', now: 0 },
      { type: 'resume' },
      { type: 'foreground', now: 10 * 60_000, settings: { appLock: true, lockAfter: 'immediately' } },
    ]);
    expect(s.locked).toBe(false);
    expect(s.suspended).toBe(0);
  });

  it('keeps the first background time (a second event does not restart the clock)', () => {
    const s = run([
      { type: 'background', now: 0 },
      { type: 'background', now: 50_000 },
      { type: 'foreground', now: 61_000, settings: on },
    ]);
    expect(s.locked).toBe(true);
  });

  it('counts wrong PINs and resets on unlock / disable', () => {
    let s = run([
      { type: 'pin_failed', now: 0 },
      { type: 'pin_failed', now: 0 },
      { type: 'pin_failed', now: 0 },
      { type: 'pin_failed', now: 0 },
      { type: 'pin_failed', now: 100 },
    ]);
    expect(s.pinFailures).toBe(5);
    expect(s.pinBlockedUntil).toBe(30_100);
    s = lockReducer(s, { type: 'unlocked' });
    expect(s.pinFailures).toBe(0);
    expect(lockReducer({ ...s, locked: true }, { type: 'disabled' })).toEqual(INITIAL_LOCK);
  });
});

describe('lock controller', () => {
  const adapter = (over: Partial<AuthAdapter> = {}): AuthAdapter => ({
    capability: jest.fn(async () => ({ biometric: 'fingerprint' as const, deviceSecure: true })),
    authenticate: jest.fn(async () => 'success' as const),
    cancel: jest.fn(async () => {}),
    ...over,
  });

  it('unlocks with the system prompt and suspends locking while it is open', async () => {
    const store = createLockStore({ ...INITIAL_LOCK, locked: true });
    let suspendedDuring = -1;
    const a = adapter({
      authenticate: jest.fn(async () => {
        suspendedDuring = store.get().suspended;
        return 'success' as const;
      }),
    });
    await expect(unlockLandlord(a, { appPinHash: null }, { prompt: 'p', cancel: 'c' }, store)).resolves.toBe('success');
    expect(a.cancel).toHaveBeenCalled();
    expect(suspendedDuring).toBe(1);
    expect(store.get()).toMatchObject({ locked: false, suspended: 0 });
  });

  it('stays locked on cancel; tells the screen to show the PIN pad / set a PIN', async () => {
    const store = createLockStore({ ...INITIAL_LOCK, locked: true });
    await expect(
      unlockLandlord(adapter({ authenticate: jest.fn(async () => 'cancel' as const) }), { appPinHash: null }, { prompt: 'p', cancel: 'c' }, store),
    ).resolves.toBe('cancel');
    expect(store.get().locked).toBe(true);
    const noLock = adapter({ capability: jest.fn(async () => ({ biometric: null, deviceSecure: false })) });
    await expect(unlockLandlord(noLock, { appPinHash: null }, { prompt: 'p', cancel: 'c' }, store)).resolves.toBe('needs_pin');
    await expect(unlockLandlord(noLock, { appPinHash: 'h' }, { prompt: 'p', cancel: 'c' }, store)).resolves.toBe('use_pin');
    expect(noLock.authenticate).not.toHaveBeenCalled();
  });

  it('PIN pad: right PIN unlocks, 5 wrong ones block', () => {
    const store = createLockStore({ ...INITIAL_LOCK, locked: true });
    const s = { appPinHash: hashPin('1357', SALT, 1000) };
    for (let i = 0; i < 5; i++) expect(unlockWithPin('0000', s, 1000, store)).toBe('wrong');
    expect(unlockWithPin('1357', s, 2000, store)).toBe('blocked');
    expect(unlockWithPin('1357', s, 31_001, store)).toBe('success');
    expect(store.get().locked).toBe(false);
  });

  it('withLockSuspended resumes even when the sheet throws', async () => {
    const store = createLockStore();
    await expect(withLockSuspended(async () => Promise.reject(new Error('x')), store)).rejects.toThrow('x');
    expect(store.get().suspended).toBe(0);
  });
});
