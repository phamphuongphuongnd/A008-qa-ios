import { useState } from 'react';

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

  return { form, errors, dirty: !sameForm(form, savedForm), edit, commit };
}
