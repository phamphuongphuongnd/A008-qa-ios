/**
 * Renders a real expo-router tree (ExpoRoot + an in-memory `app/` folder) with jest-expo's own test renderer, so
 * navigation regressions (B-40 / B-47 / B-55) are checked on the actual stack state, not on mocks.
 * The project has no @testing-library/react-native, so `expo-router/testing-library`'s renderRouter cannot be used;
 * this is the same thing with `test-renderer` (shipped with jest-expo).
 */
import 'expo-router/build/testing-library/mocks';

import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { navigationRef } from 'expo-router/build/global-state/navigationRef';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'test-renderer';

export type RouteFiles = Record<string, ComponentType | { default: ComponentType; unstable_settings?: object }>;

type NavState = { routes: { name: string; state?: NavState }[] };

/** Root stack as names, nested navigators as [name, children]: [["(tabs)", ["index"]], "units/[id]/index"]. */
export function stackShape(state: NavState | undefined = navigationRef.getRootState() as unknown as NavState): unknown[] {
  const root = state?.routes[0];
  const top = root?.name === '__root' ? root.state : state;
  return (top?.routes ?? []).map((r) => (r.state ? [r.name, stackShape(r.state as NavState)] : r.name));
}

/** Runs `fn`, then lets the routing queue, redirects and timers settle. */
export async function step(fn: () => void = () => {}): Promise<void> {
  await act(async () => {
    fn();
  });
  await act(async () => {
    jest.runAllTimers();
  });
}

let mounted: Root | null = null;

export async function renderApp(files: RouteFiles, url = '/'): Promise<void> {
  jest.useFakeTimers();
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  const context = getMockContext(files as Parameters<typeof getMockContext>[0]);
  mounted = createRoot();
  await step(() => mounted!.render(<ExpoRoot context={context} location={url} />));
}

export async function unmountApp(): Promise<void> {
  const r = mounted;
  mounted = null;
  if (r) await act(async () => r.unmount());
  jest.useRealTimers();
}
