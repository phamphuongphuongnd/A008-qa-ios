/**
 * First-come order (§3.14): queue by received time, whose turn it is, 72 h missing-info / 48 h offer timers, the actions
 * they unlock and the local notifications to schedule. Pure: every function takes `now`; nothing reads the clock.
 * Timers run on absolute time (72 h = 259 200 s), so a daylight-saving change moves the wall-clock end by an hour.
 */
import { HOUR_MS, instantMs } from './dates';
import { byReceived } from './evaluate';
import type { ApplicantStatus, IsoDateTime } from './types';

export type TimerKind = 'missing_info' | 'offer';

export const TIMER_HOURS: Record<TimerKind, number> = { missing_info: 72, offer: 48 };
/** "Thông báo local khi đồng hồ còn 2 h và khi hết". */
export const NOTIFY_BEFORE_HOURS = 2;

export interface Timer {
  kind: TimerKind;
  startedAt: IsoDateTime;
  /** UTC ISO ('…Z'); the UI formats it in local time. */
  endsAt: IsoDateTime;
  resolvedAt: IsoDateTime | null;
}

export function startTimer(kind: TimerKind, startedAt: IsoDateTime): Timer {
  return {
    kind,
    startedAt,
    endsAt: new Date(instantMs(startedAt) + TIMER_HOURS[kind] * HOUR_MS).toISOString(),
    resolvedAt: null,
  };
}

export type TimerStatus = 'running' | 'expired' | 'resolved';

export interface TimerState {
  status: TimerStatus;
  /** ms left (0 when expired / resolved). */
  remainingMs: number;
  /** "Missing info — 41 h left", "Offer — 22 h left", "Offer expired". */
  label: string;
}

/** Expired from the exact end instant (now ≥ endsAt). */
export function timerState(timer: Timer, now: IsoDateTime): TimerState {
  const name = timer.kind === 'missing_info' ? 'Missing info' : 'Offer';
  if (timer.resolvedAt) return { status: 'resolved', remainingMs: 0, label: `${name} — resolved` };
  const left = instantMs(timer.endsAt) - instantMs(now);
  if (left <= 0) {
    return {
      status: 'expired',
      remainingMs: 0,
      label: timer.kind === 'offer' ? 'Offer expired' : 'Missing info — time is up',
    };
  }
  const hours = Math.floor(left / HOUR_MS);
  const leftText = hours >= 1 ? `${hours} h left` : `${Math.max(1, Math.ceil(left / 60_000))} min left`;
  return { status: 'running', remainingMs: left, label: `${name} — ${leftText}` };
}

export interface TimerNotification {
  /** Stable key for scheduling / cancelling: `${applicantId}:${kind}:${type}`. */
  key: string;
  at: IsoDateTime;
  type: 'two_hours_left' | 'expired';
  title: string;
}

