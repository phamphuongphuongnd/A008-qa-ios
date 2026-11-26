import * as A from '@/db/repos/applicants';
import * as Dec from '@/db/repos/decisions';
import * as R from '@/db/repos/rentals';
import * as Set from '@/db/repos/settings';
import * as V from '@/db/repos/verify';
import type { DecisionInput } from '@/engine';

import {
  checkDecision,
  decisionOptions,
  emptyDecision,
  expireOffer,
  loadDecisionContext,
  markOfferAccepted,
  markWithdrawnByApplicant,
  moveToNextIncomplete,
  requestMissingInfo,
  saveDecisionAction,
  syncQueueStatus,
} from '../decision';
import { loadApplicantReview, loadQueue } from '../review';
import { makeDeps, sampleDb } from '../testing/helpers';

const T0 = '2026-12-05T10:00:00-05:00';

function reasonFor(db: Parameters<typeof loadDecisionContext>[0], applicantId: number, code: string) {
  const ctx = loadDecisionContext(db, applicantId, T0)!;
  return ctx.reasonChoices.find((c) => c.reason.code === code)!.reason;
}

describe('S-15 options + checks', () => {
  it('offers decisions by status (Conditional offer only with C10, Withdraw only after an offer)', () => {
    expect(decisionOptions('new', true)).toEqual(['conditional_offer', 'approve', 'approve_with_conditions', 'deny']);
    expect(decisionOptions('in_review', false)).toEqual(['approve', 'approve_with_conditions', 'deny']);
    expect(decisionOptions('conditional_offer', true)).toEqual(['approve', 'approve_with_conditions', 'withdraw_offer']);
    expect(decisionOptions('denied', true)).toEqual([]);
    expect(decisionOptions('approved', true)).toEqual([]);
  });

  it('Priya: Deny for C5 (screening report) → FCRA notice required; Marcus: Deny for C4 → plain denial letter', () => {
    const { db, id } = sampleDb();
    const priya = loadDecisionContext(db, id('Priya'), T0)!;
    expect(priya.reasonChoices.map((c) => [c.reason.code, c.result.outcome])).toEqual([
      ['C1', 'not_met'],
      ['C5', 'not_met'],
    ]);
    expect(priya.defaultReportInfluenced).toBe(true);
    const deny: DecisionInput = { ...emptyDecision(priya, 'deny'), reasons: [reasonFor(db, id('Priya'), 'C5')] };
    const p = checkDecision(priya, deny);
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual(['Some information is missing. In first-come mode, give the applicant 72 hours first.']);
    expect(p.notice).toMatchObject({ letter: 'adverse_action', adverseAction: true, canExport: true });

    const marcus = loadDecisionContext(db, id('Marcus'), T0)!;
    expect(marcus.defaultReportInfluenced).toBe(false);
    const m = checkDecision(marcus, { ...emptyDecision(marcus, 'deny'), reasons: [reasonFor(db, id('Marcus'), 'C4')] });
    expect(m.notice).toMatchObject({ letter: 'denial', adverseAction: false });
  });

  it('requires reasons / conditions and blocks prohibited words', () => {
    const { db, id } = sampleDb();
    const ctx = loadDecisionContext(db, id('Marcus'), T0)!;
    expect(checkDecision(ctx, emptyDecision(ctx, 'deny')).errors.map((e) => e.code)).toEqual(['reasons_required']);
    expect(checkDecision(ctx, emptyDecision(ctx, 'approve_with_conditions')).errors.map((e) => e.code)).toEqual([
      'reasons_required',
      'conditions_required',
    ]);
    const bad = { ...emptyDecision(ctx, 'deny'), note: 'Too many children for the unit' };
    expect(checkDecision(ctx, bad).errors.map((e) => e.code)).toContain('prohibited_terms');
    expect(checkDecision(ctx, emptyDecision(ctx, 'withdraw_offer')).errors.map((e) => e.code)).toContain('not_your_turn');
  });
});

