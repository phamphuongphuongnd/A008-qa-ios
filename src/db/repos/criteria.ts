import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { applicants, criteria, criteriaHistory } from '../schema';
import type { AppDb, CriteriaChange, Criterion, NewCriterion, Patch } from '../types';

/** A rental's criteria in display order (C1…C10 then custom). */
export function listCriteria(db: AppDb, rentalId: number): Criterion[] {
  return db.select().from(criteria).where(eq(criteria.rentalId, rentalId)).orderBy(asc(criteria.order), asc(criteria.id)).all();
}

export type CriterionInput = Omit<NewCriterion, 'id' | 'rentalId'>;

/**
 * Writes the whole set for a rental (new rental: the template from the engine; editor Save): rows are matched by
 * `code` — updated, added, and codes no longer in `items` removed. One transaction.
 * TODO(merge 1B): the default set (§3.2) comes from the engine — S-04 passes it here for a new rental.
 */
export function saveCriteria(db: AppDb, rentalId: number, items: CriterionInput[]): void {
  db.transaction((tx) => {
    const existing = tx.select().from(criteria).where(eq(criteria.rentalId, rentalId)).all();
    const keep = new Set(items.map((i) => i.code));
    for (const row of existing) if (!keep.has(row.code)) tx.delete(criteria).where(eq(criteria.id, row.id)).run();
    items.forEach((item, i) => {
      const values = { ...item, rentalId, order: item.order ?? i };
      const found = existing.find((r) => r.code === item.code);
      if (found) tx.update(criteria).set(values).where(eq(criteria.id, found.id)).run();
      else tx.insert(criteria).values(values).run();
    });
  });
}

export function updateCriterion(db: AppDb, id: number, patch: Patch<Omit<NewCriterion, 'rentalId' | 'code'>>): void {
  db.update(criteria).set(patch).where(eq(criteria.id, id)).run();
}

/** §3.13: criteria are locked once the rental has an applicant (drafts and data-deleted ones count too: they were received). */
export function isCriteriaLocked(db: AppDb, rentalId: number): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(applicants)
    .where(and(eq(applicants.rentalId, rentalId), eq(applicants.draft, false)))
    .get();
  return Number(row?.n ?? 0) > 0;
}

/**
 * Locked edit (S-04 "Edit criteria" sheet): saves the new set and the history line (before → after, reason) together.
 */
export function saveCriteriaWithReason(db: AppDb, rentalId: number, items: CriterionInput[], reason: string, at = new Date().toISOString()): void {
  db.transaction((tx) => {
    const before = listCriteria(tx as unknown as AppDb, rentalId).map(stripIds);
    saveCriteria(tx as unknown as AppDb, rentalId, items);
    const after = listCriteria(tx as unknown as AppDb, rentalId).map(stripIds);
    tx.insert(criteriaHistory).values({ rentalId, at, before, after, reason }).run();
  });
}

/** Any other recorded change (review mode switched with applicants, S-03). */
export function addCriteriaHistory(db: AppDb, rentalId: number, entry: { before: unknown; after: unknown; reason: string; at?: string }): void {
  db.insert(criteriaHistory)
    .values({ rentalId, at: entry.at ?? new Date().toISOString(), before: entry.before, after: entry.after, reason: entry.reason })
    .run();
}

export function listCriteriaHistory(db: AppDb, rentalId: number): CriteriaChange[] {
  return db.select().from(criteriaHistory).where(eq(criteriaHistory.rentalId, rentalId)).orderBy(desc(criteriaHistory.at), desc(criteriaHistory.id)).all();
}

function stripIds(c: Criterion) {
  const { id: _id, rentalId: _r, ...rest } = c;
  return rest;
}
