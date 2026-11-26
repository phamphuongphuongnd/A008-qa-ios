import { useState } from 'react';

import { haptics } from '@/ui';

import type { FieldError } from '../common';

type Saved = { ok: true } | { ok: false; errors: readonly FieldError[] };

/**
 * Local form state for a verify sheet. `edit` changes fields while typing (dirty, not saved); `commit` saves through
 * the service (S-11 / S-12 / S-14 save each answer as it is chosen or when a text field loses focus; S-13 on "Save").
 * A failed save keeps the form dirty and shows the field errors (the screen leaves with "Discard changes?").
 * The form resets only when `recordKey` changes (another applicant / residence), not when the saved data reloads.
 */
export function useSheetForm<F extends object>(initial: F, recordKey: string, save: (form: F) => Saved) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const [dirty, setDirty] = useState(false);
  const [key, setKey] = useState(recordKey);
  if (key !== recordKey) {
    setKey(recordKey);
    setForm(initial);
    setErrors([]);
    setDirty(false);
  }

  const edit = (patch: Partial<F>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const commit = (patch: Partial<F> = {}): boolean => {
    const next = { ...form, ...patch };
    setForm(next);
    const r = save(next);
    if (r.ok) {
      setErrors([]);
      setDirty(false);
      return true;
    }
    setErrors(r.errors);
    setDirty(true);
    haptics.error();
    return false;
  };

  return { form, errors, dirty, edit, commit };
}