describe('save decision (Compare mode)', () => {
  it('stores the decision with a local timestamp, the new status and "Notice pending"', async () => {
    const { db, id } = sampleDb();
    const { deps, notes } = makeDeps(db, '2026-12-06T20:12:00Z');
    const res = await saveDecisionAction(deps, id('Priya'), {
      kind: 'deny',
      conditions: [],
      reasons: [reasonFor(db, id('Priya'), 'C5')],
      note: 'Outstanding balance with a previous landlord.',
      reportInfluenced: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(res.status).toBe('denied');
    expect(res.notice.adverseAction).toBe(true);
    expect(A.getApplicant(db, id('Priya'))!.status).toBe('denied');
    expect(Dec.latestDecision(db, id('Priya'))).toMatchObject({ kind: 'deny', noticeRequired: true, noticeStatus: 'pending' });
    expect(Dec.listPendingNotices(db, A.getApplicant(db, id('Priya'))!.rentalId)).toHaveLength(1);
    expect(notes.scheduled.size).toBe(0); // no clocks in Compare mode
    // Closed now: S-09 blocks a second decision.
    expect(loadApplicantReview(db, id('Priya'), res.at)!.decide).toMatchObject({ allowed: false, block: 'closed' });
  });

  it('refuses an invalid decision without writing', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db);
    const res = await saveDecisionAction(deps, id('Marcus'), { kind: 'deny', conditions: [], reasons: [], note: '', reportInfluenced: false });
    expect(res).toMatchObject({ ok: false, error: 'reasons_required' });
    expect(Dec.listDecisions(db, id('Marcus'))).toEqual([]);
  });

  it('conditional offer opens step 2; withdraw needs the assessment, then ends like a denial', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db);
    const offer = await saveDecisionAction(deps, id('Jordan'), { kind: 'conditional_offer', conditions: [], reasons: [], note: '', reportInfluenced: false });
    expect(offer).toMatchObject({ ok: true, status: 'conditional_offer', notice: { letter: 'conditional_offer', adverseAction: false } });
    const review = loadApplicantReview(db, id('Jordan'), T0)!;
    expect(review.applicant.conditionalOfferAt).not.toBeNull();
    expect(review.sections.find((s) => s.key === 'background')!.status).toBe('To review');
    const ctx = loadDecisionContext(db, id('Jordan'), T0)!;
    expect(ctx.options).toEqual(['approve', 'approve_with_conditions', 'withdraw_offer']);

    V.saveBackground(db, id('Jordan'), {
      noConvictions: false,
      convictions: [{ type: 'property', convictedOn: '2025-06-01', sentenceEndedOn: '2025-12-01' }],
      reviewedOn: '2026-12-06',
    });
    const withdraw = { kind: 'withdraw_offer' as const, conditions: [], reasons: [], note: 'Individual assessment', reportInfluenced: false };
    expect(await saveDecisionAction(deps, id('Jordan'), withdraw)).toMatchObject({ ok: false, error: 'assessment_required' });
    V.saveBackground(db, id('Jordan'), { assessment: { seriousness: 'Recent property offense', rehabilitation: 'None given', other: 'Nothing else' } });
    const done = await saveDecisionAction(deps, id('Jordan'), withdraw);
    expect(done).toMatchObject({ ok: true, status: 'denied' });
  });

  it('Withdrawn by applicant (Compare mode)', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db);
    expect(await markWithdrawnByApplicant(deps, id('Dana'))).toEqual({ ok: true, nextApplicantId: null });
    expect(A.getApplicant(db, id('Dana'))!.status).toBe('withdrawn');
    expect(await markWithdrawnByApplicant(deps, id('Dana'))).toMatchObject({ ok: false, error: 'closed' });
  });
});

