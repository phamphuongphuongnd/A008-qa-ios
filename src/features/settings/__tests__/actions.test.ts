import { createRental } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import { makeFakeNotifications } from '@/notifications/adapter';
import { randomBytes } from 'crypto';

import { saveContact, setAppLock, setAppPin, setCleanupAfter, setReminders } from '../actions';
import { verifyPin } from '../lock';

const rng = (n: number) => new Uint8Array(randomBytes(n));
const noLock = { biometric: null, deviceSecure: false };
const face = { biometric: 'face' as const, deviceSecure: true };

describe('settings actions', () => {
  it('contact: validates, then saves normalized', () => {
    const db = makeTestDb();
    expect(saveContact(db, { landlordName: 'Alex', landlordAddress: '', landlordPhone: '123' }).landlordPhone).toBeDefined();
    expect(getSettings(db).landlordName).toBe('');
    expect(saveContact(db, { landlordName: ' Alex Morgan ', landlordAddress: '12 Elm St', landlordPhone: '614 555 0142' })).toEqual({});
    expect(getSettings(db)).toMatchObject({ landlordName: 'Alex Morgan', landlordPhone: '(614) 555-0142' });
  });

  it('App lock: on with Face ID; a phone with no lock needs a PIN first; off forgets the PIN', () => {
    const db = makeTestDb();
    expect(setAppLock(db, true, face)).toBe('ok');
    expect(getSettings(db).appLock).toBe(true);
    setAppLock(db, false, face);

    expect(setAppLock(db, true, noLock)).toBe('needs_pin');
    expect(getSettings(db).appLock).toBe(false);
    expect(setAppPin(db, '12', '12', rng)).toBe('format');
    expect(setAppPin(db, '1234', '4321', rng)).toBe('mismatch');
    expect(setAppPin(db, '2580', '2580', rng, { enableLock: true })).toBeNull();
    const s = getSettings(db);
    expect(s.appLock).toBe(true);
    expect(verifyPin('2580', s.appPinHash)).toBe(true);
    expect(setAppLock(db, true, noLock)).toBe('ok');
    setAppLock(db, false, noLock);
    expect(getSettings(db)).toMatchObject({ appLock: false, appPinHash: null });
  });

  it('turning a reminder on asks permission once and re-plans', async () => {
    const db = makeTestDb();
    createRental(db, { street: '1 A St', city: 'X', state: 'OH', zip: '43215', rentCents: 100000 });
    const n = makeFakeNotifications('undetermined');
    const now = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    expect(await setReminders(db, n.adapter, { backup: false, cleanup: false, timers: true }, now)).toBe(false);
    expect(n.asked()).toBe(0);
    expect(await setReminders(db, n.adapter, { backup: true, cleanup: false, timers: true }, now)).toBe(true);
    expect(n.asked()).toBe(1);
    expect([...n.scheduled.keys()]).toEqual(['reminder-backup']);
    await setCleanupAfter(db, n.adapter, null, now);
    expect(getSettings(db).cleanupAfterDays).toBeNull();
  });
});
