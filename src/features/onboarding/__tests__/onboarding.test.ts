import { getSampleRental, listRentals } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';

import {
  INITIAL_ONBOARDING,
  canFinish,
  finishOnboarding,
  hasSampleRental,
  loadSample,
  needsOnboarding,
  onboardingReducer,
  removeSample,
  showsSkip,
  type OnboardingAction,
} from '../onboarding';

const run = (actions: OnboardingAction[]) => actions.reduce(onboardingReducer, INITIAL_ONBOARDING);

describe('S-01 pages', () => {
  it('Next walks the 3 pages; Skip jumps to page 3 but not past the tick', () => {
    expect(run([{ type: 'next' }]).page).toBe(1);
    expect(run([{ type: 'next' }, { type: 'next' }, { type: 'next' }]).page).toBe(2);
    expect(run([{ type: 'back' }]).page).toBe(0);
    const skipped = run([{ type: 'skip' }]);
    expect(skipped.page).toBe(2);
    expect(showsSkip(skipped)).toBe(false);
    expect(showsSkip(INITIAL_ONBOARDING)).toBe(true);
    expect(canFinish(skipped)).toBe(false);
    expect(canFinish(onboardingReducer(skipped, { type: 'toggleAccepted' }))).toBe(true);
    // Ticked on page 3, then back to page 2: the finish buttons are not on that page.
    expect(canFinish(run([{ type: 'skip' }, { type: 'toggleAccepted' }, { type: 'back' }]))).toBe(false);
  });
});

describe('finish onboarding', () => {
  it('needs the tick', () => {
    const db = makeTestDb();
    expect(() => finishOnboarding(db, { accepted: false, withSample: false })).toThrow();
    expect(needsOnboarding(getSettings(db))).toBe(true);
  });

  it('"Get started": records acceptance, no sample, goes to Rentals', () => {
    const db = makeTestDb();
    const r = finishOnboarding(db, { accepted: true, withSample: false, at: '2026-12-01T09:00:00.000-05:00' });
    expect(r).toEqual({ sampleRentalId: null, next: '/' });
    const s = getSettings(db);
    expect(s.onboarded).toBe(true);
    expect(s.legalAcceptedAt).toBe('2026-12-01T09:00:00.000-05:00');
    expect(needsOnboarding(s)).toBe(false);
    expect(listRentals(db)).toHaveLength(0);
  });

  it('"Explore with a sample rental": loads §8 and opens its hub', () => {
    const db = makeTestDb();
    const r = finishOnboarding(db, { accepted: true, withSample: true });
    expect(r.sampleRentalId).toBe(getSampleRental(db)?.id);
    expect(r.next).toBe(`/units/${r.sampleRentalId}`);
    expect(getSampleRental(db)?.street).toContain('1428 Maple St');
  });
});

describe('sample rental (S-21)', () => {
  it('loads once and removes in one tap', () => {
    const db = makeTestDb();
    const files = makeTestFiles();
    expect(hasSampleRental(db)).toBe(false);
    const id = loadSample(db);
    expect(loadSample(db)).toBe(id);
    expect(hasSampleRental(db)).toBe(true);
    removeSample(db, files);
    expect(hasSampleRental(db)).toBe(false);
    expect(listRentals(db)).toHaveLength(0);
  });
});
