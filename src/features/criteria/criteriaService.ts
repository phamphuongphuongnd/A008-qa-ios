/**
 * Criteria load / save for S-04 and S-05 (F-03): guardrails + lock + history through the engine (`editCriteria`).
 *
 * History rows written by 2A (`criteria_history.before` / `.after`):
 *   - criteria edit while locked: `{ criteria: Criterion[] }` (engine shape, ids = row ids as text, so
 *     `describeCriteriaChanges` matches them);
 *   - Review mode switch with applicants: `{ reviewMode: 'compare' | 'first_come' }` (see units/rentalService).
 * `describeHistoryEntry(row)` turns either into lines for the Decision file (2D).
 */
import {
  describeCriteriaChanges,
  editCriteria,
  type CriteriaError,
  type Criterion,
} from '@/engine';
import { addCriteriaHistory, isCriteriaLocked, listCriteria, listCriteriaHistory, saveCriteria } from '@/db/repos/criteria';
import { getRental, updateRental } from '@/db/repos/rentals';
import { toEngineCriteria } from '@/db/toEngine';
import type { ReviewMode, SmokingPolicy } from '@/db/schema';
import type { AppDb, CriteriaChange, Rental } from '@/db/types';

import { reviewModeLabel } from '../units/format';
import { criteriaToRows } from './criteriaRows';

export interface CriteriaHistoryCriteriaValue {
  criteria: Criterion[];
}

export interface CriteriaForEdit {
  rental: Rental;
  /** Engine shape, display order. */
  criteria: Criterion[];
  locked: boolean;
}

/** S-04 / S-05 data (null = no such rental). */
export function loadCriteria(db: AppDb, rentalId: number): CriteriaForEdit | null {
  const rental = getRental(db, rentalId);
  if (!rental) return null;
  return { rental, criteria: toEngineCriteria(listCriteria(db, rentalId)), locked: isCriteriaLocked(db, rentalId) };
}

export type SaveCriteriaResult =
  | { ok: true; recorded: boolean }
  | { ok: false; reasonRequired: boolean; errors: CriteriaError[]; notFound?: boolean };

/**
 * S-04 Save. Unlocked: free save. Locked: `reason` required; the change (before → after, reason) is recorded when
 * anything changed. Applicants are re-checked automatically (screens evaluate from the database).
 * `smokingPolicy` is a printed policy of the Rental (not a criterion) and never recorded.
 */
export function saveCriteriaDraft(
  db: AppDb,
  rentalId: number,
  draft: readonly Criterion[],
  opts: { reason?: string | null; at?: string; smokingPolicy?: SmokingPolicy } = {},
): SaveCriteriaResult {
  const current = loadCriteria(db, rentalId);
  if (!current) return { ok: false, reasonRequired: false, errors: [], notFound: true };
  const at = opts.at ?? new Date().toISOString();
  const result = editCriteria({
    before: current.criteria,
    after: draft,
    applicantCount: current.locked ? 1 : 0,
    reason: opts.reason,
    at,
  });
  if (!result.ok) return result;
  const history = result.history;
  db.transaction((tx) => {
    const tdb = tx as unknown as AppDb;
    saveCriteria(tdb, rentalId, criteriaToRows(result.criteria));
    if (opts.smokingPolicy && opts.smokingPolicy !== current.rental.smokingPolicy) {
      updateRental(tdb, rentalId, { smokingPolicy: opts.smokingPolicy });
    }
    if (history) {
      const before: CriteriaHistoryCriteriaValue = { criteria: current.criteria };
      const after: CriteriaHistoryCriteriaValue = { criteria: toEngineCriteria(listCriteria(tdb, rentalId)) };
      addCriteriaHistory(tdb, rentalId, { before, after, reason: history.reason, at });
    }
  });
  return { ok: true, recorded: !!history };
}

export interface HistoryLine {
  at: string;
  reason: string;
  /** "Months − 24 → 12"-style lines (engine wording). */
  changes: string[];
}

function isCriteriaValue(v: unknown): v is CriteriaHistoryCriteriaValue {
  return !!v && typeof v === 'object' && Array.isArray((v as CriteriaHistoryCriteriaValue).criteria);
}

function isModeValue(v: unknown): v is { reviewMode: ReviewMode } {
  const m = (v as { reviewMode?: unknown } | null)?.reviewMode;
  return m === 'compare' || m === 'first_come';
}

/** One history row → lines (Decision file, S-04). Unknown shapes give no change lines (reason still shown). */
export function describeHistoryEntry(row: Pick<CriteriaChange, 'at' | 'before' | 'after' | 'reason'>): HistoryLine {
  let changes: string[] = [];
  if (isCriteriaValue(row.before) && isCriteriaValue(row.after)) {
    changes = describeCriteriaChanges(row.before.criteria, row.after.criteria);
  } else if (isModeValue(row.before) && isModeValue(row.after)) {
    changes = [`Review mode: ${reviewModeLabel(row.before.reviewMode)} → ${reviewModeLabel(row.after.reviewMode)}`];
  }
  return { at: row.at, reason: row.reason, changes };
}

/** Rental history, newest first, described. */
export function criteriaHistoryLines(db: AppDb, rentalId: number): HistoryLine[] {
  return listCriteriaHistory(db, rentalId).map(describeHistoryEntry);
}
