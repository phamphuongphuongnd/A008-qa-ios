/**
 * S-15 Decision + First-come turn actions (F-12, F-13, product.md §3.14, §3.15, S-15, S-18).
 *
 * State machine of an Applicant (ApplicantStatus):
 *   new ─(first in line, First-come)→ in_review
 *   new | in_review ─Conditional offer→ conditional_offer ─Approve / with conditions→ approved
 *                                                       └─Withdraw offer→ denied
 *   new | in_review ─Approve / with conditions→ approved   ─Deny→ denied
 *   (First-come) 72 h ran out → incomplete · 48 h ran out → offer_expired · S-09 menu → withdrawn
 * denied / withdrawn / incomplete / offer_expired are final and, in First-come, hand the turn to the next in line.
 * First-come clocks: Conditional offer starts the 48 h reply clock; Approve (the landlord's final answer) stops it.
 * Every rule comes from the engine (`validateDecision`, `noticeRequirement`, `decisionGate`, `closeTurn`, `startTimer`).
 */
import {
  activeCriteria,
  closeTurn,
  decisionGate,
  defaultReportInfluenced,
  FINAL_STATUSES,
  noticeRequirement,
  reasonOptions,
  startTimer as engineStartTimer,
  validateDecision,
  type ApplicantStatus,
  type CriterionResult,
  type DecisionCheck,
  type DecisionInput,
  type DecisionKind,
  type DecisionReason,
  type NoticeRequirement,
  type QueueAction,
  type TimerKind,
  type TurnChange,
} from '@/engine';
import { getApplicantBundle, purgeApplicant, setApplicantStatus } from '@/db/repos/applicants';
import type { FileStore } from '@/db/files';
import { activeTimer, resolveTimer, saveDecision, startTimer as dbStartTimer } from '@/db/repos/decisions';
import { getSettings } from '@/db/repos/settings';
import { toQueueApplicant } from '@/db/toEngine';
import type { AppDb, Timer as TimerRow } from '@/db/types';
import { cancelTimerNotifications, ensureTimerPermission, type PermissionState, type QueueNotifier } from '@/notifications/queueTimers';
import { syncTimerNotifications } from '@/notifications/timerSync';

import { loadApplicantReview, loadRentalReview, type ApplicantReview } from './review';
import { localIso } from './time';

/** Everything an action needs; screens pass `decisionDeps` from ./deps (real db + expo notifier). */
export interface DecisionDeps {
  db: AppDb;
  notifier: QueueNotifier;
  now: () => Date;
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; message: string };

const fail = (error: string, message: string) => ({ ok: false as const, error, message });

// ---------------------------------------------------------------------------
// S-15 form
// ---------------------------------------------------------------------------

/** Decisions shown in S-15 for the applicant's status (product.md S-15). */
export function decisionOptions(status: ApplicantStatus, c10Enabled: boolean): DecisionKind[] {
  if (status === 'conditional_offer') return ['approve', 'approve_with_conditions', 'withdraw_offer'];
  if (status === 'new' || status === 'in_review') {
    return [...(c10Enabled ? (['conditional_offer'] as const) : []), 'approve', 'approve_with_conditions', 'deny'];
  }
  return [];
}

/** Applicant status a saved Decision leads to. A withdrawn conditional offer ends the application like a denial. */
export const STATUS_AFTER: Record<DecisionKind, ApplicantStatus> = {
  conditional_offer: 'conditional_offer',
  approve: 'approved',
  approve_with_conditions: 'approved',
  deny: 'denied',
  withdraw_offer: 'denied',
};

export interface ReasonChoice {
  reason: DecisionReason;
  result: CriterionResult;
}

export interface DecisionContext {
  review: ApplicantReview;
  options: DecisionKind[];
  /** Not met / Needs review results the landlord may tick ("Not met · Screening report: $2,310"). */
  reasonChoices: ReasonChoice[];
  /** Pre-ticked "Information from a screening report played a part in this decision" (§3.15). */
  defaultReportInfluenced: boolean;
  c10: { enabled: boolean; lookbackYears: number };
}

export function loadDecisionContext(db: AppDb, applicantId: number, now: string): DecisionContext | null {
  const review = loadApplicantReview(db, applicantId, now);
  if (!review) return null;
  const c10 = activeCriteria(review.criteria).find((c) => c.code === 'C10');
  const byId = new Map(review.evaluation.results.map((r) => [r.criterionId, r]));
  return {
    review,
    options: review.bundle.applicant.deletedAt ? [] : decisionOptions(review.applicant.status, !!c10),
    reasonChoices: reasonOptions(review.evaluation.results).map((reason) => ({ reason, result: byId.get(reason.criterionId)! })),
    defaultReportInfluenced: defaultReportInfluenced(review.applicant.report),
    c10: { enabled: !!c10, lookbackYears: c10 && c10.code === 'C10' ? c10.params.lookbackYears : 7 },
  };
}

