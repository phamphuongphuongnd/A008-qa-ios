/**
 * Read models for S-02 Rentals and S-06 Rental hub (synchronous; the hooks wrap them in `useLive`).
 */
import { listApplicants } from '@/db/repos/applicants';
import { listPendingNotices } from '@/db/repos/decisions';
import { isCriteriaLocked } from '@/db/repos/criteria';
import { getRental, listRentals } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import { loadRentalForEngine } from '@/db/toEngine';
import type { ReviewMode } from '@/db/schema';
import type { AppDb, Rental } from '@/db/types';
import type { LiveTable } from '@/db/useLive';
import { cleanupRows } from '@/features/settings/dataCleanup';

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

/** Received (not draft) applicants whose data was deleted — only the anonymous record is left (B-62). */
function deletedApplicantCount(db: AppDb, rentalId: number): number {
  return listApplicants(db, rentalId, { deleted: true }).filter((a) => a.deletedAt).length;
}

function card(db: AppDb, r: Rental): RentalCard {
  const data = loadRentalForEngine(db, r.id);
  const summary = summarizeRental({
    stored: r.status,
    rental: data!.rental,
    criteria: data!.criteria,
    applicants: data!.applicants,
    deletedCount: deletedApplicantCount(db, r.id),
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

/**
 * S-02 card "2 closed rentals still hold applicant data": same rows and "due" rule as 2E's S-24 list and reminder
 * (`cleanupRows`), off when the cleanup reminder is off. The backup card is 2E's `useBackupReminder()`.
 */
export function loadCleanupReminderCount(db: AppDb, now: Date = new Date()): number {
  const s = getSettings(db);
  if (!s.reminders.cleanup) return 0;
  return cleanupRows(db, s.cleanupAfterDays, now).filter((r) => r.due).length;
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
  /** Received applicants whose data was deleted (anonymous records, S-24) — B-62. */
  deletedCount: number;
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
  const deletedCount = deletedApplicantCount(db, rentalId);
  const summary = summarizeRental({ stored: rental.status, rental: data.rental, criteria: data.criteria, applicants: data.applicants, deletedCount });
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
    deletedCount,
    moveInApplicantId: moveInApplicantId(data.applicants),
    pendingNoticeCount: listPendingNotices(db, rentalId).length,
    criteriaLocked: isCriteriaLocked(db, rentalId),
  };
}
