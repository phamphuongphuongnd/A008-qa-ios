/**
 * Read models for S-02 Rentals and S-06 Rental hub (synchronous; the hooks wrap them in `useLive`).
 */
import { listPendingNotices } from '@/db/repos/decisions';
import { isCriteriaLocked } from '@/db/repos/criteria';
import { getRental, listCleanupCandidates, listRentals } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import { loadRentalForEngine } from '@/db/toEngine';
import type { ReviewMode } from '@/db/schema';
import type { AppDb, Rental } from '@/db/types';
import type { LiveTable } from '@/db/useLive';

import {
  addressLine,
  cityLine,
  rentalCardLine,
  rentalHubLine,
  rentalStatusLabel,
  reviewModeChip,
  reviewModeLabel,
} from './format';
import {
  hubApplicantRows,
  moveInApplicantId,
  summarizeRental,
  type DisplayStatus,
  type HubApplicantRow,
  type RentalCardSummary,
} from './rentalSummary';

/** Every table the counts / "ready to decide" depend on. */
export const RENTAL_LIVE_TABLES: readonly LiveTable[] = [
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
  'timers',
];

export interface RentalCard {
  id: number;
  /** "1428 Maple St, Unit B". */
  address: string;
  /** "Columbus, OH 43215". */
  city: string;
  /** "$1,650/mo · 2 bd". */
  line: string;
  reviewMode: ReviewMode;
  /** "Compare" / "First-come". */
  modeLabel: string;
  status: DisplayStatus;
  statusLabel: string;
  summary: RentalCardSummary;
  isSample: boolean;
}

function card(db: AppDb, r: Rental): RentalCard {
  const data = loadRentalForEngine(db, r.id);
  const summary = summarizeRental({
    stored: r.status,
    rental: data!.rental,
    criteria: data!.criteria,
    applicants: data!.applicants,
  });
  return {
    id: r.id,
    address: addressLine(r),
    city: cityLine(r),
    line: rentalCardLine(r),
    reviewMode: r.reviewMode,
    modeLabel: reviewModeLabel(r.reviewMode),
    status: summary.status,
    statusLabel: rentalStatusLabel(summary.status),
    summary,
    isSample: r.isSample,
  };
}

/** S-02 cards for a filter segment (newest first). */
export function loadRentalCards(db: AppDb, filter: 'open' | 'closed'): RentalCard[] {
  return listRentals(db, filter).map((r) => card(db, r));
}

export interface RentalsReminders {
  /** Days since the last backup (null = never backed up); the whole card is null when not due. */
  backup: { days: number | null } | null;
  /** Closed rentals (not the sample) still holding data of applicants not approved, past the cleanup delay. */
  cleanupCount: number;
}

export const BACKUP_REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * S-02 top cards. Backup: on, there is real data (a non-sample rental), and the last backup is older than 30 days
 * (or none). Cleanup: on and N days (Settings) after closing. "Later" is kept by the screen for the session.
 * TODO(merge 2A): 2E owns reminder rules (S-21/S-22/S-24); align if 2E exposes a shared function.
 */
export function loadRentalsReminders(db: AppDb, now: Date = new Date()): RentalsReminders {
  const s = getSettings(db);
  let backup: RentalsReminders['backup'] = null;
  const hasRealData = listRentals(db, 'all').some((r) => !r.isSample);
  if (s.reminders.backup && hasRealData) {
    if (!s.lastBackupAt) backup = { days: null };
    else {
      const days = Math.floor((now.getTime() - new Date(s.lastBackupAt).getTime()) / DAY_MS);
      if (days > BACKUP_REMINDER_DAYS) backup = { days };
    }
  }
  let cleanupCount = 0;
  if (s.reminders.cleanup && s.cleanupAfterDays !== null) {
    const before = new Date(now.getTime() - s.cleanupAfterDays * DAY_MS).toISOString();
    cleanupCount = listCleanupCandidates(db, before).length;
  }
  return { backup, cleanupCount };
}

export interface RentalHub {
  rental: Rental;
  address: string;
  city: string;
  /** "$1,650/mo · 2 bd · Available Jan 1". */
  line: string;
  reviewMode: ReviewMode;
  /** "Compare mode" / "First-come mode". */
  modeChip: string;
  status: DisplayStatus;
  statusLabel: string;
  /** Received order; First-come rows carry "#n". */
  applicants: HubApplicantRow[];
  /** For "Compare applicants · 4" / "Order queue · 4". */
  applicantCount: number;
  /** "Move-in checklist" card when someone is Approved. */
  moveInApplicantId: number | null;
  /** Decisions still waiting for their FCRA notice. */
  pendingNoticeCount: number;
  criteriaLocked: boolean;
}

/** S-06 (null = the rental was deleted). */
export function loadRentalHub(db: AppDb, rentalId: number): RentalHub | null {
  const rental = getRental(db, rentalId);
  const data = rental ? loadRentalForEngine(db, rentalId) : null;
  if (!rental || !data) return null;
  const summary = summarizeRental({ stored: rental.status, rental: data.rental, criteria: data.criteria, applicants: data.applicants });
  return {
    rental,
    address: addressLine(rental),
    city: cityLine(rental),
    line: rentalHubLine(rental),
    reviewMode: rental.reviewMode,
    modeChip: reviewModeChip(rental.reviewMode),
    status: summary.status,
    statusLabel: rentalStatusLabel(summary.status),
    applicants: hubApplicantRows(data.rental, data.criteria, data.applicants),
    applicantCount: data.applicants.length,
    moveInApplicantId: moveInApplicantId(data.applicants),
    pendingNoticeCount: listPendingNotices(db, rentalId).length,
    criteriaLocked: isCriteriaLocked(db, rentalId),
  };
}
