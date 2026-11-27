/**
 * B-40: the onboarding gate of the root stack, on a real expo-router tree with the app's RootNavigator and tabs layout.
 * - fresh install / `pm clear` → S-01 alone (Back leaves the app), never S-03;
 * - finishing S-01 → Rentals; "Explore with a sample rental" → [Rentals, S-06];
 * - S-27 Delete all → S-01 alone, whichever comes first (the store update or the navigation);
 * - onboarded: launcher → Rentals; a deep link keeps the tabs underneath.
 */
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { routes } from '@/routes';

import TabsLayout from '../../../app/(tabs)/_layout';
import { landAfterOnboarding } from '../onboardingLanding';
import { ROOT_STACK_SETTINGS, RootNavigator } from '../RootNavigator';
import { renderApp, stackShape, step, unmountApp } from '../testing/routerHarness';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

// Stand-in for the settings store behind useOnboarded().
let onboarded = false;
const listeners = new Set<() => void>();
function setOnboarded(v: boolean) {
  onboarded = v;
  listeners.forEach((l) => l());
}
function RootLayout() {
  const o = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => onboarded,
  );
  return <RootNavigator onboarded={o} />;
}

const Null = () => null;
const files = {
  _layout: { default: RootLayout, unstable_settings: ROOT_STACK_SETTINGS },
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Null,
  '(tabs)/guide': Null,
  '(tabs)/settings': Null,
  'onboarding/index': Null,
  'units/new': Null,
  'units/[id]/index': Null,
  'settings/delete-all': Null,
  'applicants/add': Null,
  'review/applicant/[id]/decision': Null,
  'applicants/mode/start/[rentalId]': Null,
  'applicants/mode/form/[id]': Null,
  'applicants/mode/done/[id]': Null,
  'dev/gallery': Null,
  '+not-found': Null,
};

const TABS_ON = (tab: string) => ['(tabs)', [tab]];

afterEach(unmountApp);

describe('onboarding gate (B-40)', () => {
  it('fresh install opens S-01 alone (not S-03 New rental)', async () => {
    setOnboarded(false);
    await renderApp(files, '/');
    expect(stackShape()).toEqual(['onboarding/index']);
    expect(router.canGoBack()).toBe(false);
  });

  it('"Get started" → Rentals, S-01 gone', async () => {
    setOnboarded(false);
    await renderApp(files, '/');
    await step(() => {
      landAfterOnboarding(routes.rentals());
      setOnboarded(true);
    });
    expect(stackShape()).toEqual([TABS_ON('index')]);
  });

  it('"Explore with a sample rental" → S-06 above Rentals (Back → Rentals)', async () => {
    setOnboarded(false);
    await renderApp(files, '/');
    landAfterOnboarding(routes.rentalHub(1));
    // The settings store reports the change a beat after the tap.
    await step(() => setOnboarded(true));
    expect(stackShape()).toEqual([TABS_ON('index'), 'units/[id]/index']);
    await step(() => router.back());
    expect(stackShape()).toEqual([TABS_ON('index')]);
  });

  it.each([
    ['store first', true],
    ['navigation first', false],
  ])('S-27 Delete all → S-01 alone (%s)', async (_label, storeFirst) => {
    setOnboarded(true);
    await renderApp(files, '/settings');
    await step(() => router.push(routes.deleteAll()));
    expect(stackShape()).toEqual([TABS_ON('settings'), 'settings/delete-all']);
    // What DeleteAllScreen does after settingsActions.deleteAll().
    if (storeFirst) {
      await step(() => setOnboarded(false));
      await step(() => router.dismissTo(routes.rentals()));
    } else {
      await step(() => router.dismissTo(routes.rentals()));
      await step(() => setOnboarded(false));
    }
    expect(stackShape()).toEqual(['onboarding/index']);
  });

  it('onboarded: the launcher opens Rentals; a deep link keeps the tabs underneath', async () => {
    setOnboarded(true);
    await renderApp(files, '/');
    expect(stackShape()).toEqual([TABS_ON('index')]);
    await unmountApp();
    await renderApp(files, '/units/1');
    expect(stackShape()).toEqual([TABS_ON('index'), 'units/[id]/index']);
  });
});
