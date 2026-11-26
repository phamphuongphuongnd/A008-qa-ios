import { strToU8, zipSync } from 'fflate';

import { listApplicants } from '@/db/repos/applicants';
import { dumpAll } from '@/db/repos/data';
import { getSampleRental, listRentals } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import { evaluateApplicant } from '@/engine';
import { loadRentalForEngine } from '@/db/toEngine';

import { DEVICE_KEYS, getDeviceValue, setDeviceValue } from '../deviceStore';
import { seal, type BackupError } from '../format';
import { SCHEMA_VERSION, pack, unpack } from '../pack';
import {
  backupDump,
  backupFileName,
  buildBackup,
  formatBytes,
  hasBackupPassword,
  openBackup,
  recordBackup,
  restoreBackup,
  setBackupPassword,
  storedBackupKey,
} from '../service';
import { bytes, makeFakeIO, testRng } from '../testing/fakes';

const ITER = 1000;
const errCode = async (p: Promise<unknown>) => p.then(() => 'ok', (e: BackupError) => e.code);

async function phoneWithData() {
  const db = makeTestDb();
  loadSampleRental(db);
  updateSettings(db, {
    onboarded: true,
    legalAcceptedAt: '2026-12-01T09:00:00.000-05:00',
    landlordName: 'Alex Morgan',
    appLock: true,
    backupFolderUri: 'content://tree/old-phone',
  });
  const { io, files } = makeFakeIO({
    'applicants/1/doc-1.jpg': bytes('jpeg-1'),
    'applicants/2/letter-4.pdf': bytes('%PDF letter'),
    'rentals/1/movein-2.jpg': bytes('jpeg-movein'),
  });
  await setBackupPassword(db, 'backup password', testRng, ITER);
  return { db, io, files };
}

describe('make a backup', () => {
  it('needs the backup password first', async () => {
    const db = makeTestDb();
    expect(hasBackupPassword(db)).toBe(false);
    expect(await errCode(buildBackup({ db, io: makeFakeIO().io, rng: testRng }))).toBe('no_password');
  });

  it('packs every row and file, leaves this phone\'s own settings out, names the file by time', async () => {
    const { db, io } = await phoneWithData();
    const now = new Date(2026, 10, 30, 9, 5);
    const made = await buildBackup({ db, io, rng: testRng, now: () => now });
    expect(made.fileName).toBe('Evenlease-backup-2026-11-30-0905.evenlease');
    expect(made.counts).toEqual({ rentals: 1, applicants: 4, files: 3 });
    const dump = backupDump(db);
    const keys = dump.settings.map((r) => r.key);
    expect(keys).toContain('landlordName');
    expect(keys).not.toContain('appLock');
    expect(keys).not.toContain('backupFolderUri');
    expect(keys.some((k) => k.startsWith('device.'))).toBe(false);
    // Encrypted: no applicant name in the bytes.
    expect(Buffer.from(made.bytes).includes(Buffer.from('Jordan Ellis'))).toBe(false);

    recordBackup(db, made);
    expect(getSettings(db).lastBackupAt).toBe(made.createdAt);
    expect(getSettings(db).lastBackupBytes).toBe(made.bytes.length);
  });
});

