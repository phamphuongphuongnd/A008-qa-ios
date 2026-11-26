/**
 * S-04 Criteria builder state machine (pure reducer — the hook wraps it in useReducer).
 *
 * Phases:  editing  — no applicants yet: free edits (§3.13)
 *          locked   — has applicants: read-only, banner + "Edit criteria"
 *          unlocking — the "Why are you changing criteria?" sheet is open
 *          unlocked — locked criteria opened with a reason; Save records the change
 * Guardrails (§3.12): turning the voucher option off waits for the dialog (`pendingVoucher`); C7 below 2 applies at
 * once and shows the warning card until "Set to 2" or "Keep 1" (dismiss). Custom titles are checked by the engine.
 */
import {
  MAX_CUSTOM_CRITERIA,
  criteriaWarnings,
  customTitleError,
  validateCriteria,
  type CriteriaError,
  type CriteriaWarning,
  type CriteriaWarningCode,
  type Criterion,
  type CriterionCode,
  type DocType,
  type PetPolicy,
  type RequiredDocument,
} from '@/engine';

import { NEW_ID_PREFIX } from './criteriaRows';

export type EditorPhase = 'editing' | 'locked' | 'unlocking' | 'unlocked';

export interface CriteriaEditorState {
  /** Criteria as saved (engine shape, ids = row ids as text). */
  saved: Criterion[];
  draft: Criterion[];
  locked: boolean;
  phase: EditorPhase;
  /** Reason given in the unlock sheet (required to save while locked). */
  reason: string;
  /** Voucher option switched off, waiting for "Keep on" / "Turn off anyway". */
  pendingVoucher: { criterionId: string } | null;
  /** Warning cards the landlord closed ("Keep 1"); they come back if the setting changes again. */
  dismissed: CriteriaWarningCode[];
  nextNewId: number;
}

/** Stepper ranges per numeric parameter (same ranges the engine validates). */
export const PARAM_RANGES = {
  C1: { key: 'multipleTenths', min: 20, max: 40, step: 1 },
  C2: { key: 'months', min: 0, max: 60, step: 1 },
  C3: { key: 'years', min: 1, max: 7, step: 1 },
  C7: { key: 'perBedroom', min: 1, max: 12, step: 1 },
  C8: { key: 'maxPets', min: 1, max: 12, step: 1 },
  C9: { key: 'minScore', min: 300, max: 850, step: 10 },
  C10: { key: 'lookbackYears', min: 1, max: 10, step: 1 },
} as const satisfies Partial<Record<CriterionCode, { key: string; min: number; max: number; step: number }>>;

export type SteppedCode = keyof typeof PARAM_RANGES;

export type CriteriaEditorAction =
  | { type: 'reset'; saved: Criterion[]; locked: boolean }
  | { type: 'toggle'; id: string; enabled: boolean }
  | { type: 'step'; id: string; delta: 1 | -1 }
  | { type: 'setNumber'; id: string; value: number }
  | { type: 'setVoucherShare'; id: string; on: boolean }
  | { type: 'confirmVoucherOff' }
  | { type: 'keepVoucherOn' }
  | { type: 'setPetPolicy'; id: string; policy: PetPolicy }
  | { type: 'toggleDocument'; id: string; doc: DocType; on: boolean }
  | { type: 'setOtherDocument'; id: string; label: string }
  | { type: 'addCustom'; title: string; answeredBy: 'applicant' | 'landlord' }
  | { type: 'removeCustom'; id: string }
  | { type: 'dismissWarning'; code: CriteriaWarningCode }
  | { type: 'requestUnlock' }
  | { type: 'setReason'; reason: string }
  | { type: 'confirmUnlock' }
  | { type: 'cancelUnlock' }
  | { type: 'discard' };

const clone = (list: readonly Criterion[]) => list.map((c) => ({ ...c, params: structuredCloneParams(c.params) }) as Criterion);

function structuredCloneParams<T>(p: T): T {
  return JSON.parse(JSON.stringify(p)) as T;
}

export function initCriteriaEditor(saved: readonly Criterion[], locked: boolean): CriteriaEditorState {
  return {
    saved: clone(saved),
    draft: clone(saved),
    locked,
    phase: locked ? 'locked' : 'editing',
    reason: '',
    pendingVoucher: null,
    dismissed: [],
    nextNewId: 1,
  };
}

