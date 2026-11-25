/**
 * Criteria: defaults (§3.2), titles, parameter validation + guardrails (§3.12), lock & history (§3.13).
 */
import { findProhibitedTerms, PROHIBITED_MESSAGE } from './guardrails';
import { formatMultiple } from './money';
import type { Criterion, CriterionCode, DocType, IsoDateTime, PetPolicy, RequiredDocument } from './types';

export const MAX_CUSTOM_CRITERIA = 5;
export const MAX_CUSTOM_TITLE = 80;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  photo_id: 'Photo ID',
  proof_of_income: 'Proof of income',
  bank_statement: 'Bank statement',
  reference_letter: 'Reference letter',
  voucher_letter: 'Voucher / benefits letter',
  other: 'Other',
};

export function requiredDocLabel(doc: RequiredDocument): string {
  return doc.type === 'other' ? (doc.label?.trim() || DOC_TYPE_LABELS.other) : DOC_TYPE_LABELS[doc.type];
}

/** §3.2 template; ids are `${prefix}-c1` … so they stay stable per Rental. */
export function defaultCriteria(prefix = 'crit'): Criterion[] {
  return [
    { id: `${prefix}-c1`, code: 'C1', enabled: true, order: 1, params: { multipleTenths: 30, applyToTenantShare: true } },
    { id: `${prefix}-c2`, code: 'C2', enabled: true, order: 2, params: { months: 12 } },
    { id: `${prefix}-c3`, code: 'C3', enabled: true, order: 3, params: { years: 5 } },
    { id: `${prefix}-c4`, code: 'C4', enabled: true, order: 4, params: {} },
    { id: `${prefix}-c5`, code: 'C5', enabled: true, order: 5, params: {} },
    {
      id: `${prefix}-c6`,
      code: 'C6',
      enabled: true,
      order: 6,
      params: { documents: [{ type: 'photo_id' }, { type: 'proof_of_income' }] },
    },
    { id: `${prefix}-c7`, code: 'C7', enabled: true, order: 7, params: { perBedroom: 2 } },
    { id: `${prefix}-c8`, code: 'C8', enabled: true, order: 8, params: { policy: 'case_by_case', maxPets: 2 } },
    { id: `${prefix}-c9`, code: 'C9', enabled: false, order: 9, params: { minScore: 600 } },
    { id: `${prefix}-c10`, code: 'C10', enabled: false, order: 10, params: { lookbackYears: 7 } },
  ];
}

const PET_POLICY_TEXT: Record<PetPolicy, (max: number) => string> = {
  no_pets: () => 'No pets',
  cats_only: () => 'Cats only',
  cats_and_dogs: (max) => `Cats and dogs (max ${max})`,
  case_by_case: () => 'Pets considered case by case',
};

/** The criterion as written on the app and the published page (§3.2). */
export function criterionTitle(c: Criterion): string {
  switch (c.code) {
    case 'C1':
      return `Income: at least ${formatMultiple(c.params.multipleTenths)}× the rent`;
    case 'C2':
      return `At least ${c.params.months} months of rental or home-ownership history`;
    case 'C3':
      return `No eviction judgment in the past ${c.params.years} years`;
    case 'C4':
      return 'Previous landlord would rent to them again';
    case 'C5':
      return 'No unpaid balance owed to a past landlord';
    case 'C6':
      return 'Required documents provided';
    case 'C7':
      return `Occupancy: up to ${c.params.perBedroom} people per bedroom`;
    case 'C8':
      return `Pet policy: ${PET_POLICY_TEXT[c.params.policy](c.params.maxPets)}`;
    case 'C9':
      return `Credit score of at least ${c.params.minScore}`;
    case 'C10':
      return 'Criminal history review (after a conditional offer)';
    case 'CX':
      return c.params.title.trim();
  }
}

/** Enabled criteria in display order. */
export function activeCriteria(criteria: readonly Criterion[]): Criterion[] {
  return criteria.filter((c) => c.enabled).sort((a, b) => a.order - b.order);
}

export type CriteriaErrorCode = 'out_of_range' | 'prohibited' | 'empty_title' | 'title_too_long' | 'too_many_custom' | 'no_documents';

export interface CriteriaError {
  criterionId: string;
  code: CriteriaErrorCode;
  message: string;
  /** For 'prohibited': the terms found. */
  terms?: string[];
}

function inRange(v: number, min: number, max: number): boolean {
  return Number.isInteger(v) && v >= min && v <= max;
}

