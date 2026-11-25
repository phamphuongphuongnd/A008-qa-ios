/**
 * Data layer (product.md §7): SQLite via expo-sqlite + Drizzle. Money in integer cents, dates 'YYYY-MM-DD', months
 * 'YYYY-MM', timestamps ISO. Repositories are synchronous and take the database first:
 * `const list = useLive(() => listApplicants(db, rentalId), [rentalId], ['applicants'])` re-renders on writes.
 * Deleting anything with files takes `fileStore` from `@/files`: `purgeApplicant(db, fileStore, id)`.
 * Jest: import the repo files directly with `makeTestDb()` / `makeTestFiles()` (this index opens the real database).
 */
export { db, DB_NAME } from './client';
export { ensureMigrated } from './migrate';
export { applicantDir, rentalDir, type FileStore } from './files';
export { useLive, useTablesVersion, markTablesChanged, type LiveTable } from './useLive';
export * from './types';
export * from './model';
export type {
  ApplicantSource,
  ApplicantStatus,
  AttemptMethod,
  AttemptResult,
  ConfirmSource,
  DecisionKind,
  DocumentType,
  IncomeKind,
  LetterKind,
  NoticeStatus,
  PayFrequency,
  ReferenceKind,
  RentalStatus,
  ResidenceType,
  ReviewMode,
  SentMethod,
  SmokingPolicy,
  TimerKind,
} from './schema';
export * from './repos/rentals';
export * from './repos/criteria';
export * from './repos/applicants';
export * from './repos/verify';
export * from './repos/decisions';
export * from './repos/movein';
export * from './repos/settings';
export * from './repos/data';
export * from './repos/sample';
export * from './toEngine';
