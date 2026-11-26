/**
 * S-14 Background review (step 2) — pure logic: the gate (only after a Conditional offer), form ↔ DB, validation,
 * "How long ago" text, and whether "Continue" / "Withdraw the offer" may be chosen. Convictions only (no arrests);
 * the app never auto-denies: a conviction in the lookback is always Needs review (engine C10), and withdrawing needs
 * the individual assessment answered (engine `missingAssessment`). product.md §3.11, §5 S-14.
 */
import {
  convictionsInLookback,
  dateOf,
  missingAssessment,
  type ApplicantStatus,
  type AssessmentField,
  type BackgroundReview,
  type Conviction,
  type ConvictionType,
  type IsoDate,
} from '@/engine';
import type { BackgroundAssessment } from '@/db/model';
import type { Background, NewBackground, Patch } from '@/db/types';
import { t } from '@/i18n';

import { isIsoDate, yearsAndMonthsBetween, type FieldError } from './common';

export const CONVICTION_TYPES: readonly ConvictionType[] = ['violent', 'property', 'drug', 'fraud', 'other'];

/**
 * - `not_in_criteria`: C10 is off for this Rental — criminal history is not reviewed at all.
 * - `locked`: no Conditional offer yet ("Unlocks after you make a conditional offer.").
 * - `open`: Applicant is in Conditional offer — editable.
 * - `read_only`: an offer was made and a later Decision followed (approved / withdrawn…) — kept as the record.
 */
export type BackgroundGate = 'not_in_criteria' | 'locked' | 'open' | 'read_only';

export function backgroundGate(input: { c10Enabled: boolean; conditionalOfferAt: string | null; status: ApplicantStatus }): BackgroundGate {
  if (!input.c10Enabled) return 'not_in_criteria';
  if (!input.conditionalOfferAt) return 'locked';
  return input.status === 'conditional_offer' ? 'open' : 'read_only';
}

export type ConvictionsMode = 'not_entered' | 'none' | 'listed';

export interface ConvictionForm {
  type: ConvictionType | null;
  convictedOn: IsoDate | null;
  sentenceEndedOn: IsoDate | null;
}

export interface BackgroundForm {
  mode: ConvictionsMode;
  convictions: ConvictionForm[];
  seriousness: string;
  rehabilitation: string;
  other: string;
}

export type BackgroundField = 'mode' | `convictions.${number}.${keyof ConvictionForm}` | AssessmentField;

export function toBackgroundForm(b: Background | null): BackgroundForm {
  const list = b?.convictions ?? [];
  return {
    mode: !b ? 'not_entered' : b.noConvictions ? 'none' : list.length ? 'listed' : 'not_entered',
    convictions: list.map((c) => ({ type: c.type, convictedOn: c.convictedOn, sentenceEndedOn: c.sentenceEndedOn })),
    seriousness: b?.assessment?.seriousness ?? '',
    rehabilitation: b?.assessment?.rehabilitation ?? '',
    other: b?.assessment?.other ?? '',
  };
}

export function emptyConviction(): ConvictionForm {
  return { type: null, convictedOn: null, sentenceEndedOn: null };
}

export function validateBackgroundForm(f: BackgroundForm, today: IsoDate): FieldError<BackgroundField>[] {
  const e: FieldError<BackgroundField>[] = [];
  if (f.mode !== 'listed') return e;
  if (f.convictions.length === 0) e.push({ field: 'mode', code: 'required' });
  f.convictions.forEach((c, i) => {
    if (!c.type) e.push({ field: `convictions.${i}.type`, code: 'required' });
    if (!c.convictedOn) e.push({ field: `convictions.${i}.convictedOn`, code: 'required' });
    else if (!isIsoDate(c.convictedOn)) e.push({ field: `convictions.${i}.convictedOn`, code: 'date_invalid' });
    else if (c.convictedOn > today) e.push({ field: `convictions.${i}.convictedOn`, code: 'date_future' });
    if (c.sentenceEndedOn) {
      if (!isIsoDate(c.sentenceEndedOn)) e.push({ field: `convictions.${i}.sentenceEndedOn`, code: 'date_invalid' });
      else if (c.sentenceEndedOn > today) e.push({ field: `convictions.${i}.sentenceEndedOn`, code: 'date_future' });
      else if (c.convictedOn && c.sentenceEndedOn < c.convictedOn)
        e.push({ field: `convictions.${i}.sentenceEndedOn`, code: 'sentence_before_conviction' });
    }
  });
  return e;
}

