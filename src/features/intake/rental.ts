/**
 * What intake needs from a Rental: its address line, the custom questions the applicant answers (CX "applicant
 * answers", shown in form part 5 and on the blank PDF), and the required documents (C6, S-10).
 */
import { activeCriteria, requiredDocLabel, type Criterion, type RequiredDocument } from '@/engine';
import { listCriteria } from '@/db/repos/criteria';
import { getRental } from '@/db/repos/rentals';
import { toEngineCriteria } from '@/db/toEngine';
import type { AppDb, Rental } from '@/db/types';

/** "1428 Maple St, Unit B" (S-08a title). */
export function rentalAddress(r: Pick<Rental, 'street' | 'unit'>): string {
  const unit = (r.unit ?? '').trim();
  if (!unit) return r.street.trim();
  return `${r.street.trim()}, ${/^(unit|apt|apartment|suite|ste|#)\b/i.test(unit) || unit.startsWith('#') ? unit : `Unit ${unit}`}`;
}

/** "1428 Maple St, Unit B, Columbus, OH 43215" (PDF subtitle). */
export function rentalFullAddress(r: Pick<Rental, 'street' | 'unit' | 'city' | 'state' | 'zip'>): string {
  const stateZip = [r.state, r.zip].filter((x) => x && x.trim()).join(' ');
  return [rentalAddress(r), r.city?.trim(), stateZip].filter(Boolean).join(', ');
}

export interface CustomQuestion {
  /** Criterion row id as string (= key of applicants.custom_answers). */
  id: string;
  title: string;
}

export function customQuestions(criteria: readonly Criterion[]): CustomQuestion[] {
  return activeCriteria(criteria).flatMap((c) =>
    c.code === 'CX' && c.params.answeredBy === 'applicant' ? [{ id: c.id, title: c.params.title }] : [],
  );
}

export function requiredDocuments(criteria: readonly Criterion[]): RequiredDocument[] {
  const c6 = activeCriteria(criteria).find((c) => c.code === 'C6');
  return c6 && c6.code === 'C6' ? c6.params.documents : [];
}

export interface IntakeRental {
  rental: Rental;
  criteria: Criterion[];
  address: string;
  fullAddress: string;
  customQuestions: CustomQuestion[];
  requiredDocuments: RequiredDocument[];
  requiredLabels: string[];
}

/** null when the rental does not exist. */
export function loadIntakeRental(db: AppDb, rentalId: number): IntakeRental | null {
  const rental = getRental(db, rentalId);
  if (!rental) return null;
  const criteria = toEngineCriteria(listCriteria(db, rentalId));
  const docs = requiredDocuments(criteria);
  return {
    rental,
    criteria,
    address: rentalAddress(rental),
    fullAddress: rentalFullAddress(rental),
    customQuestions: customQuestions(criteria),
    requiredDocuments: docs,
    requiredLabels: docs.map(requiredDocLabel),
  };
}