/** An empty S-15 draft for a kind (reasons empty, FCRA box pre-ticked per §3.15). */
export function emptyDecision(ctx: DecisionContext, kind: DecisionKind): DecisionInput {
  return { kind, conditions: [], reasons: [], note: '', reportInfluenced: ctx.defaultReportInfluenced };
}

export interface DecisionPreview extends DecisionCheck {
  notice: NoticeRequirement;
  /** First-come gate for this kind (S-15 shows the message). */
  gate: { allowed: boolean; message?: string };
}

/** Live S-15 checks: errors block "Save decision"; warnings show ("Some information is missing…"). */
export function checkDecision(ctx: DecisionContext, decision: DecisionInput): DecisionPreview {
  const r = ctx.review;
  const queue = r.queue;
  const gate = queue ? decisionGate(queue, r.applicant.id, decision.kind) : { allowed: true as const };
  const check = validateDecision({
    decision,
    status: r.applicant.status,
    c10Enabled: ctx.c10.enabled,
    c10LookbackYears: ctx.c10.lookbackYears,
    background: r.applicant.background,
    conditionalOfferAt: r.applicant.conditionalOfferAt,
    missingCount: r.evaluation.summary.missingCount,
    gate,
  });
  if (!ctx.options.includes(decision.kind)) {
    check.errors.unshift({ code: 'not_your_turn', message: 'This decision is not available for this applicant now' });
  }
  return { ...check, notice: noticeRequirement(decision, r.applicant.report), gate };
}

// ---------------------------------------------------------------------------
// Timers (First-come)
// ---------------------------------------------------------------------------

async function cancelRows(notifier: QueueNotifier, rows: readonly (TimerRow | null)[]) {
  for (const t of rows) if (t) await cancelTimerNotifications(notifier, t.notificationIds);
}

/** Resolve the applicant's open timers (all kinds) and cancel their notifications. */
async function resolveOpenTimers(deps: DecisionDeps, applicantId: number, at: string) {
  const open: TimerRow[] = [];
  for (let t = activeTimer(deps.db, applicantId); t; t = activeTimer(deps.db, applicantId)) {
    resolveTimer(deps.db, t.id, at);
    open.push(t);
  }
  await cancelRows(deps.notifier, open);
}

/**
 * Start a 72 h / 48 h clock, store it and schedule its two notifications (asks the permission once).
 * Notification problems never fail the action: the clock is shown in the app either way. A clock started while
 * notifications are off gets its notifications later, once they are allowed (`syncTimerNotifications`, B-58).
 */
async function startClock(
  deps: DecisionDeps,
  input: { applicantId: number; fullName: string; rentalId: number; kind: TimerKind; at: string; method?: string | null },
): Promise<{ timerId: number; endsAt: string; permission: PermissionState }> {
  const t = engineStartTimer(input.kind, input.at);
  const timerId = dbStartTimer(deps.db, { applicantId: input.applicantId, kind: input.kind, startedAt: t.startedAt, endsAt: t.endsAt, method: input.method ?? null });
  let permission: PermissionState = 'denied';
  try {
    const s = getSettings(deps.db);
    if (s.reminders.timers) {
      // 2E's prompt (ask once, `settings.notificationsAsked`) on the phone; see queueTimersNative.
      permission = await ensureTimerPermission(deps.notifier);
      if (permission === 'granted') {
        await syncTimerNotifications(deps.db, deps.notifier, { now: input.at, timerIds: [timerId] });
        // First clock: ask once for exact alarms ("Alarms & reminders", Android 14+) so the reminders come on time.
        // Not awaited — the landlord may spend a while on the system screen; when they come back, the sync sees the
        // change and re-schedules every clock exactly.
        if (deps.notifier.ensureExactAlarms) {
          void deps.notifier
            .ensureExactAlarms()
            .then(() => syncTimerNotifications(deps.db, deps.notifier))
            .catch(() => undefined);
        }
      }
    }
  } catch {
    // Reminders are best-effort.
  }
  return { timerId, endsAt: t.endsAt, permission };
}

/** Apply an engine TurnChange: statuses, resolved timers (+ their notifications). */
async function applyTurn(deps: DecisionDeps, change: TurnChange, at: string) {
  for (const s of change.statusChanges) setApplicantStatus(deps.db, Number(s.applicantId), s.status);
  const ids = [...new Set(change.resolveTimers.map((r) => Number(r.applicantId)))];
  for (const id of ids) await resolveOpenTimers(deps, id, at);
}

// ---------------------------------------------------------------------------
// Save decision
// ---------------------------------------------------------------------------

