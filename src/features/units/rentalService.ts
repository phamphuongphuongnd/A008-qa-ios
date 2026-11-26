/**
 * Rental actions (F-02: S-02, S-03, S-06): create (with the §3.2 default criteria), edit, Review mode switch rules,
 * close / reopen, delete, sample rental. Synchronous, database first (tests pass `makeTestDb()`).
 * Imports repositories directly — `@/db` (index) would open the phone database.
 */
import { defaultCriteria } from '@/engine';
import { addCriteriaHistory, isCriteriaLocked, saveCriteria } from '@/db/repos/criteria';
import { listActiveTimers, resolveTimer } from '@/db/repos/decisions';
import { listApplicants } from '@/db/repos/applicants';
import { createRental, deleteRental, getRental, getSampleRental, setRentalStatus, updateRental } from '@/db/repos/rentals';
import { loadSampleRental, removeSampleRental } from '@/db/repos/sample';
import { getSetting } from '@/db/repos/settings';
import type { FileStore } from '@/db/files';
import type { ReviewMode } from '@/db/schema';
import type { AppDb, Timer } from '@/db/types';
import { t } from '@/i18n';

import { reviewModeLabel } from './format';
import { formToRentalValues, validateRental, type RentalErrors, type RentalForm } from './rentalForm';
import { criteriaToRows } from '../criteria/criteriaRows';

export type ModeDirection = 'to_first_come' | 'to_compare';

/** History `before` / `after` of a Review mode switch (criteria edits store `{ criteria: [...] }`). */
export interface ReviewModeHistoryValue {
  reviewMode: ReviewMode;
}

export interface ModeChangePlan {
  from: ReviewMode;
  to: ReviewMode;
  direction: ModeDirection;
  /** Received applicants (the switch needs a confirmation when > 0 and is recorded). */
  applicantCount: number;
  needsConfirm: boolean;
  /** First-come timers that stop when switching to Compare. */
  activeTimerCount: number;
  /** Dialog text (S-03). */
  title: string;
  message: string;
}

/** Received applicants: submitted ones, data-deleted included (they were received — same rule as the criteria lock). */
export function receivedApplicantCount(db: AppDb, rentalId: number): number {
  return listApplicants(db, rentalId, { deleted: true }).length;
}

/** What switching the mode of an existing Rental involves (null = no change / no such rental). */
export function planReviewModeChange(db: AppDb, rentalId: number, to: ReviewMode): ModeChangePlan | null {
  const r = getRental(db, rentalId);
  if (!r || r.reviewMode === to) return null;
  const applicantCount = receivedApplicantCount(db, rentalId);
  const direction: ModeDirection = to === 'first_come' ? 'to_first_come' : 'to_compare';
  const activeTimerCount = direction === 'to_compare' ? listActiveTimers(db, rentalId).length : 0;
  return {
    from: r.reviewMode,
    to,
    direction,
    applicantCount,
    needsConfirm: applicantCount > 0,
    activeTimerCount,
    title: t('units:s03.modeChange.title'),
    message:
      direction === 'to_first_come'
        ? t('units:s03.modeChange.toFirstCome', { count: applicantCount })
        : t('units:s03.modeChange.toCompare', { count: applicantCount }),
  };
}

export type SaveRentalResult =
  | { ok: false; errors: RentalErrors }
  /** The mode switch needs the S-03 confirmation: show `plan`, then save again with `confirmModeChange: true`. */
  | { ok: false; errors: RentalErrors; confirm: ModeChangePlan }
  | {
      ok: true;
      id: number;
      modeChanged: boolean;
      /** Timers resolved because First-come was turned off; `useRentalActions` cancels their notifications (2D). */
      stoppedTimers: Timer[];
      /** First time First-come is on and notifications were never asked: ask now (§6). */
      askNotifications: boolean;
    };

function shouldAskNotifications(db: AppDb, mode: ReviewMode): boolean {
  return mode === 'first_come' && !getSetting(db, 'notificationsAsked');
}

