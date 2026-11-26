/**
 * Applicant mode state machine (F-05, S-08a / S-08 / S-08b): start → form (parts 1–5) → sign (part 6) → review (7)
 * → done. Leaving is only possible through the landlord's lock: "Landlord" → authenticating → (draft kept?) confirm →
 * off. From "done", 3 taps or a timeout → authenticating → off (nothing left to confirm).
 * Pure: the store (./store.ts) holds the state, screens dispatch events, ./guard.ts keeps the router inside.
 */
import { routes } from '@/routes';
import type { Href } from 'expo-router';

import { clampSection, REVIEW_SECTION, SIGN_SECTION, type FormSection } from '../form/model';

export type ModePhase = 'off' | 'start' | 'form' | 'sign' | 'review' | 'done';
/** The landlord-exit overlay: none · waiting for biometrics / device code · "Exit applicant mode?" dialog. */
export type ExitStep = 'none' | 'authenticating' | 'confirm';

export interface ModeState {
  phase: ModePhase;
  rentalId: number | null;
  applicantId: number | null;
  step: FormSection;
  /** Set when submitted (S-08b text). */
  receivedAt: string | null;
  exit: ExitStep;
}

export type ModeEvent =
  | { type: 'ENTER'; rentalId: number }
  /** Draft created (or reopened at `step`). */
  | { type: 'START'; applicantId: number; step?: FormSection }
  | { type: 'GO'; step: FormSection }
  | { type: 'SUBMITTED'; receivedAt: string }
  | { type: 'EXIT_REQUEST' }
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAILED' }
  | { type: 'EXIT_CANCEL' }
  | { type: 'EXIT_CONFIRM' };

export const MODE_OFF: ModeState = { phase: 'off', rentalId: null, applicantId: null, step: 1, receivedAt: null, exit: 'none' };

export const phaseOfStep = (step: FormSection): ModePhase => (step === SIGN_SECTION ? 'sign' : step === REVIEW_SECTION ? 'review' : 'form');
export const isActive = (s: ModeState) => s.phase !== 'off';
const inForm = (p: ModePhase) => p === 'form' || p === 'sign' || p === 'review';

export function modeReducer(s: ModeState, e: ModeEvent): ModeState {
  switch (e.type) {
    case 'ENTER':
      return s.phase === 'off' ? { ...MODE_OFF, phase: 'start', rentalId: e.rentalId } : s;
    case 'START': {
      if (s.phase !== 'start' || s.exit !== 'none') return s;
      const step = clampSection(e.step ?? 1);
      return { ...s, phase: phaseOfStep(step), applicantId: e.applicantId, step };
    }
    case 'GO':
      return inForm(s.phase) && s.exit === 'none' ? { ...s, phase: phaseOfStep(e.step), step: e.step } : s;
    case 'SUBMITTED':
      return s.phase === 'review' ? { ...s, phase: 'done', receivedAt: e.receivedAt, exit: 'none' } : s;
    case 'EXIT_REQUEST':
      return s.phase !== 'off' && s.exit === 'none' ? { ...s, exit: 'authenticating' } : s;
    case 'AUTH_SUCCESS':
      if (s.exit !== 'authenticating') return s;
      // Nothing typed yet, or already submitted: leave at once. Otherwise ask (the draft is kept).
      return s.phase === 'done' || s.applicantId == null ? MODE_OFF : { ...s, exit: 'confirm' };
    case 'AUTH_FAILED':
    case 'EXIT_CANCEL':
      return s.exit === 'none' ? s : { ...s, exit: 'none' };
    case 'EXIT_CONFIRM':
      return s.exit === 'confirm' ? MODE_OFF : s;
  }
}

/** Where the router must be for this state (null when off). */
export function routeForState(s: ModeState): Href | null {
  if (s.phase === 'off' || s.rentalId == null) return null;
  if (s.phase === 'start' || s.applicantId == null) return routes.applicantModeStart(s.rentalId);
  if (s.phase === 'done') return routes.applicantModeDone(s.applicantId);
  return routes.applicantModeForm(s.applicantId, s.step);
}

/** Where the landlord lands after leaving (S-06 hub of the rental). */
export function exitRoute(prev: ModeState): Href {
  return prev.rentalId != null ? routes.rentalHub(prev.rentalId) : routes.rentals();
}

/** S-08b: 3 taps within this window ask for the landlord's lock; or after DONE_IDLE_MS without a touch. */
export const DONE_TAP_COUNT = 3;
export const DONE_TAP_WINDOW_MS = 1500;
export const DONE_IDLE_MS = 60_000;

/** Tap times kept in the window; `trigger` when the 3rd tap lands. */
export function registerTap(taps: readonly number[], now: number): { taps: number[]; trigger: boolean } {
  const kept = [...taps.filter((t) => now - t <= DONE_TAP_WINDOW_MS), now];
  return kept.length >= DONE_TAP_COUNT ? { taps: [], trigger: true } : { taps: kept, trigger: false };
}
