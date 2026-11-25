/** C1 Income (§3.3) and the S-10 income check. */
import { divCeil, divHalfUp, formatMultiple, formatPercentDiff, formatRatio, formatUsd, payToMonthly, percentDiff } from '../money';
import type {
  ApplicantInput,
  Cents,
  CriterionOf,
  DocumentInput,
  Evidence,
  IncomeMetrics,
  IncomeSource,
  IsoDate,
  RentalInput,
} from '../types';
import { makeResult, type RuleResult } from './result';

/** Monthly amount a proof-of-income document shows: pay stub converted (§3.3), else the typed monthly amount. */
export function documentMonthlyCents(doc: DocumentInput): Cents | null {
  if (doc.payGrossCents != null && doc.payFrequency) return payToMonthly(doc.payGrossCents, doc.payFrequency);
  return doc.monthlyCents ?? null;
}

/** True when the document amount is below 90% of the stated amount. */
export function isIncomeMismatch(docMonthly: Cents, stated: Cents): boolean {
  return docMonthly * 10 < stated * 9;
}

export interface IncomeCheck {
  docMonthlyCents: Cents;
  statedCents: Cents;
  diffPercent: number;
  mismatch: boolean;
  /** "≈ $4,600/mo vs $5,200 stated (−12%)". */
  text: string;
}

/** S-10 "Income check" line. */
export function incomeCheck(docMonthlyCents: Cents, statedCents: Cents): IncomeCheck {
  const diffPercent = percentDiff(docMonthlyCents, statedCents);
  return {
    docMonthlyCents,
    statedCents,
    diffPercent,
    mismatch: isIncomeMismatch(docMonthlyCents, statedCents),
    text: `≈ ${formatUsd(docMonthlyCents)}/mo vs ${formatUsd(statedCents)} stated (${formatPercentDiff(diffPercent)})`,
  };
}

/** Checked proof-of-income documents that belong to an income source (unlinked ones count when there is one source). */
export function documentsForIncome(source: IncomeSource, applicant: ApplicantInput): DocumentInput[] {
  const sources = applicant.incomes.filter((i) => i.monthlyCents != null);
  return applicant.documents.filter(
    (d) =>
      d.type === 'proof_of_income' &&
      d.checkedOn != null &&
      documentMonthlyCents(d) != null &&
      (d.incomeId === source.id || (d.incomeId == null && sources.length === 1)),
  );
}

export function evaluateIncome(
  c: CriterionOf<'C1'>,
  rental: RentalInput,
  applicant: ApplicantInput,
  title: string,
): RuleResult {
  const x = c.params.multipleTenths;
  const sources = applicant.incomes.filter((i) => i.monthlyCents != null);
  const voucherApplied = c.params.applyToTenantShare && applicant.hasVoucher === true;

  if (voucherApplied && applicant.voucherMonthlyCents == null) {
    // TODO(question): product.md §3.3 does not say what to do when "Monthly amount it pays" is left blank.
    return makeResult(c, title, {
      outcome: 'missing',
      reason: 'Enter the monthly amount the voucher pays to check income against the tenant’s share',
      action: 'edit_application',
    });
  }
  const rentForTest = voucherApplied
    ? Math.max(0, rental.rentCents - (applicant.voucherMonthlyCents ?? 0))
    : rental.rentCents;

  if (rentForTest === 0) {
    return makeResult(c, title, {
      outcome: 'met',
      evidence: 'claimed',
      source: 'application',
      reason: 'The voucher pays the full rent',
      income: {
        householdCents: sum(sources.map((s) => s.monthlyCents ?? 0)),
        rentForTestCents: 0,
        voucherApplied,
        ratioHundredths: null,
        multipleTenths: x,
        shortByCents: null,
        usedDocuments: false,
      },
    });
  }
  if (sources.length === 0) {
    return makeResult(c, title, { outcome: 'missing', reason: 'No income entered', action: 'edit_application' });
  }

  let household = 0;
  let allVerified = true;
  let usedDocuments = false;
  let verifiedOn: IsoDate | null = null;
  const mismatchIssues: string[] = [];
  for (const s of sources) {
    const stated = s.monthlyCents as Cents;
    const docs = documentsForIncome(s, applicant);
    if (docs.length === 0) {
      household += stated;
      allVerified = false;
      continue;
    }
    usedDocuments = true;
    const amounts = docs.map((d) => documentMonthlyCents(d) as Cents);
    // Several checked documents for one source (e.g. 2 pay stubs): the lowest amount counts.
    const low = Math.min(...amounts);
    household += low;
    if (!amounts.some((a) => !isIncomeMismatch(a, stated))) allVerified = false;
    if (amounts.some((a) => isIncomeMismatch(a, stated))) {
      mismatchIssues.push(`Documents show ${incomeCheck(low, stated).text.slice(2)}`);
    }
    for (const d of docs) if (d.checkedOn && (!verifiedOn || d.checkedOn > verifiedOn)) verifiedOn = d.checkedOn;
  }

  const met = household * 10 >= x * rentForTest;
  let ratio = divHalfUp(household * 100, rentForTest);
  // Never display the required value (or more) for a Not met ratio, e.g. 2.996 → 2.99×, not 3.00×.
  if (!met && ratio >= x * 10) ratio = Math.floor((household * 100) / rentForTest);
  const shortBy = met ? null : divCeil(x * rentForTest, 10) - household;

  const evidence: Evidence = mismatchIssues.length ? 'mismatch' : allVerified ? 'verified' : 'claimed';
  const rentText = voucherApplied ? `your share of the rent (${formatUsd(rentForTest)})` : 'rent';
  let reason = `Household income ${formatUsd(household)}/mo is ${formatRatio(ratio)}× ${rentText}; required ${formatMultiple(x)}×`;
  if (shortBy != null) reason += ` · Short by ${formatUsd(shortBy)}/mo`;

  const metrics: IncomeMetrics = {
    householdCents: household,
    rentForTestCents: rentForTest,
    voucherApplied,
    ratioHundredths: ratio,
    multipleTenths: x,
    shortByCents: shortBy,
    usedDocuments,
  };
  return makeResult(c, title, {
    outcome: met ? 'met' : 'not_met',
    evidence,
    source: usedDocuments ? 'document' : 'application',
    verifiedOn,
    reason,
    income: metrics,
    mismatches: mismatchIssues,
    mismatchAction: 'review_documents',
  });
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
