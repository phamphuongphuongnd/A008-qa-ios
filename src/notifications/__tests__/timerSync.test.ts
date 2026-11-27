import { listApplicants } from '@/db/repos/applicants';
import { activeTimer, startTimer } from '@/db/repos/decisions';
import { getSampleRental } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import { fakeNotifier } from '@/features/decision/testing/helpers';

import { PRIVATE_TIMER_TITLES } from '../queueTimers';
import { syncTimerNotifications } from '../timerSync';

const NOW = '2026-12-05T10:00:00.000-05:00';

function setup(perm: 'granted' | 'denied' = 'denied') {
  const db = makeTestDb();
  loadSampleRental(db);
  const rental = getSampleRental(db)!;
  const jordan = listApplicants(db, rental.id)[0];
  // A clock started while notifications were off: no notification ids on the row.
  startTimer(db, { applicantId: jordan.id, kind: 'missing_info', startedAt: '2026-12-05T09:00:00.000-05:00', endsAt: '2026-12-08T09:00:00.000-05:00' });
  return { db, jordan, n: fakeNotifier(perm) };
}

describe('First-come clock notifications follow the permission (B-58) and Applicant mode (B-60)', () => {
  it('a clock started without permission gets its notifications once the permission is granted', async () => {
    const { db, jordan, n } = setup('denied');
    expect(await syncTimerNotifications(db, n.notifier, { now: NOW })).toEqual({ scheduled: 0, cleared: 0 });
    expect(n.scheduled.size).toBe(0);

    n.setPermission('granted');
    expect(await syncTimerNotifications(db, n.notifier, { now: NOW })).toMatchObject({ scheduled: 1 });
    expect([...n.scheduled.values()].map((x) => x.title)).toEqual([
      `${jordan.fullName} — 2 hours left to provide missing info`,
      `${jordan.fullName} — time to provide missing info is up`,
    ]);
    expect(activeTimer(db, jordan.id)!.notificationIds).toEqual(['n1', 'n2']);

    // Coming back to the foreground again schedules nothing twice.
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    expect(n.scheduled.size).toBe(2);
  });

  it('two syncs at once (foreground + a clock just started) never double-schedule', async () => {
    const { db, n } = setup('granted');
    await Promise.all([syncTimerNotifications(db, n.notifier, { now: NOW }), syncTimerNotifications(db, n.notifier, { now: NOW })]);
    expect(n.scheduled.size).toBe(2);
  });

  it('permission revoked → cancelled and forgotten, so they come back when it is granted again', async () => {
    const { db, jordan, n } = setup('granted');
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    n.setPermission('denied');
    expect(await syncTimerNotifications(db, n.notifier, { now: NOW })).toMatchObject({ cleared: 1 });
    expect(n.scheduled.size).toBe(0);
    expect(activeTimer(db, jordan.id)!.notificationIds).toEqual([]);
    n.setPermission('granted');
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    expect(n.scheduled.size).toBe(2);
  });

  it('Settings › Reminders › timers off → no clock notifications', async () => {
    const { db, n } = setup('granted');
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    updateSettings(db, { reminders: { backup: true, cleanup: true, timers: false } });
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    expect(n.scheduled.size).toBe(0);
  });

  it('Applicant mode: re-scheduled without the applicant name, and with it again after', async () => {
    const { db, jordan, n } = setup('granted');
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    n.setPrivate(true);
    await syncTimerNotifications(db, n.notifier, { now: NOW, force: true });
    const titles = [...n.scheduled.values()].map((x) => x.title);
    expect(titles).toEqual([PRIVATE_TIMER_TITLES.two_hours_left, PRIVATE_TIMER_TITLES.expired]);
    expect(titles.join(' ')).not.toContain(jordan.fullName.split(' ')[0]);
    expect(n.cancelled).toEqual(['n1', 'n2']);
    n.setPrivate(false);
    await syncTimerNotifications(db, n.notifier, { now: NOW, force: true });
    expect([...n.scheduled.values()].map((x) => x.title)[0]).toContain(jordan.fullName);
    expect(n.scheduled.size).toBe(2);
  });

  it('without exact alarms the reminder says "about 2 hours"; allowing them later re-schedules on time', async () => {
    const { db, jordan, n } = setup('granted');
    n.setExact(false);
    await syncTimerNotifications(db, n.notifier, { now: NOW });
    expect([...n.scheduled.values()].map((x) => x.title)).toEqual([
      `${jordan.fullName} — about 2 hours left to provide missing info`,
      `${jordan.fullName} — time to provide missing info is up`,
    ]);
    // The landlord allows "Alarms & reminders" in system settings → next foreground sync (no force) re-schedules.
    n.setExact(true);
    expect(await syncTimerNotifications(db, n.notifier, { now: NOW })).toMatchObject({ scheduled: 1 });
    expect(n.cancelled).toEqual(['n1', 'n2']);
    expect([...n.scheduled.values()].map((x) => x.title)[0]).toBe(`${jordan.fullName} — 2 hours left to provide missing info`);
    // Nothing changes → nothing re-scheduled.
    expect(await syncTimerNotifications(db, n.notifier, { now: NOW })).toMatchObject({ scheduled: 0 });
  });

  it('Applicant mode without exact alarms: no name, still "about"', async () => {
    const { db, n } = setup('granted');
    n.setExact(false);
    n.setPrivate(true);
    await syncTimerNotifications(db, n.notifier, { now: NOW, force: true });
    expect([...n.scheduled.values()].map((x) => x.title)).toEqual(['A first-come clock has about 2 hours left', PRIVATE_TIMER_TITLES.expired]);
  });

  it('moments already past are not scheduled (clock ran out while notifications were off)', async () => {
    const { db, n } = setup('granted');
    await syncTimerNotifications(db, n.notifier, { now: '2026-12-08T08:00:00.000-05:00' });
    expect([...n.scheduled.values()].map((x) => x.title)).toHaveLength(1);
  });
});