function completeConvictions(f: BackgroundForm): Conviction[] {
  return f.convictions
    .filter((c): c is ConvictionForm & { type: ConvictionType; convictedOn: IsoDate } => !!c.type && isIsoDate(c.convictedOn))
    .map((c) => ({ type: c.type, convictedOn: c.convictedOn, sentenceEndedOn: isIsoDate(c.sentenceEndedOn) ? c.sentenceEndedOn : null }));
}

/** DB patch for `saveBackground`. `reviewedOn` (evidence date) = today whenever the review is entered / changed. */
export function backgroundPatch(f: BackgroundForm, today: IsoDate): Patch<Omit<NewBackground, 'applicantId'>> {
  const assessment: BackgroundAssessment = {
    seriousness: f.seriousness.trim() || null,
    rehabilitation: f.rehabilitation.trim() || null,
    other: f.other.trim() || null,
  };
  const convictions = f.mode === 'listed' ? completeConvictions(f) : [];
  const entered = f.mode === 'none' || convictions.length > 0;
  return {
    noConvictions: f.mode === 'none',
    convictions,
    assessment: f.mode === 'listed' ? assessment : {},
    reviewedOn: entered ? today : null,
  };
}

/** The form as the engine's BackgroundReview (live "Needs review" chips + assessment check before Save). */
export function draftEngineBackground(f: BackgroundForm, today: IsoDate): BackgroundReview {
  return {
    noConvictions: f.mode === 'none',
    convictions: f.mode === 'listed' ? completeConvictions(f) : [],
    reviewedOn: today,
    assessment: { seriousness: f.seriousness || null, rehabilitation: f.rehabilitation || null, other: f.other || null },
  };
}

/** "How long ago was it?" — "6 years, 6 months" since the conviction (calculated, read-only). */
export function howLongAgoText(convictedOn: IsoDate, asOf: IsoDate): string {
  const { years, months } = yearsAndMonthsBetween(convictedOn, asOf);
  const y = t('verify:background.years', { count: years });
  const m = t('verify:background.months', { count: months });
  if (years === 0) return m;
  if (months === 0) return y;
  return `${y}, ${m}`;
}

export interface ConvictionView {
  index: number;
  conviction: Conviction;
  /** Dated inside the lookback counted from the offer date → "Needs review"; older ones are not considered. */
  inLookback: boolean;
  howLongAgo: string;
}

export type OutcomeBlock = 'not_entered' | 'invalid' | 'no_convictions_in_lookback' | 'assessment_required' | 'not_editable';

export interface BackgroundState {
  gate: BackgroundGate;
  lookbackYears: number;
  offerOn: IsoDate | null;
  convictions: ConvictionView[];
  /** Assessment questions still empty (only asked when a conviction is in the lookback). */
  missing: AssessmentField[];
  needsAssessment: boolean;
  /** "Continue with the offer" — allowed once the review is entered. */
  continueBlock: OutcomeBlock | null;
  /** "Withdraw the offer" (→ S-15) — only for a conviction in the lookback, after the individual assessment. */
  withdrawBlock: OutcomeBlock | null;
}

export function backgroundState(
  f: BackgroundForm,
  ctx: { gate: BackgroundGate; lookbackYears: number; conditionalOfferAt: string | null; today: IsoDate },
): BackgroundState {
  const offerOn = ctx.conditionalOfferAt ? dateOf(ctx.conditionalOfferAt) : null;
  const draft = draftEngineBackground(f, ctx.today);
  const inLookback = offerOn ? convictionsInLookback(draft, ctx.lookbackYears, offerOn) : [];
  const convictions = draft.convictions.map((c, index) => ({
    index,
    conviction: c,
    inLookback: inLookback.includes(c),
    howLongAgo: howLongAgoText(c.convictedOn, ctx.today),
  }));
  const missing = offerOn ? missingAssessment(draft, ctx.lookbackYears, offerOn) : [];
  const invalid = validateBackgroundForm(f, ctx.today).length > 0;
  const entered = f.mode === 'none' || (f.mode === 'listed' && draft.convictions.length > 0);
  const base: OutcomeBlock | null = ctx.gate !== 'open' ? 'not_editable' : !entered ? 'not_entered' : invalid ? 'invalid' : null;
  return {
    gate: ctx.gate,
    lookbackYears: ctx.lookbackYears,
    offerOn,
    convictions,
    missing,
    needsAssessment: inLookback.length > 0,
    continueBlock: base,
    withdrawBlock: base ?? (inLookback.length === 0 ? 'no_convictions_in_lookback' : missing.length ? 'assessment_required' : null),
  };
}
