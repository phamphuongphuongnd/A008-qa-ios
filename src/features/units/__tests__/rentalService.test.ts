import * as A from '@/db/repos/applicants';
import * as C from '@/db/repos/criteria';
import * as Dec from '@/db/repos/decisions';
import * as R from '@/db/repos/rentals';
import * as Set from '@/db/repos/settings';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import type { AppDb } from '@/db/types';
import { describeHistoryEntry } from '@/features/criteria/criteriaService';

import { emptyRentalForm, rentalToForm, type RentalForm } from '../rentalForm';
import {
  closeRental,
  createRentalFromForm,
  deleteRentalAndData,
  deleteRentalMessage,
  openSampleRental,
  planReviewModeChange,
  reopenRental,
  updateRentalFromForm,
} from '../rentalService';

const AT = '2026-12-05T10:00:00-05:00';

const form = (extra: Partial<RentalForm> = {}): RentalForm => ({
  ...emptyRentalForm(),
  street: '77 Pine Ave',
  unit: 'Apt 3',
  city: 'Seattle',
  state: 'WA',
  zip: '98101',
  rentCents: 210000,
  bedrooms: 1,
  ...extra,
});

function create(db: AppDb, extra: Partial<RentalForm> = {}): number {
  const r = createRentalFromForm(db, form(extra));
  if (!r.ok) throw new Error('create failed');
  return r.id;
}

function addApplicant(db: AppDb, rentalId: number, name = 'Jordan Ellis') {
  return A.createApplicant(db, { rentalId, receivedAt: '2026-12-02T09:14:00-05:00', fullName: name, occupants: 1 });
}

