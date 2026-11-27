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

/**
 * Form part 3: replaces every residence of the applicant (order kept). Ids of rows still referenced stay stable.
 * Inside a transaction pass `tx` as `db` (nests as a savepoint); the root `db` cannot `begin` twice on expo-sqlite.
 */
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
  return applicant ? listApplicantBundles(db, [applicant])[0] : null;
}

/** Rows grouped by applicant id, keeping the query's order inside each group. */
function byApplicant<T extends { applicantId: number }>(rows: readonly T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const r of rows) {
    const list = m.get(r.applicantId);
    if (list) list.push(r);
    else m.set(r.applicantId, [r]);
  }
  return m;
}

/** SQLite caps bound parameters; rentals stay far below, but chunk anyway. */
const IN_CHUNK = 500;
function chunked<T>(ids: readonly number[], run: (part: number[]) => T[]): T[] {
  if (ids.length <= IN_CHUNK) return ids.length ? run([...ids]) : [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...run(ids.slice(i, i + IN_CHUNK)));
  return out;
}

/**
 * Bundles for many applicants with one query per table (S-17 Compare, S-18, S-19 load a whole rental — B-71: one
 * `getApplicantBundle` per applicant was ~12 queries each). Same rows and order as `getApplicantBundle`.
 */
export function listApplicantBundles(db: AppDb, rows: readonly Applicant[]): ApplicantBundle[] {
  const ids = rows.map((a) => a.id);
  if (!ids.length) return [];
  const res = byApplicant(
    chunked(ids, (part) => db.select().from(residences).where(inArray(residences.applicantId, part)).orderBy(asc(residences.order), asc(residences.id)).all()),
  );
  const inc = byApplicant(
    chunked(ids, (part) => db.select().from(incomes).where(inArray(incomes.applicantId, part)).orderBy(asc(incomes.order), asc(incomes.id)).all()),
  );
  const docs = byApplicant(
    chunked(ids, (part) => db.select().from(documents).where(inArray(documents.applicantId, part)).orderBy(asc(documents.id)).all()),
  );
  const refs = byApplicant(
    chunked(ids, (part) => db.select().from(references).where(inArray(references.applicantId, part)).orderBy(asc(references.id)).all()),
  );
  const refIds = [...refs.values()].flat().map((r) => r.id);
  const atts = chunked(refIds, (part) =>
    db.select().from(attempts).where(inArray(attempts.referenceId, part)).orderBy(asc(attempts.at), asc(attempts.id)).all(),
  );
  const attsByRef = new Map<number, Attempt[]>();
  for (const a of atts) attsByRef.set(a.referenceId, [...(attsByRef.get(a.referenceId) ?? []), a]);
  const reps = byApplicant(chunked(ids, (part) => db.select().from(reports).where(inArray(reports.applicantId, part)).all()));
  const bgs = byApplicant(chunked(ids, (part) => db.select().from(background).where(inArray(background.applicantId, part)).all()));
  const decs = byApplicant(
    chunked(ids, (part) => db.select().from(decisions).where(inArray(decisions.applicantId, part)).orderBy(asc(decisions.at), asc(decisions.id)).all()),
  );
  const decIds = [...decs.values()].flat().map((d) => d.id);
  const lets = chunked(decIds, (part) => db.select().from(letters).where(inArray(letters.decisionId, part)).orderBy(asc(letters.id)).all());
  const tms = byApplicant(
    chunked(ids, (part) => db.select().from(timers).where(inArray(timers.applicantId, part)).orderBy(asc(timers.startedAt)).all()),
  );
  return rows.map((applicant) => {
    const id = applicant.id;
    return {
      applicant,
      residences: res.get(id) ?? [],
      incomes: inc.get(id) ?? [],
      documents: docs.get(id) ?? [],
      references: (refs.get(id) ?? []).map((r) => ({ ...r, attempts: attsByRef.get(r.id) ?? [] })),
      report: reps.get(id)?.[0] ?? null,
      background: bgs.get(id)?.[0] ?? null,
      decisions: (decs.get(id) ?? []).map((d) => ({ ...d, letters: lets.filter((l) => l.decisionId === d.id) })),
      timers: tms.get(id) ?? [],
    };
  });
}

/**
 * Disposal Rule delete (S-09 "Delete applicant", S-24 cleanup): every related row (application, documents,
 * references, report, background, decisions, letters, timers) and every file under `applicants/{id}/` is erased.
 *
 * - default (`keepRecord: true`): the applicant row stays as a tombstone with no personal data — rental, received time,
 *   status and `deletedAt` only — so the Decision file can say "Applicant 3 — data deleted Jan 10" and First-come
 *   order stays provable.
 * - `keepRecord: false`: the row goes too (a mistaken entry, or the sample). A draft always goes (never received).
 */
export function purgeApplicant(db: AppDb, files: FileStore, id: number, opts: { keepRecord?: boolean; at?: string } = {}): void {
  // A draft was never received: no anonymous row for it (it would be counted and listed as "Applicant n" — B-62).
  const keepRecord = (opts.keepRecord ?? true) && getApplicant(db, id)?.draft !== true;
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
