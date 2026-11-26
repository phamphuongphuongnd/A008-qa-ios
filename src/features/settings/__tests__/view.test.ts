import { DEFAULT_SETTINGS } from '@/db/repos/settings';

import { appLockView, backupView, settingsSections } from '../view';

const bytes = (n: number) => `${n} B`;

describe('S-21 settings rows', () => {
  it('lists the sections in mockup order with values', () => {
    const sections = settingsSections({
      settings: { ...DEFAULT_SETTINGS, landlordName: '  Alex Morgan ' },
      now: new Date('2026-12-01T10:00:00Z'),
      biometric: null,
      ios: false,
      cleanupCount: 0,
      hasSample: true,
      appVersion: { version: '1.0', build: '1' },
    });
    expect(sections.map((s) => s.rows.map((r) => r.key))).toEqual([
      ['name', 'contact'],
      ['appLock', 'backup', 'cleanup'],
      ['appearance', 'reminders', 'sample'],
      ['legal', 'about', 'deleteAll'],
    ]);
    const rows = Object.fromEntries(sections.flatMap((s) => s.rows).map((r) => [r.key, r]));
    expect(rows.name.value).toBe('Alex Morgan');
    expect(rows.deleteAll.danger).toBe(true);
    expect(rows.about).toMatchObject({ value: 'Version 1.0 (1)', chevron: true });
    expect(rows.sample.title).not.toBe(
      settingsSections({ settings: DEFAULT_SETTINGS, now: new Date(), biometric: null, ios: false, cleanupCount: 0, hasSample: false, appVersion: { version: null, build: null } })[2]
        .rows[2].title,
    );
  });
});

describe('S-22 backup view', () => {
  it('last backup line, folder help, failure flag, password first', () => {
    const none = backupView({ hasPassword: false, last: null, autoBackup: 'off', folderLabel: null, autoFailedAt: null }, false, bytes);
    expect(none.needsPassword).toBe(true);
    expect(none.autoFailed).toBe(false);
    const v = backupView(
      { hasPassword: true, last: { at: '2026-11-30T09:00:00Z', bytes: 1234 }, autoBackup: 'weekly', folderLabel: 'Drive', autoFailedAt: '2026-12-07T09:00:00Z' },
      true,
      bytes,
    );
    expect(v.lastLine).toContain('Nov 30, 2026');
    expect(v.lastLine).toContain('1234 B');
    expect(v.folderHelp).toContain('Drive');
    expect(v.autoFailed).toBe(true);
    expect(v.needsPassword).toBe(false);
    expect(none.lastLine).not.toBe(v.lastLine);
  });
});

describe('S-23 app lock view', () => {
  it('names the method; a phone without any lock needs an app PIN first', () => {
    const face = appLockView({ appLock: true, appPinHash: null }, { biometric: 'face', deviceSecure: true }, true);
    expect(face.showLockAfter).toBe(true);
    expect(face.usesAppPin).toBe(false);
    expect(face.needsPinFirst).toBe(false);
    const bare = appLockView({ appLock: false, appPinHash: null }, { biometric: null, deviceSecure: false }, false);
    expect(bare.usesAppPin).toBe(true);
    expect(bare.needsPinFirst).toBe(true);
    expect(bare.showLockAfter).toBe(false);
    expect(appLockView({ appLock: false, appPinHash: 'x' }, { biometric: null, deviceSecure: false }, false).needsPinFirst).toBe(false);
    expect(new Set([face.switchTitle, bare.switchTitle]).size).toBe(2);
  });
});