describe('restore', () => {
  it('round-trips onto another phone: same rows, same files, same §8 results; the phone keeps its own lock / folder', async () => {
    const a = await phoneWithData();
    const made = await buildBackup({ db: a.db, io: a.io, rng: testRng });
    const beforeRows = dumpAll(a.db);
    const rentalId = getSampleRental(a.db)!.id;
    const before = loadRentalForEngine(a.db, rentalId)!;

    // Phone B: other data, other settings, an old staging leftover.
    const db = makeTestDb();
    updateSettings(db, { onboarded: true, legalAcceptedAt: '2027-01-01T08:00:00.000-05:00', appLock: false, theme: 'dark' });
    setDeviceValue(db, DEVICE_KEYS.backupSnoozedUntil, '2027-01-08T00:00:00.000Z');
    const b = makeFakeIO({ 'applicants/9/doc-9.jpg': bytes('old'), 'restore-staging/applicants/1/x.jpg': bytes('stale') });

    const opened = await openBackup(made.bytes, 'backup password');
    expect(opened.counts).toEqual({ rentals: 1, applicants: 4 });
    await restoreBackup({ db, io: b.io, rng: testRng }, opened);

    expect(listRentals(db)).toHaveLength(1);
    expect(listApplicants(db, rentalId).map((x) => x.fullName)).toEqual(listApplicants(a.db, rentalId).map((x) => x.fullName));
    for (const table of ['rentals', 'applicants', 'residences', 'incomes', 'documents', 'references', 'attempts', 'reports', 'criteria'] as const) {
      expect(dumpAll(db)[table]).toEqual(beforeRows[table]);
    }
    const after = loadRentalForEngine(db, rentalId)!;
    for (let i = 0; i < before.applicants.length; i++) {
      expect(evaluateApplicant(after.rental, after.criteria, after.applicants[i]).results).toEqual(
        evaluateApplicant(before.rental, before.criteria, before.applicants[i]).results,
      );
    }
    expect([...b.files.keys()].sort()).toEqual(['applicants/1/doc-1.jpg', 'applicants/2/letter-4.pdf', 'rentals/1/movein-2.jpg']);
    expect(Buffer.from(b.files.get('applicants/2/letter-4.pdf')!).toString()).toBe('%PDF letter');

    const s = getSettings(db);
    expect(s.landlordName).toBe('Alex Morgan'); // from the backup
    expect(s.theme).toBe('system'); // backup's value (default there)
    expect(s.appLock).toBe(false); // this phone's
    expect(s.backupFolderUri).toBeNull(); // the old phone's folder never comes along
    expect(s.legalAcceptedAt).toBe('2027-01-01T08:00:00.000-05:00');
    expect(getDeviceValue(db, DEVICE_KEYS.backupSnoozedUntil)).toBe('2027-01-08T00:00:00.000Z');
    // The password that opened the file is now this phone's backup password.
    expect(storedBackupKey(db)?.iterations).toBe(ITER);
  });

  it('wrong password / damaged file / newer file: nothing on the phone changes', async () => {
    const a = await phoneWithData();
    const made = await buildBackup({ db: a.db, io: a.io, rng: testRng });
    expect(await errCode(openBackup(made.bytes, 'not the password'))).toBe('wrong_password');
    const damaged = made.bytes.slice();
    damaged[damaged.length - 40] ^= 0x55;
    expect(await errCode(openBackup(damaged, 'backup password'))).toBe('corrupt');

    const key = storedBackupKey(a.db)!;
    const manifest = { app: 'evenlease', pack: 1, schema: SCHEMA_VERSION + 1, createdAt: 'x', appVersion: null, counts: {}, files: {} };
    const newer = seal(zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'data.json': strToU8('{"rentals":[]}') }), key, testRng);
    expect(await errCode(openBackup(newer, 'backup password'))).toBe('newer_version');
  });

  it('a failing file write leaves the old data and files', async () => {
    const a = await phoneWithData();
    const made = await buildBackup({ db: a.db, io: a.io, rng: testRng });
    const db = makeTestDb();
    updateSettings(db, { landlordName: 'Phone B' });
    const b = makeFakeIO({ 'applicants/9/doc-9.jpg': bytes('keep me') });
    b.io.failWrites = true;
    const opened = await openBackup(made.bytes, 'backup password');
    await expect(restoreBackup({ db, io: b.io, rng: testRng }, opened)).rejects.toThrow();
    expect(getSettings(db).landlordName).toBe('Phone B');
    expect([...b.files.keys()]).toEqual(['applicants/9/doc-9.jpg']);
  });
});

describe('pack', () => {
  const dump = () => dumpAll(makeTestDb());

  it('rejects a file whose bytes changed or whose path escapes the app folders', () => {
    const zip = pack({ dump: dump(), files: { 'applicants/1/a.jpg': bytes('abc') }, createdAt: 't', counts: { rentals: 0, applicants: 0 } });
    expect(unpack(zip).files['applicants/1/a.jpg']).toEqual(bytes('abc'));
    expect(() => pack({ dump: dump(), files: { '../evenlease.db': bytes('x') }, createdAt: 't', counts: { rentals: 0, applicants: 0 } })).toThrow();

    const evil = {
      app: 'evenlease',
      pack: 1,
      schema: SCHEMA_VERSION,
      createdAt: 't',
      appVersion: null,
      counts: {},
      files: { 'SQLite/evenlease.db': { size: 1, sha256: 'x' } },
    };
    const z = zipSync({ 'manifest.json': strToU8(JSON.stringify(evil)), 'data.json': strToU8(JSON.stringify(dump())) });
    expect(() => unpack(z)).toThrow(expect.objectContaining({ code: 'corrupt' }));
    expect(() => unpack(strToU8('not a zip'))).toThrow(expect.objectContaining({ code: 'corrupt' }));
  });
});

describe('labels', () => {
  it('file name and size', () => {
    expect(backupFileName(new Date(2027, 0, 2, 23, 59))).toBe('Evenlease-backup-2027-01-02-2359.evenlease');
    expect(formatBytes(12_400_000)).toBe('12.4 MB');
    expect(formatBytes(850_000)).toBe('850 KB');
    expect(formatBytes(12)).toBe('12 B');
  });
});
