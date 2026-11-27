/**
 * B-55: leaving Applicant mode ("Landlord" → lock → Exit) lands on S-06 ABOVE the tabs, so Back goes to Rentals.
 * It used to `router.replace(S-06)`: after a restart in Applicant mode (stack = the mode screen alone) S-06 became the
 * root of the stack — no tabs, Back "GO_BACK was not handled". Real expo-router tree + the app's mode guard.
 */
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';

import { RootNavigator, ROOT_STACK_SETTINGS } from '@/navigation/RootNavigator';
import { renderApp, stackShape, step, unmountApp } from '@/navigation/testing/routerHarness';
import { routes } from '@/routes';

import type { LocalAuthAdapter } from '../applicantMode/auth';
import { useApplicantModeGuard, useLandlordExit, type LandlordExit } from '../applicantMode/hooks';
import { dispatchApplicantMode, getApplicantMode, hydrateApplicantMode, memoryPersistence } from '../applicantMode/store';

const phoneLockOk: LocalAuthAdapter = {
  securityLevel: async () => 'biometric_strong',
  authenticate: async () => ({ success: true }),
};

let exit: LandlordExit | null = null;
function ModeFormScreen() {
  const e = useLandlordExit(phoneLockOk);
  useEffect(() => {
    exit = e;
  });
  return null;
}
function RootLayout() {
  useApplicantModeGuard();
  return <RootNavigator onboarded />;
}

const Null = () => null;
/** A plain Tabs navigator (the real tab bar pulls in the UI kit). */
function PlainTabs() {
  return (
    <Tabs>
      <Tabs.Screen name="index" />
    </Tabs>
  );
}
const files = {
  _layout: { default: RootLayout, unstable_settings: ROOT_STACK_SETTINGS },
  '(tabs)/_layout': PlainTabs,
  '(tabs)/index': Null,
  'onboarding/index': Null,
  'review/applicant/[id]/decision': Null,
  'dev/gallery': Null,
  '+not-found': Null,
  'units/[id]/index': Null,
  'applicants/add': Null,
  'applicants/mode/start/[rentalId]': Null,
  'applicants/mode/form/[id]': ModeFormScreen,
  'applicants/mode/done/[id]': Null,
};
const RENTALS = ['(tabs)', ['index']];

async function exitThroughLock() {
  await step(() => {
    void exit!.request();
  });
  expect(getApplicantMode().exit).toBe('confirm'); // "Exit applicant mode? The applicant's draft will be kept."
  await step(() => exit!.confirm());
  expect(getApplicantMode().phase).toBe('off');
}

beforeEach(() => {
  exit = null;
  memoryPersistence.save(null);
  hydrateApplicantMode(memoryPersistence);
});
afterEach(unmountApp);

describe('leaving Applicant mode (B-55)', () => {
  it('started from S-06: lands on S-06 above Rentals, Back → Rentals', async () => {
    await renderApp(files, '/');
    await step(() => router.push(routes.rentalHub(1)));
    // S-06 → S-07 (sheet) → Applicant mode start → form, as the app does.
    await step(() => router.push(routes.addApplicant(1)));
    await step(() => {
      dispatchApplicantMode({ type: 'ENTER', rentalId: 1 });
      router.replace(routes.applicantModeStart(1));
    });
    await step(() => {
      dispatchApplicantMode({ type: 'START', applicantId: 5 });
      router.replace(routes.applicantModeForm(5, 1));
    });
    expect(stackShape()).toEqual([RENTALS, 'units/[id]/index', 'applicants/mode/form/[id]']);

    await exitThroughLock();
    expect(stackShape()).toEqual([RENTALS, 'units/[id]/index']);
    await step(() => router.back());
    expect(stackShape()).toEqual([RENTALS]);
  });

  it('restored after a restart (mode screen alone in the stack): same landing', async () => {
    memoryPersistence.save({ phase: 'form', rentalId: 1, applicantId: 5, step: 2, receivedAt: null, exit: 'none' });
    hydrateApplicantMode(memoryPersistence);
    await renderApp(files, '/');
    expect(stackShape()).toEqual(['applicants/mode/form/[id]']);

    await exitThroughLock();
    expect(stackShape()).toEqual([RENTALS, 'units/[id]/index']);
    await step(() => router.back());
    expect(stackShape()).toEqual([RENTALS]);
  });
});
