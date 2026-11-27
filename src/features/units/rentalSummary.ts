/**
 * S-02 card counts + S-06 applicant rows (pure, on engine inputs). Uses the engine for "Ready to decide" — no score,
 * no ranking: rows are in received order only.
 */
import {
  byReceived,
  evaluateApplicant,
  FINAL_STATUSES,
  type ApplicantInput,
  type ApplicantStatus,
  type Criterion,
  type RentalInput,
} from '@/engine';
import type { RentalStatus } from '@/db/schema';
import { t } from '@/i18n';

/** The chip on S-02 / S-06: Open · Offer out · Leased · Closed. */
export type DisplayStatus = RentalStatus;

/** Waiting for the landlord's decision (counted by "N ready to decide"). */
const AWAITING: ReadonlySet<ApplicantStatus> = new Set(['new', 'in_review']);

/**
 * Chip status. The DB keeps 'open' / 'closed' (2A writes only those); Offer out / Leased follow the applicants'
 * decisions so they never go stale: any Approved → Leased, else any Conditional offer → Offer out. A stored
 * 'offer_out' / 'leased' (set elsewhere) is kept as a floor.
 */
export function deriveRentalStatus(stored: RentalStatus, statuses: readonly ApplicantStatus[]): DisplayStatus {
  if (stored === 'closed') return 'closed';
  if (stored === 'leased' || statuses.includes('approved')) return 'leased';
  if (stored === 'offer_out' || statuses.includes('conditional_offer')) return 'offer_out';
  return 'open';
}

export interface RentalCardSummary {
  applicantCount: number;
  readyCount: number;
  status: DisplayStatus;
  /** "4 applicants" / "No applicants yet". */
  countText: string;
  /** "2 ready to decide" / "decision made" / null (shown after " · ", emphasised). */
  detailText: string | null;
  /** Both joined, for accessibility labels. */
  fullText: string;
}

export function summarizeRental(input: {
  stored: RentalStatus;
  rental: RentalInput;
  criteria: readonly Criterion[];
  applicants: readonly ApplicantInput[];
}): RentalCardSummary {
  const { applicants } = input;
  const status = deriveRentalStatus(input.stored, applicants.map((a) => a.status));
  const readyCount = applicants.filter(
    (a) => AWAITING.has(a.status) && evaluateApplicant(input.rental, input.criteria, a).summary.ready,
  ).length;
  if (applicants.length === 0) {
    const none = t('units:s02.count.none');
    return { applicantCount: 0, readyCount: 0, status, countText: none, detailText: null, fullText: none };
  }
  const countText = t('units:s02.count.applicants', { count: applicants.length });
  const detailText =
    status === 'leased'
      ? t('units:s02.count.decisionMade')
      : readyCount > 0
        ? t('units:s02.count.ready', { count: readyCount })
        : null;
  return {
    applicantCount: applicants.length,
    readyCount,
    status,
    countText,
    detailText,
    fullText: detailText ? `${countText} · ${detailText}` : countText,
  };
}

export interface HubApplicantRow {
  /** Row id. */
  id: number;
  fullName: string;
  /** "JE" for the avatar. */
  initials: string;
  receivedAt: string;
  status: ApplicantStatus;
  ready: boolean;
  missingCount: number;
  /** "Ready to decide" / "3 items missing" (engine text). */
  summaryText: string;
  /** First-come: 1-based place in received order; Compare: null. */
  queueNumber: number | null;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** S-06 list: received order (the only order — never a ranking). */
export function hubApplicantRows(
  rental: RentalInput,
  criteria: readonly Criterion[],
  applicants: readonly ApplicantInput[],
): HubApplicantRow[] {
  const firstCome = rental.reviewMode === 'first_come';
  // §3.14: in First-come the first applicant without a final result is In review — the same rule as the S-18 queue
  // (engine buildQueue), not only once S-18 has been opened (B-65: hub "New" vs queue "In review").
  const front = firstCome ? byReceived(applicants).find((a) => !FINAL_STATUSES.has(a.status)) : undefined;
  return byReceived(applicants).map((a, i) => {
    const { summary } = evaluateApplicant(rental, criteria, a);
    return {
      id: Number(a.id),
      fullName: a.fullName,
      initials: initials(a.fullName),
      receivedAt: a.receivedAt,
      status: a === front && a.status === 'new' ? 'in_review' : a.status,
      ready: summary.ready,
      missingCount: summary.missingCount,
      summaryText: summary.text,
      queueNumber: firstCome ? i + 1 : null,
    };
  });
}

/** Approved applicant for the "Move-in checklist" card (first approved by received order), or null. */
export function moveInApplicantId(applicants: readonly ApplicantInput[]): number | null {
  const a = byReceived(applicants).find((x) => x.status === 'approved');
  return a ? Number(a.id) : null;
}
