import * as A from '@/db/repos/applicants';
import * as Dec from '@/db/repos/decisions';
import * as R from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import * as Set from '@/db/repos/settings';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';

import { loadCleanupReminderCount, loadRentalCards, loadRentalHub } from '../rentalQueries';
import { deriveRentalStatus, initials } from '../rentalSummary';
import { closeRental, createRentalFromForm } from '../rentalService';
import { emptyRentalForm } from '../rentalForm';

const NOW = new Date('2026-12-10T12:00:00Z');

describe('S-02 cards on the §8 sample', () => {
  it('shows address, rent, mode, status and "4 applicants · 2 ready to decide"', () => {
    const db = makeTestDb();
    loadSampleRental(db);
    const [card] = loadRentalCards(db, 'open');
    expect(card).toMatchObject({
      address: '1428 Maple St, Unit B',
      city: 'Columbus, OH 43215',
      line: '$1,650/mo · 2 bd',
      modeLabel: 'Compare',
      status: 'open',
      statusLabel: 'Open',
      isSample: true,
    });
    expect(card.summary).toMatchObject({ applicantCount: 4, readyCount: 2, countText: '4 applicants', detailText: '2 ready to decide' });
    expect(card.summary.fullText).toBe('4 applicants · 2 ready to decide');
    expect(loadRentalCards(db, 'closed')).toEqual([]);
  });

  it('says "No applicants yet" and moves closed rentals to the Closed segment', () => {
    const db = makeTestDb();
    const r = createRentalFromForm(db, { ...emptyRentalForm(), street: '310 Oak Ct', rentCents: 120000, bedrooms: 0 });
    const id = r.ok ? r.id : 0;
    expect(loadRentalCards(db, 'open')[0].summary.fullText).toBe('No applicants yet');
    expect(loadRentalCards(db, 'open')[0].line).toBe('$1,200/mo · Studio');
    closeRental(db, id);
    expect(loadRentalCards(db, 'open')).toEqual([]);
    expect(loadRentalCards(db, 'closed')[0]).toMatchObject({ status: 'closed', statusLabel: 'Closed' });
  });

  it('derives Offer out / Leased from decisions ("decision made")', () => {
    expect(deriveRentalStatus('open', ['new', 'conditional_offer'])).toBe('offer_out');
    expect(deriveRentalStatus('open', ['conditional_offer', 'approved'])).toBe('leased');
    expect(deriveRentalStatus('closed', ['approved'])).toBe('closed');
    expect(deriveRentalStatus('open', ['denied'])).toBe('open');
    const db = makeTestDb();
    const id = loadSampleRental(db);
    const jordan = A.listApplicants(db, id)[0];
    A.setApplicantStatus(db, jordan.id, 'approved');
    const [card] = loadRentalCards(db, 'open');
    expect(card).toMatchObject({ status: 'leased', statusLabel: 'Leased' });
    expect(card.summary.fullText).toBe('4 applicants · decision made');
  });
});

describe('S-06 hub', () => {
  it('lists applicants in received order with summary lines, no ranking', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    const hub = loadRentalHub(db, id)!;
    expect(hub).toMatchObject({
      address: '1428 Maple St, Unit B',
      line: '$1,650/mo · 2 bd · Available Jan 1',
      modeChip: 'Compare mode',
      statusLabel: 'Open',
      applicantCount: 4,
      moveInApplicantId: null,
      pendingNoticeCount: 0,
      criteriaLocked: true,
    });
    expect(hub.applicants.map((a) => [a.fullName, a.initials, a.summaryText, a.queueNumber])).toEqual([
      ['Jordan Ellis', 'JE', 'Ready to decide', null],
      ['Priya Raman', 'PR', '2 items missing', null],
      ['Marcus Webb', 'MW', '1 item missing', null],
      ['Dana Ortiz', 'DO', 'Ready to decide', null],
    ]);
  });

  it('numbers rows in First-come mode and shows the move-in card after approval', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    R.updateRental(db, id, { reviewMode: 'first_come' });
    const dana = A.listApplicants(db, id)[3];
    A.setApplicantStatus(db, dana.id, 'approved');
    const hub = loadRentalHub(db, id)!;
    expect(hub.modeChip).toBe('First-come mode');
    expect(hub.applicants.map((a) => a.queueNumber)).toEqual([1, 2, 3, 4]);
    expect(hub.moveInApplicantId).toBe(dana.id);
  });

  it('counts decisions waiting for their FCRA notice', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    const priya = A.listApplicants(db, id)[1];
    Dec.saveDecision(db, { applicantId: priya.id, kind: 'deny', reasons: [], conditions: [], note: '', reportInfluenced: true, at: '2026-12-05T10:00:00-05:00', noticeRequired: true });
    expect(loadRentalHub(db, id)!.pendingNoticeCount).toBe(1);
  });

  it('returns null for a deleted rental', () => {
    expect(loadRentalHub(makeTestDb(), 42)).toBeNull();
  });

  it('makes initials from any name', () => {
    expect(initials('  priya  ')).toBe('P');
    expect(initials('Mary Ann Lee')).toBe('ML');
    expect(initials('')).toBe('?');
  });
});

