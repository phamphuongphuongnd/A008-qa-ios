import {
  appLockRowValue,
  appearanceRowValue,
  backupRowValue,
  cleanupRowValue,
  daysSince,
  formatUsPhone,
  normalizeContact,
  relativeDays,
  validateContact,
} from '../summary';

const now = new Date(2026, 11, 20, 9, 0); // Dec 20, 2026 local

describe('S-21 row values', () => {
  it('counts calendar days', () => {
    expect(daysSince(new Date(2026, 10, 16, 23, 0).toISOString(), now)).toBe(34);
    expect(daysSince(new Date(2026, 11, 20, 0, 1).toISOString(), now)).toBe(0);
    expect(daysSince(new Date(2027, 0, 1).toISOString(), now)).toBe(0);
    expect(daysSince('nope', now)).toBe(0);
  });

  it('says Today / Yesterday / n days ago / Never', () => {
    expect(relativeDays(0)).toBe('Today');
    expect(relativeDays(1)).toBe('Yesterday');
    expect(relativeDays(34)).toBe('34 days ago');
    expect(backupRowValue({ lastBackupAt: null }, now)).toBe('Never');
    expect(backupRowValue({ lastBackupAt: new Date(2026, 10, 16).toISOString() }, now)).toBe('34 days ago');
  });

  it('names the lock method like the mockup ("Face ID")', () => {
    expect(appLockRowValue({ appLock: false, appPinHash: null }, 'face', true)).toBe('Off');
    expect(appLockRowValue({ appLock: true, appPinHash: null }, 'face', true)).toBe('Face ID');
    expect(appLockRowValue({ appLock: true, appPinHash: null }, 'fingerprint', false)).toBe('Fingerprint');
    expect(appLockRowValue({ appLock: true, appPinHash: null }, null, false)).toBe('Phone passcode');
    expect(appLockRowValue({ appLock: true, appPinHash: 'h' }, null, false)).toBe('App PIN');
  });

  it('cleanup and appearance', () => {
    expect(cleanupRowValue(0)).toBe('None');
    expect(cleanupRowValue(1)).toBe('1 rental');
    expect(cleanupRowValue(2)).toBe('2 rentals');
    expect(appearanceRowValue('system')).toBe('System');
  });
});

describe('landlord contact', () => {
  const ok = { landlordName: 'Alex Morgan', landlordAddress: '12 Elm St\nColumbus, OH 43215', landlordPhone: '614-555-0142' };

  it('accepts empty fields and a US phone', () => {
    expect(validateContact(ok)).toEqual({});
    expect(validateContact({ landlordName: '', landlordAddress: '', landlordPhone: '' })).toEqual({});
    expect(validateContact({ ...ok, landlordPhone: '+1 (614) 555-0142' })).toEqual({});
  });

  it('rejects a bad phone and long text', () => {
    expect(validateContact({ ...ok, landlordPhone: '555-0142' }).landlordPhone).toBe('Enter a 10-digit US phone number.');
    expect(validateContact({ ...ok, landlordPhone: '614 555 0142 ext 3' }).landlordPhone).toBeDefined();
    expect(validateContact({ ...ok, landlordName: 'x'.repeat(81) }).landlordName).toBeDefined();
  });

  it('normalizes for saving', () => {
    expect(formatUsPhone('16145550142')).toBe('(614) 555-0142');
    expect(normalizeContact({ landlordName: ' Alex ', landlordAddress: ' 12 Elm St \n\n Columbus ', landlordPhone: '6145550142' })).toEqual({
      landlordName: 'Alex',
      landlordAddress: '12 Elm St\nColumbus',
      landlordPhone: '(614) 555-0142',
    });
  });
});
