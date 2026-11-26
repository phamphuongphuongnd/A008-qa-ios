/**
 * Step 4 QA: first-run defaults match APP.md / product.md in one place (S-03, S-04 §3.2, S-21–S-24, S-19), and a
 * reinstall over the same database (migrations run again) keeps the data — "cài đè".
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import * as R from '@/db/repos/rentals';
import { DEFAULT_SETTINGS, getSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import { defaultCriteria } from '@/engine';

import { emptyRentalForm } from '../../units/rentalForm';

describe('first-run defaults', () => {
  it('settings: System theme, no lock, auto backup Off, cleanup reminder 60 days, reminders on, not onboarded', () => {
    const s = getSettings(makeTestDb());
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s).toMatchObject({
      onboarded: false,
      legalAcceptedAt: null,
      theme: 'system',
      appLock: false,
      lockAfter: 'immediately',
      autoBackup: 'off',
      lastBackupAt: null,
      cleanupAfterDays: 60,
      reminders: { backup: true, cleanup: true, timers: true },
      applicantMode: null,
    });
  });

  it('new rental: Compare mode, $0 application fee, non-smoking, 1 bedroom', () => {
    expect(emptyRentalForm()).toMatchObject({ reviewMode: 'compare', feeCents: 0, smokingPolicy: 'non_smoking', bedrooms: 1, rentCents: null });
  });

  it('criteria template (§3.2): C1 3.0× voucher ON · C2 12 · C3 5 · C7 2 · C8 case by case · C9 600 off · C10 7 y off', () => {
    const c = Object.fromEntries(defaultCriteria().map((x) => [x.code, x]));
    expect(c.C1).toMatchObject({ enabled: true, params: { multipleTenths: 30, applyToTenantShare: true } });
    expect(c.C2.params).toEqual({ months: 12 });
    expect(c.C3.params).toEqual({ years: 5 });
    expect(c.C6.params).toEqual({ documents: [{ type: 'photo_id' }, { type: 'proof_of_income' }] });
    expect(c.C7.params).toEqual({ perBedroom: 2 });
    expect(c.C8).toMatchObject({ enabled: true, params: { policy: 'case_by_case' } });
    expect(c.C9).toMatchObject({ enabled: false, params: { minScore: 600 } });
    expect(c.C10).toMatchObject({ enabled: false, params: { lookbackYears: 7 } });
  });
});

describe('install over an existing install (migrations again)', () => {
  it('running the bundled migrations a second time changes nothing and keeps the rows', () => {
    const db = makeTestDb();
    const id = R.createRental(db, { street: '1 Keep St', rentCents: 120000, bedrooms: 1 });
    expect(() => migrate(db as never, { migrationsFolder: path.join(__dirname, '../../../../drizzle') })).not.toThrow();
    expect(R.getRental(db, id)?.street).toBe('1 Keep St');
    expect(R.listRentals(db)).toHaveLength(1);
  });
});