describe('S-02 cleanup card', () => {
  function realRental(db: ReturnType<typeof makeTestDb>) {
    const r = createRentalFromForm(db, { ...emptyRentalForm(), street: '1 Main St', rentCents: 100000 });
    return r.ok ? r.id : 0;
  }

  it('counts closed rentals still holding applicant data after the cleanup delay', () => {
    const db = makeTestDb();
    const id = realRental(db);
    A.createApplicant(db, { rentalId: id, receivedAt: '2026-09-01T09:00:00-04:00', fullName: 'Sam Lee', occupants: 1 });
    closeRental(db, id, '2026-09-15T12:00:00Z');
    expect(loadCleanupReminderCount(db, NOW)).toBe(1);
    Set.updateSettings(db, { cleanupAfterDays: 180 });
    expect(loadCleanupReminderCount(db, NOW)).toBe(0);
    Set.updateSettings(db, { cleanupAfterDays: 30, reminders: { backup: true, cleanup: false, timers: true } });
    expect(loadCleanupReminderCount(db, NOW)).toBe(0);
    Set.updateSettings(db, { reminders: { backup: true, cleanup: true, timers: true } });
    expect(loadCleanupReminderCount(db, NOW)).toBe(1);
  });

  it('B-62: after deleting applicant data the card and hub say so, not "No applicants yet"', () => {
    const db = makeTestDb();
    const id = realRental(db);
    const ids = ['Sam Lee', 'Ana Ruiz', 'Bo Chen'].map((fullName, i) =>
      A.createApplicant(db, { rentalId: id, receivedAt: `2026-09-0${i + 1}T09:00:00-04:00`, fullName, occupants: 1 }),
    );
    // A draft never counts (it was never received).
    const draft = A.createApplicant(db, { rentalId: id, receivedAt: '2026-09-05T09:00:00-04:00', fullName: '', occupants: 1 });
    A.updateApplicant(db, draft, { draft: true });
    closeRental(db, id, '2026-09-15T12:00:00Z');
    const files = makeTestFiles([]);
    A.purgeApplicant(db, files, ids[1], { at: '2026-11-20T10:00:00Z' });
    A.purgeApplicant(db, files, ids[2], { at: '2026-11-20T10:00:00Z' });
    expect(loadRentalCards(db, 'closed')[0].summary.fullText).toBe('1 applicant · 2 deleted');
    expect(loadRentalHub(db, id)).toMatchObject({ applicantCount: 1, deletedCount: 2 });

    A.purgeApplicant(db, files, ids[0], { at: '2026-11-20T10:00:00Z' });
    A.purgeApplicant(db, files, draft, { at: '2026-11-20T10:00:00Z' });
    expect(loadRentalCards(db, 'closed')[0].summary.fullText).toBe('Applicant data deleted (3 applicants)');
    expect(loadRentalHub(db, id)).toMatchObject({ applicantCount: 0, deletedCount: 3 });
  });

  it('never counts the sample rental', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    closeRental(db, id, '2026-09-15T12:00:00Z');
    expect(loadCleanupReminderCount(db, NOW)).toBe(0);
  });
});
