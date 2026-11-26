/**
 * React side of Applicant mode.
 * - `useApplicantModeGuard()` — called once in app/_layout.tsx (inside the navigator). Sends the router
 *   back into the session's screen whenever the path is not allowed, and swallows the Android back button while on.
 * - `useLandlordExit()` — what the "Landlord" button and S-08b's triple tap run.
 */
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { t } from '@/i18n';

import { unlockLandlord, type LocalAuthAdapter, type UnlockResult } from './auth';
import { guardRedirect } from './guard';
import { exitRoute, isActive, type ModeState } from './machine';
import { dispatchApplicantMode, getApplicantMode, useApplicantMode } from './store';

export function useApplicantModeGuard(): void {
  const [mode] = useApplicantMode();
  const pathname = usePathname();
  const router = useRouter();
  const target = guardRedirect(pathname, mode);
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const active = isActive(mode);
  useEffect(() => {
    if (!active) return;
    // Inside the form the screen handles Back (previous part); everything else is swallowed.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [active]);
}

export interface LandlordExit {
  /** Runs the system lock. 'ok' moves the machine on (confirm dialog, or straight out). */
  request(): Promise<UnlockResult>;
  /** "Exit" in "Exit applicant mode? The applicant's draft will be kept." */
  confirm(): void;
  cancel(): void;
  /** After `request()` returned 'needs_app_pin' and `unlockWithPin` said 'ok'. */
  pinUnlocked(): void;
}

export function useLandlordExit(adapter: LocalAuthAdapter): LandlordExit {
  const router = useRouter();
  const leave = (prev: ModeState) => router.replace(exitRoute(prev));
  return {
    async request() {
      const prev = getApplicantMode();
      dispatchApplicantMode({ type: 'EXIT_REQUEST' });
      const r = await unlockLandlord(adapter, { promptMessage: t('intake:mode.unlockPrompt'), cancelLabel: t('common:actions.cancel') });
      if (r === 'ok') {
        const next = dispatchApplicantMode({ type: 'AUTH_SUCCESS' });
        if (!isActive(next)) leave(prev);
      } else if (r !== 'needs_app_pin') dispatchApplicantMode({ type: 'AUTH_FAILED' });
      return r;
    },
    confirm() {
      const prev = getApplicantMode();
      const next = dispatchApplicantMode({ type: 'EXIT_CONFIRM' });
      if (!isActive(next)) leave(prev);
    },
    cancel() {
      dispatchApplicantMode({ type: 'EXIT_CANCEL' });
    },
    pinUnlocked() {
      const prev = getApplicantMode();
      const next = dispatchApplicantMode({ type: 'AUTH_SUCCESS' });
      if (!isActive(next)) leave(prev);
    },
  };
}

