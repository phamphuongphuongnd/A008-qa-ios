/**
 * B-123: change the system font size (or dark mode, language) while the app is open → Android recreates the Activity:
 * expo-router mounts the new root, THEN unmounts the old one, whose cleanup resets expo-router's global `router` to
 * its "unavailable before the first render" stub. A screen that imported `router` from 'expo-router' then crashed on
 * the first tap (S-02 rental card: "The imperative router is unavailable before the first render has finished").
 * `router` from '@/services/router' follows the tree on screen (RouterBridge, A006 B-23) — every screen must use it.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import { router as globalRouter, Stack } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { act } from 'react';
import { createRoot } from 'test-renderer';

import '@/navigation/testing/routerHarness'; // expo-router's jest mocks

import { router, RouterBridge } from '../router';

function RootLayout() {
  return (
    <>
      <RouterBridge />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
const Null = () => null;
let hubShown = 0;
function RentalHub() {
  hubShown++;
  return null;
}
const files = { _layout: RootLayout, index: Null, 'units/[id]/index': RentalHub };

describe('router after the Activity is recreated (B-123)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
    jest.spyOn(console, 'error').mockImplementation(() => {}); // "multiple navigation containers" while both are up
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('new root first, old root unmounted after: @/services/router still navigates', async () => {
    hubShown = 0;
    const before = createRoot();
    await act(async () => before.render(<ExpoRoot context={getMockContext(files)} location="/" />));
    const after = createRoot();
    await act(async () => after.render(<ExpoRoot context={getMockContext(files)} location="/" />));
    await act(async () => before.unmount());

    // What crashed: expo-router's own global router is back to its stub.
    expect(() => globalRouter.push('/units/1')).toThrow('unavailable before the first render');
    // Tap on a rental card.
    await act(async () => {
      router.push('/units/1');
    });
    await act(async () => {
      jest.runAllTimers();
    });
    // (navigationRef is global too and was cleared by the old root: look at what the new tree rendered.)
    expect(hubShown).toBeGreaterThan(0);
    await act(async () => after.unmount());
  });
});

describe('no screen imports the imperative router from expo-router', () => {
  it('only @/services/router wraps it', () => {
    const root = join(__dirname, '../../..');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) return f === '__tests__' || f === 'testing' ? [] : walk(p);
        return /\.tsx?$/.test(f) ? [p] : [];
      });
    const offenders = [...walk(join(root, 'src')), ...walk(join(root, 'app'))]
      .filter((p) => /import\s*\{[^}]*\brouter\b[^}]*\}\s*from\s*'expo-router'/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p).split(sep).join('/'));
    expect(offenders).toEqual(['src/services/router.tsx']);
  });
});
