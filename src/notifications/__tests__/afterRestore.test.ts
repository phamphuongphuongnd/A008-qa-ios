import { listApplicants } from '@/db/repos/applicants';
import { activeTimer, startTimer } from '@/db/repos/decisions';
import { getSampleRental } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';

import { makeFakeNotifications } from '../adapter';
import { rescheduleAllNotifications } from '../afterRestore';
import type { QueueNotifier } from '../queueTimers';

describe('after a restore', () => {
  it('cancels old notifications, re-schedules running timers (ids saved) and reminders', async () => {
    const db = makeTestDb();
    loadSampleRental(db);
    const rental = getSampleRental(db)!;
    const jordan = listApplicants(db, rental.id)[0];
    const now = new Date('2026-12-05T10:00:00.000-05:00');
    startTimer(db, { applicantId: jordan.id, kind: 'offer', startedAt: '2026-12-05T09:00:00.000-05:00', endsAt: '2026-12-07T09:00:00.000-05:00' });

    const n = makeFakeNotifications();
    await n.adapter.schedule({ id: 'old-timer', title: '', body: '', at: now, channel: 'timers', url: '/' });
    const scheduled: { title: string; data: { url: string } }[] = [];
    const queue: QueueNotifier = {
      schedule: async (x) => {
        scheduled.push(x);
        return `q-${scheduled.length}`;
      },
      cancel: async () => {},
      getPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    };
    await rescheduleAllNotifications(db, n.adapter, queue, now);
    expect(n.scheduled.has('old-timer')).toBe(false);
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled[0].data.url).toBe(`/review/rental/${rental.id}/queue`);
    expect(activeTimer(db, jordan.id)?.notificationIds).toEqual(scheduled.map((_, i) => `q-${i + 1}`));
  });

  it('without permission: only cancels', async () => {
    const db = makeTestDb();
    const n = makeFakeNotifications('denied');
    await n.adapter.schedule({ id: 'x', title: '', body: '', at: new Date(), channel: 'timers', url: '/' });
    await rescheduleAllNotifications(db, n.adapter, {} as QueueNotifier);
    expect(n.scheduled.size).toBe(0);
  });
});
