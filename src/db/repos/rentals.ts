import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { applicantDir, rentalDir, type FileStore } from '../files';
import { applicants, rentals, type RentalStatus } from '../schema';
import type { AppDb, NewRental, Patch, Rental } from '../types';

export interface RentalListItem extends Rental {
  /** Submitted applicants, data-deleted ones excluded. */
  applicantCount: number;
}

/**
 * S-02 list: 'open' = Open / Offer out / Leased, 'closed' = Closed. Newest first. Each with its applicant count
 * (the "ready to decide" count needs the engine — computed by the screen).
 */
export function listRentals(db: AppDb, filter: 'open' | 'closed' | 'all' = 'all'): RentalListItem[] {
  const where = filter === 'all' ? undefined : filter === 'closed' ? eq(rentals.status, 'closed') : ne(rentals.status, 'closed');
  return db
    .select({
      rental: rentals,
      applicantCount: sql<number>`(select count(*) from "applicants" a where a."rental_id" = "rentals"."id" and a."deleted_at" is null and a."draft" = 0)`,
    })
    .from(rentals)
    .where(where)
    .orderBy(desc(rentals.createdAt), desc(rentals.id))
    .all()
    .map((r) => ({ ...r.rental, applicantCount: Number(r.applicantCount) }));
}

export function countRentals(db: AppDb): { open: number; closed: number } {
  const rows = db.select({ status: rentals.status, n: sql<number>`count(*)` }).from(rentals).groupBy(rentals.status).all();
  let open = 0;
  let closed = 0;
  for (const r of rows) {
    if (r.status === 'closed') closed += Number(r.n);
    else open += Number(r.n);
  }
  return { open, closed };
}

export function getRental(db: AppDb, id: number): Rental | null {
  return db.select().from(rentals).where(eq(rentals.id, id)).get() ?? null;
}

export function createRental(db: AppDb, data: NewRental): number {
  const row = db.insert(rentals).values(data).returning({ id: rentals.id }).get();
  return row.id;
}

export function updateRental(db: AppDb, id: number, patch: Patch<NewRental>): void {
  db.update(rentals).set(patch).where(eq(rentals.id, id)).run();
}

/** Close (stamps closedAt) / reopen / mark leased or offer out. */
export function setRentalStatus(db: AppDb, id: number, status: RentalStatus, at = new Date().toISOString()): void {
  db.update(rentals)
    .set({ status, closedAt: status === 'closed' ? at : null })
    .where(eq(rentals.id, id))
    .run();
}

/** Delete a rental with all its rows (cascade) and every file of it and of its applicants. */
export function deleteRental(db: AppDb, files: FileStore, id: number): void {
  const ids = db.select({ id: applicants.id }).from(applicants).where(eq(applicants.rentalId, id)).all();
  db.delete(rentals).where(eq(rentals.id, id)).run();
  for (const a of ids) files.deleteDir(applicantDir(a.id));
  files.deleteDir(rentalDir(id));
}

/** The sample rental (§8), if loaded. */
export function getSampleRental(db: AppDb): Rental | null {
  return db.select().from(rentals).where(eq(rentals.isSample, true)).orderBy(asc(rentals.id)).get() ?? null;
}

export interface CleanupItem {
  rental: Rental;
  /** Applicants not selected (not approved) whose data is still here. */
  applicantIds: number[];
}

/**
 * S-24 / reminder: closed rentals (not the sample) still holding data of applicants who were not approved, oldest
 * closed first. `closedBefore` (ISO) keeps only rentals closed before it (the reminder's N days).
 */
export function listCleanupCandidates(db: AppDb, closedBefore?: string): CleanupItem[] {
  const closed = db
    .select()
    .from(rentals)
    .where(and(eq(rentals.status, 'closed'), eq(rentals.isSample, false), closedBefore ? sql`${rentals.closedAt} < ${closedBefore}` : undefined))
    .orderBy(asc(rentals.closedAt))
    .all();
  if (closed.length === 0) return [];
  const rows = db
    .select({ id: applicants.id, rentalId: applicants.rentalId })
    .from(applicants)
    .where(and(inArray(applicants.rentalId, closed.map((r) => r.id)), isNull(applicants.deletedAt), ne(applicants.status, 'approved')))
    .orderBy(asc(applicants.receivedAt))
    .all();
  return closed
    .map((rental) => ({ rental, applicantIds: rows.filter((r) => r.rentalId === rental.id).map((r) => r.id) }))
    .filter((c) => c.applicantIds.length > 0);
}
