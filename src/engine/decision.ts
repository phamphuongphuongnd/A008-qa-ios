/**
 * Decisions (S-15) and when an FCRA Adverse action notice is required (§3.15), plus the data a Letter needs (S-16).
 */
import { findProhibitedTerms, PROHIBITED_MESSAGE } from './guardrails';
import { missingAssessment } from './rules/background';
import { dateOf, HOUR_MS, instantMs } from './dates';
import type {
  ApplicantStatus,
  BackgroundReview,
  Cents,
  CriterionCode,
  CriterionResult,
  EvidenceSource,
  IsoDateTime,
  ReviewMode,
  ScreeningReport,
} from './types';

export type DecisionKind = 'conditional_offer' | 'approve' | 'approve_with_conditions' | 'deny' | 'withdraw_offer';

export type ConditionKind = 'higher_deposit' | 'cosigner' | 'higher_rent';

export interface DecisionCondition {
  kind: ConditionKind;
  /** New deposit / rent (higher_deposit, higher_rent). */
  amountCents?: Cents | null;
}

/** A ticked criterion in "Reasons"; `source` comes from its Criterion result. */
export interface DecisionReason {
  criterionId: string;
  code: CriterionCode;
  source: EvidenceSource | null;
}

export interface DecisionInput {
  kind: DecisionKind;
  conditions: DecisionCondition[];
  reasons: DecisionReason[];
  /** "Explain in your words". */
  note: string;
  /** "Information from a screening report played a part in this decision". */
  reportInfluenced: boolean;
}

/** Decisions that can be adverse actions (§3.15). */
export const ADVERSE_KINDS: ReadonlySet<DecisionKind> = new Set(['deny', 'approve_with_conditions', 'withdraw_offer']);

/** Criteria the landlord may tick as reasons: Not met / Needs review results. */
export function reasonOptions(results: readonly CriterionResult[]): DecisionReason[] {
  return results
    .filter((r) => r.outcome === 'not_met' || r.outcome === 'needs_review')
    .map((r) => ({ criterionId: r.criterionId, code: r.code, source: r.source }));
}

/** The FCRA box is pre-ticked when the Applicant has a report entered (§3.15). */
export function defaultReportInfluenced(report: ScreeningReport | null): boolean {
  return report != null;
}

export type LetterKind = 'adverse_action' | 'denial' | 'conditional_offer' | 'approval';

export type CompanyField = 'name' | 'address' | 'phone';

export interface NoticeRequirement {
  letter: LetterKind;
  /** An Adverse action notice (FCRA) is required; the Decision stays "Notice pending" until it is exported. */
  adverseAction: boolean;
  /** A reason uses C9 → the letter includes the score block. */
  includeScore: boolean;
  /** Report company fields still blank (letter can't be exported; button goes to S-13). */
  missingCompanyFields: CompanyField[];
  canExport: boolean;
}

export function noticeRequirement(decision: DecisionInput, report: ScreeningReport | null): NoticeRequirement {
  const adverse =
    ADVERSE_KINDS.has(decision.kind) &&
    (decision.reasons.some((r) => r.source === 'screening_report') || decision.reportInfluenced);
  let letter: LetterKind;
  if (adverse) letter = 'adverse_action';
  else if (decision.kind === 'conditional_offer') letter = 'conditional_offer';
  else if (decision.kind === 'approve' || decision.kind === 'approve_with_conditions') letter = 'approval';
  else letter = 'denial';
  const missingCompanyFields: CompanyField[] = [];
  if (adverse) {
    if (!report?.companyName?.trim()) missingCompanyFields.push('name');
    if (!report?.companyAddress?.trim()) missingCompanyFields.push('address');
    if (!report?.companyPhone?.trim()) missingCompanyFields.push('phone');
  }
  return {
    letter,
    adverseAction: adverse,
    includeScore: adverse && decision.reasons.some((r) => r.code === 'C9'),
    missingCompanyFields,
    canExport: missingCompanyFields.length === 0,
  };
}

export type DecisionErrorCode =
  | 'reasons_required'
  | 'conditions_required'
  | 'prohibited_terms'
  | 'conditional_offer_requires_c10'
  | 'withdraw_requires_offer'
  | 'assessment_required'
  | 'not_your_turn';

export interface DecisionCheck {
  errors: { code: DecisionErrorCode; message: string; terms?: string[] }[];
  /** "Some information is missing. In first-come mode, give the applicant 72 hours first." */
  warnings: string[];
}

