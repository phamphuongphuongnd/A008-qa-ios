import { getApplicant, listApplicants } from '@/db/repos/applicants';
import { loadSampleRental } from '@/db/repos/sample';
import { updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import type { AppDb } from '@/db/types';
import { routes } from '@/routes';

import { enterApplicantMode, startApplicantForm, submitInApplicantMode } from '../applicantMode/actions';
import { checkCanEnter, isPinShape, unlockLandlord, unlockWithPin, type LocalAuthAdapter, type SecurityLevel } from '../applicantMode/auth';
import { canAccessApplicant, guardRedirect, isAllowedPath } from '../applicantMode/guard';
import { exitRoute, MODE_OFF, modeReducer, registerTap, routeForState, type ModeEvent, type ModeState } from '../applicantMode/machine';
import {
  dispatchApplicantMode,
  getApplicantMode,
  hydrateApplicantMode,
  isApplicantModeActive,
  resetApplicantModeForTests,
  subscribeApplicantMode,
  type ModePersistence,
} from '../applicantMode/store';
import { emptyResidence } from '../form/model';
import { loadApplication, saveSignature } from '../form/service';

const run = (events: ModeEvent[], from: ModeState = MODE_OFF) => events.reduce(modeReducer, from);

function auth(level: SecurityLevel, result: { success: true } | { success: false; error: string } = { success: true }): LocalAuthAdapter & { calls: number } {
  const a = {
    calls: 0,
    securityLevel: async () => level,
    authenticate: async () => {
      a.calls++;
      return result;
    },
  };
  return a;
}

describe('applicant mode machine', () => {
  it('start → form → sign → review → done', () => {
    let s = run([{ type: 'ENTER', rentalId: 7 }]);
    expect(s).toMatchObject({ phase: 'start', rentalId: 7, applicantId: null });
    s = run([{ type: 'START', applicantId: 42 }], s);
    expect(s).toMatchObject({ phase: 'form', step: 1, applicantId: 42 });
    s = run([{ type: 'GO', step: 6 }], s);
    expect(s.phase).toBe('sign');
    s = run([{ type: 'GO', step: 7 }], s);
    expect(s.phase).toBe('review');
    s = run([{ type: 'SUBMITTED', receivedAt: 't' }], s);
    expect(s).toMatchObject({ phase: 'done', receivedAt: 't' });
  });

  it('ignores events out of order', () => {
    expect(run([{ type: 'START', applicantId: 1 }])).toBe(MODE_OFF);
    const form = run([{ type: 'ENTER', rentalId: 7 }, { type: 'START', applicantId: 42 }]);
    expect(run([{ type: 'SUBMITTED', receivedAt: 't' }], form)).toBe(form); // only from review
    expect(run([{ type: 'ENTER', rentalId: 9 }], form)).toBe(form);
    const done = run([{ type: 'GO', step: 7 }, { type: 'SUBMITTED', receivedAt: 't' }], form);
    expect(run([{ type: 'GO', step: 3 }], done)).toBe(done); // no editing after Submit
  });

  it('exit needs authentication; a draft asks to confirm and is kept', () => {
    const form = run([{ type: 'ENTER', rentalId: 7 }, { type: 'START', applicantId: 42, step: 3 }]);
    expect(form.step).toBe(3);
    const authing = run([{ type: 'EXIT_REQUEST' }], form);
    expect(authing.exit).toBe('authenticating');
    expect(run([{ type: 'GO', step: 4 }], authing)).toBe(authing); // form frozen meanwhile
    expect(run([{ type: 'AUTH_FAILED' }], authing).exit).toBe('none');
    const confirm = run([{ type: 'AUTH_SUCCESS' }], authing);
    expect(confirm.exit).toBe('confirm');
    expect(run([{ type: 'EXIT_CANCEL' }], confirm)).toMatchObject({ phase: 'form', exit: 'none' });
    expect(run([{ type: 'EXIT_CONFIRM' }], confirm)).toBe(MODE_OFF);
    // EXIT_CONFIRM without auth does nothing.
    expect(run([{ type: 'EXIT_CONFIRM' }], form)).toBe(form);
    expect(run([{ type: 'AUTH_SUCCESS' }], form)).toBe(form);
  });

  it('from done or before Start, a successful unlock leaves at once', () => {
    const start = run([{ type: 'ENTER', rentalId: 7 }]);
    expect(run([{ type: 'EXIT_REQUEST' }, { type: 'AUTH_SUCCESS' }], start)).toBe(MODE_OFF);
    const done = run([{ type: 'START', applicantId: 1 }, { type: 'GO', step: 7 }, { type: 'SUBMITTED', receivedAt: 't' }], start);
    expect(run([{ type: 'EXIT_REQUEST' }, { type: 'AUTH_SUCCESS' }], done)).toBe(MODE_OFF);
  });

  it('routes for each state; exit lands on the rental hub', () => {
    const start = run([{ type: 'ENTER', rentalId: 7 }]);
    expect(routeForState(MODE_OFF)).toBeNull();
    expect(routeForState(start)).toBe(routes.applicantModeStart(7));
    const form = run([{ type: 'START', applicantId: 42 }, { type: 'GO', step: 3 }], start);
    expect(routeForState(form)).toBe(routes.applicantModeForm(42, 3));
    expect(routeForState(run([{ type: 'GO', step: 7 }, { type: 'SUBMITTED', receivedAt: 't' }], form))).toBe(routes.applicantModeDone(42));
    expect(exitRoute(form)).toBe(routes.rentalHub(7));
    expect(exitRoute(MODE_OFF)).toBe(routes.rentals());
  });

  it('S-08b: three taps within 1.5 s trigger the unlock', () => {
    let r = registerTap([], 0);
    r = registerTap(r.taps, 500);
    expect(r.trigger).toBe(false);
    expect(registerTap(r.taps, 900).trigger).toBe(true);
    // Slow taps never trigger.
    expect(registerTap(registerTap(registerTap([], 0).taps, 2000).taps, 4000).trigger).toBe(false);
  });
});

describe('applicant mode guard', () => {
  const form = run([{ type: 'ENTER', rentalId: 7 }, { type: 'START', applicantId: 42 }]);

  it('allows everything while off', () => {
    expect(isAllowedPath('/', MODE_OFF)).toBe(true);
    expect(guardRedirect('/review/applicant/3', MODE_OFF)).toBeNull();
  });

  it("keeps the applicant on this session's own screens", () => {
    expect(isAllowedPath('/applicants/mode/form/42', form)).toBe(true);
    expect(isAllowedPath('/applicants/mode/form/42?section=3', form)).toBe(true);
    for (const p of ['/', '/settings', '/guide', '/units/7', '/review/applicant/42', '/applicants/42/form', '/applicants/mode/form/43', '/applicants/mode/start/7', '/applicants/mode/done/42'])
      expect(guardRedirect(p, form)).toBe(routes.applicantModeForm(42, 1));
    const start = run([{ type: 'ENTER', rentalId: 7 }]);
    expect(isAllowedPath('/applicants/mode/start/7', start)).toBe(true);
    expect(guardRedirect('/applicants/mode/start/8', start)).toBe(routes.applicantModeStart(7));
    const done = run([{ type: 'GO', step: 7 }, { type: 'SUBMITTED', receivedAt: 't' }], form);
    expect(isAllowedPath('/applicants/mode/done/42', done)).toBe(true);
    expect(guardRedirect('/applicants/mode/form/42', done)).toBe(routes.applicantModeDone(42));
  });

  it('data access only to the session applicant', () => {
    expect(canAccessApplicant(MODE_OFF, 3)).toBe(true);
    expect(canAccessApplicant(form, 42)).toBe(true);
    expect(canAccessApplicant(form, 3)).toBe(false);
    expect(canAccessApplicant(form, null)).toBe(false);
  });
});

describe('applicant mode store', () => {
  beforeEach(() => resetApplicantModeForTests());

  it('dispatches, notifies and persists an active session (without the exit overlay)', () => {
    const saved: (ModeState | null)[] = [];
    const p: ModePersistence = { load: () => null, save: (s) => saved.push(s) };
    resetApplicantModeForTests(p);
    let calls = 0;
    const off = subscribeApplicantMode(() => calls++);
    dispatchApplicantMode({ type: 'ENTER', rentalId: 7 });
    dispatchApplicantMode({ type: 'EXIT_REQUEST' });
    expect(isApplicantModeActive()).toBe(true);
    expect(saved[1]).toMatchObject({ phase: 'start', exit: 'none' });
    dispatchApplicantMode({ type: 'START', applicantId: 1 }); // ignored while authenticating → no notify
    expect(calls).toBe(2);
    dispatchApplicantMode({ type: 'AUTH_SUCCESS' });
    expect(saved[saved.length - 1]).toBeNull();
    expect(isApplicantModeActive()).toBe(false);
    off();
  });

  it('a restart restores the session locked (no way out without the lock)', () => {
    const state = run([{ type: 'ENTER', rentalId: 7 }, { type: 'START', applicantId: 42 }, { type: 'EXIT_REQUEST' }]);
    const s = hydrateApplicantMode({ load: () => state, save: () => undefined });
    expect(s).toMatchObject({ phase: 'form', applicantId: 42, exit: 'none' });
    expect(getApplicantMode()).toBe(s);
    expect(hydrateApplicantMode({ load: () => null, save: () => undefined })).toBe(MODE_OFF);
  });
});

describe('landlord lock', () => {
  it('can enter only with a phone lock or an app PIN', async () => {
    expect(await checkCanEnter(auth('biometric_strong'), { appPinSet: false })).toEqual({ ok: true, method: 'device' });
    expect(await checkCanEnter(auth('secret'), { appPinSet: false })).toEqual({ ok: true, method: 'device' });
    expect(await checkCanEnter(auth('none'), { appPinSet: true })).toEqual({ ok: true, method: 'app_pin' });
    expect(await checkCanEnter(auth('none'), { appPinSet: false })).toEqual({ ok: false, reason: 'set_app_pin' });
    const broken: LocalAuthAdapter = { securityLevel: () => Promise.reject(new Error('x')), authenticate: async () => ({ success: true }) };
    expect(await checkCanEnter(broken, { appPinSet: false })).toEqual({ ok: false, reason: 'set_app_pin' });
  });

  it('unlock: ok / cancelled / failed / needs PIN', async () => {
    const opts = { promptMessage: 'p' };
    expect(await unlockLandlord(auth('biometric_weak'), opts)).toBe('ok');
    expect(await unlockLandlord(auth('secret', { success: false, error: 'user_cancel' }), opts)).toBe('cancelled');
    expect(await unlockLandlord(auth('secret', { success: false, error: 'lockout' }), opts)).toBe('failed');
    const none = auth('none');
    expect(await unlockLandlord(none, opts)).toBe('needs_app_pin');
    expect(none.calls).toBe(0);
    const throws: LocalAuthAdapter = { securityLevel: async () => 'secret', authenticate: () => Promise.reject(new Error('x')) };
    expect(await unlockLandlord(throws, opts)).toBe('failed');
  });

  it('app PIN: 4–6 digits, checked by the verifier (none accepted until 2E is merged)', async () => {
    expect(isPinShape('123')).toBe(false);
    expect(isPinShape('1234')).toBe(true);
    expect(isPinShape('1234567')).toBe(false);
    expect(await unlockWithPin('1234')).toBe('failed');
    expect(await unlockWithPin('1234', async (p) => p === '1234')).toBe('ok');
    expect(await unlockWithPin('12a4', async () => true)).toBe('failed');
    expect(await unlockWithPin('1234', () => Promise.reject(new Error('x')))).toBe('failed');
  });
});

describe('applicant mode flow (DB)', () => {
  let db: AppDb;
  let rentalId: number;
  beforeEach(() => {
    resetApplicantModeForTests();
    db = makeTestDb();
    rentalId = loadSampleRental(db);
  });

  it('refuses to start on a phone without any lock', async () => {
    expect(await enterApplicantMode(db, auth('none'), rentalId)).toEqual({ ok: false, reason: 'set_app_pin' });
    expect(isApplicantModeActive()).toBe(false);
    updateSettings(db, { appPinHash: 'salt:hash' });
    expect(await enterApplicantMode(db, auth('none'), rentalId)).toEqual({ ok: true, method: 'app_pin' });
    expect(getApplicantMode().phase).toBe('start');
  });

  it('enter → start a draft → submit only its own applicant → done', async () => {
    await enterApplicantMode(db, auth('biometric_strong'), rentalId);
    const now = new Date(2026, 11, 2, 9, 14);
    const id = startApplicantForm(db, now);
    expect(getApplicant(db, id)).toMatchObject({ draft: true, source: 'applicant_mode', rentalId });
    expect(getApplicantMode()).toMatchObject({ phase: 'form', applicantId: id });

    const other = listApplicants(db, rentalId)[0].id;
    expect(() => submitInApplicantMode(db, other, loadApplication(db, other)!.form)).toThrow();

    const files = {
      saveText: async () => ({ path: `applicants/${id}/signature-${id}.svg`, mime: 'image/svg+xml' }),
      deleteFile: () => undefined,
    };
    const sig = await saveSignature(db, files, id, { kind: 'typed', name: 'Lee Park' }, 'Lee Park', now);
    const form = {
      ...loadApplication(db, id)!.form,
      fullName: 'Lee Park',
      email: 'lee@example.com',
      residences: [{ ...emptyResidence(), address: '1 A St', fromMonth: '2020-01', current: true, type: 'rent' as const }],
      consent: { authorize: true, certify: true },
      signaturePath: sig.ok ? sig.path : null,
      signedName: 'Lee Park',
    };
    const later = new Date(2026, 11, 2, 9, 40);
    const r = submitInApplicantMode(db, id, form, later);
    expect(r.ok).toBe(true);
    expect(getApplicantMode()).toMatchObject({ phase: 'done', applicantId: id });
    expect(getApplicant(db, id)!.draft).toBe(false);
    expect(() => startApplicantForm(db)).toThrow(); // only from the start screen
  });
});
