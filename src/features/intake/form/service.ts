/**
 * Application service (F-04, F-05): draft → autosave → submit with a locked received time.
 * All functions take the database (and the file store where files are written) so Jest runs them on better-sqlite3.
 * Deep imports (not '@/db') keep expo-sqlite out of tests.
 *
 * - Every new application starts as a DRAFT row (`draft = 1`): not in lists, not in the First-come queue.
 * - "Save applicant" (landlord) / "Submit application" (applicant mode) clears `draft` and fixes `receivedAt`:
 *   landlord → the "Received on" chosen at creation (default now, not in the future); applicant → the Submit instant.
 *   After that `receivedAt` never changes (§3.14).
 * - Source: applicant mode → 'applicant_mode'; landlord with paper-form photos → 'paper'; else 'landlord'.
 */
import { createApplicant, getApplicant, listIncomes, listResidences, purgeApplicant, saveIncomes, saveResidences, updateApplicant } from '@/db/repos/applicants';
import { listDocuments } from '@/db/repos/verify';
import type { FileStore } from '@/db/files';
import type { Applicant, AppDb } from '@/db/types';
import type { AppFiles } from '@/files/files';

import { signatureSvg, validateSignature, type SignatureError, type SignatureInput } from '../signature';
import { localIso } from '../time';
import { applicantPatch, formFromRows, incomeRows, residenceRows, withSavedIds } from './mapping';
import { clampSection, type ApplicationForm, type FormMode, type FormSection } from './model';
import { validateForm, type FieldError } from './validate';

/** File operations the signature needs (the real `files`, or a fake in tests). */
export type SignatureFiles = Pick<AppFiles, 'saveText' | 'deleteFile'>;

export function createDraft(db: AppDb, opts: { rentalId: number; mode: FormMode; now?: Date }): number {
  return createApplicant(db, {
    rentalId: opts.rentalId,
    receivedAt: localIso(opts.now ?? new Date()),
    fullName: '',
    draft: true,
    source: opts.mode === 'applicant' ? 'applicant_mode' : 'landlord',
    formStep: 1,
  });
}

export interface LoadedApplication {
  applicant: Applicant;
  form: ApplicationForm;
  /** Part to reopen (where the draft was left, or 1). */
  step: FormSection;
  /** "Received on" can still be edited (only while the row is a draft — §3.14). */
  receivedEditable: boolean;
}

/** null when missing or data-deleted. */
export function loadApplication(db: AppDb, applicantId: number): LoadedApplication | null {
  const a = getApplicant(db, applicantId);
  if (!a || a.deletedAt) return null;
  return {
    applicant: a,
    form: formFromRows(a, listResidences(db, applicantId), listIncomes(db, applicantId)),
    step: clampSection(a.formStep),
    receivedEditable: a.draft,
  };
}

/**
 * Autosave ("Draft saved"): writes every part + the furthest step reached. `receivedAt` only while a draft.
 * Returns the form with DB ids on new residence / income rows.
 */
export function saveDraft(db: AppDb, applicantId: number, form: ApplicationForm, step: FormSection, now = new Date()): ApplicationForm {
  return db.transaction(() => {
    const a = getApplicant(db, applicantId);
    if (!a || a.deletedAt) throw new Error('Applicant not found');
    updateApplicant(
      db,
      applicantId,
      {
        ...applicantPatch(form),
        formStep: Math.max(a.draft ? a.formStep : 1, step),
        ...(a.draft ? { receivedAt: form.receivedAt } : {}),
      },
      localIso(now),
    );
    const rIds = saveResidences(db, applicantId, residenceRows(form));
    const iIds = saveIncomes(db, applicantId, incomeRows(form));
    return withSavedIds(form, rIds, iIds);
  });
}

export type SubmitResult =
  | { ok: true; receivedAt: string; form: ApplicationForm }
  | { ok: false; errors: FieldError[]; section: FormSection };

/** "Save applicant" / "Submit application". Validates the whole form first. */
export function submitApplication(db: AppDb, applicantId: number, form: ApplicationForm, opts: { mode: FormMode; now?: Date }): SubmitResult {
  const now = opts.now ?? new Date();
  const a = getApplicant(db, applicantId);
  if (!a || a.deletedAt) throw new Error('Applicant not found');
  const check = validateForm(form, { mode: opts.mode, now });
  const errors = [...check.errors];
  // In applicant mode the signature must be saved (a file), not only drawn.
  if (opts.mode === 'applicant' && !form.signaturePath && !errors.some((e) => e.field === 'signature'))
    errors.push({ field: 'signature', code: 'signatureRequired' });
  if (errors.length) return { ok: false, errors, section: check.firstInvalid ?? 6 };

  const receivedAt = !a.draft ? a.receivedAt : opts.mode === 'applicant' ? localIso(now) : form.receivedAt;
  const saved = db.transaction(() => {
    const f = saveDraft(db, applicantId, { ...form, receivedAt, petsAnswered: true }, 7, now);
    if (a.draft) {
      const paper = listDocuments(db, applicantId).some((d) => d.type === 'paper_form');
      updateApplicant(
        db,
        applicantId,
        {
          draft: false,
          receivedAt,
          status: 'new',
          source: opts.mode === 'applicant' ? 'applicant_mode' : paper ? 'paper' : 'landlord',
        },
        localIso(now),
      );
    }
    return f;
  });
  return { ok: true, receivedAt, form: { ...saved, receivedAt } };
}

/** Cancel a new application (landlord "Discard", or the landlord exits applicant mode and deletes the draft). */
export function discardDraft(db: AppDb, files: FileStore, applicantId: number): boolean {
  const a = getApplicant(db, applicantId);
  if (!a || !a.draft) return false;
  purgeApplicant(db, files, applicantId, { keepRecord: false });
  return true;
}

export type SignatureResult = { ok: true; path: string; signedAt: string } | { ok: false; error: SignatureError };

/** Part 6: validate, write `signature-{id}.svg`, record path + name + time. */
export async function saveSignature(
  db: AppDb,
  files: SignatureFiles,
  applicantId: number,
  input: SignatureInput,
  signedName: string,
  now = new Date(),
): Promise<SignatureResult> {
  const error = validateSignature(input);
  if (error) return { ok: false, error };
  const saved = await files.saveText({ owner: { applicantId }, kind: 'signature', text: signatureSvg(input), ext: 'svg', id: applicantId });
  const signedAt = localIso(now);
  updateApplicant(db, applicantId, { signaturePath: saved.path, signedAt, signedName: signedName.trim() || null }, signedAt);
  return { ok: true, path: saved.path, signedAt };
}

/** "Clear" on a saved signature. */
export function clearSignature(db: AppDb, files: SignatureFiles, applicantId: number): void {
  const a = getApplicant(db, applicantId);
  if (a?.signaturePath) files.deleteFile(a.signaturePath);
  updateApplicant(db, applicantId, { signaturePath: null, signedAt: null });
}
