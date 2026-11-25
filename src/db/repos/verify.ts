import { asc, eq } from 'drizzle-orm';

import type { FileStore } from '../files';
import { attempts, background, documents, references, reports } from '../schema';
import type {
  AppDb,
  Attempt,
  Background,
  DocumentRow,
  NewAttempt,
  NewBackground,
  NewDocument,
  NewReference,
  NewReport,
  Patch,
  Reference,
  Report,
} from '../types';

// ---------------- Documents (S-10) ----------------

export function listDocuments(db: AppDb, applicantId: number): DocumentRow[] {
  return db.select().from(documents).where(eq(documents.applicantId, applicantId)).orderBy(asc(documents.addedAt), asc(documents.id)).all();
}

/** The file must already be copied to `applicants/{applicantId}/…` (relative path). */
export function addDocument(db: AppDb, data: NewDocument): number {
  return db.insert(documents).values(data).returning({ id: documents.id }).get().id;
}

export function updateDocument(db: AppDb, id: number, patch: Patch<Omit<NewDocument, 'applicantId'>>): void {
  db.update(documents).set(patch).where(eq(documents.id, id)).run();
}

/** "Mark as checked" (null = unmark). */
export function setDocumentChecked(db: AppDb, id: number, at: string | null = new Date().toISOString()): void {
  db.update(documents).set({ checkedAt: at }).where(eq(documents.id, id)).run();
}

/** Deletes the row and its file. */
export function deleteDocument(db: AppDb, files: FileStore, id: number): void {
  const row = db.select({ filePath: documents.filePath }).from(documents).where(eq(documents.id, id)).get();
  db.delete(documents).where(eq(documents.id, id)).run();
  if (row) files.deleteFile(row.filePath);
}

// ---------------- References (S-11, S-12) ----------------

export function listReferences(db: AppDb, applicantId: number): Reference[] {
  return db.select().from(references).where(eq(references.applicantId, applicantId)).orderBy(asc(references.id)).all();
}

export function getReference(db: AppDb, id: number): Reference | null {
  return db.select().from(references).where(eq(references.id, id)).get() ?? null;
}

export function createReference(db: AppDb, data: NewReference): number {
  return db.insert(references).values(data).returning({ id: references.id }).get().id;
}

export function updateReference(db: AppDb, id: number, patch: Patch<Omit<NewReference, 'applicantId'>>, at = new Date().toISOString()): void {
  db.update(references)
    .set({ ...patch, updatedAt: at })
    .where(eq(references.id, id))
    .run();
}

/** The landlord reference of a residence, created empty the first time S-11 opens for it. */
export function ensureLandlordReference(db: AppDb, applicantId: number, residenceId: number): number {
  const found = db
    .select({ id: references.id, residenceId: references.residenceId })
    .from(references)
    .where(eq(references.applicantId, applicantId))
    .all()
    .find((r) => r.residenceId === residenceId);
  return found ? found.id : createReference(db, { applicantId, kind: 'landlord', residenceId });
}

export function listAttempts(db: AppDb, referenceId: number): Attempt[] {
  return db.select().from(attempts).where(eq(attempts.referenceId, referenceId)).orderBy(asc(attempts.at), asc(attempts.id)).all();
}

export function addAttempt(db: AppDb, data: NewAttempt): number {
  return db.insert(attempts).values(data).returning({ id: attempts.id }).get().id;
}

export function deleteAttempt(db: AppDb, id: number): void {
  db.delete(attempts).where(eq(attempts.id, id)).run();
}

// ---------------- Screening report (S-13) ----------------

export function getReport(db: AppDb, applicantId: number): Report | null {
  return db.select().from(reports).where(eq(reports.applicantId, applicantId)).get() ?? null;
}

/** One report per applicant: creates or updates it. */
export function saveReport(db: AppDb, applicantId: number, data: Patch<Omit<NewReport, 'applicantId'>>, at = new Date().toISOString()): number {
  return db
    .insert(reports)
    .values({ ...data, applicantId, updatedAt: at })
    .onConflictDoUpdate({ target: reports.applicantId, set: { ...data, updatedAt: at } })
    .returning({ id: reports.id })
    .get().id;
}

/** Removes the report and its attached files. */
export function deleteReport(db: AppDb, files: FileStore, applicantId: number): void {
  const r = getReport(db, applicantId);
  db.delete(reports).where(eq(reports.applicantId, applicantId)).run();
  for (const p of r?.filePaths ?? []) files.deleteFile(p);
}

// ---------------- Background review (S-14) ----------------

export function getBackground(db: AppDb, applicantId: number): Background | null {
  return db.select().from(background).where(eq(background.applicantId, applicantId)).get() ?? null;
}

export function saveBackground(db: AppDb, applicantId: number, data: Patch<Omit<NewBackground, 'applicantId'>>, at = new Date().toISOString()): number {
  return db
    .insert(background)
    .values({ ...data, applicantId, updatedAt: at })
    .onConflictDoUpdate({ target: background.applicantId, set: { ...data, updatedAt: at } })
    .returning({ id: background.id })
    .get().id;
}
