import { startTimer } from '@/engine';

import { fakeNotifier } from '@/features/decision/testing/helpers';

import { cancelStoppedTimers, cancelTimerNotifications, ensureTimerPermission, scheduleTimerNotifications, TIMER_NOTIFICATION_BODY } from '../queueTimers';

const applicant = { id: '7', fullName: 'Jordan Ellis' };

describe('queueTimers', () => {
  it('schedules 2 h-left and ended notifications that open the order queue', async () => {
    const n = fakeNotifier();
    const timer = startTimer('missing_info', '2026-12-05T23:30:00-05:00');
    const ids = await scheduleTimerNotifications(n.notifier, { timer, applicant, rentalId: 3, now: '2026-12-05T23:30:00-05:00' });
    expect(ids).toEqual(['n1', 'n2']);
    const list = [...n.scheduled.values()];
    // 72 h across midnight: ends Dec 9 04:30 UTC; reminder 2 h earlier.
    expect(list.map((x) => [x.title, x.at.toISOString(), x.data.url, x.data.key])).toEqual([
      ['Jordan Ellis — 2 hours left to provide missing info', '2026-12-09T02:30:00.000Z', '/review/rental/3/queue', '7:missing_info:two_hours_left'],
      ['Jordan Ellis — time to provide missing info is up', '2026-12-09T04:30:00.000Z', '/review/rental/3/queue', '7:missing_info:expired'],
    ]);
    expect(list[0]).toMatchObject({ body: TIMER_NOTIFICATION_BODY });
  });

  it('skips moments already past and keeps going when one schedule fails', async () => {
    const n = fakeNotifier();
    const timer = startTimer('offer', '2026-12-05T10:00:00-05:00');
    const late = await scheduleTimerNotifications(n.notifier, { timer, applicant, rentalId: 3, now: '2026-12-07T09:00:00-05:00' });
    expect(late).toHaveLength(1);
    let calls = 0;
    const flaky = {
      ...n.notifier,
      schedule: async () => {
        calls += 1;
        if (calls === 1) throw new Error('limit');
        return 'ok';
      },
    };
    expect(await scheduleTimerNotifications(flaky, { timer, applicant, rentalId: 3, now: '2026-12-05T10:00:00-05:00' })).toEqual(['ok']);
  });

  it('cancels quietly, also ids already gone', async () => {
    const n = fakeNotifier();
    const failing = { ...n.notifier, cancel: async () => Promise.reject(new Error('gone')) };
    await expect(cancelTimerNotifications(failing, ['x'])).resolves.toBeUndefined();
    await cancelTimerNotifications(n.notifier, null);
    await cancelTimerNotifications(n.notifier, ['a', 'b']);
    expect(n.cancelled).toEqual(['a', 'b']);
    await cancelStoppedTimers(n.notifier, [{ notificationIds: ['c'] }, { notificationIds: null }, {}]);
    expect(n.cancelled).toEqual(['a', 'b', 'c']);
  });

  it('asks the permission only the first time', async () => {
    const n = fakeNotifier('undetermined');
    let asked = false;
    const settings = {
      get asked() {
        return asked;
      },
      markAsked: () => {
        asked = true;
      },
    };
    expect(await ensureTimerPermission(n.notifier, settings)).toBe('granted');
    expect(asked).toBe(true);
    const m = fakeNotifier('undetermined');
    expect(await ensureTimerPermission(m.notifier, { asked: true, markAsked: () => undefined })).toBe('undetermined');
    expect(m.askedCount()).toBe(0);
    expect(await ensureTimerPermission(fakeNotifier('denied').notifier, { asked: false, markAsked: () => undefined })).toBe('denied');
  });
});
