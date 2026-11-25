/** @jest-environment node */
// §3.5 C3 Eviction, §3.7 C5 Unpaid balance, §3.10 C9 Credit.
import { evaluateCriterion } from '..';
import { applicant, criterion, RENTAL } from '../fixtures/build';
import type { EvictionCase, LandlordReference, ScreeningReport } from '../types';

const report = (over: Partial<ScreeningReport> = {}): ScreeningReport => ({
  id: 'rep',
  companyName: 'Co',
  companyAddress: 'Addr',
  companyPhone: '1-800',
  reportDate: '2026-12-03',
  evictions: [],
  landlordCollectionsCents: 0,
  score: null,
  noScore: false,
  scoreModel: null,
  scoreRange: null,
  scoreDate: null,
  keyFactors: [],
  ...over,
});
const c3 = (cases: EvictionCase[] | null, evicted: 'yes' | 'no' | null = null, withReport = true) =>
  evaluateCriterion(
    criterion('C3'),
    RENTAL,
    applicant({
      report: withReport ? report({ evictions: cases }) : null,
      answers: { evicted, bankruptcy: null, smokes: null },
    }),
  );

describe('C3 eviction (§3.5)', () => {
  it('judgment within 5 years of the date received → Not met (Verified)', () => {
    const r = c3([{ date: '2023-04-10', outcome: 'judgment' }], 'yes');
    expect([r.outcome, r.evidence]).toEqual(['not_met', 'verified']);
  });
  it('judgment exactly 5 years before the date received is inside; one day earlier is outside', () => {
    expect(c3([{ date: '2021-12-02', outcome: 'judgment' }], 'yes').outcome).toBe('not_met');
    expect(c3([{ date: '2021-12-01', outcome: 'judgment' }], 'yes').outcome).toBe('met');
  });
  it('year-only judgment in the boundary year → Needs review (check the date)', () => {
    expect(c3([{ date: '2021', outcome: 'judgment' }], 'yes').outcome).toBe('needs_review');
  });
  it.each(['settled', 'dismissed', 'tenant_won', 'unknown'] as const)('only %s → Needs review', (outcome) => {
    const r = c3([{ date: '2024-02', outcome }], 'yes');
    expect(r.outcome).toBe('needs_review');
    expect(r.reason).toBe('A case was filed but there was no judgment against the applicant');
  });
  it('no cases → Met (Verified)', () => {
    expect([c3([], 'no').outcome, c3([], 'no').evidence]).toEqual(['met', 'verified']);
  });
  it('no report: application No → Met Claimed; Yes → Needs review Claimed; blank → Missing', () => {
    expect([c3(null, 'no', false).outcome, c3(null, 'no', false).evidence]).toEqual(['met', 'claimed']);
    expect([c3(null, 'yes', false).outcome, c3(null, 'yes', false).evidence]).toEqual(['needs_review', 'claimed']);
    expect(c3(null, null, false).outcome).toBe('missing');
  });
  it('report "No" but application "Yes" (and the reverse) → Mismatch', () => {
    expect(c3([], 'yes').evidence).toBe('mismatch');
    const r = c3([{ date: '2022-05-01', outcome: 'dismissed' }], 'no');
    expect(r.evidence).toBe('mismatch');
    expect(r.issues[0].kind).toBe('mismatch');
  });
});

describe('C5 unpaid landlord balance (§3.7)', () => {
  const ref = (owes: LandlordReference['owes'], owesCents: number | null = null): LandlordReference => ({
    id: 'ref',
    residenceId: 'r',
    ownerConfirmed: true,
    confirmSource: null,
    answeredOn: '2026-12-04',
    rentedFromYou: 'yes',
    from: null,
    to: null,
    rentCents: null,
    owes,
    owesCents,
    rentAgain: 'yes',
    unreachable: false,
    attempts: [],
  });
  const c5 = (rep: ScreeningReport | null, refs: LandlordReference[] = []) =>
    evaluateCriterion(criterion('C5'), RENTAL, applicant({ report: rep, landlordReferences: refs }));
  it('report amount > $0 → Not met (Verified)', () => {
    const r = c5(report({ landlordCollectionsCents: 231000 }));
    expect([r.outcome, r.evidence, r.source]).toEqual(['not_met', 'verified', 'screening_report']);
  });
  it('report None → Met; landlord No → Met', () => {
    expect(c5(report()).outcome).toBe('met');
    expect(c5(null, [ref('no')]).outcome).toBe('met');
  });
  it('landlord "Yes $500" → Not met', () => {
    const r = c5(null, [ref('yes', 50000)]);
    expect(r.outcome).toBe('not_met');
    expect(r.reason).toContain('$500');
  });
  it('"Wouldn’t say" and no report → Missing', () => {
    expect(c5(null, [ref('wouldnt_say')]).outcome).toBe('missing');
    expect(c5(report({ landlordCollectionsCents: null })).outcome).toBe('missing');
  });
  it('report None but landlord says owed → Not met with Mismatch', () => {
    const r = c5(report(), [ref('yes', 80000)]);
    expect([r.outcome, r.evidence]).toEqual(['not_met', 'mismatch']);
  });
});

describe('C9 credit (§3.10)', () => {
  const c9 = (rep: ScreeningReport | null) => evaluateCriterion(criterion('C9', { minScore: 600 }), RENTAL, applicant({ report: rep }));
  it('score = s → Met; s − 1 → Not met', () => {
    expect(c9(report({ score: 600 })).outcome).toBe('met');
    expect(c9(report({ score: 599 })).outcome).toBe('not_met');
  });
  it('"No score" → Needs review, never Not met', () => {
    expect(c9(report({ noScore: true })).outcome).toBe('needs_review');
  });
  it('no report → Missing', () => {
    expect(c9(null).outcome).toBe('missing');
  });
});
