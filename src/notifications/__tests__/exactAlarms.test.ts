import { getSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';

import { ensureExactAlarmPermission, exactAlarmsOn, type ExactAlarmAdapter } from '../exactAlarms';

function fake(o: { needs?: boolean; granted?: boolean; explain?: boolean; request?: boolean | 'throw' } = {}) {
  let granted = o.granted ?? false;
  const calls = { explain: 0, request: 0 };
  const adapter: ExactAlarmAdapter = {
    needsPermission: () => o.needs ?? true,
    granted: async () => granted,
    explain: async () => {
      calls.explain += 1;
      return o.explain ?? true;
    },
    request: async () => {
      calls.request += 1;
      if (o.request === 'throw') throw new Error('not declared');
      granted = o.request ?? true;
      return granted;
    },
  };
  return { adapter, calls };
}

describe('exact alarms for First-come reminders (Android 14+ "Alarms & reminders")', () => {
  it('iOS / Android < 12: always on time, never asks', async () => {
    const db = makeTestDb();
    const f = fake({ needs: false });
    expect(await exactAlarmsOn(f.adapter)).toBe(true);
    expect(await ensureExactAlarmPermission(db, f.adapter)).toBe(true);
    expect(f.calls).toEqual({ explain: 0, request: 0 });
    expect(getSettings(db).exactAlarmsAsked).toBe(false);
  });

  it('already allowed (Android 12–13 grant it at install): no question', async () => {
    const db = makeTestDb();
    const f = fake({ granted: true });
    expect(await ensureExactAlarmPermission(db, f.adapter)).toBe(true);
    expect(f.calls.explain).toBe(0);
  });

  it('explains once, then opens the system screen; allowed → on time', async () => {
    const db = makeTestDb();
    const f = fake();
    expect(await exactAlarmsOn(f.adapter)).toBe(false);
    expect(await ensureExactAlarmPermission(db, f.adapter)).toBe(true);
    expect(f.calls).toEqual({ explain: 1, request: 1 });
    expect(getSettings(db).exactAlarmsAsked).toBe(true);
  });

  it('"Not now" → inexact, and never asked again', async () => {
    const db = makeTestDb();
    const f = fake({ explain: false });
    expect(await ensureExactAlarmPermission(db, f.adapter)).toBe(false);
    expect(await ensureExactAlarmPermission(db, f.adapter)).toBe(false);
    expect(f.calls).toEqual({ explain: 1, request: 0 });
  });

  it('declined on the system screen or the request fails → inexact, the app goes on', async () => {
    const db = makeTestDb();
    expect(await ensureExactAlarmPermission(db, fake({ request: false }).adapter)).toBe(false);
    const db2 = makeTestDb();
    expect(await ensureExactAlarmPermission(db2, fake({ request: 'throw' }).adapter)).toBe(false);
  });
});
