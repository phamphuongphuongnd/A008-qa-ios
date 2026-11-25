/** @jest-environment node */
// §3.14 First-come order: queue, 72 h / 48 h timers (midnight, DST), notifications, turn changes.
import { buildQueue, closeTurn, decisionGate, startTimer, timerNotifications, timerState, validateDecision } from '..';
import type { QueueApplicant, Timer } from '../firstCome';

const localNY = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const qa = (id: string, receivedAt: string, over: Partial<QueueApplicant> = {}): QueueApplicant => ({
  id,
  fullName: `Person ${id}`,
  receivedAt,
  status: 'new',
  timers: [],
  missingCount: 0,
  ...over,
});

describe('timers', () => {
  it('72 h across midnight ends at the same wall-clock time 3 days later', () => {
    const t = startTimer('missing_info', '2026-12-02T23:30:00-05:00');
    expect(t.endsAt).toBe('2026-12-06T04:30:00.000Z');
    expect(localNY(t.endsAt)).toBe('Dec 5, 11:30 PM');
  });
  it('48 h across the spring-forward DST change is 48 real hours (wall clock +1 h)', () => {
    // 2027-03-14 02:00 EST → EDT
    const t = startTimer('offer', '2027-03-13T09:00:00-05:00');
    expect(Date.parse(t.endsAt) - Date.parse(t.startedAt)).toBe(48 * 3600_000);
    expect(localNY(t.endsAt)).toBe('Mar 15, 10:00 AM');
  });
  it('72 h across the fall-back DST change (wall clock −1 h)', () => {
    const t = startTimer('missing_info', '2026-10-31T12:00:00-04:00');
    expect(localNY(t.endsAt)).toBe('Nov 3, 11:00 AM');
  });
  it('expires at the exact second; labels "41 h left" / minutes', () => {
    const t = startTimer('missing_info', '2026-12-02T09:00:00-05:00');
    expect(timerState(t, '2026-12-05T08:59:59-05:00').status).toBe('running');
    expect(timerState(t, '2026-12-05T09:00:00-05:00').status).toBe('expired');
    expect(timerState(t, '2026-12-03T16:00:00-05:00').label).toBe('Missing info — 41 h left');
    expect(timerState(t, '2026-12-05T08:30:00-05:00').label).toBe('Missing info — 30 min left');
    expect(timerState(startTimer('offer', '2026-12-02T09:00:00-05:00'), '2026-12-03T11:00:00-05:00').label).toBe('Offer — 22 h left');
  });
  it('notifications at 2 h left and at the end; past ones dropped; resolved → none', () => {
    const t = startTimer('offer', '2026-12-02T09:00:00-05:00');
    const n = timerNotifications(t, { id: 'a1', fullName: 'Jordan Ellis' }, '2026-12-02T10:00:00-05:00');
    expect(n.map((x) => [x.type, x.at, x.title])).toEqual([
      ['two_hours_left', '2026-12-04T12:00:00.000Z', 'Offer to Jordan Ellis expires in 2 hours'],
      ['expired', '2026-12-04T14:00:00.000Z', 'Offer to Jordan Ellis has expired'],
    ]);
    expect(timerNotifications(t, { id: 'a1', fullName: 'J' }, '2026-12-04T08:00:00-05:00')).toHaveLength(1);
    expect(timerNotifications({ ...t, resolvedAt: '2026-12-03T09:00:00-05:00' }, { id: 'a1', fullName: 'J' }, '2026-12-02T10:00:00-05:00')).toEqual([]);
    const m = timerNotifications(startTimer('missing_info', '2026-12-02T09:00:00-05:00'), { id: 'a1', fullName: 'Jordan Ellis' }, '2026-12-02T10:00:00-05:00');
    expect(m[0].title).toBe('Jordan Ellis — 2 hours left to provide missing info');
  });
});

