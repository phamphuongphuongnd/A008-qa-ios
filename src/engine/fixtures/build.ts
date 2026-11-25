/** Test builders: a blank Applicant / criterion lookup. Plain data, no randomness. */
import { defaultCriteria } from '../criteria';
import type { ApplicantInput, Criterion, CriterionCode, CriterionOf, RentalInput } from '../types';

export const RENTAL: RentalInput = { id: 'r1', rentCents: 165000, bedrooms: 2, reviewMode: 'compare' };

export function applicant(over: Partial<ApplicantInput> = {}): ApplicantInput {
  return {
    id: 'a1',
    fullName: 'Test Applicant',
    receivedAt: '2026-12-02T09:14:00-05:00',
    status: 'new',
    conditionalOfferAt: null,
    occupants: 2,
    pets: [],
    hasVoucher: false,
    voucherMonthlyCents: null,
    residences: [],
    incomes: [],
    documents: [],
    landlordReferences: [],
    employerReferences: [],
    report: null,
    background: null,
    answers: { evicted: null, bankruptcy: null, smokes: null },
    customAnswers: {},
    landlordChecks: {},
    ...over,
  };
}

/** Default criterion of a code with params overridden. */
export function criterion<C extends Exclude<CriterionCode, 'CX'>>(
  code: C,
  params: Partial<CriterionOf<C>['params']> = {},
): CriterionOf<C> {
  const c = defaultCriteria('t').find((x) => x.code === code) as Criterion;
  return { ...c, enabled: true, params: { ...c.params, ...params } } as unknown as CriterionOf<C>;
}
