import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { applicantDir, type FileStore } from '../files';
import {
  applicants,
  attempts,
  background,
  decisions,
  documents,
  incomes,
  letters,
  references,
  reports,
  residences,
  timers,
  type ApplicantStatus,
} from '../schema';
import type {
  Applicant,
  AppDb,
  Attempt,
  Background,
  Decision,
  DocumentRow,
  Income,
  Letter,
  NewApplicant,
  NewIncome,
  NewResidence,
  Patch,
  Reference,
  Report,
  Residence,
  Timer,
} from '../types';

/**
 * A rental's applicants in received order (= First-come queue order and Compare column order). Drafts of
 * applicant mode are left out unless `drafts`; data-deleted rows are left out unless `deleted` (Decision file).
 */
export function listApplicants(db: AppDb, rentalId: number, opts: { drafts?: boolean; deleted?: boolean } = {}): Applicant[] {
  return db
    .select()
    .from(applicants)
    .where(
      and(
        eq(applicants.rentalId, rentalId),
        opts.drafts ? undefined : eq(applicants.draft, false),
        opts.deleted ? undefined : isNull(applicants.deletedAt),
      ),
    )
    .orderBy(asc(applicants.receivedAt), asc(applicants.id))
    .all();
}

export function getApplicant(db: AppDb, id: number): Applicant | null {
  return db.select().from(applicants).where(eq(applicants.id, id)).get() ?? null;
}

/** Creates the applicant (receivedAt required: "Received on" of the landlord, or Submit time in applicant mode). */
export function createApplicant(db: AppDb, data: NewApplicant): number {
  return db.insert(applicants).values(data).returning({ id: applicants.id }).get().id;
}

/** Updates fields. `receivedAt` is not editable after the first save (§3.14) — pass it only while the row is a draft. */
export function updateApplicant(db: AppDb, id: number, patch: Patch<Omit<NewApplicant, 'rentalId'>>, at = new Date().toISOString()): void {
  db.update(applicants)
    .set({ ...patch, updatedAt: at })
    .where(eq(applicants.id, id))
    .run();
}

export function setApplicantStatus(db: AppDb, id: number, status: ApplicantStatus): void {
  updateApplicant(db, id, { status });
}

/** Form part 3: replaces every residence of the applicant (order kept). Ids of rows still referenced stay stable. */
export function saveResidences(db: AppDb, applicantId: number, rows: (Omit<NewResidence, 'applicantId'> & { id?: number })[]): number[] {
  return db.transaction((tx) => {
    const existing = tx.select({ id: residences.id }).from(residences).where(eq(residences.applicantId, applicantId)).all();
    const keep = new Set(rows.map((r) => r.id).filter((x): x is number => typeof x === 'number'));
    for (const e of existing) if (!keep.has(e.id)) tx.delete(residences).where(eq(residences.id, e.id)).run();
    return rows.map((r, i) => {
      const { id, ...values } = r;
      const v = { ...values, applicantId, order: i };
      if (id && existing.some((e) => e.id === id)) {
        tx.update(residences).set(v).where(eq(residences.id, id)).run();
        return id;
      }
      return tx.insert(residences).values(v).returning({ id: residences.id }).get().id;
    });
  });
}

export function listResidences(db: AppDb, applicantId: number): Residence[] {
  return db.select().from(residences).where(eq(residences.applicantId, applicantId)).orderBy(asc(residences.order), asc(residences.id)).all();
}

/** Form part 4: replaces every income line of the applicant. */
export function saveIncomes(db: AppDb, applicantId: number, rows: (Omit<NewIncome, 'applicantId'> & { id?: number })[]): number[] {
  return db.transaction((tx) => {
    const existing = tx.select({ id: incomes.id }).from(incomes).where(eq(incomes.applicantId, applicantId)).all();
    const keep = new Set(rows.map((r) => r.id).filter((x): x is number => typeof x === 'number'));
    for (const e of existing) if (!keep.has(e.id)) tx.delete(incomes).where(eq(incomes.id, e.id)).run();
    return rows.map((r, i) => {
      const { id, ...values } = r;
      const v = { ...values, applicantId, order: i };
      if (id && existing.some((e) => e.id === id)) {
        tx.update(incomes).set(v).where(eq(incomes.id, id)).run();
        return id;
      }
      return tx.insert(incomes).values(v).returning({ id: incomes.id }).get().id;
    });
  });
}

export function listIncomes(db: AppDb, applicantId: number): Income[] {
  return db.select().from(incomes).where(eq(incomes.applicantId, applicantId)).orderBy(asc(incomes.order), asc(incomes.id)).all();
}

/** Everything known about one applicant — the input the engine maps into a Criterion-result list. */
export interface ApplicantBundle {
  applicant: Applicant;
  residences: Residence[];
  incomes: Income[];
  documents: DocumentRow[];
  references: (Reference & { attempts: Attempt[] })[];
  report: Report | null;
  background: Background | null;
  decisions: (Decision & { letters: Letter[] })[];
  timers: Timer[];
}

