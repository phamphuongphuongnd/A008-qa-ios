/**
 * Screen hooks for 2D (S-09, S-15…S-19). Each is a thin `useLive` wrapper over a pure loader in this folder (tested
 * with `makeTestDb()`), re-running when one of its tables is written. 'use no memo' keeps React Compiler from
 * memoising the query closures (fact react-compiler-use-no-memo).
 */
import { db, useLive, type LiveTable } from '@/db';
import { useClock } from '@/services/clock';

import { loadDecisionContext } from './decision';
import { decisionFileData } from './decisionFile';
import { loadLetterContext } from './letters';
import { loadApplicantReview, loadCompare, loadQueue, loadRentalReview } from './review';
import { localIso } from './time';

/** Everything a rental's review reads. */
export const REVIEW_TABLES: readonly LiveTable[] = [
  'rentals',
  'criteria',
  'applicants',
  'residences',
  'incomes',
  'documents',
  'references',
  'attempts',
  'reports',
  'background',
  'decisions',
  'letters',
  'timers',
];

/**
 * Current time, ticking every `everyMs` and when the app returns to the foreground (First-come clocks: "41 h left",
 * B-59). Local ISO with offset.
 */
export function useNow(everyMs = 60_000): string {
  'use no memo';
  return localIso(useClock(everyMs));
}

/** S-09 Applicant detail: live results, issues, sections, place in line, "Make a decision" gate. */
export function useApplicantReview(applicantId: number | null) {
  'use no memo';
  const now = useNow();
  return useLive(() => (applicantId == null ? null : loadApplicantReview(db, applicantId, now)), [applicantId, now], REVIEW_TABLES);
}

/** S-15 Decision sheet context (options, reason choices, FCRA default). */
export function useDecisionContext(applicantId: number | null) {
  'use no memo';
  const now = useNow();
  return useLive(() => (applicantId == null ? null : loadDecisionContext(db, applicantId, now)), [applicantId, now], REVIEW_TABLES);
}

/** S-16 Letter context. */
export function useLetterContext(applicantId: number | null, decisionId: number | null) {
  'use no memo';
  return useLive(
    () => (applicantId == null ? null : loadLetterContext(db, applicantId, decisionId)),
    [applicantId, decisionId],
    ['rentals', 'criteria', 'applicants', 'residences', 'reports', 'decisions', 'letters', 'settings'],
  );
}

/** S-17 Compare. */
export function useCompare(rentalId: number | null, hideClosed: boolean) {
  'use no memo';
  return useLive(() => (rentalId == null ? null : loadCompare(db, rentalId, { hideClosed })), [rentalId, hideClosed], REVIEW_TABLES);
}

/** S-18 Order queue (clocks tick every minute). */
export function useOrderQueue(rentalId: number | null) {
  'use no memo';
  const now = useNow();
  return useLive(() => (rentalId == null ? null : loadQueue(db, rentalId, now)), [rentalId, now], REVIEW_TABLES);
}

/** S-19 header data (rental + applicant count); the PDF itself is built on Export. */
export function useRentalReview(rentalId: number | null) {
  'use no memo';
  const now = useNow();
  return useLive(() => (rentalId == null ? null : loadRentalReview(db, rentalId, now)), [rentalId, now], REVIEW_TABLES);
}

/** S-19 on-screen Decision file (no thumbnails; the PDF reads those on Export). */
export function useDecisionFileData(rentalId: number | null) {
  'use no memo';
  const now = useNow();
  return useLive(() => (rentalId == null ? null : decisionFileData(db, rentalId, new Date(now))), [rentalId, now], REVIEW_TABLES);
}
