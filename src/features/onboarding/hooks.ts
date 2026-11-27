/**
 * S-01 screen state: pages + tick (reducer) and the two finish buttons. On finish the root stack's guard leaves S-01;
 * the screen only passes `result.next` to `landAfterOnboarding` (B-40).
 */
import { useReducer, useState } from 'react';

import { db } from '@/db';
import { fileStore } from '@/files';
import { refreshReminders } from '@/notifications';

import { INITIAL_ONBOARDING, canFinish, finishOnboarding, onboardingReducer, removeSample, showsSkip, type FinishResult } from './onboarding';

export function useOnboardingFlow() {
  const [state, dispatch] = useReducer(onboardingReducer, INITIAL_ONBOARDING);
  const [busy, setBusy] = useState<false | 'start' | 'sample'>(false);
  const finish = (withSample: boolean): FinishResult | null => {
    if (!canFinish(state) || busy) return null;
    setBusy(withSample ? 'sample' : 'start');
    try {
      return finishOnboarding(db, { accepted: state.accepted, withSample });
    } finally {
      setBusy(false);
      refreshReminders();
    }
  };
  return {
    state,
    dispatch,
    busy,
    showsSkip: showsSkip(state),
    canFinish: canFinish(state),
    /** "Get started". */
    getStarted: () => finish(false),
    /** "Explore with a sample rental". */
    explore: () => finish(true),
  };
}

/** S-21 "Remove sample rental". */
export function removeSampleRental(): void {
  removeSample(db, fileStore);
  refreshReminders();
}
