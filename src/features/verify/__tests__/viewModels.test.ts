import { listApplicants, listIncomes, listResidences } from '@/db/repos/applicants';
import { updateCriterion, listCriteria } from '@/db/repos/criteria';
import { saveDecision } from '@/db/repos/decisions';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';
import type { Attempt } from '@/db/types';

import {
  attemptAt,
  attemptRows,
  backgroundNext,
  backgroundView,
  canSaveAttempt,
  chooseEvictions,
  employerView,
  emptyConviction,
  emptyReportForm,
  errorText,
  fieldError,
  firstName,
  landlordView,
  loadBackgroundSheet,
  loadEmployerSheet,
  loadLandlordSheet,
  loadReportSheet,
  localDate,
  pickMessage,
  reportView,
  saveOwesNow,
  unreachableCard,
  type BackgroundForm,
} from '..';

const NOW = new Date('2026-12-10T15:00:00Z');
const TODAY = '2026-12-10';
const OFFER = '2026-12-05T10:00:00-05:00';

function setup() {
  const db = makeTestDb();
  const rentalId = loadSampleRental(db);
  const id = (n: string) => listApplicants(db, rentalId).find((a) => a.fullName === n)!.id;
  return { db, rentalId, jordan: id('Jordan Ellis'), priya: id('Priya Raman'), marcus: id('Marcus Webb'), dana: id('Dana Ortiz') };
}

const attempt = (id: number, method: Attempt['method'], result: Attempt['result'], at: string): Attempt => ({ id, referenceId: 1, method, result, at });

describe('shared', () => {
  test('errors, first name', () => {
    expect(errorText('money_zero')).toBe('Enter an amount above $0');
    expect(fieldError([{ field: 'a', code: 'required' }], 'a')).toBe('Required');
    expect(fieldError([{ field: 'a', code: 'required' }], 'b')).toBeNull();
    expect(firstName('  Marcus  Webb ')).toBe('Marcus');
    expect(firstName('Cher')).toBe('Cher');
  });

  test('attempt rows (mockup: "No reply yet · Email · Dec 5, 9:15 AM")', () => {
    expect(
      attemptRows([attempt(1, 'call', 'no_answer', '2026-12-03T10:02:00-05:00'), attempt(2, 'email', 'no_answer', '2026-12-05T09:15:00-05:00')]),
    ).toEqual([
      { id: 1, method: 'call', title: 'No answer', subtitle: 'Call · Dec 3, 10:02 AM' },
      { id: 2, method: 'email', title: 'No reply yet', subtitle: 'Email · Dec 5, 9:15 AM' },
    ]);
  });

  test('unreachable card + log sheet', () => {
    expect(unreachableCard({ unreachable: false, canMark: false, failedCount: 2, methodCount: 1, reached: false })).toEqual({ kind: 'none' });
    expect(unreachableCard({ unreachable: false, canMark: true, failedCount: 3, methodCount: 2, reached: false })).toEqual({ kind: 'can_mark', title: '3 tries, 2 ways' });
    expect(unreachableCard({ unreachable: true, canMark: false, failedCount: 3, methodCount: 2, reached: false })).toEqual({ kind: 'marked' });
    expect(canSaveAttempt('call', null)).toBe(false);
    expect(canSaveAttempt('call', 'reached')).toBe(true);
    const now = new Date(2026, 11, 10, 9, 30);
    expect(attemptAt(localDate(now), now).slice(0, 16)).toBe('2026-12-10T09:30');
    expect(attemptAt('2026-12-08', now).slice(0, 16)).toBe('2026-12-08T12:00');
  });
});

describe('S-11 view', () => {
  test('Marcus: subtitle, Q1 with first name, live flags follow the form, conditional fields', () => {
    const { db, marcus } = setup();
    const r = listResidences(db, marcus)[0];
    const sheet = loadLandlordSheet(db, marcus, r.id, NOW)!;
    const v = landlordView(sheet, sheet.form, NOW);
    expect(v.subtitle).toBe(`${r.address} · Marcus Webb`);
    expect(v.q1).toBe(`1. Did Marcus rent from you at ${r.address}?`);
    expect(v.redFlags.map((f) => f.text)).toEqual([
      'Dates differ by more than 31 days',
      'Rent differs by more than 5% (+29%)',
      "Wouldn't say whether they'd rent to them again",
    ]);
    expect(v).toMatchObject({ showBothTip: true, toDisabled: true, showViolationsNote: false, showOwesAmount: false, showRentAgainWhy: true });
    const fixed = landlordView(sheet, { ...sheet.form, rentText: '1,200.00', from: '2022-03', rentAgain: 'yes', owes: 'yes', violations: 'yes', to: null }, NOW);
    expect(fixed.redFlags).toEqual([]);
    expect(fixed).toMatchObject({ toDisabled: false, showViolationsNote: true, showOwesAmount: true, showRentAgainWhy: false });
    expect(saveOwesNow('yes')).toBe(false);
    expect(saveOwesNow('no')).toBe(true);
    expect(saveOwesNow(null)).toBe(true);
  });

  test('Priya: owner not confirmed is a red flag before any answer', () => {
    const { db, priya } = setup();
    const r = listResidences(db, priya)[0];
    const sheet = loadLandlordSheet(db, priya, r.id, NOW)!;
    expect(landlordView(sheet, sheet.form, NOW).redFlags.map((f) => f.code)).toContain('owner_not_confirmed');
    expect(landlordView(sheet, { ...sheet.form, ownerConfirmed: true }, NOW).redFlags.map((f) => f.code)).not.toContain('owner_not_confirmed');
  });
});