export interface SavedDecision {
  decisionId: number;
  at: string;
  status: ApplicantStatus;
  /** Letter to create next; `adverseAction` → the Decision is "Notice pending" until the notice is exported. */
  notice: NoticeRequirement;
  /** First-come: who is In review now (row id), or null. */
  nextApplicantId: number | null;
  /** First-come offer: reply-by (UTC ISO). */
  offerEndsAt: string | null;
}

/** "Save decision": validate, timestamp, store with the new status, hand the turn on / start the 48 h offer clock. */
export async function saveDecisionAction(
  deps: DecisionDeps,
  applicantId: number,
  decision: DecisionInput,
): Promise<ActionResult<SavedDecision>> {
  const at = localIso(deps.now());
  const ctx = loadDecisionContext(deps.db, applicantId, at);
  if (!ctx) return fail('not_found', 'Applicant not found');
  const preview = checkDecision(ctx, decision);
  if (preview.errors.length) return fail(preview.errors[0].code, preview.errors[0].message);

  const r = ctx.review;
  const status = STATUS_AFTER[decision.kind];
  const decisionId = saveDecision(
    deps.db,
    {
      applicantId,
      kind: decision.kind,
      conditions: decision.conditions,
      reasons: decision.reasons,
      note: decision.note.trim() || null,
      reportInfluenced: decision.reportInfluenced,
      at,
      noticeRequired: preview.notice.adverseAction,
    },
    status,
  );

  let nextApplicantId: number | null = null;
  let offerEndsAt: string | null = null;
  if (r.rental.reviewMode === 'first_come') {
    if (FINAL_STATUSES.has(status)) {
      const turn = turnChange(deps.db, r.rentalRow.id, applicantId, 'denied', at);
      if (turn) {
        await applyTurn(deps, turn, at);
        nextApplicantId = turn.nextId ? Number(turn.nextId) : null;
      }
    } else {
      // Any earlier clock of this applicant ends now (72 h missing info, or the 48 h offer when Approve is the
      // landlord's final answer — Phương 2026-11-26: no "Applicant accepted" button, Approve stops the clock).
      await resolveOpenTimers(deps, applicantId, at);
      if (decision.kind === 'conditional_offer') {
        // Conditional offer → 48 h to reply (§3.14).
        const clock = await startClock(deps, { applicantId, fullName: r.bundle.applicant.fullName, rentalId: r.rentalRow.id, kind: 'offer', at });
        offerEndsAt = clock.endsAt;
      }
    }
  } else if (FINAL_STATUSES.has(status)) {
    await resolveOpenTimers(deps, applicantId, at);
  }

  return { ok: true, decisionId, at, status, notice: preview.notice, nextApplicantId, offerEndsAt };
}

function turnChange(
  db: AppDb,
  rentalId: number,
  applicantId: number,
  status: 'denied' | 'incomplete' | 'offer_expired' | 'withdrawn',
  at: string,
): TurnChange | null {
  const review = loadRentalReview(db, rentalId, at);
  if (!review) return null;
  const queueApplicants = review.bundles.map((b, i) => toQueueApplicant(b, review.evaluations[i].summary.missingCount));
  // The decision row may already have moved this applicant to `status`; closeTurn only needs who comes next.
  return closeTurn(queueApplicants, String(applicantId), status, at);
}

// ---------------------------------------------------------------------------
// S-18 actions
// ---------------------------------------------------------------------------

function queueAction(db: AppDb, applicantId: number, action: QueueAction, now: string) {
  const b = getApplicantBundle(db, applicantId);
  if (!b) return { error: fail('not_found', 'Applicant not found') } as const;
  const review = loadRentalReview(db, b.applicant.rentalId, now);
  if (!review?.queue) return { error: fail('not_first_come', 'This rental is not in first-come mode') } as const;
  const entry = review.queue.entries.find((e) => e.applicantId === String(applicantId));
  if (!entry?.actions.includes(action)) return { error: fail('not_available', 'This action is not available now') } as const;
  return { bundle: b, review, entry } as const;
}

export type MissingInfoMethod = 'email' | 'text' | 'call' | 'in_person';

/** "Request missing info" → "Start 72-hour timer" (records how the applicant was told). */
export async function requestMissingInfo(
  deps: DecisionDeps,
  applicantId: number,
  method: MissingInfoMethod,
): Promise<ActionResult<{ timerId: number; endsAt: string; permission: PermissionState }>> {
  const at = localIso(deps.now());
  const q = queueAction(deps.db, applicantId, 'request_missing_info', at);
  if ('error' in q) return q.error!;
  if (q.bundle.applicant.status === 'new') setApplicantStatus(deps.db, applicantId, 'in_review');
  const clock = await startClock(deps, {
    applicantId,
    fullName: q.bundle.applicant.fullName,
    rentalId: q.bundle.applicant.rentalId,
    kind: 'missing_info',
    at,
    method,
  });
  return { ok: true, ...clock };
}