export const MISSING_INFO_WARNING = 'Some information is missing. In first-come mode, give the applicant 72 hours first.';

/** S-15 checks before "Save decision". */
export function validateDecision(input: {
  decision: DecisionInput;
  status: ApplicantStatus;
  c10Enabled: boolean;
  c10LookbackYears?: number;
  background?: BackgroundReview | null;
  conditionalOfferAt?: IsoDateTime | null;
  missingCount: number;
  /** From `decisionGate` (First-come). */
  gate?: { allowed: boolean; message?: string };
}): DecisionCheck {
  const d = input.decision;
  const errors: DecisionCheck['errors'] = [];
  if (input.gate && !input.gate.allowed) {
    errors.push({ code: 'not_your_turn', message: input.gate.message ?? 'Not this applicant’s turn yet' });
  }
  if (d.kind === 'conditional_offer' && !input.c10Enabled) {
    errors.push({ code: 'conditional_offer_requires_c10', message: 'Conditional offer is used only with a criminal history review' });
  }
  if (d.kind === 'withdraw_offer') {
    if (input.status !== 'conditional_offer' || !input.conditionalOfferAt) {
      errors.push({ code: 'withdraw_requires_offer', message: 'Only a conditional offer can be withdrawn' });
    } else {
      const missing = missingAssessment(
        input.background ?? null,
        input.c10LookbackYears ?? 7,
        dateOf(input.conditionalOfferAt),
      );
      if (missing.length) {
        errors.push({ code: 'assessment_required', message: 'Answer the individual assessment questions first' });
      }
    }
  }
  if (ADVERSE_KINDS.has(d.kind) && d.reasons.length === 0 && !d.note.trim()) {
    errors.push({ code: 'reasons_required', message: 'Choose at least one reason' });
  }
  if (d.kind === 'approve_with_conditions' && d.conditions.length === 0) {
    errors.push({ code: 'conditions_required', message: 'Choose at least one condition' });
  }
  const terms = findProhibitedTerms(d.note);
  if (terms.length) errors.push({ code: 'prohibited_terms', message: PROHIBITED_MESSAGE, terms });
  const warnings = d.kind === 'deny' && input.missingCount > 0 ? [MISSING_INFO_WARNING] : [];
  return { errors, warnings };
}

/** Fixed FCRA paragraph lines the landlord cannot delete (S-16). */
export const FCRA_REQUIRED_LINES = [
  'The company did not make this decision and cannot tell you why it was made.',
  'You have the right to get a free copy of your report from the company if you ask within 60 days.',
  'You have the right to dispute the accuracy or completeness of any information in the report with the company.',
] as const;

export interface ScoreBlock {
  score: number | null;
  noScore: boolean;
  range: string | null;
  date: string | null;
  model: string | null;
  keyFactors: string[];
}

export interface LetterData {
  letter: LetterKind;
  company: { name: string; address: string; phone: string } | null;
  scoreBlock: ScoreBlock | null;
  fcraLines: readonly string[];
  /** First-come offers: reply by (decided + 48 h), UTC ISO. */
  respondBy: IsoDateTime | null;
}

/** Structured fields for S-16 (the PDF layer adds names, addresses and wording). */
export function letterData(input: {
  decision: DecisionInput;
  report: ScreeningReport | null;
  reviewMode: ReviewMode;
  decidedAt: IsoDateTime;
}): LetterData {
  const req = noticeRequirement(input.decision, input.report);
  const r = input.report;
  const offer = input.decision.kind === 'conditional_offer' || input.decision.kind === 'approve' || input.decision.kind === 'approve_with_conditions';
  return {
    letter: req.letter,
    company:
      req.adverseAction && r && req.canExport
        ? { name: r.companyName as string, address: r.companyAddress as string, phone: r.companyPhone as string }
        : null,
    scoreBlock:
      req.includeScore && r
        ? {
            score: r.score,
            noScore: r.noScore,
            range: r.scoreRange,
            date: r.scoreDate,
            model: r.scoreModel,
            keyFactors: r.keyFactors.slice(0, 4),
          }
        : null,
    fcraLines: req.adverseAction ? FCRA_REQUIRED_LINES : [],
    respondBy:
      input.reviewMode === 'first_come' && offer ? new Date(instantMs(input.decidedAt) + 48 * HOUR_MS).toISOString() : null,
  };
}
