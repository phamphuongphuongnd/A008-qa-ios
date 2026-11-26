/**
 * The one Applicant mode session of the app (module store + React hook). Persisted so that killing and reopening the
 * app does not drop the applicant into the landlord's data: on start the layout calls `hydrateApplicantMode()`.
 *
 * Persistence: settings key `applicantMode` (`settingsPersistence(db)` in ./persistence.ts, passed by app/_layout.tsx);
 * Jest and the default before hydration use `memoryPersistence`.
 * 2E reads `isApplicantModeActive()` to hold notifications and the App lock prompt while the applicant has the phone.
 */
import { useSyncExternalStore } from 'react';

import { isActive, MODE_OFF, modeReducer, type ModeEvent, type ModeState } from './machine';

export interface ModePersistence {
  load(): ModeState | null;
  save(state: ModeState | null): void;
}

let memory: ModeState | null = null;
export const memoryPersistence: ModePersistence = {
  load: () => memory,
  save: (s) => {
    memory = s;
  },
};

let persistence: ModePersistence = memoryPersistence;
let state: ModeState = MODE_OFF;
const listeners = new Set<() => void>();

function set(next: ModeState) {
  if (next === state) return;
  state = next;
  // The exit overlay is not persisted: a restart during "authenticating" comes back locked.
  persistence.save(isActive(next) ? { ...next, exit: 'none' } : null);
  listeners.forEach((l) => l());
}

export function getApplicantMode(): ModeState {
  return state;
}

export function dispatchApplicantMode(e: ModeEvent): ModeState {
  set(modeReducer(state, e));
  return state;
}

export function subscribeApplicantMode(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function isApplicantModeActive(): boolean {
  return isActive(state);
}

/** App start: restore a session that was on when the app was closed. */
export function hydrateApplicantMode(p: ModePersistence = persistence): ModeState {
  persistence = p;
  const saved = p.load();
  state = saved && isActive(saved) ? { ...saved, exit: 'none' } : MODE_OFF;
  listeners.forEach((l) => l());
  return state;
}

/** Tests only. */
export function resetApplicantModeForTests(p: ModePersistence = memoryPersistence) {
  memory = null;
  persistence = p;
  state = MODE_OFF;
  listeners.clear();
}

/** `const [mode, dispatch] = useApplicantMode()`. */
export function useApplicantMode(): [ModeState, (e: ModeEvent) => ModeState] {
  const s = useSyncExternalStore(subscribeApplicantMode, getApplicantMode, getApplicantMode);
  return [s, dispatchApplicantMode];
}
