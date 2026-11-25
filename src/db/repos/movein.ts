import { desc, eq } from 'drizzle-orm';

import { movein } from '../schema';
import type { AppDb, MoveIn, NewMoveIn, Patch } from '../types';

/** The rental's move-in checklist (latest), or null. */
export function getMoveIn(db: AppDb, rentalId: number): MoveIn | null {
  return db.select().from(movein).where(eq(movein.rentalId, rentalId)).orderBy(desc(movein.id)).get() ?? null;
}

export function createMoveIn(db: AppDb, data: NewMoveIn): number {
  return db.insert(movein).values(data).returning({ id: movein.id }).get().id;
}

/** Autosave of the checklist ("can be done in parts and continued"). */
export function updateMoveIn(db: AppDb, id: number, patch: Patch<Omit<NewMoveIn, 'rentalId'>>, at = new Date().toISOString()): void {
  db.update(movein)
    .set({ ...patch, updatedAt: at })
    .where(eq(movein.id, id))
    .run();
}
