/**
 * S-24 Data cleanup (F-17, FTC Disposal Rule) and S-27 Delete all data.
 * Deleting goes through 1C (`purgeApplicants` keeps an anonymous row for the Decision file, `deleteAllData` wipes
 * rows + files); here: the list, the confirm text, and cancelling the applicants' scheduled timer notifications first.
 */
import { inArray } from 'drizzle-orm';

import { purgeApplicants } from '@/db/repos/applicants';
import { deleteAllData } from '@/db/repos/data';
import { listCleanupCandidates } from '@/db/repos/rentals';
import { timers } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { FileStore } from '@/db/files';
import { t } from '@/i18n';
import type { NotificationAdapter } from '@/notifications/adapter';

import { daysSince, relativeDays } from './summary';

export interface CleanupRow {
  rentalId: number;
  /** "310 Oak Ct" (+ unit). */
  address: string;
  applicantIds: number[];
  closedAt: string | null;
  daysClosed: number;
  /** Past the S-24 "Remind me" period (also what the reminder counts). */
  due: boolean;
  /** "3 applicants not selected · closed 45 days ago". */
  label: string;
}

/** Every closed (non-sample) rental still holding data of applicants who were not approved; oldest first. */
export function cleanupRows(db: AppDb, cleanupAfterDays: number | null, now: Date = new Date()): CleanupRow[] {
  return listCleanupCandidates(db).map(({ rental, applicantIds }) => {
    const days = rental.closedAt ? daysSince(rental.closedAt, now) : 0;
    return {
      rentalId: rental.id,
      address: [rental.street, rental.unit].filter(Boolean).join(', '),
      applicantIds,
      closedAt: rental.closedAt,
      daysClosed: days,
      due: cleanupAfterDays != null && days >= cleanupAfterDays,
      label: t('system:s24.item', {
        applicants: t('system:s24.applicants', { count: applicantIds.length }),
        days: relativeDays(days).toLowerCase(),
      }),
    };
  });
}

/** Confirm title "Permanently delete data for 3 applicants?". */
export const cleanupConfirmTitle = (count: number) => t('system:s24.confirmTitle', { count });

async function cancelTimerNotifications(db: AppDb, applicantIds: number[], notifications?: NotificationAdapter): Promise<void> {
  if (!notifications || applicantIds.length === 0) return;
  const rows = db.select({ ids: timers.notificationIds }).from(timers).where(inArray(timers.applicantId, applicantIds)).all();
  for (const id of rows.flatMap((r) => r.ids ?? [])) {
    try {
      await notifications.cancel(id);
    } catch {
      // Already shown or gone.
    }
  }
}

/**
 * "Delete their data" for one rental's row: every listed applicant is purged (rows + files + letters/PDFs under
 * applicants/{id}); the Decision file keeps "Applicant 3 — data deleted Jan 10". Returns how many were deleted.
 */
export async function deleteNotSelected(
  db: AppDb,
  files: FileStore,
  rentalId: number,
  opts: { notifications?: NotificationAdapter; at?: string } = {},
): Promise<number> {
  const row = listCleanupCandidates(db).find((c) => c.rental.id === rentalId);
  if (!row) return 0;
  await cancelTimerNotifications(db, row.applicantIds, opts.notifications);
  purgeApplicants(db, files, row.applicantIds, opts.at);
  return row.applicantIds.length;
}

// ---------------------------------------------------------------------------
// S-27 Delete all data
// ---------------------------------------------------------------------------

/** The button stays disabled until the landlord types DELETE (exact word, capitals; spaces around ignored). */
export function isDeleteConfirmed(text: string): boolean {
  return text.trim() === t('system:s27.word');
}

/**
 * Every row (settings and the backup password too), every file, every scheduled notification. The caller then
 * resets the lock store and replaces the stack with S-01.
 */
export async function deleteEverything(db: AppDb, files: FileStore, notifications?: NotificationAdapter): Promise<void> {
  if (notifications) {
    try {
      await notifications.cancelAll();
    } catch {
      // Nothing scheduled.
    }
  }
  deleteAllData(db, files);
}
