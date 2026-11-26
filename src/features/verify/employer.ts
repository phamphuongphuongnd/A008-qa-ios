/**
 * S-12 Employer reference — pure form logic. Not used by C1–C10 (income is verified with pay stubs, S-10); the sheet
 * records the call with its date so the Decision file shows what was checked. product.md §5 S-12.
 */
import type { YearMonth } from '@/engine';
import type { ReferenceAnswers } from '@/db/model';
import type { NewReference, Patch, Reference } from '@/db/types';

import { isMonth, type FieldError } from './common';

export type Employed = NonNullable<ReferenceAnswers['employed']>;
export const EMPLOYED: readonly Employed[] = ['yes', 'no', 'wont_confirm'];

export interface EmployerForm {
  /** Main number the landlord found themself (company website / directory), HR or payroll contact. */
  contactName: string;
  contactPhone: string;
  employed: Employed | null;
  since: YearMonth | null;
  title: string;
  notes: string;
}

export type EmployerField = keyof EmployerForm;

export function toEmployerForm(ref: Reference | null): EmployerForm {
  const a = ref?.answers ?? {};
  return {
    contactName: ref?.contactName ?? '',
    contactPhone: ref?.contactPhone ?? '',
    employed: a.employed ?? null,
    since: a.since ?? null,
    title: a.title ?? '',
    notes: ref?.notes ?? '',
  };
}

export function validateEmployerForm(f: EmployerForm, thisMonth: YearMonth): FieldError<EmployerField>[] {
  const errors: FieldError<EmployerField>[] = [];
  if (f.since && !isMonth(f.since)) errors.push({ field: 'since', code: 'month_invalid' });
  else if (isMonth(f.since) && f.since > thisMonth) errors.push({ field: 'since', code: 'date_future' });
  return errors;
}

/** DB patch; `answeredOn` = date of the call (changes when the answers change, product.md §3.1 source + date). */
export function employerPatch(f: EmployerForm, previous: Reference | null, today: string): Patch<Omit<NewReference, 'applicantId'>> {
  const answers = {
    employed: f.employed,
    since: f.employed === 'no' ? null : isMonth(f.since) ? f.since : null,
    title: f.employed === 'no' ? null : f.title.trim() || null,
  };
  const prev = previous?.answers ?? {};
  const any = Object.values(answers).some((v) => v != null);
  const same = prev.employed === answers.employed && (prev.since ?? null) === answers.since && (prev.title ?? null) === answers.title;
  return {
    contactName: f.contactName.trim() || null,
    contactPhone: f.contactPhone.trim() || null,
    answers: { ...answers, answeredOn: !any ? null : same && prev.answeredOn ? prev.answeredOn : today },
    notes: f.notes.trim() || null,
  };
}
