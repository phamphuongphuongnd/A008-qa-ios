import { router as globalRouter, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';

type AppRouter = ReturnType<typeof useRouter>;

let current: AppRouter | null = null;

/**
 * Keeps `router` below pointing at the navigator that is on screen now.
 *
 * Why (A006 B-23): when Android recreates the Activity (font size / dark mode / language change), expo-router mounts the
 * new root and only then unmounts the old one; the old root's cleanup resets expo-router's global `router` to its
 * "unavailable before the first render" stub, so the first tap that navigates crashes the app. `useRouter()` is bound
 * to its own tree through context and is not touched by that cleanup.
 */
export function RouterBridge() {
  const r = useRouter();
  useLayoutEffect(() => {
    current = r;
    return () => {
      if (current === r) current = null;
    };
  }, [r]);
  return null;
}

/** Drop-in for expo-router's `router`: use this everywhere instead of `import { router } from 'expo-router'`. */
export const router: AppRouter = new Proxy({} as AppRouter, {
  get: (_target, key) => {
    const target = (current ?? globalRouter) as unknown as Record<PropertyKey, unknown>;
    return target[key];
  },
});
