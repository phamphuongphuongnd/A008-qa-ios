/**
 * Hooks for S-02, S-03, S-06 — thin `useLive` wrappers over rentalQueries / rentalService (tested there).
 * 'use no memo': DB-reading hooks must opt out of React Compiler (fact react-compiler-use-no-memo).
 */
import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import { countRentals, getRental } from '@/db/repos/rentals';
import { useLive } from '@/db/useLive';
import { fileStore } from '@/files';
import { askFirstComePermissions, refreshReminders, syncTimers } from '@/notifications';
import { cancelStoppedTimers } from '@/notifications/queueTimers';
import { expoQueueNotifier } from '@/notifications/queueTimersNative';

import { emptyRentalForm, rentalToForm, type RentalForm } from './rentalForm';
import { loadCleanupReminderCount, loadRentalCards, loadRentalHub, RENTAL_LIVE_TABLES } from './rentalQueries';
import {
  closeRental,
  closeRentalWarning,
  createRentalFromForm,
  deleteRentalAndData,
  deleteRentalMessage,
  openSampleRental,
  planReviewModeChange,
  reopenRental,
  updateRentalFromForm,
} from './rentalService';
import type { ReviewMode } from '@/db/schema';
import type { Timer } from '@/db/types';

/** S-02 cards of a segment + counts of both segments (to pick the empty state). */
export function useRentals(filter: 'open' | 'closed') {
  'use no memo';
  const cards = useLive(() => loadRentalCards(db, filter), [filter], RENTAL_LIVE_TABLES);
  const counts = useLive(() => countRentals(db), [], ['rentals']);
  return { cards, counts, isEmpty: counts.open + counts.closed === 0 };
}

/** S-02 cleanup card ("2 closed rentals still hold applicant data"); "Later" hides it for this app session. The backup
 * card is 2E's `useBackupReminder()` (@/backup). */
export function useCleanupReminder(now: Date = new Date()) {
  'use no memo';
  // Re-counted each minute / on return to the foreground (`now` from useClock, B-59), not only when the data changes.
  const minute = now.toISOString().slice(0, 16);
  const count = useLive(() => loadCleanupReminderCount(db, now), [minute], ['settings', 'rentals', 'applicants']);
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
    /** Also asks the notification permission (+ exact alarms) the first time First-come is on (§6, asked at most once). */
    create: useCallback((form: RentalForm) => {
      const r = createRentalFromForm(db, form);
      if (r.ok && r.askNotifications) void askFirstComePermissions();
      return r;
    }, []),
    /** Also cancels the notifications of first-come timers stopped by a switch to Compare (2D). */
    update: useCallback((id: number, form: RentalForm, confirmModeChange?: boolean) => {
      const r = updateRentalFromForm(db, id, form, { confirmModeChange });
      if (r.ok) {
        if (r.stoppedTimers.length) void cancelStoppedTimers(expoQueueNotifier, r.stoppedTimers);
        if (r.askNotifications) void askFirstComePermissions();
      }
      return r;
    }, []),
    planModeChange: useCallback((id: number, to: ReviewMode) => planReviewModeChange(db, id, to), []),
    /** Ask before closing when an offer is out / a First-come clock runs (B-61); null = close right away. */
    closeWarning: useCallback((id: number) => closeRentalWarning(db, id), []),
    // Closing / reopening / deleting changes what the 2E cleanup reminder counts.
    /** Stops the rental's clocks and cancels their notifications (B-61); returns them for Undo. */
    close: useCallback((id: number) => {
      const stopped = closeRental(db, id);
      if (stopped.length) void cancelStoppedTimers(expoQueueNotifier, stopped);
      void refreshReminders();
      return stopped;
    }, []),
    /** Undo of a close passes the clocks it stopped: they run again with their notifications. */
    reopen: useCallback((id: number, restoreTimers: readonly Timer[] = []) => {
      reopenRental(db, id, restoreTimers);
      if (restoreTimers.length) void syncTimers();
      void refreshReminders();
    }, []),
    deleteMessage: useCallback((id: number) => deleteRentalMessage(db, id), []),
    remove: useCallback((id: number) => {
      const stopped = deleteRentalAndData(db, fileStore, id);
      if (stopped.length) void cancelStoppedTimers(expoQueueNotifier, stopped);
      void refreshReminders();
    }, []),
    openSample: useCallback(() => openSampleRental(db), []),
  };
}
