import { loadSampleRental } from '@/db/repos/sample';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';

import { makeBackupActions, type BackupEnv } from '../actions';
import { autoBackupDue, autoBackupFailedAt, backupErrorText, backupReminder, filesToPrune, runAutoBackup, snoozeBackupReminder, backupSnoozedUntil } from '../auto';
import { DEVICE_KEYS, setDeviceValue } from '../deviceStore';
import { BackupError } from '../format';
import { setBackupPassword } from '../service';
import { bytes, makeFakeFolder, makeFakeIO, testRng } from '../testing/fakes';

const day = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-12-20T15:00:00.000Z');

async function setup(opts: { password?: boolean } = {}) {
  const db = makeTestDb();
  loadSampleRental(db);
  if (opts.password !== false) await setBackupPassword(db, 'backup password', testRng, 1000);
  const { io } = makeFakeIO({ 'applicants/1/doc-1.jpg': bytes('jpg') });
  const folder = makeFakeFolder();
  return { db, io, folder, deps: { db, io, rng: testRng, now: () => NOW } };
}

describe('weekly automatic backup', () => {
  it('is due once a week, with a folder', () => {
    const base = { autoBackup: 'weekly' as const, backupFolderUri: 'content://x', lastBackupAt: null };
    expect(autoBackupDue(base, NOW)).toBe(true);
    expect(autoBackupDue({ ...base, lastBackupAt: new Date(NOW.getTime() - 6 * day).toISOString() }, NOW)).toBe(false);
    expect(autoBackupDue({ ...base, lastBackupAt: new Date(NOW.getTime() - 7 * day + 30 * 60_000).toISOString() }, NOW)).toBe(true);
    expect(autoBackupDue({ ...base, autoBackup: 'off' }, NOW)).toBe(false);
    expect(autoBackupDue({ ...base, backupFolderUri: null }, NOW)).toBe(false);
  });

  it('writes into the folder, records it, keeps the newest 3 of our files only', async () => {
    const { db, folder, deps } = await setup();
    updateSettings(db, { autoBackup: 'weekly', backupFolderUri: 'content://tree/x' });
    for (const n of ['Evenlease-backup-2026-11-01-0900.evenlease', 'Evenlease-backup-2026-11-08-0900.evenlease', 'Evenlease-backup-2026-11-15-0900.evenlease', 'notes.txt'])
      folder.files.set(n, bytes('old'));
    expect(await runAutoBackup(deps, () => folder.port)).toBe('done');
    expect([...folder.files.keys()].sort()).toEqual([
      'Evenlease-backup-2026-11-08-0900.evenlease',
      'Evenlease-backup-2026-11-15-0900.evenlease',
      expect.stringMatching(/^Evenlease-backup-2026-12-20-\d{4}\.evenlease$/),
      'notes.txt',
    ]);
    expect(getSettings(db).lastBackupAt).not.toBeNull();
    expect(await runAutoBackup(deps, () => folder.port)).toBe('not_due');
  });

  it('off / no password / folder gone → no throw; failure remembered for S-22', async () => {
    const { db, folder, deps } = await setup({ password: false });
    expect(await runAutoBackup(deps, () => folder.port)).toBe('off');
    updateSettings(db, { autoBackup: 'weekly', backupFolderUri: 'content://tree/x' });
    expect(await runAutoBackup(deps, () => folder.port)).toBe('no_password');
    await setBackupPassword(db, 'backup password', testRng, 1000);
    folder.setGone(true);
    expect(await runAutoBackup(deps, () => folder.port)).toBe('failed');
    expect(autoBackupFailedAt(db)).toBe(NOW.toISOString());
    folder.setGone(false);
    expect(await runAutoBackup(deps, () => folder.port)).toBe('done');
    expect(autoBackupFailedAt(db)).toBeNull();
  });

  it('prunes by name only', () => {
    expect(filesToPrune(['a.txt', 'Evenlease-backup-2026-01-01-0000.evenlease'], 0)).toEqual(['Evenlease-backup-2026-01-01-0000.evenlease']);
  });
});

