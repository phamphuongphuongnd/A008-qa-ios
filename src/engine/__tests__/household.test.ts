/** @jest-environment node */
// §3.8 C6 Documents, §3.9 C7 Occupancy + C8 Pets, §3.11 C10, custom criteria.
import {
  convictionsInLookback,
  documentProgress,
  evaluateCriterion,
  missingAssessment,
  OCCUPANCY_WARNING,
  yearsSince,
} from '..';
import { applicant, criterion, RENTAL } from '../fixtures/build';
import type { BackgroundReview, Criterion, PetEntry } from '../types';

describe('C6 documents (§3.8)', () => {
  const c6 = criterion('C6');
  it('a required type missing → Missing, listing the type', () => {
    const r = evaluateCriterion(c6, RENTAL, applicant({ documents: [{ id: 'd', type: 'photo_id', checkedOn: null }] }));
    expect(r.outcome).toBe('missing');
    expect(r.reason).toBe('Missing: Proof of income');
  });
  it('all provided → Met Claimed; all checked → Verified', () => {
    const docs = [
      { id: 'd1', type: 'photo_id' as const, checkedOn: '2026-12-02' },
      { id: 'd2', type: 'proof_of_income' as const, checkedOn: null },
    ];
    expect(evaluateCriterion(c6, RENTAL, applicant({ documents: docs })).evidence).toBe('claimed');
    const all = docs.map((d) => ({ ...d, checkedOn: '2026-12-03' }));
    const r = evaluateCriterion(c6, RENTAL, applicant({ documents: all }));
    expect([r.outcome, r.evidence, r.verifiedOn]).toEqual(['met', 'verified', '2026-12-03']);
  });
  it('"Other" requirement matches by label; progress counts 1/2', () => {
    const req = [{ type: 'photo_id' as const }, { type: 'other' as const, label: 'Pet vaccination record' }];
    const p = documentProgress(req, [{ id: 'd', type: 'other', label: 'pet vaccination record', checkedOn: null }]);
    expect(p).toMatchObject({ required: 2, provided: 1, missing: ['Photo ID'] });
  });
});

describe('C7 occupancy (§3.9)', () => {
  const run = (occupants: number | null, bedrooms = 2, perBedroom = 2) =>
    evaluateCriterion(criterion('C7', { perBedroom }), { ...RENTAL, bedrooms }, applicant({ occupants }));
  it('exactly p × bedrooms → Met; one more → Not met + orange warning', () => {
    expect(run(4).outcome).toBe('met');
    const r = run(5);
    expect(r.outcome).toBe('not_met');
    expect(r.warning).toBe('occupancy_local_code');
    expect(OCCUPANCY_WARNING).toContain('families with children are protected');
  });
  it('Studio (0 bedrooms) counts as 1', () => {
    expect(run(2, 0).outcome).toBe('met');
    expect(run(3, 0).outcome).toBe('not_met');
  });
  it('not answered → Missing', () => {
    expect(run(null).outcome).toBe('missing');
  });
});

describe('C8 pets (§3.9)', () => {
  const run = (pets: PetEntry[] | null, policy: 'no_pets' | 'cats_only' | 'cats_and_dogs' | 'case_by_case', maxPets = 2) =>
    evaluateCriterion(criterion('C8', { policy, maxPets }), RENTAL, applicant({ pets }));
  it('no pets → Met under every policy', () => {
    for (const p of ['no_pets', 'cats_only', 'cats_and_dogs', 'case_by_case'] as const) expect(run([], p).outcome).toBe('met');
  });
  it('No pets policy + a cat → Not met; Cats only + a dog → Not met', () => {
    expect(run([{ kind: 'cat', count: 1 }], 'no_pets').outcome).toBe('not_met');
    expect(run([{ kind: 'dog', count: 1 }], 'cats_only').outcome).toBe('not_met');
    expect(run([{ kind: 'cat', count: 2 }], 'cats_only').outcome).toBe('met');
  });
  it('Cats and dogs max 2: 2 → Met, 3 → Not met, other animal → Not met', () => {
    expect(run([{ kind: 'cat', count: 1 }, { kind: 'dog', count: 1 }], 'cats_and_dogs').outcome).toBe('met');
    expect(run([{ kind: 'dog', count: 3 }], 'cats_and_dogs').outcome).toBe('not_met');
    expect(run([{ kind: 'other', count: 1 }], 'cats_and_dogs').outcome).toBe('not_met');
  });
  it('case by case with a pet → Needs review; not answered → Missing', () => {
    expect(run([{ kind: 'dog', count: 1 }], 'case_by_case').outcome).toBe('needs_review');
    expect(run(null, 'cats_only').outcome).toBe('missing');
  });
});

