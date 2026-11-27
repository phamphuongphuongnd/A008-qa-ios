/**
 * B-120: S-27 Delete all → S-01 at once, on the whole chain: the real settings rows, `useOnboarded()` (useLive) and the
 * root stack's onboarding guard. On the phone `DELETE FROM settings` is SQLite's truncate optimization: no change
 * event reaches useLive — here the expo-sqlite listener never fires either, so only an explicit announcement after
 * the delete can flip the gate. Before the fix the app stayed on an empty S-02 with its tabs until a restart.
 */
import { router } from 'expo-router';

import { updateSettings } from '@/db/repos/settings';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import { GATED_SCREENS, OnboardingRoute, ROOT_STACK_SETTINGS, RootNavigator } from '@/navigation/RootNavigator';
import { renderApp, stackShape, step, unmountApp } from '@/navigation/testing/routerHarness';
import { routes } from '@/routes';

import TabsLayout from '../../../../app/(tabs)/_layout';
import { deleteEverything } from '../dataCleanup';
import { useOnboarded } from '../hooks';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
// The phone's change listener stays silent for a truncate; in Jest it never fires at all.
jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: () => ({ remove() {} }) }));
jest.mock('@/db', () => {
  const { makeTestDb: make } = jest.requireActual('@/db/testing/testDb');
  return { ...jest.requireActual('@/db/useLive'), db: make() };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db } = require('@/db') as { db: ReturnType<typeof makeTestDb> };

function RootLayout() {
  return <RootNavigator onboarded={useOnboarded()} />;
}
const Null = () => null;
const files = {
  _layout: { default: RootLayout, unstable_settings: ROOT_STACK_SETTINGS },
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Null,
  '(tabs)/guide': Null,
  '(tabs)/settings': Null,
  ...Object.fromEntries(GATED_SCREENS.map((name) => [name, Null])),
  'applicants/add': Null,
  'review/applicant/[id]/decision': Null,
  'applicants/mode/start/[rentalId]': Null,
  'applicants/mode/form/[id]': Null,
  'applicants/mode/done/[id]': Null,
  '+not-found': Null,
  'onboarding/index': () => (
    <OnboardingRoute>
      <Null />
    </OnboardingRoute>
  ),
};

afterEach(unmountApp);

it('S-27 Delete all → S-01 alone, without a restart (B-120)', async () => {
  updateSettings(db, { onboarded: true, legalAcceptedAt: '2026-11-27T10:00:00.000Z' });
  await renderApp(files, '/settings');
  await step(() => router.push(routes.deleteAll()));
  expect(stackShape()).toEqual([['(tabs)', ['settings']], 'settings/delete-all']);

  // What DeleteAllScreen does.
  await step(() => {
    void deleteEverything(db, makeTestFiles()).then(() => router.dismissTo(routes.rentals()));
  });
  await step();
  expect(stackShape()).toEqual(['onboarding/index']);
  expect(router.canGoBack()).toBe(false);
});
