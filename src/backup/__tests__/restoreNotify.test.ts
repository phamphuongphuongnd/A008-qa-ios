/**
 * B-120 family: Restore empties every table with DELETE without WHERE — on the phone SQLite's truncate shortcut sends
 * no change event, so useLive screens kept the old data. Restore must announce every table itself.
 * (In Jest the expo-sqlite listener never fires at all, like the truncate on the phone.)
 */
import { TABLE_NAMES } from '@/db/repos/data';
import { listRentals } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';

import { buildBackup, openBackup, restoreBackup, setBackupPassword } from '../service';
import { makeFakeIO, testRng } from '../testing/fakes';

jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: () => ({ remove() {} }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const live = require('@/db/useLive') as typeof import('@/db/useLive');

const ITER = 1000;

async function emptyPhoneBackup() {
  const db = makeTestDb();
  updateSettings(db, { onboarded: true, legalAcceptedAt: '2026-12-01T09:00:00.000-05:00' });
  await setBackupPassword(db, 'backup password', testRng, ITER);
  const made = await buildBackup({ db, io: makeFakeIO().io, rng: testRng });
  return openBackup(made.bytes, 'backup password');
}

describe('Restore tells open screens (useLive) that every table changed', () => {
  it('restoring an empty backup over a phone with data: rentals / applicants listeners fire', async () => {
    const phone = makeTestDb();
    loadSampleRental(phone);
    expect(listRentals(phone)).toHaveLength(1);

    const fired: string[] = [];
    const offR = live.subscribe(['rentals'], () => fired.push('rentals'));
    const offA = live.subscribe(['applicants'], () => fired.push('applicants'));
    const before = live.stampOf(TABLE_NAMES);

    await restoreBackup({ db: phone, io: makeFakeIO().io, rng: testRng, tablesChanged: live.markTablesChanged }, await emptyPhoneBackup());
    await new Promise((r) => setTimeout(r, 40)); // useLive coalesces changes for 16 ms

    expect(listRentals(phone)).toHaveLength(0);
    expect(fired.sort()).toEqual(['applicants', 'rentals']);
    // Every table's version moved (a screen on any table re-reads).
    const after = live.stampOf(TABLE_NAMES).split(',');
    before.split(',').forEach((v, i) => expect(Number(after[i])).toBeGreaterThan(Number(v)));
    offR();
    offA();
  });

  it('announces once, after the files are in place, even when a file move fails', async () => {
    const phone = makeTestDb();
    const opened = await emptyPhoneBackup();
    const calls: (readonly string[])[] = [];
    const { io } = makeFakeIO();
    const failing = { ...io, moveDir: async () => Promise.reject(new Error('disk')) };
    await expect(restoreBackup({ db: phone, io: failing, rng: testRng, tablesChanged: (t) => calls.push(t) }, opened)).rejects.toThrow('disk');
    expect(calls).toEqual([TABLE_NAMES]);
  });
});
