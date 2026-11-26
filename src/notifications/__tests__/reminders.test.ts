import { createRental, setRentalStatus } from '@/db/repos/rentals';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';

import { makeFakeNotifications } from '../adapter';
import { REMINDER_IDS, ensureNotificationPermission, planReminders, syncReminders, type ReminderInput } from '../reminders';

const day = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 11, 20, 15, 0); // Dec 20, 2026 3 PM local
const ago = (d: number) => new Date(NOW.getTime() - d * day).toISOString();
const input = (over: Partial<ReminderInput['settings']> = {}, rest: Partial<ReminderInput> = {}): ReminderInput => ({
  settings: { reminders: { backup: true, cleanup: true, timers: true }, lastBackupAt: null, cleanupAfterDays: 60, ...over },
  firstDataAt: null,
  closedWithData: [],
  ...rest,
});

describe('planReminders', () => {
  it('backup: 31 days after the last backup at 10:00, text as product.md §6, tap → S-22', () => {
    const [n] = planReminders(input({ lastBackupAt: ago(5) }), NOW);
    expect(n.id).toBe(REMINDER_IDS.backup);
    expect(n.at.getHours()).toBe(10);
    expect(Math.round((n.at.getTime() - new Date(ago(5)).getTime()) / day)).toBe(31);
    expect(n.body).toBe('Time to back up — last backup 31 days ago.');
    expect(n.url).toBe('/settings/backup');
    expect(n.channel).toBe('reminders');
  });

  it('backup already overdue → weekly repeat, never in the past', () => {
    const [n] = planReminders(input({ lastBackupAt: ago(40) }), NOW);
    expect(n.at.getTime()).toBeGreaterThan(NOW.getTime());
    expect(n.at.getTime() - NOW.getTime()).toBeLessThanOrEqual(7 * day);
    expect(n.body).toMatch(/^Time to back up — last backup \d+ days ago\.$/);
  });

  it('never backed up: counts from the first real rental; nothing before any data', () => {
    expect(planReminders(input(), NOW)).toEqual([]);
    const [n] = planReminders(input({}, { firstDataAt: ago(2) }), NOW);
    expect(n.body).toBe("Time to back up — you haven't made a backup yet.");
  });

  it('cleanup: N days after closing, counts rentals due at that time, tap → S-24', () => {
    const plan = planReminders(input({ reminders: { backup: false, cleanup: true, timers: true } }, { closedWithData: [{ closedAt: ago(70) }, { closedAt: ago(65) }, { closedAt: ago(1) }] }), NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].id).toBe(REMINDER_IDS.cleanup);
    expect(plan[0].body).toBe('2 closed rentals still hold applicant data.');
    expect(plan[0].url).toBe('/settings/cleanup');
    expect(plan[0].at.getTime()).toBeGreaterThan(NOW.getTime());

    const single = planReminders(input({ reminders: { backup: false, cleanup: true, timers: true } }, { closedWithData: [{ closedAt: ago(10) }] }), NOW);
    expect(single[0].body).toBe('1 closed rental still holds applicant data.');
    expect(Math.round((single[0].at.getTime() - new Date(ago(10)).getTime()) / day)).toBe(60);
  });

  it('Off settings plan nothing', () => {
    expect(planReminders(input({ cleanupAfterDays: null, reminders: { backup: false, cleanup: true, timers: true } }, { closedWithData: [{ closedAt: ago(90) }], firstDataAt: ago(90) }), NOW)).toEqual([]);
  });
});

describe('syncReminders + permission', () => {
  it('schedules from the database and cancels what is no longer planned', async () => {
    const db = makeTestDb();
    const id = createRental(db, { street: '310 Oak Ct', city: 'Dayton', state: 'OH', zip: '45402', rentCents: 120000 });
    setRentalStatus(db, id, 'closed');
    const n = makeFakeNotifications();
    await syncReminders(db, n.adapter, NOW);
    expect([...n.scheduled.keys()]).toEqual([REMINDER_IDS.backup]); // the closed rental has no applicants

    updateSettings(db, { reminders: { backup: false, cleanup: true, timers: true } });
    await syncReminders(db, n.adapter, NOW);
    expect(n.scheduled.size).toBe(0);
  });

  it('does nothing without permission and never prompts', async () => {
    const db = makeTestDb();
    createRental(db, { street: '1 A St', city: 'X', state: 'OH', zip: '43215', rentCents: 100000 });
    const n = makeFakeNotifications('undetermined');
    const plan = await syncReminders(db, n.adapter, new Date(Date.now() + 40 * day));
    expect(plan).toHaveLength(1);
    expect(n.scheduled.size).toBe(0);
    expect(n.asked()).toBe(0);
  });

  it('asks once', async () => {
    const db = makeTestDb();
    const n = makeFakeNotifications('undetermined');
    n.adapter.requestPermission = async () => 'denied';
    expect(await ensureNotificationPermission(db, n.adapter)).toBe(false);
    expect(getSettings(db).notificationsAsked).toBe(true);
    const spy = jest.spyOn(n.adapter, 'requestPermission');
    expect(await ensureNotificationPermission(db, n.adapter)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    n.setPermission('granted');
    expect(await ensureNotificationPermission(db, n.adapter)).toBe(true);
  });
});