export function isEditable(s: CriteriaEditorState): boolean {
  return s.phase === 'editing' || s.phase === 'unlocked';
}

function update(s: CriteriaEditorState, id: string, fn: (c: Criterion) => Criterion | null): CriteriaEditorState {
  if (!isEditable(s)) return s;
  let changed = false;
  const draft = s.draft.map((c) => {
    if (c.id !== id) return c;
    const next = fn(c);
    if (!next || next === c) return c;
    changed = true;
    return next;
  });
  return changed ? { ...s, draft } : s;
}

function withParams<C extends Criterion>(c: C, params: Partial<C['params']>): C {
  return { ...c, params: { ...c.params, ...params } };
}

function clampToRange(code: SteppedCode, value: number): number {
  const r = PARAM_RANGES[code];
  return Math.min(r.max, Math.max(r.min, Math.round(value / r.step) * r.step));
}

function setNumber(c: Criterion, value: number): Criterion | null {
  if (!(c.code in PARAM_RANGES)) return null;
  const code = c.code as SteppedCode;
  const key = PARAM_RANGES[code].key;
  const v = clampToRange(code, value);
  return withParams(c, { [key]: v } as never);
}

/** Current numeric value of a stepped parameter (null for codes without one). */
export function paramValue(c: Criterion): number | null {
  if (!(c.code in PARAM_RANGES)) return null;
  const key = PARAM_RANGES[c.code as SteppedCode].key;
  return (c.params as unknown as Record<string, number>)[key];
}

/** Stepper buttons: [canDecrease, canIncrease]. */
export function stepLimits(c: Criterion): { canDecrease: boolean; canIncrease: boolean } {
  const v = paramValue(c);
  if (v === null) return { canDecrease: false, canIncrease: false };
  const r = PARAM_RANGES[c.code as SteppedCode];
  return { canDecrease: v > r.min, canIncrease: v < r.max };
}

function undismiss(s: CriteriaEditorState, before: readonly Criterion[]): CriteriaEditorState {
  // A warning that disappeared and came back shows again.
  const now = new Set(criteriaWarnings(s.draft).map((w) => w.code));
  const prev = new Set(criteriaWarnings(before).map((w) => w.code));
  const dismissed = s.dismissed.filter((code) => now.has(code) && prev.has(code));
  return dismissed.length === s.dismissed.length ? s : { ...s, dismissed };
}

