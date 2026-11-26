/**
 * Pure state of the S-08 screen (the hook in ../hooks/useApplicationForm.ts runs it): current part, edits, errors
 * shown after a failed "Next", autosave status. Tested without React.
 */
import { clampSection, SECTION_COUNT, type ApplicationForm, type FormMode, type FormSection } from './model';
import { validateSection, type FieldError, type WarningCode } from './validate';

export type SaveState = 'idle' | 'pending' | 'saved' | 'error';

export interface FormState {
  form: ApplicationForm | null;
  step: FormSection;
  errors: FieldError[];
  warnings: WarningCode[];
  /** Edits not written yet. */
  dirty: boolean;
  save: SaveState;
  /** "Received on" still editable (draft). */
  receivedEditable: boolean;
  notFound: boolean;
}

export type FormAction =
  | { type: 'load'; form: ApplicationForm; step: FormSection; receivedEditable: boolean }
  | { type: 'notFound' }
  | { type: 'patch'; patch: Partial<ApplicationForm> }
  | { type: 'edit'; fn: (f: ApplicationForm) => ApplicationForm }
  | { type: 'go'; step: FormSection }
  | { type: 'checked'; errors: FieldError[]; warnings: WarningCode[] }
  /** Autosave wrote `saved` (the form as written, with new DB ids). */
  | { type: 'saved'; saved: ApplicationForm; stillDirty: boolean }
  | { type: 'saveFailed' };

export const INITIAL_FORM_STATE: FormState = { form: null, step: 1, errors: [], warnings: [], dirty: false, save: 'idle', receivedEditable: false, notFound: false };

/** Copy DB ids from the saved snapshot onto the current form (rows matched by key; edits typed meanwhile kept). */
export function mergeSavedIds(current: ApplicationForm, saved: ApplicationForm): ApplicationForm {
  const byKey = <T extends { key: string }>(list: readonly T[]) => new Map(list.map((x) => [x.key, x]));
  const rs = byKey(saved.residences);
  const oi = byKey(saved.otherIncome);
  const oa = byKey(saved.otherAdults);
  return {
    ...current,
    jobIncomeId: current.jobIncomeId ?? saved.jobIncomeId,
    residences: current.residences.map((r) => (r.id == null && rs.get(r.key)?.id != null ? { ...r, id: rs.get(r.key)!.id } : r)),
    otherIncome: current.otherIncome.map((o) => (o.id == null && oi.get(o.key)?.id != null ? { ...o, id: oi.get(o.key)!.id } : o)),
    otherAdults: current.otherAdults.map((a) =>
      a.incomeId == null && oa.get(a.key)?.incomeId != null ? { ...a, incomeId: oa.get(a.key)!.incomeId } : a,
    ),
  };
}

export function formReducer(s: FormState, a: FormAction): FormState {
  switch (a.type) {
    case 'load':
      return { ...INITIAL_FORM_STATE, form: a.form, step: a.step, save: 'saved', receivedEditable: a.receivedEditable };
    case 'notFound':
      return { ...INITIAL_FORM_STATE, notFound: true };
    case 'patch':
    case 'edit': {
      if (!s.form) return s;
      const form = a.type === 'patch' ? { ...s.form, ...a.patch } : a.fn(s.form);
      // Errors already shown clear field by field as they are fixed (re-checked on the next "Next").
      return { ...s, form, dirty: true, save: 'pending' };
    }
    case 'go':
      return { ...s, step: clampSection(a.step), errors: [], warnings: [] };
    case 'checked':
      return { ...s, errors: a.errors, warnings: a.warnings };
    case 'saved':
      if (!s.form) return s;
      return { ...s, form: mergeSavedIds(s.form, a.saved), dirty: a.stillDirty, save: a.stillDirty ? 'pending' : 'saved' };
    case 'saveFailed':
      return { ...s, save: 'error' };
  }
}

export type AdvanceResult =
  | { ok: true; next: FormSection | null; warnings: WarningCode[] }
  | { ok: false; errors: FieldError[]; warnings: WarningCode[] };

/** "Next" on `step`: errors block; warnings are shown but do not block. `next` null on the last part. */
export function advance(form: ApplicationForm, step: FormSection, ctx: { mode: FormMode; now?: Date }): AdvanceResult {
  const r = validateSection(step, form, ctx);
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings };
  return { ok: true, next: step < SECTION_COUNT ? ((step + 1) as FormSection) : null, warnings: r.warnings };
}

/** Errors still relevant after an edit: drop the ones of fields that now pass. */
export function remainingErrors(form: ApplicationForm, step: FormSection, shown: readonly FieldError[], ctx: { mode: FormMode; now?: Date }): FieldError[] {
  if (!shown.length) return [];
  const now = validateSection(step, form, ctx).errors;
  return shown.filter((e) => now.some((n) => n.field === e.field && n.code === e.code));
}
