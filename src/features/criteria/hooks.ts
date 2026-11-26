/**
 * Hooks for S-04 Criteria builder and S-05 Published criteria. Logic lives in criteriaEditor (reducer),
 * criteriaService (save + history) and @/pdf/publishedCriteria (content / PDF / text) — all tested there.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { db } from '@/db/client';
import { useLive } from '@/db/useLive';
import type { SmokingPolicy } from '@/db/schema';
import {
  publishedCriteriaContent,
  publishedCriteriaText,
  sharePublishedCriteriaPdf,
} from '@/pdf/publishedCriteria';

import { copyText } from './clipboard';
import {
  canSave,
  criteriaEditorReducer,
  draftErrors,
  initCriteriaEditor,
  isDirty,
  isEditable,
  visibleWarnings,
} from './criteriaEditor';
import { loadCriteria, saveCriteriaDraft, type SaveCriteriaResult } from './criteriaService';

const TABLES = ['rentals', 'criteria', 'applicants', 'criteria_history'] as const;

/** S-04: saved criteria from the DB + the editor state machine. A DB change resets the editor when it has no edits. */
export function useCriteriaEditor(rentalId: number) {
  'use no memo';
  const data = useLive(() => loadCriteria(db, rentalId), [rentalId], TABLES);
  const [state, dispatch] = useReducer(criteriaEditorReducer, data, (d) =>
    initCriteriaEditor(d?.criteria ?? [], d?.locked ?? false),
  );
  const savedKey = data ? JSON.stringify([data.criteria, data.locked]) : '';
  const lastKey = useRef(savedKey);
  useEffect(() => {
    if (savedKey === lastKey.current || !data) return;
    lastKey.current = savedKey;
    if (!isDirty(state) || data.locked !== state.locked) dispatch({ type: 'reset', saved: data.criteria, locked: data.locked });
  }, [savedKey, data, state]);

  const save = useCallback(
    (opts: { smokingPolicy?: SmokingPolicy } = {}): SaveCriteriaResult => {
      const result = saveCriteriaDraft(db, rentalId, state.draft, {
        reason: state.phase === 'unlocked' ? state.reason : null,
        smokingPolicy: opts.smokingPolicy,
      });
      if (result.ok) {
        const fresh = loadCriteria(db, rentalId);
        if (fresh) {
          lastKey.current = JSON.stringify([fresh.criteria, fresh.locked]);
          dispatch({ type: 'reset', saved: fresh.criteria, locked: fresh.locked });
        }
      }
      return result;
    },
    [rentalId, state.draft, state.phase, state.reason],
  );

  return {
    rental: data?.rental ?? null,
    notFound: data === null,
    state,
    dispatch,
    save,
    editable: isEditable(state),
    dirty: isDirty(state),
    canSave: canSave(state),
    errors: draftErrors(state),
    warnings: visibleWarnings(state),
  };
}

/** S-05: the page content (preview), plus export / share / copy. */
export function usePublishedCriteria(rentalId: number) {
  'use no memo';
  const data = useLive(() => loadCriteria(db, rentalId), [rentalId], TABLES);
  const content = data ? publishedCriteriaContent(data.rental, data.criteria) : null;
  return {
    notFound: data === null,
    rental: data?.rental ?? null,
    content,
    sharePdf: () => (content ? sharePublishedCriteriaPdf(content) : Promise.reject(new Error('not found'))),
    copy: () => (content ? copyText(publishedCriteriaText(content)) : Promise.resolve(false)),
  };
}

/** S-06 "Share criteria": print + share the published criteria of a rental (false = no such rental). */
export async function sharePublishedCriteria(rentalId: number): Promise<boolean> {
  const data = loadCriteria(db, rentalId);
  if (!data) return false;
  await sharePublishedCriteriaPdf(publishedCriteriaContent(data.rental, data.criteria));
  return true;
}