describe('queue', () => {
  const now = '2026-12-05T12:00:00-05:00';
  it('ordered by received time (offsets respected); first open one is In review, the rest wait', () => {
    const q = buildQueue(
      [qa('b', '2026-12-02T14:40:00-05:00'), qa('a', '2026-12-02T09:14:00-05:00'), qa('c', '2026-12-02T15:00:00Z')],
      now,
    );
    expect(q.entries.map((e) => [e.applicantId, e.position, e.state])).toEqual([
      ['a', 1, 'in_review'],
      ['c', 2, 'waiting'],
      ['b', 3, 'waiting'],
    ]);
    expect(q.currentId).toBe('a');
  });
  it('denied / incomplete / expired are skipped', () => {
    const q = buildQueue([qa('a', '2026-12-02T09:00:00-05:00', { status: 'denied' }), qa('b', '2026-12-02T10:00:00-05:00')], now);
    expect(q.currentId).toBe('b');
    expect(q.entries[0].state).toBe('done');
  });
  it('later applicants cannot get Approve / Conditional offer: "decide on #1 first"', () => {
    const q = buildQueue([qa('a', '2026-12-02T09:00:00-05:00'), qa('b', '2026-12-02T10:00:00-05:00')], now);
    expect(decisionGate(q, 'b', 'approve')).toEqual({ allowed: false, message: 'First-come mode: decide on #1 first' });
    expect(decisionGate(q, 'b', 'conditional_offer').allowed).toBe(false);
    expect(decisionGate(q, 'a', 'approve').allowed).toBe(true);
    expect(decisionGate(q, 'b', 'deny').allowed).toBe(true);
    const check = validateDecision({
      decision: { kind: 'approve', conditions: [], reasons: [], note: '', reportInfluenced: false },
      status: 'new',
      c10Enabled: false,
      missingCount: 0,
      gate: decisionGate(q, 'b', 'approve'),
    });
    expect(check.errors.map((e) => e.code)).toEqual(['not_your_turn']);
  });
  it('an Offered applicant still blocks the next one', () => {
    const offer = startTimer('offer', '2026-12-04T09:00:00-05:00');
    const q = buildQueue(
      [qa('a', '2026-12-02T09:00:00-05:00', { status: 'conditional_offer', timers: [offer] }), qa('b', '2026-12-02T10:00:00-05:00')],
      now,
    );
    expect(q.entries[0].state).toBe('offered');
    expect(q.entries[0].timer?.label).toBe('Offer — 21 h left');
    expect(decisionGate(q, 'b', 'approve').allowed).toBe(false);
  });
  it('request missing info → 72 h; after it runs out with items still missing → "Move to next (incomplete)"', () => {
    const fresh = buildQueue([qa('a', '2026-12-02T09:00:00-05:00', { missingCount: 2 })], now);
    expect(fresh.entries[0].actions).toEqual(['review', 'request_missing_info']);
    const timer: Timer = startTimer('missing_info', '2026-12-02T12:00:00-05:00');
    const running = buildQueue([qa('a', '2026-12-02T09:00:00-05:00', { missingCount: 2, timers: [timer] })], '2026-12-05T11:59:59-05:00');
    expect(running.entries[0].actions).toEqual(['review']);
    const out = buildQueue([qa('a', '2026-12-02T09:00:00-05:00', { missingCount: 2, timers: [timer] })], '2026-12-05T12:00:00-05:00');
    expect(out.entries[0].actions).toEqual(['review', 'move_to_next_incomplete']);
  });
  it('offer runs out after 48 h → "Offer expired — move to next"', () => {
    const offer = startTimer('offer', '2026-12-02T09:00:00-05:00');
    const q = buildQueue([qa('a', '2026-12-02T08:00:00-05:00', { status: 'approved', timers: [offer] })], '2026-12-04T09:00:00-05:00');
    expect(q.entries[0].actions).toContain('offer_expired_move_next');
    expect(q.entries[0].timer?.label).toBe('Offer expired');
  });
  it('closing a turn moves the next applicant to In review and resolves open timers', () => {
    const t = startTimer('missing_info', '2026-12-02T12:00:00-05:00');
    const list = [
      qa('a', '2026-12-02T09:00:00-05:00', { status: 'in_review', timers: [t] }),
      qa('b', '2026-12-02T10:00:00-05:00', { status: 'withdrawn' }),
      qa('c', '2026-12-02T11:00:00-05:00'),
    ];
    const change = closeTurn(list, 'a', 'incomplete', '2026-12-05T12:01:00-05:00');
    expect(change.statusChanges).toEqual([
      { applicantId: 'a', status: 'incomplete' },
      { applicantId: 'c', status: 'in_review' },
    ]);
    expect(change.resolveTimers).toEqual([{ applicantId: 'a', kind: 'missing_info', resolvedAt: '2026-12-05T12:01:00-05:00' }]);
    expect(change.nextId).toBe('c');
  });
});
