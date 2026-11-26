/**
 * Applicant mode flow as plain functions (the screens call these, tests too):
 * S-07 "Hand the phone…" → `enterApplicantMode` · S-08a "Start" → `startApplicantForm` · part 7 "Submit" →
 * `submitInApplicantMode` · S-08b → `useLandlordExit` (./hooks.ts).
 */
import { getSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';

import type { ApplicationForm } from '../form/model';
import { createDraft, submitApplication, type SubmitResult } from '../form/service';
import { checkCanEnter, type EnterCheck, type LocalAuthAdapter } from './auth';
import { canAccessApplicant } from './guard';
import { dispatchApplicantMode, getApplicantMode } from './store';

/** Checks the landlord has a way out (phone lock or app PIN), then turns the mode on for the rental. */
export async function enterApplicantMode(db: AppDb, adapter: LocalAuthAdapter, rentalId: number): Promise<EnterCheck> {
  const check = await checkCanEnter(adapter, { appPinSet: getSettings(db).appPinHash != null });
  if (check.ok) dispatchApplicantMode({ type: 'ENTER', rentalId });
  return check;
}

/** "Start": a fresh draft for the session's rental (never an existing applicant). Returns its id. */
export function startApplicantForm(db: AppDb, now = new Date()): number {
  const s = getApplicantMode();
  if (s.phase !== 'start' || s.rentalId == null) throw new Error('Applicant mode is not at the start screen');
  const id = createDraft(db, { rentalId: s.rentalId, mode: 'applicant', now });
  dispatchApplicantMode({ type: 'START', applicantId: id });
  return id;
}

/** "Submit application": only the session's own draft; moves the machine to "done" on success. */
export function submitInApplicantMode(db: AppDb, applicantId: number, form: ApplicationForm, now = new Date()): SubmitResult {
  const s = getApplicantMode();
  if (!canAccessApplicant(s, applicantId) || s.phase === 'off') throw new Error('Not this session’s applicant');
  const r = submitApplication(db, applicantId, form, { mode: 'applicant', now });
  if (r.ok) {
    if (s.phase !== 'review') dispatchApplicantMode({ type: 'GO', step: 7 });
    dispatchApplicantMode({ type: 'SUBMITTED', receivedAt: r.receivedAt });
  }
  return r;
}
