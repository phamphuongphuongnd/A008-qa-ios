/**
 * Applicant evaluation (§3.1): one result per enabled criterion, the Issues list and the summary line.
 * No total score, no ranking: Compare columns follow the order applications were received.
 */
import { activeCriteria, criterionTitle } from './criteria';
import { instantMs } from './dates';
import { evaluateBackground } from './rules/background';
import { evaluateLandlordReference, evaluateRentalHistory } from './rules/history';
import { evaluateCustom, evaluateDocuments, evaluateOccupancy, evaluatePets } from './rules/household';
import { evaluateIncome } from './rules/income';
import { evaluateCredit, evaluateEviction, evaluateLandlordBalance } from './rules/report';
import type {
  ApplicantEvaluation,
  ApplicantInput,
  ApplicantStatus,
  ApplicantSummary,
  Criterion,
  CriterionResult,
  Evidence,
  Issue,
  Outcome,
  RentalInput,
} from './types';

export function evaluateCriterion(c: Criterion, rental: RentalInput, applicant: ApplicantInput): CriterionResult {
  const title = criterionTitle(c);
  switch (c.code) {
    case 'C1':
      return evaluateIncome(c, rental, applicant, title);
    case 'C2':
      return evaluateRentalHistory(c, applicant, title);
    case 'C3':
      return evaluateEviction(c, applicant, title);
    case 'C4':
      return evaluateLandlordReference(c, applicant, title);
    case 'C5':
      return evaluateLandlordBalance(c, applicant, title);
    case 'C6':
      return evaluateDocuments(c, applicant, title);
    case 'C7':
      return evaluateOccupancy(c, rental, applicant, title);
    case 'C8':
      return evaluatePets(c, applicant, title);
    case 'C9':
      return evaluateCredit(c, applicant, title);
    case 'C10':
      return evaluateBackground(c, applicant, title);
    case 'CX':
      return evaluateCustom(c, applicant, title);
  }
}

const KIND_RANK: Record<Issue['kind'], number> = { mismatch: 0, needs_review: 2, unconfirmed: 3, missing: 4 };
const OUTCOME_RANK: Record<Outcome, number> = { not_met: 0, needs_review: 1, missing: 2, met: 3, not_reviewed: 4 };

/** Mismatch → Not met → Needs review → Missing (§3.1); ties keep criterion order. */
export function sortIssues(issues: readonly Issue[], order: readonly string[]): Issue[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort(
      (a, b) =>
        KIND_RANK[a.issue.kind] - KIND_RANK[b.issue.kind] ||
        OUTCOME_RANK[a.issue.outcome] - OUTCOME_RANK[b.issue.outcome] ||
        (pos.get(a.issue.criterionId) ?? 0) - (pos.get(b.issue.criterionId) ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.issue);
}

export function summarize(results: readonly CriterionResult[]): ApplicantSummary {
  const missingCount = results.filter((r) => r.outcome === 'missing').length;
  return {
    ready: missingCount === 0,
    missingCount,
    text: missingCount === 0 ? 'Ready to decide' : `${missingCount} item${missingCount === 1 ? '' : 's'} missing`,
  };
}

/** Evaluate one Applicant against the Rental's Criteria. */
export function evaluateApplicant(
  rental: RentalInput,
  criteria: readonly Criterion[],
  applicant: ApplicantInput,
): ApplicantEvaluation {
  const active = activeCriteria(criteria);
  const results = active.map((c) => evaluateCriterion(c, rental, applicant));
  return {
    applicantId: applicant.id,
    results,
    issues: sortIssues(
      results.flatMap((r) => r.issues),
      active.map((c) => c.id),
    ),
    summary: summarize(results),
  };
}

/** Applicants in the order applications were received (ties by id). */
export function byReceived<T extends { receivedAt: string; id: string }>(list: readonly T[]): T[] {
  return list
    .slice()
    .sort((a, b) => instantMs(a.receivedAt) - instantMs(b.receivedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface CompareCell {
  outcome: Outcome;
  evidence: Evidence | null;
}

export interface CompareTable {
  /** "Not a ranking. Columns are in the order applications were received." */
  columns: { applicantId: string; fullName: string; receivedAt: string; status: ApplicantStatus; summary: ApplicantSummary }[];
  rows: { criterionId: string; code: Criterion['code']; title: string; cells: CompareCell[] }[];
  /** Issue count per column (last row "Issues"). */
  issueCounts: number[];
  evaluations: ApplicantEvaluation[];
}

/** S-17 Compare table. `hideClosed` = "Hide denied / withdrawn". */
export function compareApplicants(
  rental: RentalInput,
  criteria: readonly Criterion[],
  applicants: readonly ApplicantInput[],
  options: { hideClosed?: boolean } = {},
): CompareTable {
  const shown = byReceived(applicants).filter(
    (a) => !options.hideClosed || (a.status !== 'denied' && a.status !== 'withdrawn'),
  );
  const evaluations = shown.map((a) => evaluateApplicant(rental, criteria, a));
  const active = activeCriteria(criteria);
  return {
    columns: shown.map((a, i) => ({
      applicantId: a.id,
      fullName: a.fullName,
      receivedAt: a.receivedAt,
      status: a.status,
      summary: evaluations[i].summary,
    })),
    rows: active.map((c, row) => ({
      criterionId: c.id,
      code: c.code,
      title: criterionTitle(c),
      cells: evaluations.map((e) => ({ outcome: e.results[row].outcome, evidence: e.results[row].evidence })),
    })),
    issueCounts: evaluations.map((e) => e.issues.length),
    evaluations,
  };
}
