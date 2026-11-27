import { useEffect, useRef, useState } from 'react';

import { haptics } from '@/ui';

import { sameForm, type FieldError } from '../common';

type Saved = { ok: true } | { ok: false; errors: readonly FieldError[] };

/**
 * Local form state for a verify sheet. `edit` changes fields while typing (not saved); `commit` saves through the
 * service (S-11 / S-12 / S-14 save each answer as it is chosen or when a text field loses focus; S-13 on "Save").
 * `dirty` = the form differs from what was last saved (B-45: a flag set by every `edit` stayed true when a late
 * onChangeText — e.g. the keyboard committing its text after "Save" — repeated the same value, so ‹ still asked
 * "Discard changes?" after a successful save). A failed save keeps the field errors (the screen leaves with
 * "Discard changes?"). The form resets only when `recordKey` changes (another applicant / residence), not when the
 * saved data reloads.
 */
export function useSheetForm<F extends object>(initial: F, recordKey: string, save: (form: F) => Saved) {
  const [form, setForm] = useState(initial);
  const [savedForm, setSavedForm] = useState(initial);
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const [key, setKey] = useState(recordKey);
  if (key !== recordKey) {
    setKey(recordKey);
    setForm(initial);
    setSavedForm(initial);
    setErrors([]);
  }

  const edit = (patch: Partial<F>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  /** true when saved; false with `errors` set when validation failed. Throws when the database write fails. */
  const commit = (patch: Partial<F> = {}): boolean => {
    const next = { ...form, ...patch };
    setForm(next);
    const r = save(next);
    if (r.ok) {
      setErrors([]);
      setSavedForm(next);
      return true;
    }
    setErrors(r.errors);
    haptics.error();
    return false;
  };

  /**
   * B-122: the form was saved by another action (S-14 "Continue with the offer" / "Withdraw" save it with the outcome)
   * → mark it saved, then run `go` (leave / open the next screen) only AFTER the re-render, once `dirty` is false and the
   * screen's discard guard has switched off. Navigating in the same handler was blocked by the still-dirty guard
   * ("Discard changes?" although everything was saved — e.g. the last field still focused, never blurred).
   */
  const afterSave = useRef<null | (() => void)>(null);
  const [savedTick, setSavedTick] = useState(0);
  const savedThen = (go: () => void, saved: F = form) => {
    setErrors([]);
    setForm(saved);
    setSavedForm(saved);
    afterSave.current = go;
    setSavedTick((n) => n + 1);
  };
  useEffect(() => {
    const go = afterSave.current;
    afterSave.current = null;
    go?.();
  }, [savedTick]);

  return { form, errors, dirty: !sameForm(form, savedForm), edit, commit, savedThen };
}