/**
 * One applicant with every related row (S-09, S-15, S-17 columns, Decision file).
 * Engine input: `toEngineApplicant(bundle)` (../toEngine.ts).
 */
export function getApplicantBundle(db: AppDb, id: number): ApplicantBundle | null {
  const applicant = getApplicant(db, id);
  if (!applicant) return null;
  const refs = db.select().from(references).where(eq(references.applicantId, id)).orderBy(asc(references.id)).all();
  const atts = refs.length
    ? db.select().from(attempts).where(inArray(attempts.referenceId, refs.map((r) => r.id))).orderBy(asc(attempts.at), asc(attempts.id)).all()
    : [];
  const decs = db.select().from(decisions).where(eq(decisions.applicantId, id)).orderBy(asc(decisions.at), asc(decisions.id)).all();
  const lets = decs.length ? db.select().from(letters).where(inArray(letters.decisionId, decs.map((d) => d.id))).orderBy(asc(letters.id)).all() : [];
  return {
    applicant,
    residences: listResidences(db, id),
    incomes: listIncomes(db, id),
    documents: db.select().from(documents).where(eq(documents.applicantId, id)).orderBy(asc(documents.id)).all(),
    references: refs.map((r) => ({ ...r, attempts: atts.filter((a) => a.referenceId === r.id) })),
    report: db.select().from(reports).where(eq(reports.applicantId, id)).get() ?? null,
    background: db.select().from(background).where(eq(background.applicantId, id)).get() ?? null,
    decisions: decs.map((d) => ({ ...d, letters: lets.filter((l) => l.decisionId === d.id) })),
    timers: db.select().from(timers).where(eq(timers.applicantId, id)).orderBy(asc(timers.startedAt)).all(),
  };
}

/**
 * Disposal Rule delete (S-09 "Delete applicant", S-24 cleanup): every related row (application, documents,
 * references, report, background, decisions, letters, timers) and every file under `applicants/{id}/` is erased.
 *
 * - default (`keepRecord: true`): the applicant row stays as a tombstone with no personal data — rental, received time,
 *   status and `deletedAt` only — so the Decision file can say "Applicant 3 — data deleted Jan 10" and First-come
 *   order stays provable.
 * - `keepRecord: false`: the row goes too (a draft / a mistaken entry, or the sample).
 */
export function purgeApplicant(db: AppDb, files: FileStore, id: number, opts: { keepRecord?: boolean; at?: string } = {}): void {
  const keepRecord = opts.keepRecord ?? true;
  const at = opts.at ?? new Date().toISOString();
  db.transaction((tx) => {
    // Children first (explicit, not relying on cascade, so a keepRecord tombstone loses them too).
    const refIds = tx.select({ id: references.id }).from(references).where(eq(references.applicantId, id)).all().map((r) => r.id);
    if (refIds.length) tx.delete(attempts).where(inArray(attempts.referenceId, refIds)).run();
    tx.delete(references).where(eq(references.applicantId, id)).run();
    const decIds = tx.select({ id: decisions.id }).from(decisions).where(eq(decisions.applicantId, id)).all().map((d) => d.id);
    if (decIds.length) tx.delete(letters).where(inArray(letters.decisionId, decIds)).run();
    tx.delete(decisions).where(eq(decisions.applicantId, id)).run();
    tx.delete(timers).where(eq(timers.applicantId, id)).run();
    tx.delete(background).where(eq(background.applicantId, id)).run();
    tx.delete(reports).where(eq(reports.applicantId, id)).run();
    tx.delete(documents).where(eq(documents.applicantId, id)).run();
    tx.delete(incomes).where(eq(incomes.applicantId, id)).run();
    tx.delete(residences).where(eq(residences.applicantId, id)).run();
    if (keepRecord) {
      tx.update(applicants)
        .set({
          fullName: '',
          phone: null,
          email: null,
          emergency: null,
          occupants: null,
          otherAdults: null,
          pets: null,
          moveInOn: null,
          hasVoucher: null,
          voucherCents: null,
          voucherProgram: null,
          answers: null,
          customAnswers: null,
          landlordChecks: null,
          consent: null,
          signaturePath: null,
          signedName: null,
          signedAt: null,
          deletedAt: at,
          updatedAt: at,
        })
        .where(eq(applicants.id, id))
        .run();
    } else {
      tx.delete(applicants).where(eq(applicants.id, id)).run();
    }
  });
  files.deleteDir(applicantDir(id));
}

/** S-24 "Delete their data": several applicants at once (each as `purgeApplicant` with a tombstone). */
export function purgeApplicants(db: AppDb, files: FileStore, ids: number[], at = new Date().toISOString()): void {
  for (const id of ids) purgeApplicant(db, files, id, { at });
}
