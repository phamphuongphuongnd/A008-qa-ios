/**
 * S-08 screen state: loads the application, autosaves ("Draft saved") 600 ms after the last edit and on every part
 * change, validates "Next", saves the signature when leaving part 6, submits on part 7.
 * Logic lives in ../form/controller.ts + ../form/service.ts (tested); this hook only wires React to them.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { AppDb } from '@/db/types';

import { advance, formReducer, INITIAL_FORM_STATE, remainingErrors } from '../form/controller';
import { SIGN_SECTION, type ApplicationForm, type FormMode, type FormSection } from '../form/model';
import { loadApplication, saveDraft, saveSignature, submitApplication, type SignatureFiles, type SubmitResult } from '../form/service';
import type { WarningCode } from '../form/validate';

export const AUTOSAVE_MS = 600;

export interface UseApplicationFormOptions {
  db: AppDb;
  files: SignatureFiles;
  applicantId: number | null;
  mode: FormMode;
  /** Open this part (route `?section=`), else where the draft was left. */
  initialStep?: FormSection | null;
  /** Replaces the default submit (applicant mode: `submitInApplicantMode`, which also moves the state machine). */
  submitFn?: (db: AppDb, applicantId: number, form: ApplicationForm) => SubmitResult;
}

export function useApplicationForm({ db, files, applicantId, mode, initialStep, submitFn }: UseApplicationFormOptions) {
  const [state, dispatch] = useReducer(formReducer, INITIAL_FORM_STATE);
  const latest = useRef(state);
  latest.current = state; // eslint-disable-line react-hooks/refs -- read by timers / async handlers

  useEffect(() => {
    if (applicantId == null) return;
    const loaded = loadApplication(db, applicantId);
    if (!loaded) dispatch({ type: 'notFound' });
    else dispatch({ type: 'load', form: loaded.form, step: initialStep ?? loaded.step, receivedEditable: loaded.receivedEditable });
  }, [db, applicantId, initialStep]);

  /** Writes the current form now (sync SQLite). Returns false when the write failed. */
  const flush = useCallback((): boolean => {
    const s = latest.current;
    if (applicantId == null || !s.form || !s.dirty) return true;
    const snapshot = s.form;
    try {
      const saved = saveDraft(db, applicantId, snapshot, s.step);
      dispatch({ type: 'saved', saved, stillDirty: latest.current.form !== snapshot });
      return true;
    } catch {
      dispatch({ type: 'saveFailed' });
      return false;
    }
  }, [db, applicantId]);

  useEffect(() => {
    if (!state.dirty) return;
    const id = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [state.form, state.dirty, flush]);

  // Leaving the screen writes what is pending.
  useEffect(() => () => void flush(), [flush]);

  const ctx = { mode };

  const update = useCallback(
    (patch: Partial<ApplicationForm>) => {
      dispatch({ type: 'patch', patch });
      const s = latest.current;
      if (s.errors.length && s.form) dispatch({ type: 'checked', errors: remainingErrors({ ...s.form, ...patch }, s.step, s.errors, ctx), warnings: s.warnings });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );

  const goTo = useCallback(
    (step: FormSection) => {
      flush();
      dispatch({ type: 'go', step });
    },
    [flush],
  );

  /** "Next": validate the part (signature saved on part 6), then move on. */
  const next = useCallback(async (): Promise<{ ok: boolean; warnings: WarningCode[] }> => {
    const s = latest.current;
    if (!s.form || applicantId == null) return { ok: false, warnings: [] };
    const r = advance(s.form, s.step, ctx);
    if (!r.ok) {
      dispatch({ type: 'checked', errors: r.errors, warnings: r.warnings });
      return { ok: false, warnings: r.warnings };
    }
    let form = s.form;
    if (s.step === SIGN_SECTION && form.pendingSignature) {
      const sig = await saveSignature(db, files, applicantId, form.pendingSignature, form.signedName);
      if (!sig.ok) {
        dispatch({ type: 'checked', errors: [{ field: 'signature', code: sig.error }], warnings: [] });
        return { ok: false, warnings: [] };
      }
      form = { ...form, pendingSignature: null, signaturePath: sig.path, signedAt: sig.signedAt };
      dispatch({ type: 'patch', patch: { pendingSignature: null, signaturePath: sig.path, signedAt: sig.signedAt } });
    }
    // Passing part 2 answers the pets question and the voucher question (shown as "No" until changed).
    if (s.step === 2 && (!form.petsAnswered || form.hasVoucher == null))
      dispatch({ type: 'patch', patch: { petsAnswered: true, hasVoucher: form.hasVoucher ?? false } });
    if (r.next) goTo(r.next);
    return { ok: true, warnings: r.warnings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, files, applicantId, mode, goTo]);

  const back = useCallback(() => {
    const s = latest.current;
    if (s.step > 1) goTo((s.step - 1) as FormSection);
  }, [goTo]);

  /** Part 7 "Save applicant" / "Submit application". On error, jumps to the first part with an error. */
  const submit = useCallback((): SubmitResult | null => {
    const s = latest.current;
    if (!s.form || applicantId == null) return null;
    flush();
    const r = submitFn ? submitFn(db, applicantId, latest.current.form ?? s.form) : submitApplication(db, applicantId, latest.current.form ?? s.form, { mode });
    if (r.ok) {
      dispatch({ type: 'load', form: r.form, step: s.step, receivedEditable: false });
    } else {
      dispatch({ type: 'go', step: r.section });
      dispatch({ type: 'checked', errors: r.errors.filter((e) => e.field !== 'receivedAt' || r.section === 7), warnings: [] });
    }
    return r;
  }, [db, applicantId, mode, submitFn, flush]);

  return {
    ...state,
    ready: state.form != null,
    update,
    edit: (fn: (f: ApplicationForm) => ApplicationForm) => dispatch({ type: 'edit', fn }),
    next,
    back,
    goTo,
    submit,
    flush,
  };
}
