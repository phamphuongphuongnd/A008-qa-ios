/**
 * S-01 Onboarding (F-01): 3 pages, the required "I understand Evenlease is not legal advice" tick, then
 * "Get started" (empty app) or "Explore with a sample rental" (§8 data via 1C's `loadSampleRental`).
 * Both buttons need the tick — the acceptance time is stored (`legalAcceptedAt`).
 */
import type { Href } from 'expo-router';

import type { FileStore } from '@/db/files';
import { getSampleRental } from '@/db/repos/rentals';
import { loadSampleRental, removeSampleRental } from '@/db/repos/sample';
import { getSettings, updateSettings, type AppSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';
import { t } from '@/i18n';
import { routes } from '@/routes';

export const ONBOARDING_PAGES = 3;
export type OnboardingPage = 0 | 1 | 2;
const LAST: OnboardingPage = 2;

export interface OnboardingState {
  page: OnboardingPage;
  /** "I understand Evenlease is not legal advice". */
  accepted: boolean;
}

export type OnboardingAction =
  | { type: 'next' }
  | { type: 'back' }
  /** Page 1–2 "Skip" → page 3 (the tick can't be skipped). */
  | { type: 'skip' }
  | { type: 'go'; page: OnboardingPage }
  | { type: 'toggleAccepted' };

export const INITIAL_ONBOARDING: OnboardingState = { page: 0, accepted: false };

export function onboardingReducer(s: OnboardingState, a: OnboardingAction): OnboardingState {
  switch (a.type) {
    case 'next':
      return { ...s, page: Math.min(LAST, s.page + 1) as OnboardingPage };
    case 'back':
      return { ...s, page: Math.max(0, s.page - 1) as OnboardingPage };
    case 'skip':
      return { ...s, page: LAST };
    case 'go':
      return { ...s, page: a.page };
    case 'toggleAccepted':
      return { ...s, accepted: !s.accepted };
  }
}

const PAGE_KEYS = ['p1', 'p2', 'p3'] as const;

/** Title + subtitle of a page (product.md S-01 / mockup). */
export function onboardingPageText(page: OnboardingPage): { title: string; subtitle: string } {
  const k = PAGE_KEYS[page];
  return { title: t(`system:s01.pages.${k}.title`), subtitle: t(`system:s01.pages.${k}.subtitle`) };
}

/** "Skip" shows on pages 1–2 only; "Next" on 1–2; the two finish buttons on page 3. */
export const showsSkip = (s: OnboardingState) => s.page < LAST;
/** "Get started" / "Explore with a sample rental" stay disabled until the box is ticked. */
export const canFinish = (s: OnboardingState) => s.page === LAST && s.accepted;

/** Root layout gate: S-01 shows until finished. */
export function needsOnboarding(s: Pick<AppSettings, 'onboarded' | 'legalAcceptedAt'>): boolean {
  return !s.onboarded || !s.legalAcceptedAt;
}

export interface FinishResult {
  /** The sample rental's id when "Explore with a sample rental" was chosen. */
  sampleRentalId: number | null;
  /** Where to land: the sample's Rental hub (above the tabs), or Rentals. See `landAfterOnboarding`. */
  next: Href;
}

/**
 * Records the acceptance and finishes onboarding; with `withSample` loads the §8 sample rental first (one
 * transaction in 1C; already loaded → same id). Throws without the tick.
 */
export function finishOnboarding(db: AppDb, opts: { accepted: boolean; withSample: boolean; at?: string }): FinishResult {
  if (!opts.accepted) throw new Error('legal notice not accepted');
  const sampleRentalId = opts.withSample ? loadSampleRental(db) : null;
  updateSettings(db, { onboarded: true, legalAcceptedAt: opts.at ?? new Date().toISOString() });
  return { sampleRentalId, next: sampleRentalId != null ? routes.rentalHub(sampleRentalId) : routes.rentals() };
}

/** The legal notice was accepted on this phone (a restore keeps the phone's own value). */
export function legalAcceptedAt(db: AppDb): string | null {
  return getSettings(db).legalAcceptedAt;
}

// ---------------------------------------------------------------------------
// Sample rental (S-21 "Load sample rental" / "Remove sample rental")
// ---------------------------------------------------------------------------

export const hasSampleRental = (db: AppDb) => getSampleRental(db) != null;

/** Loads the §8 sample (no-op when present); returns its rental id. */
export const loadSample = (db: AppDb) => loadSampleRental(db);

/** One-tap removal: the sample rental, its applicants and every row hanging off them. */
export const removeSample = (db: AppDb, files: FileStore) => removeSampleRental(db, files);