/** Parameter ranges (§3.2, S-04) and custom-criterion guardrails (§3.12). [] = valid. */
export function validateCriteria(criteria: readonly Criterion[]): CriteriaError[] {
  const errors: CriteriaError[] = [];
  const range = (c: Criterion, ok: boolean, message: string) => {
    if (!ok) errors.push({ criterionId: c.id, code: 'out_of_range', message });
  };
  let customCount = 0;
  for (const c of criteria) {
    switch (c.code) {
      case 'C1':
        range(c, inRange(c.params.multipleTenths, 20, 40), 'Income multiple must be between 2.0 and 4.0');
        break;
      case 'C2':
        range(c, inRange(c.params.months, 0, 60), 'Months must be between 0 and 60');
        break;
      case 'C3':
        range(c, inRange(c.params.years, 1, 7), 'Years must be between 1 and 7');
        break;
      case 'C6':
        if (c.enabled && c.params.documents.length === 0)
          errors.push({ criterionId: c.id, code: 'no_documents', message: 'Choose at least one document' });
        break;
      case 'C7':
        range(c, inRange(c.params.perBedroom, 1, 12), 'People per bedroom must be between 1 and 12');
        break;
      case 'C8':
        range(c, inRange(c.params.maxPets, 1, 12), 'Max pets must be between 1 and 12');
        break;
      case 'C9':
        range(c, inRange(c.params.minScore, 300, 850), 'Credit score must be between 300 and 850');
        break;
      case 'C10':
        range(c, inRange(c.params.lookbackYears, 1, 10), 'Lookback must be between 1 and 10 years');
        break;
      case 'CX': {
        customCount += 1;
        const err = customTitleError(c.params.title);
        if (err) errors.push({ criterionId: c.id, ...err });
        break;
      }
      default:
        break;
    }
  }
  if (customCount > MAX_CUSTOM_CRITERIA) {
    errors.push({ criterionId: '', code: 'too_many_custom', message: `Up to ${MAX_CUSTOM_CRITERIA} custom criteria` });
  }
  return errors;
}

/** Custom yes/no criterion title check (§3.12, S-04 sheet). null = OK. */
export function customTitleError(
  title: string,
): { code: CriteriaErrorCode; message: string; terms?: string[] } | null {
  const t = title.trim();
  if (!t) return { code: 'empty_title', message: 'Enter the criterion' };
  if (t.length > MAX_CUSTOM_TITLE) return { code: 'title_too_long', message: `Keep it under ${MAX_CUSTOM_TITLE} characters` };
  const terms = findProhibitedTerms(t);
  if (terms.length) return { code: 'prohibited', message: PROHIBITED_MESSAGE, terms };
  return null;
}

// ---------------------------------------------------------------------------
// Lock & history (§3.13)
// ---------------------------------------------------------------------------

/** Criteria lock once the Rental has ≥ 1 Applicant. */
export function isCriteriaLocked(applicantCount: number): boolean {
  return applicantCount > 0;
}

export interface CriteriaHistoryEntry {
  at: IsoDateTime;
  before: Criterion[];
  after: Criterion[];
  reason: string;
  /** Human-readable lines for the Decision file ("Old → New"). */
  changes: string[];
}

/** Lines describing what changed (Decision file). Criteria are matched by id. */
export function describeCriteriaChanges(before: readonly Criterion[], after: readonly Criterion[]): string[] {
  const lines: string[] = [];
  const prev = new Map(before.map((c) => [c.id, c]));
  const next = new Map(after.map((c) => [c.id, c]));
  for (const c of after) {
    const old = prev.get(c.id);
    if (!old) {
      lines.push(`Added: ${criterionTitle(c)}${c.enabled ? '' : ' (off)'}`);
      continue;
    }
    if (old.enabled !== c.enabled) {
      lines.push(`${c.enabled ? 'Turned on' : 'Turned off'}: ${criterionTitle(c)}`);
    }
    if (JSON.stringify(old.params) !== JSON.stringify(c.params)) {
      const a = paramsText(old);
      const b = paramsText(c);
      lines.push(`${a} → ${b}`);
    }
  }
  for (const c of before) if (!next.has(c.id)) lines.push(`Removed: ${criterionTitle(c)}`);
  return lines;
}

function paramsText(c: Criterion): string {
  if (c.code === 'C1') {
    return `${criterionTitle(c)} (voucher share ${c.params.applyToTenantShare ? 'on' : 'off'})`;
  }
  if (c.code === 'C6') return `Required documents: ${c.params.documents.map(requiredDocLabel).join(', ')}`;
  if (c.code === 'C10') return `${criterionTitle(c)}, lookback ${c.params.lookbackYears} years`;
  if (c.code === 'CX') return `${criterionTitle(c)} (${c.params.answeredBy === 'applicant' ? 'applicant answers' : 'landlord checks'})`;
  return criterionTitle(c);
}

export type CriteriaEditResult =
  | { ok: true; criteria: Criterion[]; history: CriteriaHistoryEntry | null }
  | { ok: false; reasonRequired: boolean; errors: CriteriaError[] };

/**
 * Save edited Criteria (§3.13). Unlocked: free edit, no history. Locked: a reason is required and a history entry is
 * returned; the caller re-evaluates every Applicant with `after`.
 */
export function editCriteria(input: {
  before: readonly Criterion[];
  after: readonly Criterion[];
  applicantCount: number;
  reason?: string | null;
  at: IsoDateTime;
}): CriteriaEditResult {
  const errors = validateCriteria(input.after);
  const locked = isCriteriaLocked(input.applicantCount);
  const reason = (input.reason ?? '').trim();
  if (errors.length || (locked && !reason)) {
    return { ok: false, reasonRequired: locked && !reason, errors };
  }
  const after = input.after.map((c) => ({ ...c }));
  if (!locked) return { ok: true, criteria: after, history: null };
  const changes = describeCriteriaChanges(input.before, input.after);
  return {
    ok: true,
    criteria: after,
    history: changes.length
      ? { at: input.at, before: input.before.map((c) => ({ ...c })), after, reason, changes }
      : null,
  };
}

export const CRITERION_CODES: readonly CriterionCode[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'CX'];