describe('create rental (S-03 → S-04)', () => {
  it('saves the rental with the §3.2 default criteria', () => {
    const db = makeTestDb();
    const id = create(db);
    const rental = R.getRental(db, id)!;
    expect(rental).toMatchObject({ street: '77 Pine Ave', rentCents: 210000, status: 'open', reviewMode: 'compare', feeCents: 0 });
    const crit = C.listCriteria(db, id);
    expect(crit.map((c) => c.code)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']);
    expect(crit.find((c) => c.code === 'C8')!.params).toEqual({ policy: 'case_by_case', maxPets: 2 });
    expect(crit.filter((c) => !c.enabled).map((c) => c.code)).toEqual(['C9', 'C10']);
  });

  it('returns the errors and writes nothing when invalid', () => {
    const db = makeTestDb();
    const r = createRentalFromForm(db, form({ street: '', zip: '9810' }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual({ street: 'streetRequired', zip: 'zip' });
    expect(R.listRentals(db)).toHaveLength(0);
  });

  it('asks for notification permission the first time First-come is chosen', () => {
    const db = makeTestDb();
    const r = createRentalFromForm(db, form({ reviewMode: 'first_come' }));
    expect(r.ok && r.askNotifications).toBe(true);
    Set.updateSettings(db, { notificationsAsked: true });
    const r2 = createRentalFromForm(db, form({ reviewMode: 'first_come' }));
    expect(r2.ok && r2.askNotifications).toBe(false);
  });
});

describe('Review mode switch rules', () => {
  it('is free (no confirm, no history) before any applicant', () => {
    const db = makeTestDb();
    const id = create(db);
    expect(planReviewModeChange(db, id, 'first_come')).toMatchObject({ needsConfirm: false, applicantCount: 0 });
    expect(planReviewModeChange(db, id, 'compare')).toBeNull();
    const r = updateRentalFromForm(db, id, { ...rentalToForm(R.getRental(db, id)!), reviewMode: 'first_come' }, { at: AT });
    expect(r).toMatchObject({ ok: true, modeChanged: true, askNotifications: true });
    expect(R.getRental(db, id)!.reviewMode).toBe('first_come');
    expect(C.listCriteriaHistory(db, id)).toHaveLength(0);
  });

  it('needs a confirmation with applicants, then records the switch', () => {
    const db = makeTestDb();
    const id = create(db);
    addApplicant(db, id);
    const next = { ...rentalToForm(R.getRental(db, id)!), reviewMode: 'first_come' as const };
    const first = updateRentalFromForm(db, id, next, { at: AT });
    expect(first.ok).toBe(false);
    expect(!first.ok && 'confirm' in first && first.confirm).toMatchObject({
      needsConfirm: true,
      applicantCount: 1,
      direction: 'to_first_come',
      title: 'Change review mode?',
    });
    expect(R.getRental(db, id)!.reviewMode).toBe('compare');

    const ok = updateRentalFromForm(db, id, next, { at: AT, confirmModeChange: true });
    expect(ok.ok).toBe(true);
    const [h] = C.listCriteriaHistory(db, id);
    expect(h).toMatchObject({ before: { reviewMode: 'compare' }, after: { reviewMode: 'first_come' }, reason: 'Review mode changed: Compare → First-come' });
    expect(describeHistoryEntry(h).changes).toEqual(['Review mode: Compare → First-come']);
  });

  it('stops running first-come timers when switching to Compare', () => {
    const db = makeTestDb();
    const id = create(db, { reviewMode: 'first_come' });
    const a = addApplicant(db, id);
    const timerId = Dec.startTimer(db, { applicantId: a, kind: 'missing_info', startedAt: AT, endsAt: '2026-12-08T10:00:00-05:00', notificationIds: ['n1', 'n2'] });
    const plan = planReviewModeChange(db, id, 'compare');
    expect(plan).toMatchObject({ direction: 'to_compare', activeTimerCount: 1 });
    expect(plan!.message).toContain('Running first-come timers stop');
    const r = updateRentalFromForm(db, id, { ...rentalToForm(R.getRental(db, id)!), reviewMode: 'compare' }, { at: AT, confirmModeChange: true });
    expect(r.ok && r.stoppedTimers.map((x) => [x.id, x.notificationIds])).toEqual([[timerId, ['n1', 'n2']]]);
    expect(Dec.listActiveTimers(db, id)).toHaveLength(0);
  });

  it('saves other edits without touching mode history', () => {
    const db = makeTestDb();
    const id = create(db);
    addApplicant(db, id);
    const r = updateRentalFromForm(db, id, { ...rentalToForm(R.getRental(db, id)!), rentCents: 220000 });
    expect(r).toMatchObject({ ok: true, modeChanged: false });
    expect(R.getRental(db, id)!.rentCents).toBe(220000);
    expect(C.listCriteriaHistory(db, id)).toHaveLength(0);
  });
});

describe('close / reopen / delete / sample', () => {
  it('closes (stamps closedAt) and reopens', () => {
    const db = makeTestDb();
    const id = create(db);
    closeRental(db, id, AT);
    expect(R.getRental(db, id)).toMatchObject({ status: 'closed', closedAt: AT });
    expect(R.listRentals(db, 'closed')).toHaveLength(1);
    reopenRental(db, id);
    expect(R.getRental(db, id)).toMatchObject({ status: 'open', closedAt: null });
  });

  it('deletes the rental, its applicants and their files', () => {
    const db = makeTestDb();
    const id = create(db);
    const a = addApplicant(db, id);
    addApplicant(db, id, 'Priya Raman');
    const files = makeTestFiles([`applicants/${a}/doc-1.jpg`, `rentals/${id}/letter-1.pdf`, 'applicants/999/doc-9.jpg']);
    expect(deleteRentalMessage(db, id).message).toContain('2 applicants');
    deleteRentalAndData(db, files, id);
    expect(R.getRental(db, id)).toBeNull();
    expect(A.listApplicants(db, id, { drafts: true, deleted: true })).toHaveLength(0);
    expect([...files.files]).toEqual(['applicants/999/doc-9.jpg']);
  });

  it('opens the sample once and removes it the sample way', () => {
    const db = makeTestDb();
    const id = openSampleRental(db);
    expect(openSampleRental(db)).toBe(id);
    expect(R.getRental(db, id)!.isSample).toBe(true);
    expect(deleteRentalMessage(db, id).message).toBe('This removes the sample rental and its sample applicants.');
    deleteRentalAndData(db, makeTestFiles(), id);
    expect(R.listRentals(db)).toHaveLength(0);
  });
});