/** Local notifications still in the future for a running timer (§6 texts). */
export function timerNotifications(
  timer: Timer,
  applicant: { id: string; fullName: string },
  now: IsoDateTime,
): TimerNotification[] {
  if (timer.resolvedAt) return [];
  const end = instantMs(timer.endsAt);
  const nowMs = instantMs(now);
  const name = applicant.fullName;
  const items: TimerNotification[] = [
    {
      key: `${applicant.id}:${timer.kind}:two_hours_left`,
      at: new Date(end - NOTIFY_BEFORE_HOURS * HOUR_MS).toISOString(),
      type: 'two_hours_left',
      title:
        timer.kind === 'missing_info'
          ? `${name} — 2 hours left to provide missing info`
          : `Offer to ${name} expires in 2 hours`,
    },
    {
      key: `${applicant.id}:${timer.kind}:expired`,
      at: new Date(end).toISOString(),
      type: 'expired',
      title: timer.kind === 'missing_info' ? `${name} — time to provide missing info is up` : `Offer to ${name} has expired`,
    },
  ];
  return items.filter((n) => instantMs(n.at) > nowMs);
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface QueueApplicant {
  id: string;
  fullName: string;
  receivedAt: IsoDateTime;
  status: ApplicantStatus;
  timers: Timer[];
  /** From `evaluateApplicant(...).summary.missingCount`. */
  missingCount: number;
}

/** Statuses that end an Applicant's turn. */
export const FINAL_STATUSES: ReadonlySet<ApplicantStatus> = new Set(['denied', 'withdrawn', 'incomplete', 'offer_expired']);

export type QueueState = 'done' | 'in_review' | 'offered' | 'approved' | 'waiting';

export type QueueAction = 'review' | 'request_missing_info' | 'move_to_next_incomplete' | 'offer_expired_move_next';

export interface QueueEntry {
  applicantId: string;
  fullName: string;
  /** 1-based place in line ("#1"). */
  position: number;
  receivedAt: IsoDateTime;
  status: ApplicantStatus;
  state: QueueState;
  /** Latest unresolved timer, if any. */
  timer: (Timer & TimerState) | null;
  actions: QueueAction[];
}

export interface Queue {
  entries: QueueEntry[];
  /** Whose turn it is (In review / Offered / Approved); null when nobody is left. */
  currentId: string | null;
}

function openTimer(a: QueueApplicant, kind?: TimerKind): Timer | null {
  const open = a.timers.filter((t) => !t.resolvedAt && (!kind || t.kind === kind));
  return open.sort((x, y) => instantMs(y.startedAt) - instantMs(x.startedAt))[0] ?? null;
}

/** S-18 Order queue. */
export function buildQueue(applicants: readonly QueueApplicant[], now: IsoDateTime): Queue {
  let currentId: string | null = null;
  const entries = byReceived(applicants).map((a, i): QueueEntry => {
    const t = openTimer(a);
    const timer = t ? { ...t, ...timerState(t, now) } : null;
    const base = { applicantId: a.id, fullName: a.fullName, position: i + 1, receivedAt: a.receivedAt, status: a.status, timer };
    if (FINAL_STATUSES.has(a.status)) return { ...base, state: 'done', actions: [] };
    if (currentId) return { ...base, state: 'waiting', actions: [] };
    currentId = a.id;
    if (a.status === 'conditional_offer' || a.status === 'approved') {
      const offer = openTimer(a, 'offer');
      const expired = offer ? timerState(offer, now).status === 'expired' : false;
      const state: QueueState = a.status === 'approved' && !offer ? 'approved' : 'offered';
      return { ...base, state, actions: expired ? ['review', 'offer_expired_move_next'] : ['review'] };
    }
    const actions: QueueAction[] = ['review'];
    const missing = openTimer(a, 'missing_info');
    if (a.missingCount > 0) {
      if (!missing) actions.push('request_missing_info');
      else if (timerState(missing, now).status === 'expired') actions.push('move_to_next_incomplete');
    }
    return { ...base, state: 'in_review', actions };
  });
  return { entries, currentId };
}

export type DecisionGate = { allowed: true } | { allowed: false; message: string };

const POSITIVE: ReadonlySet<string> = new Set(['approve', 'approve_with_conditions', 'conditional_offer']);

/**
 * First-come: only the Applicant whose turn it is may get Approve / Approve with conditions / Conditional offer.
 * Message: "First-come mode: decide on #2 first".
 */
export function decisionGate(queue: Queue, applicantId: string, decisionKind: string): DecisionGate {
  if (!POSITIVE.has(decisionKind) || queue.currentId === applicantId) return { allowed: true };
  const current = queue.entries.find((e) => e.applicantId === queue.currentId);
  if (!current) return { allowed: true };
  return { allowed: false, message: `First-come mode: decide on #${current.position} first` };
}

export interface TurnChange {
  statusChanges: { applicantId: string; status: ApplicantStatus }[];
  /** Open timers of the closed Applicant to mark resolved at `at`. */
  resolveTimers: { applicantId: string; kind: TimerKind; resolvedAt: IsoDateTime }[];
  /** Who becomes In review next (null = nobody left). */
  nextId: string | null;
}

/**
 * Close the current turn: Deny / incomplete (after 72 h) / offer expired (after 48 h) / withdrawn → the next Applicant in
 * line becomes In review (§3.14).
 */
export function closeTurn(
  applicants: readonly QueueApplicant[],
  applicantId: string,
  status: 'denied' | 'incomplete' | 'offer_expired' | 'withdrawn',
  at: IsoDateTime,
): TurnChange {
  const me = applicants.find((a) => a.id === applicantId);
  if (!me) throw new Error(`Unknown applicant ${applicantId}`);
  const statusChanges: TurnChange['statusChanges'] = [{ applicantId, status }];
  const resolveTimers = me.timers
    .filter((t) => !t.resolvedAt)
    .map((t) => ({ applicantId, kind: t.kind, resolvedAt: at }));
  const after = applicants.map((a) => (a.id === applicantId ? { ...a, status } : a));
  const next = byReceived(after).find((a) => !FINAL_STATUSES.has(a.status)) ?? null;
  if (next && next.status === 'new') statusChanges.push({ applicantId: next.id, status: 'in_review' });
  return { statusChanges, resolveTimers, nextId: next?.id ?? null };
}

/** S-05 published-criteria line for First-come rentals. */
export const FIRST_COME_PUBLISHED_TEXT =
  'Applications are reviewed in the order received. If information is missing you will have 72 hours to provide it. Offers are open for 48 hours.';
