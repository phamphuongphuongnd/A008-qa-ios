/** @jest-environment node */
// §3.4 C2 Rental history, §3.6 C4 Landlord reference, S-11 red flags.
import { canMarkUnreachable, c4Residence, evaluateCriterion, referenceRedFlags, rentalHistoryMonths } from '..';
import { applicant, criterion, RENTAL } from '../fixtures/build';
import type { LandlordReference, Residence } from '../types';

const res = (id: string, from: string, to: string | null, type: Residence['type'] = 'rent', rentCents: number | null = 120000): Residence => ({
  id,
  address: `${id} Main St`,
  from,
  to,
  current: to == null,
  type,
  rentCents,
});
const ref = (residenceId: string, over: Partial<LandlordReference> = {}): LandlordReference => ({
  id: `ref-${residenceId}`,
  residenceId,
  ownerConfirmed: true,
  confirmSource: 'county_records',
  answeredOn: '2026-12-03',
  rentedFromYou: 'yes',
  from: null,
  to: null,
  rentCents: null,
  owes: null,
  owesCents: null,
  rentAgain: 'yes',
  unreachable: false,
  attempts: [],
  ...over,
});
const RECEIVED = '2026-12-02';

describe('C2 months (§3.4)', () => {
  it('overlapping residences are merged', () => {
    // Jan 2024 – Jan 2025 and Jul 2024 – Jul 2025 → Jan 2024 – Jul 2025 = 18
    expect(rentalHistoryMonths([res('a', '2024-01', '2025-01'), res('b', '2024-07', '2025-07')], RECEIVED)).toBe(18);
  });
  it('a residence inside another counts once', () => {
    expect(rentalHistoryMonths([res('a', '2020-01', '2023-01'), res('b', '2021-01', '2021-06')], RECEIVED)).toBe(36);
  });
  it('current residence runs to the date received, rounded down', () => {
    expect(rentalHistoryMonths([res('a', '2024-10', null)], RECEIVED)).toBe(26);
    expect(rentalHistoryMonths([res('a', '2024-12', null)], '2026-12-01')).toBe(24);
  });
  it('only Rent / Own count', () => {
    expect(rentalHistoryMonths([res('a', '2020-01', '2022-01', 'with_family'), res('b', '2022-01', '2023-01', 'own')], RECEIVED)).toBe(12);
  });
  it('exactly m months is Met; one less is Not met', () => {
    const c = criterion('C2', { months: 26 });
    expect(evaluateCriterion(c, RENTAL, applicant({ residences: [res('a', '2024-10', null)] })).outcome).toBe('met');
    const c27 = criterion('C2', { months: 27 });
    expect(evaluateCriterion(c27, RENTAL, applicant({ residences: [res('a', '2024-10', null)] })).outcome).toBe('not_met');
  });
  it('no residence → Missing', () => {
    expect(evaluateCriterion(criterion('C2'), RENTAL, applicant()).outcome).toBe('missing');
  });
  it('first-time renter (0 months) → Not met with the co-signer hint', () => {
    const r = evaluateCriterion(criterion('C2'), RENTAL, applicant({ residences: [res('a', '2020-01', null, 'with_family')] }));
    expect(r.outcome).toBe('not_met');
    expect(r.reason).toContain('Consider a co-signer or other evidence — your call');
  });
});

describe('C2 evidence', () => {
  const a = (r: LandlordReference) => applicant({ residences: [res('a', '2022-03', null)], landlordReferences: [r] });
  it('landlord dates within 31 days at both ends → Verified', () => {
    const r = evaluateCriterion(criterion('C2'), RENTAL, a(ref('a', { from: '2022-04', to: 'still_there' })));
    expect(r.evidence).toBe('verified');
    expect(r.source).toBe('landlord_reference');
  });
  it('more than 31 days apart → Mismatch', () => {
    const r = evaluateCriterion(criterion('C2'), RENTAL, a(ref('a', { from: '2022-05', to: 'still_there' })));
    expect(r.evidence).toBe('mismatch');
    expect(r.issues[0].kind).toBe('mismatch');
  });
  it('the longest residence is the one checked', () => {
    const r = evaluateCriterion(
      criterion('C2'),
      RENTAL,
      applicant({
        residences: [res('short', '2025-06', null), res('long', '2019-01', '2025-06')],
        landlordReferences: [ref('long', { from: '2019-01', to: '2025-06' })],
      }),
    );
    expect(r.evidence).toBe('verified');
  });
  it('no landlord dates → Claimed', () => {
    expect(evaluateCriterion(criterion('C2'), RENTAL, a(ref('a'))).evidence).toBe('claimed');
  });
});