describe('S-12 view', () => {
  test('employer name in subtitle; "No" hides since / title', () => {
    const { db, priya } = setup();
    const income = listIncomes(db, priya)[0];
    const sheet = loadEmployerSheet(db, priya, income.id)!;
    const v = employerView(sheet, sheet.form);
    expect(v.subtitle).toBe('Northside Logistics · Priya Raman');
    expect(v.q1).toBe('Is Priya employed with you?');
    expect(v.showSinceAndTitle).toBe(true);
    expect(employerView(sheet, { ...sheet.form, employed: 'no' }).showSinceAndTitle).toBe(false);
    expect(employerView({ ...sheet, income: { ...sheet.income, employer: ' ' } }, sheet.form).subtitle).toBe('Employer · Priya Raman');
  });
});

describe('S-13 view', () => {
  test('Priya (entered) vs Marcus (empty) vs C9 on', () => {
    const { db, rentalId, priya, marcus } = setup();
    const p = loadReportSheet(db, priya, NOW)!;
    expect(reportView(p, p.form, TODAY)).toMatchObject({
      subtitle: 'Priya Raman',
      showCompanyMissing: false,
      evictionsValue: 'none',
      collectionsValue: 'listed',
      showCases: false,
      showCollectionsAmount: true,
      showScoreBlock: false,
      showRemoveReport: true,
      files: [],
    });
    const m = loadReportSheet(db, marcus, NOW)!;
    expect(reportView(m, m.form, TODAY)).toMatchObject({ showCompanyMissing: true, evictionsValue: null, collectionsValue: null, showRemoveReport: false });
    // Applicant's own report older than 30 days.
    expect(reportView(m, { ...m.form, service: 'applicant_copy', reportDate: '2026-11-01' }, TODAY).showTooOld).toBe(true);
    expect(reportView(m, { ...m.form, service: 'mysmartmove', reportDate: '2026-11-01' }, TODAY).showTooOld).toBe(false);
    // Files: PDF vs photo rows.
    const files = reportView({ ...m, filePaths: ['applicants/3/report-1.PDF', 'applicants/3/report-2.jpg'] }, m.form, TODAY).files;
    expect(files).toEqual([
      { path: 'applicants/3/report-1.PDF', kind: 'pdf', title: 'Report PDF 1', removeLabel: 'Delete file 1' },
      { path: 'applicants/3/report-2.jpg', kind: 'photo', title: 'Report photo 2', removeLabel: 'Delete file 2' },
    ]);
    // C9 on: score block; "No score" hides the fields; ≤ 4 key factors.
    updateCriterion(db, listCriteria(db, rentalId).find((c) => c.code === 'C9')!.id, { enabled: true });
    const c9 = loadReportSheet(db, marcus, NOW)!;
    expect(reportView(c9, c9.form, TODAY)).toMatchObject({ showScoreBlock: true, showScoreFields: true, canAddKeyFactor: true });
    expect(reportView(c9, { ...c9.form, noScore: true }, TODAY).showScoreFields).toBe(false);
    expect(reportView(c9, { ...c9.form, keyFactors: ['a', 'b', 'c', 'd'] }, TODAY).canAddKeyFactor).toBe(false);
  });

  test('choosing "Cases listed" starts one empty case; picker messages', () => {
    const f = emptyReportForm();
    expect(chooseEvictions(f, 'listed')).toEqual({ evictionsMode: 'listed', cases: [{ date: '', outcome: null }] });
    expect(chooseEvictions({ ...f, cases: [{ date: '2021', outcome: 'settled' }] }, 'listed').cases).toHaveLength(1);
    expect(chooseEvictions(f, 'none')).toEqual({ evictionsMode: 'none', cases: [] });
    expect(pickMessage('camera', 'denied')).toBe("Camera access is off. Turn it on in your phone's settings.");
    expect(pickMessage('files', 'denied')).toBe("Photo access is off. Turn it on in your phone's settings.");
    expect(pickMessage('photos', 'canceled')).toBeNull();
  });
});

