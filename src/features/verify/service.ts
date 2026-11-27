/**
 * 2C verify service — what S-11 … S-14 read and do, on top of the 1C repositories (`(db, …)`, synchronous) and the
 * engine. Screens read through the hooks in ./hooks.ts; every write goes through a function here so the rules
 * (validation, evidence date, unreachable rule, step-2 gate) live in one tested place. Never logs applicant data.
 */
import {
  activeCriteria,
  c4Residence,
  type ApplicantInput,
  type ApplicantStatus,
  type AttemptMethod,
  type AttemptResult,
  type LandlordReference,
} from '@/engine';
import { getApplicant, getApplicantBundle, listIncomes, listResidences } from '@/db/repos/applicants';
import { listCriteria } from '@/db/repos/criteria';
import {
  addAttempt,
  createReference,
  deleteAttempt,
  deleteReport,
  ensureLandlordReference,
  getReference,
  getReport,
  listAttempts,
  listReferences,
  saveBackground,
  saveReport,
  updateReference,
} from '@/db/repos/verify';
import { conditionalOfferAt, engineId, toEngineApplicant, toEngineCriteria } from '@/db/toEngine';
import type { AppDb, Attempt, Background, Income, Reference, Report, Residence } from '@/db/types';
import type { FileStore } from '@/db/files';

import { backgroundGate, backgroundPatch, backgroundState, toBackgroundForm, validateBackgroundForm, type BackgroundForm, type BackgroundGate } from './background';
import { localDate, localTimestamp, type FieldError } from './common';
import { employerPatch, toEmployerForm, validateEmployerForm, type EmployerForm } from './employer';
import {
  countyRecordsSearchUrl,
  draftEngineReference,
  landlordEmailDraft,
  landlordPatch,
  redFlagViews,
  toLandlordForm,
  unreachableState,
  validateLandlordForm,
  type LandlordForm,
  type MailDraft,
  type RedFlagView,
} from './landlord';
import { isReportTooOld, missingCompanyFields, reportPatch, toReportForm, validateReportForm, type ReportForm } from './report';

export type SaveResult<F extends string = string> = { ok: true; id: number } | { ok: false; errors: FieldError<F>[] };

interface ApplicantHead {
  id: number;
  rentalId: number;
  fullName: string;
  status: ApplicantStatus;
}

function head(db: AppDb, applicantId: number): ApplicantHead | null {
  const a = getApplicant(db, applicantId);
  if (!a || a.deletedAt) return null;
  return { id: a.id, rentalId: a.rentalId, fullName: a.fullName, status: a.status };
}

function engineCriteriaOf(db: AppDb, rentalId: number) {
  return activeCriteria(toEngineCriteria(listCriteria(db, rentalId)));
}

// ---------------------------------------------------------------------------
// S-11 Landlord reference
// ---------------------------------------------------------------------------

export interface LandlordSheet {
  applicant: ApplicantHead;
  residence: Residence;
  reference: Reference | null;
  attempts: Attempt[];
  /** Initial form state (the screen keeps its own copy while editing). */
  form: LandlordForm;
  /** Engine input for live red flags (`liveRedFlags`). */
  engineApplicant: ApplicantInput;
  redFlags: RedFlagView[];
  unreachable: ReturnType<typeof unreachableState>;
  /** This Residence is the one C4 (would rent again) uses — most recent past rental, else the current one. */
  usedForC4: boolean;
  /** "Call both the current and the previous landlord…" — shown on a current residence, or when there are both. */
  showBothLandlordsTip: boolean;
  countySearchUrl: string;
  email: MailDraft;
}

