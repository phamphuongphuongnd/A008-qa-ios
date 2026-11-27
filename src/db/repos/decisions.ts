import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { FileStore } from '../files';
import { applicants, decisions, letters, timers, type NoticeStatus, type TimerKind } from '../schema';
import type { AppDb, Decision, Letter, NewDecision, NewLetter, Patch, Timer } from '../types';

// ---------------- Decisions (S-15) ----------------

export function listDecisions(db: AppDb, applicantId: number): Decision[] {
  return db.select().from(decisions).where(eq(decisions.applicantId, applicantId)).orderBy(asc(decisions.at), asc(decisions.id)).all();
}

/** The applicant's current decision (the latest), or null. */
export function latestDecision(db: AppDb, applicantId: number): Decision | null {
  return db.select().from(decisions).where(eq(decisions.applicantId, applicantId)).orderBy(desc(decisions.at), desc(decisions.id)).get() ?? null;
}

/**
 * Saves a decision with its timestamp (`at`), and — in the same transaction — the applicant status it implies when
 * `status` is given (Deny → denied, Approve → approved…). `noticeRequired` comes from the engine (§3.15); when true the
 * decision starts as "Notice pending".
 */
export function saveDecision(
  db: AppDb,
  data: Omit<NewDecision, 'noticeStatus'> & { noticeStatus?: NoticeStatus },
  status?: (typeof applicants.$inferSelect)['status'],
): number {
  return db.transaction((tx) => {
    const noticeStatus = data.noticeStatus ?? (data.noticeRequired ? 'pending' : 'not_required');
    const id = tx.insert(decisions).values({ ...data, noticeStatus }).returning({ id: decisions.id }).get().id;
    if (status) tx.update(applicants).set({ status, updatedAt: data.at }).where(eq(applicants.id, data.applicantId)).run();
    return id;
  });
}

export function setNoticeStatus(db: AppDb, decisionId: number, status: NoticeStatus): void {
  db.update(decisions).set({ noticeStatus: status }).where(eq(decisions.id, decisionId)).run();
}

/** Decisions of a rental still waiting for their FCRA notice (S-06 / S-09 reminders). */
export function listPendingNotices(db: AppDb, rentalId: number): Decision[] {
  return db
    .select({ d: decisions })
    .from(decisions)
    .innerJoin(applicants, eq(applicants.id, decisions.applicantId))
    .where(and(eq(applicants.rentalId, rentalId), eq(decisions.noticeStatus, 'pending')))
    .orderBy(asc(decisions.at))
    .all()
    .map((r) => r.d);
}

// ---------------- Letters (S-16) ----------------

export function listLetters(db: AppDb, decisionId: number): Letter[] {
  return db.select().from(letters).where(eq(letters.decisionId, decisionId)).orderBy(asc(letters.id)).all();
}

export function getLetter(db: AppDb, id: number): Letter | null {
  return db.select().from(letters).where(eq(letters.id, id)).get() ?? null;
}

/** Creates the letter; an adverse action letter moves its decision from "Notice pending" to "created". */
export function createLetter(db: AppDb, data: NewLetter): number {
  return db.transaction((tx) => {
    const id = tx.insert(letters).values(data).returning({ id: letters.id }).get().id;
    if (data.kind === 'adverse_action') tx.update(decisions).set({ noticeStatus: 'created' }).where(eq(decisions.id, data.decisionId)).run();
    return id;
  });
}

export function updateLetter(db: AppDb, id: number, patch: Patch<Omit<NewLetter, 'decisionId'>>): void {
  db.update(letters).set(patch).where(eq(letters.id, id)).run();
}

/** "Mark as sent" (date + how). An adverse action notice marks its decision's notice as sent. */
export function markLetterSent(db: AppDb, id: number, method: NonNullable<Letter['sentMethod']>, at = new Date().toISOString()): void {
  db.transaction((tx) => {
    const l = tx.select().from(letters).where(eq(letters.id, id)).get();
    if (!l) return;
    tx.update(letters).set({ sentAt: at, sentMethod: method }).where(eq(letters.id, id)).run();
    if (l.kind === 'adverse_action') tx.update(decisions).set({ noticeStatus: 'sent' }).where(eq(decisions.id, l.decisionId)).run();
  });
}

export function deleteLetter(db: AppDb, files: FileStore, id: number): void {
  const l = getLetter(db, id);
  db.delete(letters).where(eq(letters.id, id)).run();
  if (l?.pdfPath) files.deleteFile(l.pdfPath);
}

// ---------------- First-come timers (S-18, §3.14) ----------------

export function startTimer(db: AppDb, data: { applicantId: number; kind: TimerKind; startedAt: string; endsAt: string; method?: string | null; notificationIds?: string[] }): number {
  return db.insert(timers).values(data).returning({ id: timers.id }).get().id;
}

export function resolveTimer(db: AppDb, id: number, at = new Date().toISOString()): void {
  db.update(timers).set({ resolvedAt: at }).where(eq(timers.id, id)).run();
}

/**
 * Undo of a rental close (B-61): the clocks stopped by the close run again (same end time). Their old notifications
 * were cancelled, so the ids are cleared for `syncTimerNotifications` to schedule them again.
 */
export function reopenTimers(db: AppDb, ids: readonly number[]): void {
  if (!ids.length) return;
  db.update(timers).set({ resolvedAt: null, notificationIds: [] }).where(inArray(timers.id, [...ids])).run();
}

export function setTimerNotifications(db: AppDb, id: number, notificationIds: string[]): void {
  db.update(timers).set({ notificationIds }).where(eq(timers.id, id)).run();
}

/** The applicant's running (unresolved) timer of a kind, if any. */
export function activeTimer(db: AppDb, applicantId: number, kind?: TimerKind): Timer | null {
  return (
    db
      .select()
      .from(timers)
      .where(and(eq(timers.applicantId, applicantId), isNull(timers.resolvedAt), kind ? eq(timers.kind, kind) : undefined))
      .orderBy(desc(timers.startedAt))
      .get() ?? null
  );
}

/** Every running timer of a rental (S-18 clocks, notification rescheduling after a restore). */
export function listActiveTimers(db: AppDb, rentalId?: number): Timer[] {
  const ids = rentalId === undefined ? null : db.select({ id: applicants.id }).from(applicants).where(eq(applicants.rentalId, rentalId)).all().map((a) => a.id);
  if (ids && ids.length === 0) return [];
  return db
    .select()
    .from(timers)
    .where(and(isNull(timers.resolvedAt), ids ? inArray(timers.applicantId, ids) : undefined))
    .orderBy(asc(timers.endsAt))
    .all();
}