describe('S-14 view', () => {
  const listed = (over: Partial<BackgroundForm> = {}): BackgroundForm => ({
    mode: 'listed',
    convictions: [{ type: 'property', convictedOn: '2020-06-01', sentenceEndedOn: '2020-12-01' }],
    seriousness: '',
    rehabilitation: '',
    other: '',
    ...over,
  });

  test('locked before an offer; off when C10 is disabled', () => {
    const { db, rentalId, marcus } = setup();
    const s = loadBackgroundSheet(db, marcus)!;
    expect(backgroundView(s, s.form, TODAY)).toEqual({
      kind: 'empty',
      subtitle: 'Marcus Webb',
      icon: 'lock',
      title: 'Unlocks after you make a conditional offer.',
      body: 'Criminal history is reviewed only as a second step, and only for convictions.',
    });
    updateCriterion(db, listCriteria(db, rentalId).find((c) => c.code === 'C10')!.id, { enabled: false });
    const off = loadBackgroundSheet(db, marcus)!;
    expect(backgroundView(off, off.form, TODAY)).toMatchObject({ kind: 'empty', icon: 'off' });
  });

  test('after an offer: conviction card, assessment, footer states (never auto-deny)', () => {
    const { db, jordan } = setup();
    saveDecision(db, { applicantId: jordan, kind: 'conditional_offer', at: OFFER, reasons: [], conditions: [] }, 'conditional_offer');
    const s = loadBackgroundSheet(db, jordan)!;
    const empty = backgroundView(s, s.form, TODAY);
    if (empty.kind !== 'review') throw new Error('expected review');
    expect(empty).toMatchObject({
      subtitle: 'Jordan Ellis · after conditional offer',
      editable: true,
      modeLabel: 'Convictions in the past 7 years',
      noneA11y: 'No convictions in the past 7 years',
      modeValue: null,
      cards: [],
      showAssessment: false,
      footer: { show: true, continueDisabled: true, showWithdraw: false, hint: 'Enter the convictions, or choose None.' },
    });

    const v = backgroundView(s, listed(), TODAY);
    if (v.kind !== 'review') throw new Error('expected review');
    expect(v.cards).toEqual([
      { index: 0, title: 'Property', badge: 'needs_review', outsideLabel: 'Older than 7 years — not considered', line: 'Convicted Jun 2020 · sentence completed Dec 2020' },
    ]);
    expect(v.howLongAgo).toBe('6 years, 6 months (calculated)');
    expect(v.footer).toEqual({ show: true, continueDisabled: false, showWithdraw: true, withdrawDisabled: true, hint: 'Answer the individual assessment questions first.' });
    const done = backgroundView(s, listed({ seriousness: 'x', rehabilitation: 'y', other: 'z' }), TODAY);
    expect(done.kind === 'review' && done.footer).toMatchObject({ withdrawDisabled: false, hint: undefined });

    // An old conviction only: not considered, no assessment, no Withdraw.
    const old = backgroundView(s, listed({ convictions: [{ type: 'fraud', convictedOn: '2015-01-01', sentenceEndedOn: null }] }), TODAY);
    if (old.kind !== 'review') throw new Error('expected review');
    expect(old.cards[0]).toMatchObject({ badge: 'outside', line: 'Convicted Jan 2015' });
    expect(old).toMatchObject({ showAssessment: false, showNoneInLookback: true, footer: { showWithdraw: false, continueDisabled: false } });

    // An unfinished entry has no badge yet and blocks Continue.
    const draft = backgroundView(s, listed({ convictions: [emptyConviction()] }), TODAY);
    if (draft.kind !== 'review') throw new Error('expected review');
    expect(draft.cards[0]).toMatchObject({ title: 'Conviction 1', badge: null, line: '' });
    expect(draft.footer.continueDisabled).toBe(true);
  });

  test('read-only after a later decision; where outcomes go', () => {
    const { db, dana } = setup();
    saveDecision(db, { applicantId: dana, kind: 'conditional_offer', at: OFFER, reasons: [], conditions: [] }, 'conditional_offer');
    saveDecision(db, { applicantId: dana, kind: 'approve', at: '2026-12-08T10:00:00-05:00', reasons: [], conditions: [] }, 'approved');
    const s = loadBackgroundSheet(db, dana)!;
    const v = backgroundView(s, { ...s.form, mode: 'none' }, TODAY);
    expect(v).toMatchObject({ kind: 'review', editable: false, readOnly: true, footer: { show: false } });
    expect(backgroundNext('withdraw', 7)).toEqual({ kind: 'push', href: '/review/applicant/7/decision?kind=withdraw_offer' });
    expect(backgroundNext('continue', 7)).toEqual({ kind: 'back' });
  });
});
