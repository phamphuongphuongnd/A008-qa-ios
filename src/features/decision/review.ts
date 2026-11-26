/**
 * Live review data (F-11, F-12): S-09 Applicant detail, S-17 Compare, S-18 Order queue.
 * Pure loaders over the repositories (`(db, …)`), so the hooks in ./hooks.ts are thin `useLive` wrappers and Jest
 * tests these with `makeTestDb()`. All rules come from the engine — no total score, no ranking (Compare columns and
 * the queue follow received order).
 */
import {
  activeCriteria,
  buildQueue,
  c4Residence,
  compareApplicants,
  decisionGate,
  documentProgress,
  evaluateApplicant,
  FINAL_STATUSES,
  type ApplicantEvaluation,
  type ApplicantInput,
  type CompareTable,
  type Criterion,
  type CriterionResult,
  type Issue,
  type IssueAction,
  type Queue,
  type QueueEntry,
  type RentalInput,
} from '@/engine';
import { getApplicantBundle, listApplicants, type ApplicantBundle } from '@/db/repos/applicants';
import { getRental } from '@/db/repos/rentals';
import { loadRentalForEngine, toEngineApplicant, toQueueApplicant } from '@/db/toEngine';
import type { AppDb, Decision, Letter, Rental } from '@/db/types';
import { verifyProgress } from '@/features/verify/progress';
import { routes } from '@/routes';

// ---------------------------------------------------------------------------
// Rental helpers
// ---------------------------------------------------------------------------

