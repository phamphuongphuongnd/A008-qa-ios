/** @jest-environment node */
// §3.3 C1 Income + S-10 income check.
import { evaluateCriterion, formatUsd, incomeCheck, payToMonthly } from '..';
import { applicant, criterion, RENTAL } from '../fixtures/build';
import type { ApplicantInput, DocumentInput } from '../types';

const c1 = criterion('C1');
const run = (a: ApplicantInput, c = c1, rental = RENTAL) => evaluateCriterion(c, rental, a);
const stub = (id: string, gross: number, freq: DocumentInput['payFrequency'], checked = true, incomeId = 'i1'): DocumentInput => ({
  id,
  type: 'proof_of_income',
  checkedOn: checked ? '2026-12-03' : null,
  incomeId,
  payGrossCents: gross,
  payFrequency: freq,
});

describe('pay stub → monthly (§3.3), 4 frequencies, rounded to the cent', () => {
  it.each([
    ['weekly', 100000, 433333],
    ['biweekly', 247000, 535167],
    ['semimonthly', 305000, 610000],
    ['monthly', 123456, 123456],
  ] as const)('%s %d → %d', (freq, gross, monthly) => {
    expect(payToMonthly(gross, freq)).toBe(monthly);
  });
});

describe('C1 outcome', () => {
  it('exactly 3.0× is Met (boundary)', () => {
    const r = run(applicant({ incomes: [{ id: 'i1', kind: 'employment', monthlyCents: 495000 }] }));
    expect(r.outcome).toBe('met');
    expect(r.income?.ratioHundredths).toBe(300);
  });
  it('one cent below 3.0× is Not met, shows 2.99× (never 3.00×) and short by $0.01', () => {
    const r = run(applicant({ incomes: [{ id: 'i1', kind: 'employment', monthlyCents: 494999 }] }));
    expect(r.outcome).toBe('not_met');
    expect(r.income?.ratioHundredths).toBe(299);
    expect(r.income?.shortByCents).toBe(1);
    expect(r.reason).toContain('Short by $0.01/mo');
  });
  it('no income → Missing', () => {
    expect(run(applicant()).outcome).toBe('missing');
    expect(run(applicant({ incomes: [{ id: 'i1', kind: 'employment', monthlyCents: null }] })).outcome).toBe('missing');
  });
  it('household = applicant + other income + other adults', () => {
    const r = run(
      applicant({
        incomes: [
          { id: 'i1', kind: 'employment', monthlyCents: 300000 },
          { id: 'i2', kind: 'child_support', monthlyCents: 50000 },
          { id: 'i3', kind: 'other_adult', monthlyCents: 200000 },
        ],
      }),
    );
    expect(r.income?.householdCents).toBe(550000);
    expect(r.outcome).toBe('met');
  });
  it('voucher makes rentForTest = 0 → Met', () => {
    const r = run(applicant({ hasVoucher: true, voucherMonthlyCents: 200000, incomes: [] }));
    expect(r.outcome).toBe('met');
    expect(r.income?.rentForTestCents).toBe(0);
  });
  it('voucher option OFF → full rent is used', () => {
    const off = criterion('C1', { applyToTenantShare: false });
    const r = run(applicant({ hasVoucher: true, voucherMonthlyCents: 90000, incomes: [{ id: 'i1', kind: 'benefits', monthlyCents: 260000 }] }), off);
    expect(r.outcome).toBe('not_met');
    expect(r.income?.rentForTestCents).toBe(165000);
  });
  it('voucher with blank amount → Missing (asks for the amount)', () => {
    const r = run(applicant({ hasVoucher: true, voucherMonthlyCents: null, incomes: [{ id: 'i1', kind: 'benefits', monthlyCents: 260000 }] }));
    expect(r.outcome).toBe('missing');
  });
  it('custom multiple 2.5× and rounding of "short by" up to the cent', () => {
    const c = criterion('C1', { multipleTenths: 25 });
    const r = run(applicant({ incomes: [{ id: 'i1', kind: 'employment', monthlyCents: 100000 }] }), c, { ...RENTAL, rentCents: 99999 });
    // required 2.5 × 999.99 = 2,499.975 → short by ceil(249997.5) − 100000 = 149998
    expect(r.income?.shortByCents).toBe(149998);
  });
});

describe('C1 evidence', () => {
  const income = [{ id: 'i1', kind: 'employment' as const, monthlyCents: 540000 }];
  it('checked pay stub ≥ 90% → Verified, ratio from the documents', () => {
    const r = run(applicant({ incomes: income, documents: [stub('d1', 247000, 'biweekly')] }));
    expect(r.evidence).toBe('verified');
    expect(r.source).toBe('document');
    expect(r.income?.householdCents).toBe(535167);
  });
  it('exactly 90% is Verified, below is Mismatch with both numbers', () => {
    const at90 = run(applicant({ incomes: income, documents: [{ id: 'd', type: 'proof_of_income', checkedOn: '2026-12-03', monthlyCents: 486000 }] }));
    expect(at90.evidence).toBe('verified');
    const below = run(applicant({ incomes: income, documents: [{ id: 'd', type: 'proof_of_income', checkedOn: '2026-12-03', monthlyCents: 485999 }] }));
    expect(below.evidence).toBe('mismatch');
    expect(below.issues[0].message).toContain('$4,859.99/mo vs $5,400 stated');
  });
  it('unchecked document → Claimed, stated amount used', () => {
    const r = run(applicant({ incomes: income, documents: [stub('d1', 100000, 'biweekly', false)] }));
    expect(r.evidence).toBe('claimed');
    expect(r.income?.householdCents).toBe(540000);
  });
  it('two sources, only one with a checked document → Claimed', () => {
    const r = run(
      applicant({
        incomes: [...income, { id: 'i2', kind: 'other_adult', monthlyCents: 100000 }],
        documents: [stub('d1', 247000, 'biweekly')],
      }),
    );
    expect(r.evidence).toBe('claimed');
    expect(r.income?.householdCents).toBe(535167 + 100000);
  });
});

describe('S-10 income check', () => {
  it('"≈ $4,600/mo vs $5,200 stated (−12%)" + mismatch', () => {
    const c = incomeCheck(460000, 520000);
    expect(c.text).toBe('≈ $4,600/mo vs $5,200 stated (−12%)');
    expect(c.mismatch).toBe(true);
  });
  it('formatUsd', () => {
    expect(formatUsd(535167)).toBe('$5,351.67');
    expect(formatUsd(165000)).toBe('$1,650');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(123456789)).toBe('$1,234,567.89');
  });
});
