import * as A from '@/db/repos/applicants';
import * as S from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';
import type { AppDb } from '@/db/types';
import type { QueueNotifier, PermissionState } from '@/notifications/queueTimers';

import type { DecisionDeps } from '../decision';

export function fakeNotifier(initial: PermissionState = 'granted') {
  let perm = initial;
  let n = 0;
  const scheduled = new Map<string, { title: string; at: Date; data: { url: string; key: string } }>();
  const cancelled: string[] = [];
  let asked = 0;
  let priv = false;
  let exact = true;
  let exactAsked = 0;
  const notifier: QueueNotifier = {
    async schedule(x) {
      const id = `n${++n}`;
      scheduled.set(id, x);
      return id;
    },
    async cancel(id) {
      scheduled.delete(id);
      cancelled.push(id);
    },
    async getPermission() {
      return perm;
    },
    async requestPermission() {
      asked += 1;
      perm = 'granted';
      return perm;
    },
    isPrivate: () => priv,
    async exactAlarms() {
      return exact;
    },
    async ensureExactAlarms() {
      exactAsked += 1;
      return exact;
    },
  };
  return {
    notifier,
    scheduled,
    cancelled,
    askedCount: () => asked,
    /** The landlord changes the permission in the system settings. */
    setPermission: (p: PermissionState) => {
      perm = p;
    },
    /** Applicant mode on / off. */
    setPrivate: (on: boolean) => {
      priv = on;
    },
    /** Android "Alarms & reminders" allowed (exact alarms) or not. */
    setExact: (on: boolean) => {
      exact = on;
    },
    exactAskedCount: () => exactAsked,
  };
}

/** Sample rental (§8) in a fresh DB, with row ids by first name. */
export function sampleDb() {
  const db: AppDb = makeTestDb();
  const rentalId = S.loadSampleRental(db);
  const rows = A.listApplicants(db, rentalId);
  const id = (first: 'Jordan' | 'Priya' | 'Marcus' | 'Dana') => rows.find((r) => r.fullName.startsWith(first))!.id;
  return { db, rentalId, id };
}

export function clock(start: string) {
  let now = new Date(start);
  return {
    now: () => now,
    advanceHours(h: number) {
      now = new Date(now.getTime() + h * 3_600_000);
    },
  };
}

export function makeDeps(db: AppDb, start = '2026-12-05T10:00:00-05:00', perm: PermissionState = 'granted') {
  const c = clock(start);
  const n = fakeNotifier(perm);
  const deps: DecisionDeps = { db, notifier: n.notifier, now: c.now };
  return { deps, clock: c, notes: n };
}