describe('First-come order (§3.14)', () => {
  it('runs the queue: gate, 48 h offer, expiry, 72 h missing info, incomplete, next in line', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const { deps, clock, notes } = makeDeps(db, T0);

    expect(syncQueueStatus(db, rentalId, T0)).toBe(id('Jordan'));
    expect(syncQueueStatus(db, rentalId, T0)).toBeNull();
    expect(A.getApplicant(db, id('Jordan'))!.status).toBe('in_review');

    // #2 can't get an offer while #1 is in review.
    const priyaReview = loadApplicantReview(db, id('Priya'), T0)!;
    expect(priyaReview.decide).toEqual({ allowed: false, block: 'not_your_turn', message: 'First-come mode: decide on #1 first' });
    expect(await saveDecisionAction(deps, id('Priya'), { kind: 'approve', conditions: [], reasons: [], note: '', reportInfluenced: true })).toMatchObject({
      ok: false,
      error: 'not_your_turn',
    });

    // #1 conditional offer → 48 h clock + 2 notifications (2 h left, ended) pointing at S-18.
    const offer = await saveDecisionAction(deps, id('Jordan'), { kind: 'conditional_offer', conditions: [], reasons: [], note: '', reportInfluenced: false });
    expect(offer).toMatchObject({ ok: true, offerEndsAt: '2026-12-07T15:00:00.000Z' });
    expect([...notes.scheduled.values()].map((n) => [n.title, n.at.toISOString(), n.data.url])).toEqual([
      ['Offer to Jordan Ellis expires in 2 hours', '2026-12-07T13:00:00.000Z', `/review/rental/${rentalId}/queue`],
      ['Offer to Jordan Ellis has expired', '2026-12-07T15:00:00.000Z', `/review/rental/${rentalId}/queue`],
    ]);
    expect(Dec.activeTimer(db, id('Jordan'), 'offer')!.notificationIds).toHaveLength(2);

    // Not expired yet → can't move on.
    expect(await expireOffer(deps, id('Jordan'))).toMatchObject({ ok: false, error: 'not_available' });
    clock.advanceHours(48);
    const q1 = loadQueue(db, rentalId, clock.now().toISOString())!;
    expect(q1.rows[0].actions).toEqual(['review', 'offer_expired_move_next']);
    expect(q1.rows[0].timer?.label).toBe('Offer expired');
    expect(await expireOffer(deps, id('Jordan'))).toEqual({ ok: true, nextApplicantId: id('Priya') });
    expect(A.getApplicant(db, id('Jordan'))!.status).toBe('offer_expired');
    expect(A.getApplicant(db, id('Priya'))!.status).toBe('in_review');
    expect(notes.scheduled.size).toBe(0);
    expect(Dec.activeTimer(db, id('Jordan'))).toBeNull();

    // #2 has missing items → 72 h clock.
    const req = await requestMissingInfo(deps, id('Priya'), 'email');
    expect(req).toMatchObject({ ok: true, permission: 'granted' });
    expect(Dec.activeTimer(db, id('Priya'), 'missing_info')!.method).toBe('email');
    expect([...notes.scheduled.values()].map((n) => n.title)).toEqual([
      'Priya Raman — 2 hours left to provide missing info',
      'Priya Raman — time to provide missing info is up',
    ]);
    expect(await requestMissingInfo(deps, id('Priya'), 'text')).toMatchObject({ ok: false, error: 'not_available' });
    expect(await moveToNextIncomplete(deps, id('Priya'))).toMatchObject({ ok: false, error: 'not_available' });
    clock.advanceHours(72);
    expect(await moveToNextIncomplete(deps, id('Priya'))).toEqual({ ok: true, nextApplicantId: id('Marcus') });
    expect(A.getApplicant(db, id('Priya'))!.status).toBe('incomplete');
    expect(A.getApplicant(db, id('Marcus'))!.status).toBe('in_review');

    // #3 denied (own call) → #4 in review.
    const deny = await saveDecisionAction(deps, id('Marcus'), {
      kind: 'deny',
      conditions: [],
      reasons: [reasonFor(db, id('Marcus'), 'C4')],
      note: '',
      reportInfluenced: false,
    });
    expect(deny).toMatchObject({ ok: true, nextApplicantId: id('Dana'), notice: { letter: 'denial' } });
    expect(A.getApplicant(db, id('Dana'))!.status).toBe('in_review');

    // #4 approved → 48 h; the applicant accepts → clock stops, queue shows Approved.
    const ok = await saveDecisionAction(deps, id('Dana'), { kind: 'approve', conditions: [], reasons: [], note: '', reportInfluenced: true });
    expect(ok).toMatchObject({ ok: true, status: 'approved', notice: { letter: 'approval' } });
    expect(await markOfferAccepted(deps, id('Dana'))).toEqual({ ok: true });
    expect(await markOfferAccepted(deps, id('Dana'))).toMatchObject({ ok: false });
    const q2 = loadQueue(db, rentalId, clock.now().toISOString())!;
    expect(q2.rows.map((r) => r.state)).toEqual(['done', 'done', 'done', 'approved']);
    expect(notes.scheduled.size).toBe(0);
  });

  it('asks the notification permission once; denied permission still starts the clock', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const { deps, notes } = makeDeps(db, T0, 'undetermined');
    await saveDecisionAction(deps, id('Jordan'), { kind: 'approve', conditions: [], reasons: [], note: '', reportInfluenced: true });
    expect(notes.askedCount()).toBe(1);
    expect(Set.getSettings(db).notificationsAsked).toBe(true);
    expect(notes.scheduled.size).toBe(2);

    const other = makeDeps(db, T0, 'denied');
    await markWithdrawnByApplicant(other.deps, id('Jordan'));
    const res = await requestMissingInfo(other.deps, id('Priya'), 'call');
    expect(res).toMatchObject({ ok: true, permission: 'denied' });
    expect(other.notes.scheduled.size).toBe(0);
    expect(Dec.activeTimer(db, id('Priya'), 'missing_info')).not.toBeNull();
  });

  it('Withdrawn by applicant hands the turn on', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const { deps } = makeDeps(db, T0);
    expect(await markWithdrawnByApplicant(deps, id('Jordan'))).toEqual({ ok: true, nextApplicantId: id('Priya') });
    expect(A.getApplicant(db, id('Priya'))!.status).toBe('in_review');
  });
});