describe('C10 criminal history (§3.11)', () => {
  const c10 = criterion('C10', { lookbackYears: 7 });
  const bg = (over: Partial<BackgroundReview> = {}): BackgroundReview => ({
    noConvictions: false,
    convictions: [],
    reviewedOn: '2026-12-10',
    assessment: { seriousness: null, rehabilitation: null, other: null },
    ...over,
  });
  const offered = { status: 'conditional_offer' as const, conditionalOfferAt: '2026-12-09T10:00:00-05:00' };
  it('before a Conditional offer → "Not reviewed yet (after offer)", not counted as Missing', () => {
    const r = evaluateCriterion(c10, RENTAL, applicant({ background: bg({ noConvictions: true }) }));
    expect(r.outcome).toBe('not_reviewed');
    expect(r.issues).toEqual([]);
  });
  it('after the offer: nothing entered → Missing; no convictions → Met', () => {
    expect(evaluateCriterion(c10, RENTAL, applicant({ ...offered })).outcome).toBe('missing');
    expect(evaluateCriterion(c10, RENTAL, applicant({ ...offered, background: bg({ noConvictions: true }) })).outcome).toBe('met');
  });
  it('a conviction in the lookback → Needs review, never Not met', () => {
    const r = evaluateCriterion(
      c10,
      RENTAL,
      applicant({ ...offered, background: bg({ convictions: [{ type: 'property', convictedOn: '2021-03-01', sentenceEndedOn: '2022-03-01' }] }) }),
    );
    expect(r.outcome).toBe('needs_review');
  });
  it('lookback boundary: 7 years before the offer date is inside, a day earlier outside', () => {
    const b = bg({
      convictions: [
        { type: 'drug', convictedOn: '2019-12-09', sentenceEndedOn: null },
        { type: 'drug', convictedOn: '2019-12-08', sentenceEndedOn: null },
      ],
    });
    expect(convictionsInLookback(b, 7, '2026-12-09')).toHaveLength(1);
  });
  it('withdraw needs the 3 written assessment answers when there are convictions', () => {
    const b = bg({ convictions: [{ type: 'other', convictedOn: '2024-01-01', sentenceEndedOn: null }] });
    expect(missingAssessment(b, 7, '2026-12-09')).toEqual(['seriousness', 'rehabilitation', 'other']);
    const filled = { ...b, assessment: { seriousness: 'Minor', rehabilitation: 'Yes', other: 'None' } };
    expect(missingAssessment(filled, 7, '2026-12-09')).toEqual([]);
    expect(yearsSince(b.convictions[0], '2026-12-09')).toEqual({ conviction: 2, sentenceEnded: null });
  });
});

describe('custom yes/no criteria', () => {
  const cx = (answeredBy: 'applicant' | 'landlord'): Criterion => ({
    id: 'cx1',
    code: 'CX',
    enabled: true,
    order: 11,
    params: { title: 'Can move in by Jan 15', answeredBy },
  });
  it('applicant yes → Met Claimed; no → Not met; blank → Missing', () => {
    expect(evaluateCriterion(cx('applicant'), RENTAL, applicant({ customAnswers: { cx1: true } })).evidence).toBe('claimed');
    expect(evaluateCriterion(cx('applicant'), RENTAL, applicant({ customAnswers: { cx1: false } })).outcome).toBe('not_met');
    expect(evaluateCriterion(cx('applicant'), RENTAL, applicant()).outcome).toBe('missing');
  });
  it('landlord checks → Verified', () => {
    const r = evaluateCriterion(cx('landlord'), RENTAL, applicant({ landlordChecks: { cx1: true } }));
    expect([r.outcome, r.evidence, r.source]).toEqual(['met', 'verified', 'landlord_note']);
  });
});
