/**
 * Hooks for S-21…S-24 and the root layout (theme, onboarding / App lock gates).
 * DB-reading hooks are 'use no memo' (fact react-compiler-use-no-memo).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { db, useLive } from '@/db';
import { listCleanupCandidates } from '@/db/repos/rentals';
import { getSettings, updateSettings, type AppSettings } from '@/db/repos/settings';

import type { AuthCapability } from './lock';
import { lockStore } from './lockController';
import { expoAuthAdapter } from './lockNative';

/** All settings, refreshed on every write to the settings table. */
export function useSettings(): AppSettings {
  'use no memo';
  return useLive(() => getSettings(db), [], ['settings']);
}

/** Write some settings (whole value per key). */
export function saveSettings(patch: Partial<AppSettings>): void {
  updateSettings(db, patch);
}

/** S-21 Appearance for the theme provider (1D): 'system' | 'light' | 'dark'. */
export function useThemePreference(): AppSettings['theme'] {
  'use no memo';
  return useSettings().theme;
}

/** Root layout gate: false until S-01 is finished (onboarded + "Not legal advice" accepted). */
export function useOnboarded(): boolean {
  'use no memo';
  const s = useSettings();
  return s.onboarded && !!s.legalAcceptedAt;
}

/** Closed rentals still holding not-selected applicants' data (S-21 row "2 rentals", S-24 list). */
export function useCleanupCandidates() {
  'use no memo';
  return useLive(() => listCleanupCandidates(db), [], ['rentals', 'applicants']);
}

/** What this phone offers for unlocking; re-read when the app comes back (the landlord may have set a passcode). */
export function useAuthCapability(): AuthCapability | null {
  const [cap, setCap] = useState<AuthCapability | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      expoAuthAdapter.capability().then((c) => {
        if (alive) setCap(c);
      });
    read();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return cap;
}

export const isIos = Platform.OS === 'ios';

/**
 * Root layout App lock gate (TODO(merge 2E): `app/_layout.tsx` renders the lock screen over the stack while `locked`).
 * Locks at start when App lock is on, and on return from the background after "Lock after".
 */
export function useAppLockGate(): { locked: boolean; pinBlockedUntil: number } {
  'use no memo';
  const settings = useSettings();
  const state = useSyncExternalStore(lockStore.subscribe, lockStore.get);
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  });

  useEffect(() => {
    lockStore.dispatch({ type: 'start', settings: latest.current });
    const sub = AppState.addEventListener('change', (s) => {
      const now = Date.now();
      if (s === 'background') lockStore.dispatch({ type: 'background', now });
      else if (s === 'active') lockStore.dispatch({ type: 'foreground', now, settings: latest.current });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!settings.appLock) lockStore.dispatch({ type: 'disabled' });
  }, [settings.appLock]);

  return { locked: state.locked, pinBlockedUntil: state.pinBlockedUntil };
}
