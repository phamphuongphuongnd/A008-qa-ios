import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Both drivers are synchronous: expo-sqlite on the phone, better-sqlite3 in Jest. Repositories take this type so the
 * same code runs in both (pattern from A006 / A007).
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Rental = typeof schema.rentals.$inferSelect;
export type NewRental = typeof schema.rentals.$inferInsert;
export type Criterion = typeof schema.criteria.$inferSelect;
export type NewCriterion = typeof schema.criteria.$inferInsert;
export type CriteriaChange = typeof schema.criteriaHistory.$inferSelect;
export type Applicant = typeof schema.applicants.$inferSelect;
export type NewApplicant = typeof schema.applicants.$inferInsert;
export type Residence = typeof schema.residences.$inferSelect;
export type NewResidence = typeof schema.residences.$inferInsert;
export type Income = typeof schema.incomes.$inferSelect;
export type NewIncome = typeof schema.incomes.$inferInsert;
export type DocumentRow = typeof schema.documents.$inferSelect;
export type NewDocument = typeof schema.documents.$inferInsert;
export type Reference = typeof schema.references.$inferSelect;
export type NewReference = typeof schema.references.$inferInsert;
export type Attempt = typeof schema.attempts.$inferSelect;
export type NewAttempt = typeof schema.attempts.$inferInsert;
export type Report = typeof schema.reports.$inferSelect;
export type NewReport = typeof schema.reports.$inferInsert;
export type Background = typeof schema.background.$inferSelect;
export type NewBackground = typeof schema.background.$inferInsert;
export type Decision = typeof schema.decisions.$inferSelect;
export type NewDecision = typeof schema.decisions.$inferInsert;
export type Letter = typeof schema.letters.$inferSelect;
export type NewLetter = typeof schema.letters.$inferInsert;
export type Timer = typeof schema.timers.$inferSelect;
export type NewTimer = typeof schema.timers.$inferInsert;
export type MoveIn = typeof schema.movein.$inferSelect;
export type NewMoveIn = typeof schema.movein.$inferInsert;

/** Fields a caller may change on an existing row (never the id / owner). */
export type Patch<T> = Partial<Omit<T, 'id'>>;
