/** C3 Eviction (§3.5), C5 Unpaid landlord balance (§3.7), C9 Credit (§3.10). */
import { dateOf, minusYears, partialDateVsCutoff } from '../dates';
import { formatUsd } from '../money';
import type { ApplicantInput, Cents, CriterionOf, Evidence, EvictionCase, EvidenceSource, IsoDate } from '../types';
import { makeResult, type RuleResult } from './result';

/** The Application asks about the past 7 years (S-08 part 5). */
export const APPLICATION_EVICTION_YEARS = 7;

function casesIn(cases: readonly EvictionCase[], cutoff: IsoDate) {
  return cases
    .map((c) => ({ c, where: partialDateVsCutoff(c.date, cutoff) }))
    .filter((x) => x.where !== 'out');
}

export function evaluateEviction(c: CriterionOf<'C3'>, applicant: ApplicantInput, title: string): RuleResult {
  const y = c.params.years;
  const receivedOn = dateOf(applicant.receivedAt);
  const answer = applicant.answers.evicted;
  const report = applicant.report;

  if (report && report.evictions != null) {
    const within = casesIn(report.evictions, minusYears(receivedOn, y));
    const sureJudgment = within.find((x) => x.c.outcome === 'judgment' && x.where === 'in');
    const maybeJudgment = within.find((x) => x.c.outcome === 'judgment');
    let outcome: 'met' | 'not_met' | 'needs_review';
    let reason: string;
    if (sureJudgment) {
      outcome = 'not_met';
      reason = `Eviction judgment (${sureJudgment.c.date}) within the past ${y} years`;
    } else if (maybeJudgment) {
      outcome = 'needs_review';
      reason = `Eviction judgment in ${maybeJudgment.c.date} may be within the past ${y} years — check the date on the report`;
    } else if (within.length) {
      outcome = 'needs_review';
      reason = 'A case was filed but there was no judgment against the applicant';
    } else {
      outcome = 'met';
      reason = `No eviction records in the past ${y} years`;
    }
    const mismatches: string[] = [];
    if (answer) {
      const reportYes = casesIn(report.evictions, minusYears(receivedOn, APPLICATION_EVICTION_YEARS)).length > 0;
      if (reportYes !== (answer === 'yes')) {
        mismatches.push(
          answer === 'yes'
            ? 'Application says there was an eviction case; the screening report shows none'
            : 'Application says no eviction case; the screening report shows one',
        );
      }
    }
    return makeResult(c, title, {
      outcome,
      evidence: 'verified',
      source: 'screening_report',
      verifiedOn: report.reportDate,
      reason,
      action: 'view_report',
      mismatches,
      mismatchAction: 'view_report',
    });
  }
  if (answer === 'no') {
    return makeResult(c, title, { outcome: 'met', evidence: 'claimed', source: 'application', reason: 'Applicant says no eviction case' });
  }
  if (answer === 'yes') {
    return makeResult(c, title, {
      outcome: 'needs_review',
      evidence: 'claimed',
      source: 'application',
      reason: 'Applicant reported an eviction case — add a screening report to see the outcome',
      action: 'add_report',
    });
  }
  return makeResult(c, title, { outcome: 'missing', reason: 'No eviction answer or screening report yet', action: 'add_report' });
}

interface BalanceSource {
  source: EvidenceSource;
  owes: boolean;
  cents: Cents | null;
  evidence: Evidence;
  on: IsoDate | null;
}

export function evaluateLandlordBalance(c: CriterionOf<'C5'>, applicant: ApplicantInput, title: string): RuleResult {
  const sources: BalanceSource[] = [];
  const report = applicant.report;
  if (report && report.landlordCollectionsCents != null) {
    sources.push({
      source: 'screening_report',
      owes: report.landlordCollectionsCents > 0,
      cents: report.landlordCollectionsCents,
      evidence: 'verified',
      on: report.reportDate,
    });
  }
  for (const ref of applicant.landlordReferences) {
    // "Wouldn't say" = no source yet (§3.3 / §3.7)
    if (ref.owes === 'yes' || ref.owes === 'no') {
      sources.push({
        source: 'landlord_reference',
        owes: ref.owes === 'yes',
        cents: ref.owes === 'yes' ? ref.owesCents : 0,
        evidence: ref.ownerConfirmed ? 'verified' : 'claimed',
        on: ref.answeredOn,
      });
    }
  }
  if (sources.length === 0) {
    return makeResult(c, title, {
      outcome: 'missing',
      reason: 'No source yet — add a screening report or ask the landlord',
      action: 'add_report',
    });
  }
  const owing = sources.filter((s) => s.owes);
  const clear = sources.filter((s) => !s.owes);
  const pick = (list: BalanceSource[]) =>
    list.find((s) => s.source === 'screening_report') ?? list.find((s) => s.evidence === 'verified') ?? list[0];
  if (owing.length) {
    const s = pick(owing);
    const who = s.source === 'screening_report' ? 'Screening report shows' : 'Landlord says';
    const amount = s.cents != null && s.cents > 0 ? formatUsd(s.cents) : 'an unpaid balance';
    return makeResult(c, title, {
      outcome: 'not_met',
      evidence: s.evidence,
      source: s.source,
      verifiedOn: s.on,
      reason: `${who} ${amount} owed to a landlord or property manager`,
      mismatches: clear.length ? ['Sources disagree about an unpaid landlord balance'] : [],
      mismatchAction: 'view_report',
    });
  }
  const s = pick(clear);
  return makeResult(c, title, {
    outcome: 'met',
    evidence: s.evidence,
    source: s.source,
    verifiedOn: s.on,
    reason: 'No unpaid balance owed to a past landlord',
  });
}

export function evaluateCredit(c: CriterionOf<'C9'>, applicant: ApplicantInput, title: string): RuleResult {
  const report = applicant.report;
  if (!report) return makeResult(c, title, { outcome: 'missing', reason: 'No screening report yet', action: 'add_report' });
  if (report.noScore) {
    return makeResult(c, title, {
      outcome: 'needs_review',
      evidence: 'verified',
      source: 'screening_report',
      verifiedOn: report.reportDate,
      reason: 'The report shows no credit score — your call',
      action: 'view_report',
    });
  }
  if (report.score == null) {
    return makeResult(c, title, { outcome: 'missing', reason: 'Enter the credit score from the report', action: 'view_report' });
  }
  const met = report.score >= c.params.minScore;
  return makeResult(c, title, {
    outcome: met ? 'met' : 'not_met',
    evidence: 'verified',
    source: 'screening_report',
    verifiedOn: report.scoreDate ?? report.reportDate,
    reason: `Credit score ${report.score}; required ${c.params.minScore}`,
  });
}