/** null when the applicant / residence is gone (deleted, purged) — the screen shows its not-found state. */
export function loadLandlordSheet(db: AppDb, applicantId: number, residenceId: number, now = new Date()): LandlordSheet | null {
  const bundle = getApplicantBundle(db, applicantId);
  const residence = bundle?.residences.find((r) => r.id === residenceId);
  if (!bundle || bundle.applicant.deletedAt || !residence) return null;
  const ref = bundle.references.find((r) => r.kind === 'landlord' && r.residenceId === residenceId);
  const { attempts = [], ...row } = ref ?? {};
  const reference: Reference | null = ref ? (row as Reference) : null;
  const engineApplicant = toEngineApplicant(bundle);
  const engineRef = engineApplicant.landlordReferences.find((r) => r.residenceId === engineId(residenceId)) ?? null;
  const form = toLandlordForm(reference, residence);
  const draft = engineRef ?? draftEngineReference(form, { id: 'draft', residenceId: engineId(residenceId), unreachable: false, attempts: [] }, localDate(now));
  const rented = bundle.residences.filter((r) => r.type === 'rent');
  return {
    applicant: { id: bundle.applicant.id, rentalId: bundle.applicant.rentalId, fullName: bundle.applicant.fullName, status: bundle.applicant.status },
    residence,
    reference,
    attempts,
    form,
    engineApplicant,
    redFlags: redFlagViews(engineApplicant, draft),
    unreachable: unreachableState(attempts, ref?.unreachable ?? false),
    usedForC4: c4Residence(engineApplicant)?.id === engineId(residenceId),
    showBothLandlordsTip: residence.current || (rented.some((r) => r.current) && rented.length > 1),
    countySearchUrl: countyRecordsSearchUrl(residence.address),
    email: landlordEmailDraft({
      to: residence.landlordEmail,
      applicantName: bundle.applicant.fullName,
      address: residence.address,
      landlordName: form.contactName || residence.landlordName,
    }),
  };
}

/** Red flags for the form being edited (before Save), from the engine rules. */
export function liveRedFlags(sheet: LandlordSheet, form: LandlordForm, now = new Date()): RedFlagView[] {
  const residenceId = engineId(sheet.residence.id);
  const draft: LandlordReference = draftEngineReference(
    form,
    { id: sheet.reference ? engineId(sheet.reference.id) : 'draft', residenceId, unreachable: sheet.unreachable.unreachable, attempts: [] },
    localDate(now),
  );
  const applicant: ApplicantInput = {
    ...sheet.engineApplicant,
    landlordReferences: [...sheet.engineApplicant.landlordReferences.filter((r) => r.residenceId !== residenceId), draft],
  };
  return redFlagViews(applicant, draft);
}

/** The sheet's reference row, created empty the first time something is saved / logged for this Residence. */
export function ensureLandlordRef(db: AppDb, applicantId: number, residenceId: number): number {
  const r = listResidences(db, applicantId).find((x) => x.id === residenceId);
  if (!r) throw new Error('Residence not found');
  return ensureLandlordReference(db, applicantId, residenceId);
}

export function saveLandlordSheet(db: AppDb, applicantId: number, residenceId: number, form: LandlordForm, now = new Date()): SaveResult<keyof LandlordForm> {
  const errors = validateLandlordForm(form);
  if (errors.length) return { ok: false, errors };
  return db.transaction((tx) => {
    const id = ensureLandlordRef(tx as unknown as AppDb, applicantId, residenceId);
    const prev = getReference(tx as unknown as AppDb, id);
    updateReference(tx as unknown as AppDb, id, landlordPatch(form, prev, localDate(now)), now.toISOString());
    return { ok: true as const, id };
  });
}

// ---------------------------------------------------------------------------
// Attempts (S-11, S-12)
// ---------------------------------------------------------------------------

export interface AttemptInput {
  /** Defaults to now (local ISO with offset). */
  at?: string;
  method: AttemptMethod;
  result: AttemptResult;
}

export function logAttempt(db: AppDb, referenceId: number, input: AttemptInput, now = new Date()): number {
  if (!getReference(db, referenceId)) throw new Error('Reference not found');
  const id = addAttempt(db, { referenceId, at: input.at ?? localTimestamp(now), method: input.method, result: input.result });
  // Reaching someone after "unreachable" undoes it: the reference is no longer unreachable.
  if (input.result === 'reached') updateReference(db, referenceId, { unreachable: false }, now.toISOString());
  return id;
}

/** Deleting an attempt that the unreachable mark relied on clears the mark (engine rule must still hold). */
export function removeAttempt(db: AppDb, attemptId: number, referenceId: number, now = new Date()): void {
  deleteAttempt(db, attemptId);
  const ref = getReference(db, referenceId);
  if (ref?.unreachable && !unreachableState(listAttempts(db, referenceId), false).canMark) {
    updateReference(db, referenceId, { unreachable: false }, now.toISOString());
  }
}

/** "Mark as unreachable": only when the engine rule holds (≥ 3 failed tries by ≥ 2 methods). */
export function markUnreachable(db: AppDb, referenceId: number, now = new Date()): boolean {
  const ref = getReference(db, referenceId);
  if (!ref || !unreachableState(listAttempts(db, referenceId), ref.unreachable).canMark) return false;
  updateReference(db, referenceId, { unreachable: true }, now.toISOString());
  return true;
}

export function clearUnreachable(db: AppDb, referenceId: number, now = new Date()): void {
  updateReference(db, referenceId, { unreachable: false }, now.toISOString());
}

