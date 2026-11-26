/**
 * Hooks for S-02, S-03, S-06 — thin `useLive` wrappers over rentalQueries / rentalService (tested there).
 * 'use no memo': DB-reading hooks must opt out of React Compiler (fact react-compiler-use-no-memo).
 */
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { countRentals, getRental } from '@/db/repos/rentals';
import { useLive } from '@/db/useLive';
import { fileStore } from '@/files';
import { askNotificationPermission, refreshReminders } from '@/notifications';
import { cancelStoppedTimers } from '@/notifications/queueTimers';
import { expoQueueNotifier } from '@/notifications/queueTimersNative';

import { emptyRentalForm, rentalToForm, type RentalForm } from './rentalForm';
import { loadCleanupReminderCount, loadRentalCards, loadRentalHub, RENTAL_LIVE_TABLES } from './rentalQueries';
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

/** S-02 cleanup card ("2 closed rentals still hold applicant data"); "Later" hides it for this app session. The backup
 * card is 2E's `useBackupReminder()` (@/backup). */
export function useCleanupReminder() {
  'use no memo';
  const count = useLive(() => loadCleanupReminderCount(db), [], ['settings', 'rentals', 'applicants']);
  const [hidden, setHidden] = useState(false);
  return { count: hidden ? 0 : count, later: () => setHidden(true) };
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
    /** Also asks the notification permission the first time First-come is on (§6, 2E asks at most once). */
    create: useCallback((form: RentalForm) => {
      const r = createRentalFromForm(db, form);
      if (r.ok && r.askNotifications) void askNotificationPermission();
      return r;
    }, []),
    /** Also cancels the notifications of first-come timers stopped by a switch to Compare (2D). */
    update: useCallback((id: number, form: RentalForm, confirmModeChange?: boolean) => {
      const r = updateRentalFromForm(db, id, form, { confirmModeChange });
      if (r.ok) {
        if (r.stoppedTimers.length) void cancelStoppedTimers(expoQueueNotifier, r.stoppedTimers);
        if (r.askNotifications) void askNotificationPermission();
      }
      return r;
    }, []),
    planModeChange: useCallback((id: number, to: ReviewMode) => planReviewModeChange(db, id, to), []),
    // Closing / reopening / deleting changes what the 2E cleanup reminder counts.
    close: useCallback((id: number) => {
      closeRental(db, id);
      void refreshReminders();
    }, []),
    reopen: useCallback((id: number) => {
      reopenRental(db, id);
      void refreshReminders();
    }, []),
    deleteMessage: useCallback((id: number) => deleteRentalMessage(db, id), []),
    remove: useCallback((id: number) => {
      deleteRentalAndData(db, fileStore, id);
      void refreshReminders();
    }, []),
    openSample: useCallback(() => openSampleRental(db), []),
  };
}
