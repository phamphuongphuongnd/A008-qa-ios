// Step 4 QA: §3.6 rules the other engine tests do not pin down (TESTCASES, C4 with no rented residence).
import { evaluateCriterion } from '..';
import { applicant, criterion, RENTAL } from '../fixtures/build';
import type { Residence } from '../types';

const res = (id: string, type: Residence['type'], to: string | null = null): Residence => ({
  id,
  address: `${id} Main St`,
  from: '2022-01',
  to,
  current: to == null,
  type,
  rentCents: type === 'rent' ? 120000 : null,
});

describe('C4 with no rented residence (§3.6, Phương 2026-11-25)', () => {
  it.each(['own', 'with_family'] as const)('only %s residences → Needs review · Claimed, "your call"', (type) => {
    const r = evaluateCriterion(criterion('C4'), RENTAL, applicant({ residences: [res('a', type)] }));
    expect(r).toMatchObject({ outcome: 'needs_review', evidence: 'claimed', source: 'application' });
    expect(r.reason).toBe('No previous landlord to call (no rented residence) — your call');
  });

  it('an owned home now + a past rental → the past rental landlord is the one to call (Missing until called)', () => {
    const r = evaluateCriterion(criterion('C4'), RENTAL, applicant({ residences: [res('own', 'own'), res('old', 'rent', '2021-12')] }));
    expect(r.outcome).toBe('missing');
    expect(r.reason).toBe('Call the landlord at old Main St');
  });
});