describe('C4 landlord reference (§3.6)', () => {
  const run = (refs: LandlordReference[], residences = [res('cur', '2024-01', null)]) =>
    evaluateCriterion(criterion('C4'), RENTAL, applicant({ residences, landlordReferences: refs }));
  it.each([
    ['yes', 'met'],
    ['no', 'not_met'],
    ['wouldnt_say', 'needs_review'],
  ] as const)('would rent again %s → %s', (answer, outcome) => {
    expect(run([ref('cur', { rentAgain: answer })]).outcome).toBe(outcome);
  });
  it('not called → Missing; unreachable → "Unreachable after 3 attempts"', () => {
    expect(run([]).outcome).toBe('missing');
    const attempts = [
      { at: '2026-12-03T09:00:00-05:00', method: 'call', result: 'no_answer' },
      { at: '2026-12-03T12:00:00-05:00', method: 'email', result: 'no_answer' },
      { at: '2026-12-04T09:00:00-05:00', method: 'call', result: 'left_message' },
    ] as const;
    const r = run([ref('cur', { rentAgain: null, unreachable: true, attempts: [...attempts] })]);
    expect(r.outcome).toBe('missing');
    expect(r.reason).toBe('Unreachable after 3 attempts');
  });
  it('uses the most recent previous residence, not the current one', () => {
    const residences = [res('cur', '2025-01', null), res('old1', '2020-01', '2022-01'), res('old2', '2022-01', '2025-01')];
    expect(c4Residence(applicant({ residences }))?.id).toBe('old2');
    const r = run([ref('cur', { rentAgain: 'yes' }), ref('old2', { rentAgain: 'no' })], residences);
    expect(r.outcome).toBe('not_met');
  });
  it('owner not confirmed → Claimed + "Landlord identity not confirmed"', () => {
    const r = run([ref('cur', { ownerConfirmed: false })]);
    expect(r.evidence).toBe('claimed');
    expect(r.issues.map((i) => i.message)).toContain('Landlord identity not confirmed');
    expect(r.issues.every((i) => ['mismatch', 'needs_review', 'missing'].includes(i.kind))).toBe(true);
  });
  it('rent more than 5% off → Mismatch, outcome unchanged; exactly 5% is fine', () => {
    const over = run([ref('cur', { rentCents: 126001 })]);
    expect(over.outcome).toBe('met');
    expect(over.evidence).toBe('mismatch');
    expect(run([ref('cur', { rentCents: 126000 })]).evidence).toBe('verified');
  });
});

describe('S-11 helpers', () => {
  it('unreachable needs ≥ 3 failed attempts by ≥ 2 methods', () => {
    const call = { at: '2026-12-03T09:00:00-05:00', method: 'call' as const, result: 'no_answer' as const };
    expect(canMarkUnreachable([call, call, call])).toBe(false);
    expect(canMarkUnreachable([call, call, { ...call, method: 'text' }])).toBe(true);
    expect(canMarkUnreachable([call, { ...call, method: 'text' }])).toBe(false);
  });
  it('red flags: dates, rent, unconfirmed owner, wouldn’t say, gap > 2 months', () => {
    const residences = [res('cur', '2024-06', null), res('old', '2020-01', '2024-01')];
    const r = ref('cur', { ownerConfirmed: false, from: '2023-01', to: 'still_there', rentCents: 200000, rentAgain: 'wouldnt_say' });
    expect(referenceRedFlags(applicant({ residences, landlordReferences: [r] }), r)).toEqual([
      'dates_mismatch',
      'rent_mismatch',
      'owner_not_confirmed',
      'rent_again_wouldnt_say',
      'gap_over_two_months',
    ]);
  });
});