// ---------------------------------------------------------------------------
// S-12 Employer reference
// ---------------------------------------------------------------------------

export interface EmployerSheet {
  applicant: ApplicantHead;
  income: Income;
  reference: Reference | null;
  attempts: Attempt[];
  form: EmployerForm;
  unreachable: ReturnType<typeof unreachableState>;
}

export function loadEmployerSheet(db: AppDb, applicantId: number, incomeId: number): EmployerSheet | null {
  const applicant = head(db, applicantId);
  const income = applicant ? listIncomes(db, applicantId).find((i) => i.id === incomeId) : undefined;
  if (!applicant || !income) return null;
  const reference = listReferences(db, applicantId).find((r) => r.kind === 'employer' && r.incomeId === incomeId) ?? null;
  const attempts = reference ? listAttempts(db, reference.id) : [];
  return { applicant, income, reference, attempts, form: toEmployerForm(reference), unreachable: unreachableState(attempts, reference?.unreachable ?? false) };
}

export function ensureEmployerRef(db: AppDb, applicantId: number, incomeId: number): number {
  if (!listIncomes(db, applicantId).some((i) => i.id === incomeId)) throw new Error('Income not found');
  const found = listReferences(db, applicantId).find((r) => r.kind === 'employer' && r.incomeId === incomeId);
  return found ? found.id : createReference(db, { applicantId, kind: 'employer', incomeId });
}

export function saveEmployerSheet(db: AppDb, applicantId: number, incomeId: number, form: EmployerForm, now = new Date()): SaveResult<keyof EmployerForm> {
  const errors = validateEmployerForm(form, localDate(now).slice(0, 7));
  if (errors.length) return { ok: false, errors };
  return db.transaction((tx) => {
    const t = tx as unknown as AppDb;
    const id = ensureEmployerRef(t, applicantId, incomeId);
    updateReference(t, id, employerPatch(form, getReference(t, id), localDate(now)), now.toISOString());
    return { ok: true as const, id };
  });
}

// ---------------------------------------------------------------------------
// S-13 Screening report
// ---------------------------------------------------------------------------

export interface ReportSheet {
  applicant: ApplicantHead;
  report: Report | null;
  form: ReportForm;
  /** C9 Credit is on for this Rental → the score block is shown and required fields apply. */
  c9Enabled: boolean;
  /** Company fields the FCRA letter still needs. */
  missingCompany: ReturnType<typeof missingCompanyFields>;
  /** Applicant's own report older than 30 days. */
  tooOld: boolean;
  filePaths: string[];
}

export function loadReportSheet(db: AppDb, applicantId: number, now = new Date()): ReportSheet | null {
  const applicant = head(db, applicantId);
  if (!applicant) return null;
  const report = getReport(db, applicantId);
  const form = toReportForm(report);
  return {
    applicant,
    report,
    form,
    c9Enabled: engineCriteriaOf(db, applicant.rentalId).some((c) => c.code === 'C9'),
    missingCompany: missingCompanyFields(form),
    tooOld: form.service === 'applicant_copy' && isReportTooOld(form.reportDate, localDate(now)),
    filePaths: report?.filePaths ?? [],
  };
}

export function saveReportSheet(db: AppDb, applicantId: number, form: ReportForm, now = new Date()): SaveResult {
  const applicant = head(db, applicantId);
  if (!applicant) throw new Error('Applicant not found');
  const c9Enabled = engineCriteriaOf(db, applicant.rentalId).some((c) => c.code === 'C9');
  const errors = validateReportForm(form, { c9Enabled, today: localDate(now) });
  if (errors.length) return { ok: false, errors };
  return { ok: true, id: saveReport(db, applicantId, reportPatch(form, { c9Enabled }), now.toISOString()) };
}

/** A file the user picked (camera / photos / files). */
export interface PickedFile {
  uri: string;
  mime?: string | null;
  name?: string | null;
}

/** The part of `@/files` the report attachments need (injected so Jest uses a fake). */
export interface ReportFileSaver {
  saveAttachment(o: { owner: { applicantId: number }; kind: 'report'; sourceUri: string; mime?: string | null; name?: string | null }): Promise<{ path: string }>;
}

/**
 * "Attach report (PDF or photos)": copies / compresses each file into `applicants/{id}/` and appends it to the report
 * (creating the report row if needed). Files saved before a failure stay attached; the error is rethrown.
 */