async function closeWith(
  deps: DecisionDeps,
  applicantId: number,
  action: QueueAction,
  status: 'incomplete' | 'offer_expired',
): Promise<ActionResult<{ nextApplicantId: number | null }>> {
  const at = localIso(deps.now());
  const q = queueAction(deps.db, applicantId, action, at);
  if ('error' in q) return q.error!;
  const turn = turnChange(deps.db, q.bundle.applicant.rentalId, applicantId, status, at)!;
  await applyTurn(deps, turn, at);
  return { ok: true, nextApplicantId: turn.nextId ? Number(turn.nextId) : null };
}

/** "Move to next (incomplete)" — only after the 72 h clock ran out with items still Missing. */
export const moveToNextIncomplete = (deps: DecisionDeps, applicantId: number) =>
  closeWith(deps, applicantId, 'move_to_next_incomplete', 'incomplete');

/** "Offer expired — move to next" — only after the 48 h offer clock ran out. */
export const expireOffer = (deps: DecisionDeps, applicantId: number) => closeWith(deps, applicantId, 'offer_expired_move_next', 'offer_expired');

/**
 * Stop a running 48 h offer clock. Internal only (Phương 2026-11-26: no "Applicant accepted" button in the UI — saving
 * the final "Approve" stops the clock, see saveDecisionAction).
 */
export async function markOfferAccepted(deps: DecisionDeps, applicantId: number): Promise<ActionResult> {
  const at = localIso(deps.now());
  const t = activeTimer(deps.db, applicantId, 'offer');
  if (!t) return fail('no_offer_clock', 'No offer is waiting for a reply');
  resolveTimer(deps.db, t.id, at);
  await cancelRows(deps.notifier, [t]);
  return { ok: true };
}

/** S-09 menu "Withdrawn by applicant": final; in First-come the next in line becomes In review. */
export async function markWithdrawnByApplicant(deps: DecisionDeps, applicantId: number): Promise<ActionResult<{ nextApplicantId: number | null }>> {
  const at = localIso(deps.now());
  const b = getApplicantBundle(deps.db, applicantId);
  if (!b) return fail('not_found', 'Applicant not found');
  if (FINAL_STATUSES.has(b.applicant.status)) return fail('closed', 'This application is already closed');
  const rental = loadRentalReview(deps.db, b.applicant.rentalId, at);
  if (rental?.queue) {
    const turn = turnChange(deps.db, b.applicant.rentalId, applicantId, 'withdrawn', at)!;
    await applyTurn(deps, turn, at);
    return { ok: true, nextApplicantId: turn.nextId ? Number(turn.nextId) : null };
  }
  setApplicantStatus(deps.db, applicantId, 'withdrawn');
  await resolveOpenTimers(deps, applicantId, at);
  return { ok: true, nextApplicantId: null };
}

/**
 * S-09 menu "Delete applicant" (FTC Disposal Rule): erase the application, files, decisions and letters for good; an
 * anonymous row stays so the Decision file can say "Applicant 3 — data deleted …". Clocks + their notifications are
 * cancelled first; in First-come an applicant still in line ends their turn (as withdrawn) so the next one moves up.
 */
export async function deleteApplicantAction(
  deps: DecisionDeps & { files: FileStore },
  applicantId: number,
): Promise<ActionResult<{ nextApplicantId: number | null }>> {
  const at = localIso(deps.now());
  const b = getApplicantBundle(deps.db, applicantId);
  if (!b || b.applicant.deletedAt) return fail('not_found', 'Applicant not found');
  let nextApplicantId: number | null = null;
  const rental = loadRentalReview(deps.db, b.applicant.rentalId, at);
  if (rental?.queue && !b.applicant.draft && !FINAL_STATUSES.has(b.applicant.status)) {
    const turn = turnChange(deps.db, b.applicant.rentalId, applicantId, 'withdrawn', at);
    if (turn) {
      await applyTurn(deps, turn, at);
      nextApplicantId = turn.nextId ? Number(turn.nextId) : null;
    }
  }
  await resolveOpenTimers(deps, applicantId, at);
  purgeApplicant(deps.db, deps.files, applicantId, { keepRecord: !b.applicant.draft, at });
  return { ok: true, nextApplicantId };
}

/**
 * First-come: the first applicant in line still "new" becomes "In review" (S-18 / S-09 chip). Call when the queue
 * or an applicant of a First-come rental is opened. Returns the row id that changed, or null.
 */
export function syncQueueStatus(db: AppDb, rentalId: number, now: string): number | null {
  const review = loadRentalReview(db, rentalId, now);
  const id = review?.queue?.currentId;
  if (!review || !id) return null;
  const i = review.applicants.findIndex((a) => a.id === id);
  if (review.applicants[i].status !== 'new') return null;
  setApplicantStatus(db, Number(id), 'in_review');
  return Number(id);
}