/** S-03 "Next: criteria": the Rental + the §3.2 default criteria, in one transaction. */
export function createRentalFromForm(db: AppDb, form: RentalForm): SaveRentalResult {
  const errors = validateRental(form);
  if (Object.keys(errors).length) return { ok: false, errors };
  const id = db.transaction((tx) => {
    const tdb = tx as unknown as AppDb;
    const newId = createRental(tdb, formToRentalValues(form));
    saveCriteria(tdb, newId, criteriaToRows(defaultCriteria()));
    return newId;
  });
  return { ok: true, id, modeChanged: false, stoppedTimers: [], askNotifications: shouldAskNotifications(db, form.reviewMode) };
}

/**
 * S-03 "Save" on an existing Rental. A Review mode switch with received applicants needs `confirmModeChange`; it is
 * written to the criteria history (printed in the Decision file). Switching to Compare stops running first-come timers.
 */
export function updateRentalFromForm(
  db: AppDb,
  id: number,
  form: RentalForm,
  opts: { confirmModeChange?: boolean; at?: string } = {},
): SaveRentalResult {
  const errors = validateRental(form);
  if (Object.keys(errors).length) return { ok: false, errors };
  const at = opts.at ?? new Date().toISOString();
  const plan = planReviewModeChange(db, id, form.reviewMode);
  if (plan?.needsConfirm && !opts.confirmModeChange) return { ok: false, errors: {}, confirm: plan };
  const stopped = db.transaction((tx) => {
    const tdb = tx as unknown as AppDb;
    updateRental(tdb, id, formToRentalValues(form));
    if (!plan) return [] as Timer[];
    if (plan.applicantCount > 0) {
      const before: ReviewModeHistoryValue = { reviewMode: plan.from };
      const after: ReviewModeHistoryValue = { reviewMode: plan.to };
      addCriteriaHistory(tdb, id, {
        before,
        after,
        at,
        reason: t('units:s03.modeChange.historyReason', { from: reviewModeLabel(plan.from), to: reviewModeLabel(plan.to) }),
      });
    }
    if (plan.direction !== 'to_compare') return [] as Timer[];
    const timers = listActiveTimers(tdb, id);
    for (const tm of timers) resolveTimer(tdb, tm.id, at);
    return timers;
  });
  return {
    ok: true,
    id,
    modeChanged: !!plan,
    stoppedTimers: stopped,
    askNotifications: !!plan && shouldAskNotifications(db, form.reviewMode),
  };
}

/** S-02 swipe "Close" / S-06 menu "Close rental" (snackbar Undo = `reopenRental`). */
export function closeRental(db: AppDb, id: number, at = new Date().toISOString()): void {
  setRentalStatus(db, id, 'closed', at);
}

/** S-02 swipe "Reopen" / Undo of a close. */
export function reopenRental(db: AppDb, id: number): void {
  setRentalStatus(db, id, 'open');
}

/** S-02 "Delete" / S-06 "Delete rental" (after the confirmation): rows + every file. The sample goes the sample way. */
export function deleteRentalAndData(db: AppDb, files: FileStore, id: number): void {
  const r = getRental(db, id);
  if (!r) return;
  if (r.isSample) removeSampleRental(db, files);
  else deleteRental(db, files, id);
}

/** Text of the delete confirmation (S-06). */
export function deleteRentalMessage(db: AppDb, id: number): { title: string; message: string } {
  const r = getRental(db, id);
  const title = t('units:s06.deleteDialog.title');
  if (r?.isSample) return { title, message: t('units:s06.deleteDialog.bodySample') };
  return { title, message: t('units:s06.deleteDialog.body', { count: listApplicants(db, id, { drafts: true }).length }) };
}

/** S-02 "Try a sample rental": the loaded sample, or load it (§8). Returns its id. */
export function openSampleRental(db: AppDb): number {
  return getSampleRental(db)?.id ?? loadSampleRental(db);
}

/** Criteria lock (§3.13) — re-exported for the hub / editor. */
export { isCriteriaLocked };