export function criteriaEditorReducer(s: CriteriaEditorState, a: CriteriaEditorAction): CriteriaEditorState {
  switch (a.type) {
    case 'reset':
      return initCriteriaEditor(a.saved, a.locked);
    case 'toggle':
      // Turning C1 on with the voucher option off is not a new decision; only switching the option prompts.
      return undismiss(update(s, a.id, (c) => (c.enabled === a.enabled ? null : ({ ...c, enabled: a.enabled } as Criterion))), s.draft);
    case 'step':
      return undismiss(
        update(s, a.id, (c) => {
          const v = paramValue(c);
          if (v === null) return null;
          return setNumber(c, v + a.delta * PARAM_RANGES[c.code as SteppedCode].step);
        }),
        s.draft,
      );
    case 'setNumber':
      return undismiss(update(s, a.id, (c) => setNumber(c, a.value)), s.draft);
    case 'setVoucherShare': {
      if (!isEditable(s)) return s;
      const c = s.draft.find((x) => x.id === a.id);
      if (!c || c.code !== 'C1' || c.params.applyToTenantShare === a.on) return s;
      if (!a.on) return { ...s, pendingVoucher: { criterionId: a.id } };
      return update(s, a.id, (x) => withParams(x as Extract<Criterion, { code: 'C1' }>, { applyToTenantShare: true }));
    }
    case 'confirmVoucherOff': {
      if (!s.pendingVoucher) return s;
      const next = update(s, s.pendingVoucher.criterionId, (x) =>
        x.code === 'C1' ? withParams(x, { applyToTenantShare: false }) : null,
      );
      // The landlord answered the dialog: no extra card for the same warning.
      return { ...next, pendingVoucher: null, dismissed: [...new Set([...next.dismissed, 'voucher_off' as const])] };
    }
    case 'keepVoucherOn':
      return s.pendingVoucher ? { ...s, pendingVoucher: null } : s;
    case 'setPetPolicy':
      return update(s, a.id, (c) => (c.code === 'C8' && c.params.policy !== a.policy ? withParams(c, { policy: a.policy }) : null));
    case 'toggleDocument':
      return update(s, a.id, (c) => {
        if (c.code !== 'C6') return null;
        const has = c.params.documents.some((d) => d.type === a.doc);
        if (has === a.on) return null;
        const documents: RequiredDocument[] = a.on
          ? [...c.params.documents, { type: a.doc }]
          : c.params.documents.filter((d) => d.type !== a.doc);
        return withParams(c, { documents });
      });
    case 'setOtherDocument':
      return update(s, a.id, (c) => {
        if (c.code !== 'C6') return null;
        const label = a.label.slice(0, 60);
        const has = c.params.documents.some((d) => d.type === 'other');
        const documents = has
          ? c.params.documents.map((d) => (d.type === 'other' ? { ...d, label } : d))
          : [...c.params.documents, { type: 'other' as const, label }];
        return withParams(c, { documents });
      });
    case 'addCustom': {
      if (!isEditable(s) || customAddError(s.draft, a.title)) return s;
      const order = Math.max(0, ...s.draft.map((c) => c.order)) + 1;
      const c: Criterion = {
        id: `${NEW_ID_PREFIX}${s.nextNewId}`,
        code: 'CX',
        enabled: true,
        order,
        params: { title: a.title.trim(), answeredBy: a.answeredBy },
      };
      return { ...s, draft: [...s.draft, c], nextNewId: s.nextNewId + 1 };
    }
    case 'removeCustom':
      if (!isEditable(s)) return s;
      return s.draft.some((c) => c.id === a.id && c.code === 'CX') ? { ...s, draft: s.draft.filter((c) => c.id !== a.id) } : s;
    case 'dismissWarning':
      return s.dismissed.includes(a.code) ? s : { ...s, dismissed: [...s.dismissed, a.code] };
    case 'requestUnlock':
      return s.phase === 'locked' ? { ...s, phase: 'unlocking' } : s;
    case 'setReason':
      return s.phase === 'unlocking' || s.phase === 'unlocked' ? { ...s, reason: a.reason.slice(0, 500) } : s;
    case 'confirmUnlock':
      return s.phase === 'unlocking' && s.reason.trim() ? { ...s, phase: 'unlocked' } : s;
    case 'cancelUnlock':
      return s.phase === 'unlocking' ? { ...s, phase: 'locked', reason: '' } : s;
    case 'discard':
      return initCriteriaEditor(s.saved, s.locked);
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function customCount(draft: readonly Criterion[]): number {
  return draft.filter((c) => c.code === 'CX').length;
}

/** null = the custom criterion can be added; else the engine's error (prohibited terms, length) or the limit. */
export function customAddError(
  draft: readonly Criterion[],
  title: string,
): { code: CriteriaError['code']; message: string; terms?: string[] } | null {
  if (customCount(draft) >= MAX_CUSTOM_CRITERIA) {
    return { code: 'too_many_custom', message: `Up to ${MAX_CUSTOM_CRITERIA} custom criteria` };
  }
  return customTitleError(title);
}

export function isDirty(s: CriteriaEditorState): boolean {
  return JSON.stringify(s.draft) !== JSON.stringify(s.saved);
}

/** Warning cards to show now (dismissed ones hidden). Informational ones (C9, C10) included. */
export function visibleWarnings(s: CriteriaEditorState): CriteriaWarning[] {
  return criteriaWarnings(s.draft).filter((w) => !s.dismissed.includes(w.code));
}

export function draftErrors(s: CriteriaEditorState): CriteriaError[] {
  return validateCriteria(s.draft);
}

/** Save is possible: editable, valid, and (locked) a reason given. */
export function canSave(s: CriteriaEditorState): boolean {
  if (!isEditable(s) || s.pendingVoucher) return false;
  if (s.phase === 'unlocked' && !s.reason.trim()) return false;
  return draftErrors(s).length === 0;
}