/** "1428 Maple St, Unit B" and "1428 Maple St, Unit B, Columbus, OH 43215". */
export function rentalAddress(r: Pick<Rental, 'street' | 'unit' | 'city' | 'state' | 'zip'>): { short: string; full: string } {
  const unit = r.unit?.trim() ? (/^(unit|apt|apartment|suite|ste|#)/i.test(r.unit.trim()) ? r.unit.trim() : `Unit ${r.unit.trim()}`) : '';
  const short = [r.street.trim(), unit].filter(Boolean).join(', ');
  const stateZip = [r.state?.trim(), r.zip?.trim()].filter(Boolean).join(' ');
  return { short, full: [short, r.city?.trim(), stateZip].filter(Boolean).join(', ') };
}

/** The Applicant's mailing address for letters: the current residence, else the latest one. */
export function applicantAddress(b: Pick<ApplicantBundle, 'residences'>): string | null {
  const cur = b.residences.find((r) => r.current) ?? b.residences.slice().sort((x, y) => (y.toMonth ?? '').localeCompare(x.toMonth ?? ''))[0];
  return cur?.address?.trim() || null;
}

// ---------------------------------------------------------------------------
// Rental-wide evaluation (one pass, reused by S-09 / S-17 / S-18 / S-19)
// ---------------------------------------------------------------------------

export interface RentalReview {
  rentalRow: Rental;
  rental: RentalInput;
  criteria: Criterion[];
  applicants: ApplicantInput[];
  bundles: ApplicantBundle[];
  evaluations: ApplicantEvaluation[];
  /** First-come only. */
  queue: Queue | null;
}

export function loadRentalReview(db: AppDb, rentalId: number, now: string): RentalReview | null {
  const rentalRow = getRental(db, rentalId);
  const loaded = rentalRow ? loadRentalForEngine(db, rentalId) : null;
  if (!rentalRow || !loaded) return null;
  const evaluations = loaded.applicants.map((a) => evaluateApplicant(loaded.rental, loaded.criteria, a));
  const queue =
    loaded.rental.reviewMode === 'first_come'
      ? buildQueue(
          loaded.bundles.map((b, i) => toQueueApplicant(b, evaluations[i].summary.missingCount)),
          now,
        )
      : null;
  return { rentalRow, ...loaded, evaluations, queue };
}

// ---------------------------------------------------------------------------
// S-09 Applicant detail
// ---------------------------------------------------------------------------

export type SectionKey = 'application' | 'documents' | 'references' | 'report' | 'background' | 'decision';

export interface ReviewSection {
  key: SectionKey;
  /** "2/3", "—", "Locked", "Deny" … (display string, English like the engine). */
  status: string;
  /** Section needs attention (missing parts). */
  incomplete: boolean;
  href: string | null;
}

export type DecideBlock = 'not_your_turn' | 'closed' | 'data_deleted' | null;

export interface ApplicantReview {
  rentalRow: Rental;
  rental: RentalInput;
  criteria: Criterion[];
  bundle: ApplicantBundle;
  applicant: ApplicantInput;
  evaluation: ApplicantEvaluation;
  /** First-come: the whole queue + this applicant's place in line and clock. */
  queue: Queue | null;
  queueEntry: QueueEntry | null;
  sections: ReviewSection[];
  latestDecision: (Decision & { letters: Letter[] }) | null;
  /** A Decision is waiting for its FCRA notice (S-15 "Notice pending"). */
  noticePending: boolean;
  /** "Make a decision": enabled unless blocked; `message` explains a block under the button. */
  decide: { allowed: boolean; block: DecideBlock; message: string | null };
}

const DECISION_LABELS: Record<Decision['kind'], string> = {
  conditional_offer: 'Conditional offer',
  approve: 'Approved',
  approve_with_conditions: 'Approved with conditions',
  deny: 'Denied',
  withdraw_offer: 'Offer withdrawn',
};

export function decisionLabel(kind: Decision['kind']): string {
  return DECISION_LABELS[kind];
}

export function reviewSections(
  b: ApplicantBundle,
  applicant: ApplicantInput,
  criteria: readonly Criterion[],
): ReviewSection[] {
  const id = b.applicant.id;
  const c6 = activeCriteria(criteria).find((c) => c.code === 'C6');
  const docs = c6 && c6.code === 'C6' ? documentProgress(c6.params.documents, applicant.documents) : null;
  const vp = verifyProgress(b);
  const refs = vp.references;
  const c10 = activeCriteria(criteria).some((c) => c.code === 'C10');
  const offerOpen = applicant.conditionalOfferAt != null;
  const latest = b.decisions[b.decisions.length - 1] ?? null;
  const sections: ReviewSection[] = [
    { key: 'application', status: b.applicant.draft ? 'Draft' : 'Received', incomplete: b.applicant.draft, href: String(routes.applicationEdit(id)) },
    {
      key: 'documents',
      status: docs ? `${docs.provided}/${docs.required}` : String(b.documents.filter((d) => d.type !== 'paper_form').length),
      incomplete: docs ? docs.provided < docs.required : false,
      href: String(routes.documents(id)),
    },
    {
      key: 'references',
      status: refs.total ? `${refs.done}/${refs.total}` : '—',
      incomplete: refs.done < refs.total,
      href: null, // several call sheets: the screen lists them (S-11 / S-12 routes)
    },
    { key: 'report', status: vp.report === 'entered' ? 'Entered' : '—', incomplete: vp.report !== 'entered', href: String(routes.screeningReport(id)) },
  ];
  if (c10) {
    sections.push({
      key: 'background',
      status: !offerOpen ? 'After offer' : b.background?.reviewedOn ? 'Reviewed' : 'To review',
      incomplete: offerOpen && !b.background?.reviewedOn,
      href: String(routes.backgroundReview(id)),
    });
  }
  sections.push({
    key: 'decision',
    status: latest ? decisionLabel(latest.kind) : '—',
    incomplete: latest?.noticeStatus === 'pending',
    href: latest ? String(routes.letter(id, { decisionId: latest.id })) : String(routes.decision(id)),
  });
  return sections;
}

export function loadApplicantReview(db: AppDb, applicantId: number, now: string): ApplicantReview | null {
  const bundle0 = getApplicantBundle(db, applicantId);
  if (!bundle0) return null;
  const review = loadRentalReview(db, bundle0.applicant.rentalId, now);
  if (!review) return null;
  const idx = review.bundles.findIndex((b) => b.applicant.id === applicantId);
  // Drafts / data-deleted applicants are not in the rental list: evaluate on their own.
  const bundle = idx >= 0 ? review.bundles[idx] : bundle0;
  const applicant = idx >= 0 ? review.applicants[idx] : null;
  const engineApplicant = applicant ?? toEngineApplicant(bundle);
  const evaluation = idx >= 0 ? review.evaluations[idx] : evaluateApplicant(review.rental, review.criteria, engineApplicant);
  const queueEntry = review.queue?.entries.find((e) => e.applicantId === engineApplicant.id) ?? null;
  const latestDecision = bundle.decisions[bundle.decisions.length - 1] ?? null;

  let decide: ApplicantReview['decide'] = { allowed: true, block: null, message: null };
  if (bundle.applicant.deletedAt) decide = { allowed: false, block: 'data_deleted', message: 'This applicant’s data was deleted.' };
  else if (FINAL_STATUSES.has(engineApplicant.status))
    decide = { allowed: false, block: 'closed', message: null };
  else if (review.queue) {
    const gate = decisionGate(review.queue, engineApplicant.id, 'approve');
    if (!gate.allowed) decide = { allowed: false, block: 'not_your_turn', message: gate.message };
  }

  return {
    rentalRow: review.rentalRow,
    rental: review.rental,
    criteria: review.criteria,
    bundle,
    applicant: engineApplicant,
    evaluation,
    queue: review.queue,
    queueEntry,
    sections: reviewSections(bundle, engineApplicant, review.criteria),
    latestDecision,
    noticePending: bundle.decisions.some((d) => d.noticeStatus === 'pending'),
    decide,
  };
}

/** Where an S-09 issue / evidence-sheet button goes ("Add pay stubs", "Call landlord", "Add report"). */
export function issueHref(action: IssueAction, applicant: ApplicantInput): string {
  const id = applicant.id;
  switch (action) {
    case 'add_documents':
    case 'review_documents':
      return String(routes.documents(id));
    case 'call_landlord':
    case 'confirm_landlord': {
      const r = c4Residence(applicant) ?? applicant.residences.find((x) => x.type === 'rent') ?? null;
      return r ? String(routes.landlordReference(id, r.id)) : String(routes.applicationEdit(id, 3));
    }
    case 'add_report':
    case 'view_report':
      return String(routes.screeningReport(id));
    case 'background_review':
      return String(routes.backgroundReview(id));
    case 'landlord_check':
    case 'edit_application':
      return String(routes.applicationEdit(id));
  }
}

/** Short button text for an issue action (mockup v2: "Add pay stubs", "Call landlord", "Add report"). */
export const ISSUE_ACTION_KEYS: Record<IssueAction, string> = {
  edit_application: 'issueAction.editApplication',
  add_documents: 'issueAction.addDocuments',
  review_documents: 'issueAction.reviewDocuments',
  call_landlord: 'issueAction.callLandlord',
  confirm_landlord: 'issueAction.confirmLandlord',
  add_report: 'issueAction.addReport',
  view_report: 'issueAction.viewReport',
  background_review: 'issueAction.backgroundReview',
  landlord_check: 'issueAction.landlordCheck',
};

/** Evidence sheet for one Criterion result (S-09 / S-17 cell tap): source, date, files, button. */
export interface EvidenceDetail {
  result: CriterionResult;
  issues: Issue[];
  /** Documents behind a 'document' source (C1 / C6), newest first. */
  documents: ApplicantBundle['documents'];
  /** "by you" when the landlord checked it (Verified), else null. */
  checkedBy: 'you' | null;
  action: { action: IssueAction; href: string } | null;
}

export function evidenceDetail(result: CriterionResult, bundle: ApplicantBundle, applicant: ApplicantInput): EvidenceDetail {
  const action = result.issues[0]?.action ?? defaultAction(result);
  const documents =
    result.code === 'C1'
      ? bundle.documents.filter((d) => d.type === 'proof_of_income' || d.type === 'voucher_letter')
      : result.code === 'C6'
        ? bundle.documents.filter((d) => d.type !== 'paper_form')
        : [];
  return {
    result,
    issues: result.issues,
    documents: documents.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    checkedBy: result.evidence === 'verified' ? 'you' : null,
    action: action ? { action, href: issueHref(action, applicant) } : null,
  };
}

function defaultAction(r: CriterionResult): IssueAction | null {
  switch (r.source) {
    case 'document':
      return 'review_documents';
    case 'landlord_reference':
      return 'call_landlord';
    case 'screening_report':
      return 'view_report';
    case 'application':
      return 'edit_application';
    default:
      return r.code === 'C10' ? 'background_review' : null;
  }
}

// ---------------------------------------------------------------------------
// S-17 Compare
// ---------------------------------------------------------------------------

export interface CompareData {
  rentalRow: Rental;
  address: { short: string; full: string };
  /** < 2 applicants in the rental → "Add at least two applicants to compare." */
  enough: boolean;
  table: CompareTable;
  bundles: ApplicantBundle[];
  applicants: ApplicantInput[];
}

/** "Not a ranking. Columns are in the order applications were received." `hideClosed` = "Hide denied / withdrawn". */
export function loadCompare(db: AppDb, rentalId: number, opts: { hideClosed: boolean }): CompareData | null {
  const rentalRow = getRental(db, rentalId);
  const loaded = rentalRow ? loadRentalForEngine(db, rentalId) : null;
  if (!rentalRow || !loaded) return null;
  const table = compareApplicants(loaded.rental, loaded.criteria, loaded.applicants, { hideClosed: opts.hideClosed });
  const byId = new Map(loaded.applicants.map((a, i) => [a.id, i]));
  const order = table.columns.map((c) => byId.get(c.applicantId)!);
  return {
    rentalRow,
    address: rentalAddress(rentalRow),
    enough: loaded.applicants.length >= 2,
    table,
    bundles: order.map((i) => loaded.bundles[i]),
    applicants: order.map((i) => loaded.applicants[i]),
  };
}

/** Column header "Jordan E." (first name + last initial). */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ---------------------------------------------------------------------------
// S-18 Order queue
// ---------------------------------------------------------------------------

export interface QueueRow extends QueueEntry {
  /** Missing items for the "Request missing info" sheet (criterion titles). */
  missing: string[];
  rowId: number;
}

export interface QueueData {
  rentalRow: Rental;
  address: { short: string; full: string };
  rows: QueueRow[];
  currentId: string | null;
}

export function loadQueue(db: AppDb, rentalId: number, now: string): QueueData | null {
  const review = loadRentalReview(db, rentalId, now);
  if (!review) return null;
  const queue =
    review.queue ??
    buildQueue(
      review.bundles.map((b, i) => toQueueApplicant(b, review.evaluations[i].summary.missingCount)),
      now,
    );
  const byId = new Map(review.applicants.map((a, i) => [a.id, i]));
  return {
    rentalRow: review.rentalRow,
    address: rentalAddress(review.rentalRow),
    currentId: queue.currentId,
    rows: queue.entries.map((e) => {
      const i = byId.get(e.applicantId)!;
      return {
        ...e,
        rowId: review.bundles[i].applicant.id,
        missing: review.evaluations[i].results.filter((r) => r.outcome === 'missing').map((r) => r.title),
      };
    }),
  };
}

/** Applicants of a rental that are drafts are excluded everywhere in review (listApplicants default). */
export const countApplicants = (db: AppDb, rentalId: number) => listApplicants(db, rentalId).length;
