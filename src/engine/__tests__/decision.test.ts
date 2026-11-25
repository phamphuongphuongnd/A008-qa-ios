/** @jest-environment node */
// §3.15 FCRA adverse action notice + S-15 checks + S-16 letter data.
import { FCRA_REQUIRED_LINES, letterData, MISSING_INFO_WARNING, noticeRequirement, validateDecision } from '..';
import type { DecisionInput } from '../decision';
import type { ScreeningReport } from '../types';

const report: ScreeningReport = {
  id: 'rep',
  companyName: 'TransUnion Rental Screening Solutions',
  companyAddress: 'Somewhere, CO',
  companyPhone: '1-866-000-0000',
  reportDate: '2026-12-03',
  evictions: [],
  landlordCollectionsCents: 0,
  score: 580,
  noScore: false,
  scoreModel: 'VantageScore 3.0',
  scoreRange: '300–850',
  scoreDate: '2026-12-03',
  keyFactors: ['a', 'b', 'c', 'd', 'e'],
};
const d = (over: Partial<DecisionInput>): DecisionInput => ({
  kind: 'deny',
  conditions: [],
  reasons: [],
  note: '',
  reportInfluenced: false,
  ...over,
});
const fromReport = { criterionId: 'c5', code: 'C5' as const, source: 'screening_report' as const };
const fromLandlord = { criterionId: 'c4', code: 'C4' as const, source: 'landlord_reference' as const };

describe('when an adverse action notice is required (§3.15)', () => {
  it.each(['deny', 'approve_with_conditions', 'withdraw_offer'] as const)('%s with a report-based reason → FCRA', (kind) => {
    expect(noticeRequirement(d({ kind, reasons: [fromReport] }), report).letter).toBe('adverse_action');
  });
  it('the "screening report played a part" tick alone triggers it', () => {
    expect(noticeRequirement(d({ reasons: [fromLandlord], reportInfluenced: true }), report).adverseAction).toBe(true);
  });
  it('only a self-called reference → plain Denial letter', () => {
    expect(noticeRequirement(d({ reasons: [fromLandlord] }), null)).toMatchObject({ letter: 'denial', adverseAction: false, canExport: true });
  });
  it('Approve / Conditional offer never need it', () => {
    expect(noticeRequirement(d({ kind: 'approve', reportInfluenced: true }), report).letter).toBe('approval');
    expect(noticeRequirement(d({ kind: 'conditional_offer', reportInfluenced: true }), report).letter).toBe('conditional_offer');
  });
  it('a C9 reason adds the score block (≤ 4 key factors)', () => {
    const dec = d({ reasons: [{ criterionId: 'c9', code: 'C9', source: 'screening_report' }] });
    expect(noticeRequirement(dec, report).includeScore).toBe(true);
    const l = letterData({ decision: dec, report, reviewMode: 'compare', decidedAt: '2026-12-06T10:00:00-05:00' });
    expect(l.scoreBlock).toMatchObject({ score: 580, model: 'VantageScore 3.0', keyFactors: ['a', 'b', 'c', 'd'] });
    expect(l.fcraLines).toBe(FCRA_REQUIRED_LINES);
    expect(l.company?.name).toBe('TransUnion Rental Screening Solutions');
  });
  it('missing company name / address / phone → cannot export', () => {
    const n = noticeRequirement(d({ reasons: [fromReport] }), { ...report, companyAddress: ' ', companyPhone: null });
    expect(n).toMatchObject({ canExport: false, missingCompanyFields: ['address', 'phone'] });
  });
});

describe('S-15 checks', () => {
  const base = { status: 'in_review' as const, c10Enabled: false, missingCount: 0 };
  it('Deny needs a reason; reasons with prohibited words are blocked', () => {
    expect(validateDecision({ ...base, decision: d({}) }).errors.map((e) => e.code)).toEqual(['reasons_required']);
    const bad = validateDecision({ ...base, decision: d({ reasons: [fromLandlord], note: 'Too many kids' }) });
    expect(bad.errors.map((e) => e.code)).toEqual(['prohibited_terms']);
  });
  it('Deny with Missing items warns about the 72 hours', () => {
    expect(validateDecision({ ...base, missingCount: 1, decision: d({ reasons: [fromLandlord] }) }).warnings).toEqual([MISSING_INFO_WARNING]);
  });
  it('Conditional offer only with C10 on; Withdraw only after an offer and after the assessment', () => {
    expect(validateDecision({ ...base, decision: d({ kind: 'conditional_offer' }) }).errors[0].code).toBe('conditional_offer_requires_c10');
    expect(validateDecision({ ...base, decision: d({ kind: 'withdraw_offer', note: 'x' }) }).errors[0].code).toBe('withdraw_requires_offer');
    const withConviction = {
      ...base,
      status: 'conditional_offer' as const,
      c10Enabled: true,
      conditionalOfferAt: '2026-12-09T10:00:00-05:00',
      background: {
        noConvictions: false,
        convictions: [{ type: 'other' as const, convictedOn: '2024-01-01', sentenceEndedOn: null }],
        reviewedOn: '2026-12-10',
        assessment: { seriousness: null, rehabilitation: null, other: null },
      },
      decision: d({ kind: 'withdraw_offer', note: 'Recent conviction' }),
    };
    expect(validateDecision(withConviction).errors.map((e) => e.code)).toEqual(['assessment_required']);
  });
  it('Approve with conditions needs a condition', () => {
    expect(validateDecision({ ...base, decision: d({ kind: 'approve_with_conditions', reasons: [fromReport] }) }).errors[0].code).toBe(
      'conditions_required',
    );
  });
  it('First-come offers carry a 48 h reply-by time', () => {
    const l = letterData({ decision: d({ kind: 'approve' }), report: null, reviewMode: 'first_come', decidedAt: '2026-12-06T10:00:00-05:00' });
    expect(l.respondBy).toBe('2026-12-08T15:00:00.000Z');
  });
});