describe('30-day reminder (S-02 banner)', () => {
  it('shows after 30 days, hides for 7 days on Later', async () => {
    const at = (d: number) => new Date(NOW.getTime() - d * day).toISOString();
    expect(backupReminder({ lastBackupAt: at(30) }, null, null, NOW).show).toBe(false);
    expect(backupReminder({ lastBackupAt: at(34) }, null, null, NOW)).toEqual({ show: true, days: 34 });
    expect(backupReminder({ lastBackupAt: null }, at(40), null, NOW)).toEqual({ show: true, days: null });
    expect(backupReminder({ lastBackupAt: null }, null, null, NOW).show).toBe(false);
    const { db } = await setup();
    snoozeBackupReminder(db, NOW);
    const until = backupSnoozedUntil(db);
    expect(backupReminder({ lastBackupAt: at(34) }, null, until, new Date(NOW.getTime() + 6 * day)).show).toBe(false);
    expect(backupReminder({ lastBackupAt: at(34) }, null, until, new Date(NOW.getTime() + 8 * day)).show).toBe(true);
  });

  it('error texts', () => {
    expect(backupErrorText(new BackupError('wrong_password'))).toBe('Wrong password. Check it and try again.');
    expect(backupErrorText(new BackupError('newer_version'))).toMatch(/newer version/);
    expect(backupErrorText(new Error('x'))).toBe('Something went wrong. Your data was not changed.');
  });
});

describe('S-22 actions', () => {
  async function env(over: Partial<BackupEnv> = {}) {
    const s = await setup();
    const shared: string[] = [];
    const refresh = jest.fn(async () => {});
    const e: BackupEnv = {
      db: s.db,
      io: s.io,
      rng: testRng,
      now: () => NOW,
      folder: () => s.folder.port,
      pickFolder: async () => ({ uri: 'content://tree/Evenlease', label: 'Evenlease' }),
      pickFile: async () => null,
      writeCache: (name) => `file:///cache/${name}`,
      share: async (uri) => {
        shared.push(uri);
        return true;
      },
      refreshReminders: refresh,
      ...over,
    };
    return { ...s, actions: makeBackupActions(e), shared, refresh };
  }

  it('"Back up now" without a folder → share sheet; with a folder → the folder', async () => {
    const t = await env();
    const r = await t.actions.backUpNow();
    expect(r.where).toBe('shared');
    expect(t.shared[0]).toMatch(/^file:\/\/\/cache\/Evenlease-backup-.*\.evenlease$/);
    // B-68: the share sheet can't tell saved from cancelled → nothing recorded until the landlord confirms.
    expect(getSettings(t.db).lastBackupAt).toBeNull();
    expect(t.refresh).not.toHaveBeenCalled();
    if (r.where !== 'shared') throw new Error('expected shared');
    await t.actions.confirmShared(r.made);
    expect(getSettings(t.db)).toMatchObject({ lastBackupAt: r.made.createdAt, lastBackupBytes: r.made.bytes.length });
    expect(t.refresh).toHaveBeenCalled();

    updateSettings(t.db, { backupFolderUri: 'content://tree/x' });
    updateSettings(t.db, { lastBackupAt: null });
    expect((await t.actions.backUpNow()).where).toBe('folder');
    expect(t.folder.files.size).toBe(1);
    expect(getSettings(t.db).lastBackupAt).not.toBeNull(); // a folder write is sure → recorded at once
  });

  it('B-68: share sheet cancelled (not confirmed) → no "Last backup", reminder not pushed back', async () => {
    const t = await env();
    expect((await t.actions.backUpNow()).where).toBe('shared');
    expect(getSettings(t.db).lastBackupAt).toBeNull();
    expect(t.refresh).not.toHaveBeenCalled();
  });

  it('no share sheet → nothing recorded', async () => {
    const t = await env({ share: async () => false });
    expect(await t.actions.backUpNow()).toEqual({ where: 'not_shared' });
    expect(getSettings(t.db).lastBackupAt).toBeNull();
  });

  it('Weekly picks the folder first and backs up right away; cancel keeps Off', async () => {
    const cancelled = await env({ pickFolder: async () => null });
    expect(await cancelled.actions.setAutomatic('weekly')).toBe('cancelled');
    expect(getSettings(cancelled.db).autoBackup).toBe('off');

    const t = await env();
    expect(await t.actions.setAutomatic('weekly')).toBe('done');
    expect(getSettings(t.db)).toMatchObject({ autoBackup: 'weekly', backupFolderUri: 'content://tree/Evenlease' });
    expect(t.actions.folderLabel()).toBe('Evenlease');
    setDeviceValue(t.db, DEVICE_KEYS.backupFolderLabel, 'primary:Documents'); // saved by an older build (B-76)
    expect(t.actions.folderLabel()).toBe('Documents');
    expect(t.folder.files.size).toBe(1);
    expect(await t.actions.setAutomatic('off')).toBe('off');
    expect(getSettings(t.db).autoBackup).toBe('off');
  });

  it('restore picker rejects a file that is not a backup before asking the password', async () => {
    const t = await env({ pickFile: async () => bytes('%PDF-1.7 not a backup at all, just a document file') });
    await expect(t.actions.pickRestoreFile()).rejects.toMatchObject({ code: 'not_backup' });
    const none = await env();
    await expect(none.actions.pickRestoreFile()).resolves.toBeNull();
  });
});
