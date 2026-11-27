/* B-151: the exact-alarm question goes through the app's own dialog (host + store), not the system Alert. */
import { makeTestDb } from '@/db/testing/testDb';
import { getSettings } from '@/db/repos/settings';

import { answerExactAlarmPrompt, askExactAlarmPrompt, isExactAlarmPromptOpen, subscribeExactAlarmPrompt } from '../exactAlarmPrompt';
import { ensureExactAlarmPermission, type ExactAlarmAdapter } from '../exactAlarms';

/** Lets the ask-once flow reach the dialog (a few awaits: permission check, settings write). */
async function untilOpen() {
  for (let i = 0; i < 50 && !isExactAlarmPromptOpen(); i++) await new Promise((r) => setImmediate(r));
}

describe('exact-alarm prompt (app dialog)', () => {
  it('opens, notifies the host, and resolves with the answer', async () => {
    let renders = 0;
    const off = subscribeExactAlarmPrompt(() => (renders += 1));
    const asked = askExactAlarmPrompt();
    expect(isExactAlarmPromptOpen()).toBe(true);
    answerExactAlarmPrompt(true);
    await expect(asked).resolves.toBe(true);
    expect(isExactAlarmPromptOpen()).toBe(false);
    expect(renders).toBe(2);
    off();
  });

  it('a second question while open answers the first "Not now"', async () => {
    const first = askExactAlarmPrompt();
    const second = askExactAlarmPrompt();
    await expect(first).resolves.toBe(false);
    answerExactAlarmPrompt(false);
    await expect(second).resolves.toBe(false);
  });

  it('drives the ask-once rule: Not now → no system screen, never asked again', async () => {
    const db = makeTestDb();
    let requests = 0;
    const adapter: ExactAlarmAdapter = {
      needsPermission: () => true,
      granted: async () => false,
      explain: askExactAlarmPrompt,
      request: async () => {
        requests += 1;
        return true;
      },
    };
    const result = ensureExactAlarmPermission(db, adapter);
    await untilOpen();
    expect(isExactAlarmPromptOpen()).toBe(true);
    answerExactAlarmPrompt(false);
    await expect(result).resolves.toBe(false);
    expect(requests).toBe(0);
    expect(getSettings(db).exactAlarmsAsked).toBe(true);
    await expect(ensureExactAlarmPermission(db, adapter)).resolves.toBe(false);
    expect(isExactAlarmPromptOpen()).toBe(false);
  });

  it('Allow → opens the system screen', async () => {
    const db = makeTestDb();
    let requests = 0;
    const adapter: ExactAlarmAdapter = {
      needsPermission: () => true,
      granted: async () => false,
      explain: askExactAlarmPrompt,
      request: async () => {
        requests += 1;
        return true;
      },
    };
    const result = ensureExactAlarmPermission(db, adapter);
    await untilOpen();
    answerExactAlarmPrompt(true);
    await expect(result).resolves.toBe(true);
    expect(requests).toBe(1);
  });
});
