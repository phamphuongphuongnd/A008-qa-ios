/**
 * Hooks for S-02, S-03, S-06 — thin `useLive` wrappers over rentalQueries / rentalService (tested there).
 * 'use no memo': DB-reading hooks must opt out of React Compiler (fact react-compiler-use-no-memo).
 */
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { countRentals, getRental } from '@/db/repos/rentals';
import { useLive } from '@/db/useLive';
import { fileStore } from '@/files';

import { emptyRentalForm, rentalToForm, type RentalForm } from './rentalForm';
import { loadRentalCards, loadRentalHub, loadRentalsReminders, RENTAL_LIVE_TABLES } from './rentalQueries';
import {
  closeRental,
  createRentalFromForm,
  deleteRentalAndData,
  deleteRentalMessage,
  openSampleRental,
  planReviewModeChange,
  reopenRental,
  updateRentalFromForm,
} from './rentalService';
import type { ReviewMode } from '@/db/schema';

/** S-02 cards of a segment + counts of both segments (to pick the empty state). */
export function useRentals(filter: 'open' | 'closed') {
  'use no memo';
  const cards = useLive(() => loadRentalCards(db, filter), [filter], RENTAL_LIVE_TABLES);
  const counts = useLive(() => countRentals(db), [], ['rentals']);
  return { cards, counts, isEmpty: counts.open + counts.closed === 0 };
}

/** S-02 reminder cards; "Later" hides one for this app session. */
export function useRentalsReminders() {
  'use no memo';
  const r = useLive(() => loadRentalsReminders(db), [], ['settings', 'rentals', 'applicants']);
  const [hidden, setHidden] = useState<{ backup: boolean; cleanup: boolean }>({ backup: false, cleanup: false });
  return {
    backup: hidden.backup ? null : r.backup,
    cleanupCount: hidden.cleanup ? 0 : r.cleanupCount,
    later: (card: 'backup' | 'cleanup') => setHidden((h) => ({ ...h, [card]: true })),
  };
}

/** S-06 data (null = deleted / not found). */
export function useRentalHub(rentalId: number) {
  'use no memo';
  return useLive(() => loadRentalHub(db, rentalId), [rentalId], RENTAL_LIVE_TABLES);
}

/** S-03 initial values: an existing rental's form, or an empty one. `null` = id given but not found. */
export function useRentalForm(rentalId: number | null): RentalForm | null {
  'use no memo';
  return useLive(
    () => {
      if (rentalId === null) return emptyRentalForm();
      const r = getRental(db, rentalId);
      return r ? rentalToForm(r) : null;
    },
    [rentalId],
    ['rentals'],
  );
}

/** Rental actions bound to the app database / file store. */
export function useRentalActions() {
  return {
    create: useCallback((form: RentalForm) => createRentalFromForm(db, form), []),
    update: useCallback(
      (id: number, form: RentalForm, confirmModeChange?: boolean) => updateRentalFromForm(db, id, form, { confirmModeChange }),
      [],
    ),
    planModeChange: useCallback((id: number, to: ReviewMode) => planReviewModeChange(db, id, to), []),
    close: useCallback((id: number) => closeRental(db, id), []),
    reopen: useCallback((id: number) => reopenRental(db, id), []),
    deleteMessage: useCallback((id: number) => deleteRentalMessage(db, id), []),
    remove: useCallback((id: number) => deleteRentalAndData(db, fileStore, id), []),
    openSample: useCallback(() => openSampleRental(db), []),
  };
}