export async function attachReportFiles(db: AppDb, files: ReportFileSaver, applicantId: number, picked: readonly PickedFile[], now = new Date()): Promise<string[]> {
  if (!head(db, applicantId)) throw new Error('Applicant not found');
  const added: string[] = [];
  try {
    for (const p of picked) {
      const saved = await files.saveAttachment({ owner: { applicantId }, kind: 'report', sourceUri: p.uri, mime: p.mime, name: p.name });
      added.push(saved.path);
    }
  } finally {
    if (added.length) {
      const current = getReport(db, applicantId)?.filePaths ?? [];
      saveReport(db, applicantId, { filePaths: [...current, ...added] }, now.toISOString());
    }
  }
  return added;
}

export function removeReportFile(db: AppDb, files: FileStore, applicantId: number, path: string, now = new Date()): void {
  const current = getReport(db, applicantId)?.filePaths ?? [];
  if (!current.includes(path)) return;
  saveReport(db, applicantId, { filePaths: current.filter((p) => p !== path) }, now.toISOString());
  files.deleteFile(path);
}

/** Removes the report's results and files (the applicant's Criteria results fall back to the Application). */
export function clearReport(db: AppDb, files: FileStore, applicantId: number): void {
  deleteReport(db, files, applicantId);
}

// ---------------------------------------------------------------------------
// S-14 Background review
// ---------------------------------------------------------------------------

export interface BackgroundSheet {
  applicant: ApplicantHead;
  gate: BackgroundGate;
  lookbackYears: number;
  conditionalOfferAt: string | null;
  background: Background | null;
  form: BackgroundForm;
}

export function loadBackgroundSheet(db: AppDb, applicantId: number): BackgroundSheet | null {
  const bundle = getApplicantBundle(db, applicantId);
  if (!bundle || bundle.applicant.deletedAt) return null;
  const a = bundle.applicant;
  const c10 = engineCriteriaOf(db, a.rentalId).find((c) => c.code === 'C10');
  const offerAt = conditionalOfferAt(bundle.decisions);
  return {
    applicant: { id: a.id, rentalId: a.rentalId, fullName: a.fullName, status: a.status },
    gate: backgroundGate({ c10Enabled: !!c10, conditionalOfferAt: offerAt, status: a.status }),
    lookbackYears: c10 && c10.code === 'C10' ? c10.params.lookbackYears : 0,
    conditionalOfferAt: offerAt,
    background: bundle.background,
    form: toBackgroundForm(bundle.background),
  };
}

export type BackgroundSaveResult =
  | { ok: true; id: number }
  | { ok: false; errors: ReturnType<typeof validateBackgroundForm>; block?: undefined }
  | { ok: false; errors: []; block: NonNullable<ReturnType<typeof backgroundState>['withdrawBlock']> };

/** Save the review (only while the Applicant is in Conditional offer). */
export function saveBackgroundSheet(db: AppDb, applicantId: number, form: BackgroundForm, now = new Date()): BackgroundSaveResult {
  const sheet = loadBackgroundSheet(db, applicantId);
  if (!sheet) throw new Error('Applicant not found');
  if (sheet.gate !== 'open') return { ok: false, errors: [], block: 'not_editable' };
  const errors = validateBackgroundForm(form, localDate(now));
  if (errors.length) return { ok: false, errors };
  return { ok: true, id: saveBackground(db, applicantId, backgroundPatch(form, localDate(now)), now.toISOString()) };
}

/**
 * "Continue with the offer" / "Withdraw the offer". Saves the review + its outcome; it never changes the Applicant's
 * status — withdrawing is a Decision the landlord makes next on S-15 (with reasons, and the FCRA rule if a report
 * played a part). Withdraw needs a conviction in the lookback and the individual assessment answered; with such a
 * conviction, Continue needs the assessment answered too (product.md S-14, B-50).
 */
export function chooseBackgroundOutcome(db: AppDb, applicantId: number, form: BackgroundForm, outcome: 'continue' | 'withdraw', now = new Date()): BackgroundSaveResult {
  const sheet = loadBackgroundSheet(db, applicantId);
  if (!sheet) throw new Error('Applicant not found');
  const today = localDate(now);
  const state = backgroundState(form, { gate: sheet.gate, lookbackYears: sheet.lookbackYears, conditionalOfferAt: sheet.conditionalOfferAt, today });
  const block = outcome === 'continue' ? state.continueBlock : state.withdrawBlock;
  if (block === 'invalid') return { ok: false, errors: validateBackgroundForm(form, today) };
  if (block) return { ok: false, errors: [], block };
  const id = saveBackground(db, applicantId, { ...backgroundPatch(form, today), outcome }, now.toISOString());
  return { ok: true, id };
}

