/** C10 Criminal history, step 2 after a Conditional offer (§3.11, S-14). Never Not met. */
import { dateOf, minusYears, wholeYearsBetween } from '../dates';
import type { ApplicantInput, BackgroundReview, Conviction, CriterionOf, IsoDate } from '../types';
import { makeResult, type RuleResult } from './result';

export const NOT_REVIEWED_TEXT = 'Not reviewed yet (after offer)';

/** Convictions dated inside the lookback, counted back from the Conditional offer date. */
export function convictionsInLookback(
  background: BackgroundReview | null,
  lookbackYears: number,
  offerOn: IsoDate,
): Conviction[] {
  if (!background || background.noConvictions) return [];
  const cutoff = minusYears(offerOn, lookbackYears);
  return background.convictions.filter((c) => c.convictedOn >= cutoff);
}

export function evaluateBackground(c: CriterionOf<'C10'>, applicant: ApplicantInput, title: string): RuleResult {
  if (!applicant.conditionalOfferAt) {
    return makeResult(c, title, { outcome: 'not_reviewed', reason: NOT_REVIEWED_TEXT });
  }
  const bg = applicant.background;
  if (!bg || (!bg.noConvictions && bg.convictions.length === 0)) {
    return makeResult(c, title, { outcome: 'missing', reason: 'Complete the background review', action: 'background_review' });
  }
  const n = c.params.lookbackYears;
  const found = convictionsInLookback(bg, n, dateOf(applicant.conditionalOfferAt));
  const base = { evidence: 'verified' as const, source: 'screening_report' as const, verifiedOn: bg.reviewedOn };
  if (found.length === 0) {
    return makeResult(c, title, { ...base, outcome: 'met', reason: `No convictions in the past ${n} years` });
  }
  return makeResult(c, title, {
    ...base,
    outcome: 'needs_review',
    reason: `${found.length} conviction${found.length > 1 ? 's' : ''} in the past ${n} years — individual review required`,
    action: 'background_review',
  });
}

export type AssessmentField = 'seriousness' | 'rehabilitation' | 'other';

/**
 * S-14: the individual assessment questions still unanswered. Required before "Withdraw the offer" when there are
 * convictions in the lookback ("How long ago was it?" is computed, see `yearsSince`).
 */
export function missingAssessment(background: BackgroundReview | null, lookbackYears: number, offerOn: IsoDate): AssessmentField[] {
  if (convictionsInLookback(background, lookbackYears, offerOn).length === 0 || !background) return [];
  const a = background.assessment;
  return (['seriousness', 'rehabilitation', 'other'] as const).filter((k) => !(a[k] ?? '').trim());
}

/** "How long ago was it?" in whole years since the conviction and since the sentence ended. */
export function yearsSince(conviction: Conviction, asOf: IsoDate): { conviction: number; sentenceEnded: number | null } {
  return {
    conviction: wholeYearsBetween(conviction.convictedOn, asOf),
    sentenceEnded: conviction.sentenceEndedOn ? wholeYearsBetween(conviction.sentenceEndedOn, asOf) : null,
  };
}
