/** C6 Documents (§3.8), C7 Occupancy, C8 Pets (§3.9), custom yes/no criteria. */
import { requiredDocLabel } from '../criteria';
import type { ApplicantInput, CriterionOf, DocumentInput, IsoDate, RentalInput, RequiredDocument } from '../types';
import { makeResult, type RuleResult } from './result';

export const OCCUPANCY_WARNING =
  'Check your local occupancy code before denying — rules vary and families with children are protected.';

function docsFor(req: RequiredDocument, docs: readonly DocumentInput[]): DocumentInput[] {
  return docs.filter(
    (d) =>
      d.type === req.type &&
      (req.type !== 'other' || (d.label ?? '').trim().toLowerCase() === (req.label ?? '').trim().toLowerCase()),
  );
}

export interface DocumentProgress {
  required: number;
  provided: number;
  checked: number;
  missing: string[];
}

/** S-09 "Documents 2/3" + S-10 per-type state. */
export function documentProgress(required: readonly RequiredDocument[], docs: readonly DocumentInput[]): DocumentProgress {
  let provided = 0;
  let checked = 0;
  const missing: string[] = [];
  for (const req of required) {
    const files = docsFor(req, docs);
    if (files.length === 0) missing.push(requiredDocLabel(req));
    else {
      provided += 1;
      if (files.every((f) => f.checkedOn != null)) checked += 1;
    }
  }
  return { required: required.length, provided, checked, missing };
}

export function evaluateDocuments(c: CriterionOf<'C6'>, applicant: ApplicantInput, title: string): RuleResult {
  const p = documentProgress(c.params.documents, applicant.documents);
  if (p.missing.length) {
    return makeResult(c, title, { outcome: 'missing', reason: `Missing: ${p.missing.join(', ')}`, action: 'add_documents' });
  }
  const verified = p.checked === p.required;
  let lastChecked: IsoDate | null = null;
  if (verified) {
    for (const req of c.params.documents)
      for (const d of docsFor(req, applicant.documents))
        if (d.checkedOn && (!lastChecked || d.checkedOn > lastChecked)) lastChecked = d.checkedOn;
  }
  return makeResult(c, title, {
    outcome: 'met',
    evidence: verified ? 'verified' : 'claimed',
    source: 'document',
    verifiedOn: lastChecked,
    reason: verified ? 'All required documents provided and checked' : 'All required documents provided; not all checked yet',
  });
}

/** Studio (0 bedrooms) counts as 1. */
export function occupancyLimit(perBedroom: number, bedrooms: number): number {
  return perBedroom * Math.max(1, bedrooms);
}

export function evaluateOccupancy(
  c: CriterionOf<'C7'>,
  rental: RentalInput,
  applicant: ApplicantInput,
  title: string,
): RuleResult {
  const n = applicant.occupants;
  if (n == null || n < 1) {
    return makeResult(c, title, { outcome: 'missing', reason: 'Number of people not entered', action: 'edit_application' });
  }
  const limit = occupancyLimit(c.params.perBedroom, rental.bedrooms);
  const met = n <= limit;
  return makeResult(c, title, {
    outcome: met ? 'met' : 'not_met',
    evidence: 'claimed',
    source: 'application',
    reason: `${n} ${n === 1 ? 'person' : 'people'}; up to ${limit} for this rental`,
    warning: met ? null : 'occupancy_local_code',
  });
}

export function evaluatePets(c: CriterionOf<'C8'>, applicant: ApplicantInput, title: string): RuleResult {
  const pets = applicant.pets;
  if (pets == null) return makeResult(c, title, { outcome: 'missing', reason: 'Pets question not answered', action: 'edit_application' });
  const count = (k: string) => pets.filter((p) => p.kind === k).reduce((a, p) => a + Math.max(0, p.count), 0);
  const cats = count('cat');
  const dogs = count('dog');
  const other = count('other');
  const total = cats + dogs + other;
  const base = { evidence: 'claimed' as const, source: 'application' as const };
  if (total === 0) return makeResult(c, title, { ...base, outcome: 'met', reason: 'No pets' });
  const list = [
    cats ? `${cats} cat${cats > 1 ? 's' : ''}` : '',
    dogs ? `${dogs} dog${dogs > 1 ? 's' : ''}` : '',
    other ? `${other} other pet${other > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const { policy, maxPets } = c.params;
  let ok: boolean;
  switch (policy) {
    case 'no_pets':
      ok = false;
      break;
    case 'cats_only':
      ok = dogs === 0 && other === 0;
      break;
    case 'cats_and_dogs':
      ok = other === 0 && total <= maxPets;
      break;
    case 'case_by_case':
      return makeResult(c, title, {
        ...base,
        outcome: 'needs_review',
        reason: `${list} — pets are considered case by case`,
        action: 'edit_application',
      });
  }
  return makeResult(c, title, { ...base, outcome: ok ? 'met' : 'not_met', reason: `${list}; policy: ${title.replace(/^Pet policy: /, '')}` });
}

/**
 * Custom yes/no criterion: yes → Met, no → Not met, unanswered → Missing.
 * "Applicant answers" = Claimed (application); "Landlord checks" = Verified (landlord note).
 * (product.md §3.2, Phương chốt 2026-11-25.)
 */
export function evaluateCustom(c: CriterionOf<'CX'>, applicant: ApplicantInput, title: string): RuleResult {
  const byApplicant = c.params.answeredBy === 'applicant';
  const v = byApplicant ? applicant.customAnswers[c.id] : applicant.landlordChecks[c.id];
  if (v == null) {
    return makeResult(c, title, {
      outcome: 'missing',
      reason: byApplicant ? 'Not answered on the application' : 'Not checked yet',
      action: byApplicant ? 'edit_application' : 'landlord_check',
    });
  }
  return makeResult(c, title, {
    outcome: v ? 'met' : 'not_met',
    evidence: byApplicant ? 'claimed' : 'verified',
    source: byApplicant ? 'application' : 'landlord_note',
    reason: v ? 'Yes' : 'No',
  });
}
