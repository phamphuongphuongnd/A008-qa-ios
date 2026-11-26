import { defaultCriteria, type Criterion } from '@/engine';

import {
  canSave,
  criteriaEditorReducer as reduce,
  customAddError,
  initCriteriaEditor,
  isDirty,
  isEditable,
  paramValue,
  stepLimits,
  visibleWarnings,
  type CriteriaEditorAction,
  type CriteriaEditorState,
} from '../criteriaEditor';

const saved = (): Criterion[] => defaultCriteria().map((c, i) => ({ ...c, id: String(i + 1) }));
const byCode = (s: CriteriaEditorState, code: string) => s.draft.find((c) => c.code === code)!;
const run = (s: CriteriaEditorState, ...actions: CriteriaEditorAction[]) => actions.reduce(reduce, s);

describe('criteria editor — unlocked (no applicants)', () => {
  it('starts clean and editable', () => {
    const s = initCriteriaEditor(saved(), false);
    expect(s.phase).toBe('editing');
    expect(isEditable(s)).toBe(true);
    expect(isDirty(s)).toBe(false);
    expect(canSave(s)).toBe(true);
  });

  it('toggles and steps parameters within range', () => {
    let s = initCriteriaEditor(saved(), false);
    s = run(s, { type: 'toggle', id: '9', enabled: true }, { type: 'step', id: '1', delta: 1 });
    expect(byCode(s, 'C9').enabled).toBe(true);
    expect(paramValue(byCode(s, 'C1'))).toBe(31);
    expect(isDirty(s)).toBe(true);
    // C3 years max 7
    s = run(s, ...Array.from({ length: 5 }, () => ({ type: 'step', id: '3', delta: 1 }) as const));
    expect(paramValue(byCode(s, 'C3'))).toBe(7);
    expect(stepLimits(byCode(s, 'C3'))).toEqual({ canDecrease: true, canIncrease: false });
    // C9 steps by 10, typed value clamps
    s = run(s, { type: 'setNumber', id: '9', value: 999 });
    expect(paramValue(byCode(s, 'C9'))).toBe(850);
    s = run(s, { type: 'discard' });
    expect(isDirty(s)).toBe(false);
  });

  it('asks before turning the voucher option off (Keep on / Turn off anyway)', () => {
    let s = initCriteriaEditor(saved(), false);
    s = reduce(s, { type: 'setVoucherShare', id: '1', on: false });
    expect(s.pendingVoucher).toEqual({ criterionId: '1' });
    expect(byCode(s, 'C1').params).toMatchObject({ applyToTenantShare: true });
    expect(canSave(s)).toBe(false);
    const kept = reduce(s, { type: 'keepVoucherOn' });
    expect(kept.pendingVoucher).toBeNull();
    expect(byCode(kept, 'C1').params).toMatchObject({ applyToTenantShare: true });
    const off = reduce(s, { type: 'confirmVoucherOff' });
    expect(byCode(off, 'C1').params).toMatchObject({ applyToTenantShare: false });
    expect(visibleWarnings(off).map((w) => w.code)).not.toContain('voucher_off');
    expect(reduce(off, { type: 'setVoucherShare', id: '1', on: true }).draft[0].params).toMatchObject({ applyToTenantShare: true });
  });

  it('shows the occupancy warning below 2 per bedroom until fixed or dismissed', () => {
    let s = initCriteriaEditor(saved(), false);
    s = reduce(s, { type: 'step', id: '7', delta: -1 });
    expect(paramValue(byCode(s, 'C7'))).toBe(1);
    expect(visibleWarnings(s).map((w) => w.code)).toEqual(['occupancy_below_two']);
    expect(canSave(s)).toBe(true);
    const dismissed = reduce(s, { type: 'dismissWarning', code: 'occupancy_below_two' });
    expect(visibleWarnings(dismissed)).toEqual([]);
    // Set to 2 → gone; back to 1 → shows again
    const back = run(dismissed, { type: 'setNumber', id: '7', value: 2 }, { type: 'setNumber', id: '7', value: 1 });
    expect(visibleWarnings(back).map((w) => w.code)).toEqual(['occupancy_below_two']);
  });

  it('shows the credit / criminal notes when those are on', () => {
    const s = run(initCriteriaEditor(saved(), false), { type: 'toggle', id: '9', enabled: true }, { type: 'toggle', id: '10', enabled: true });
    expect(visibleWarnings(s).map((w) => w.code)).toEqual(['credit_enabled', 'criminal_local_law']);
  });

  it('edits pet policy and required documents', () => {
    let s = initCriteriaEditor(saved(), false);
    s = run(
      s,
      { type: 'setPetPolicy', id: '8', policy: 'cats_and_dogs' },
      { type: 'toggleDocument', id: '6', doc: 'bank_statement', on: true },
      { type: 'toggleDocument', id: '6', doc: 'photo_id', on: false },
      { type: 'setOtherDocument', id: '6', label: 'Car registration' },
    );
    expect(byCode(s, 'C8').params).toEqual({ policy: 'cats_and_dogs', maxPets: 2 });
    expect(byCode(s, 'C6').params).toEqual({
      documents: [{ type: 'proof_of_income' }, { type: 'bank_statement' }, { type: 'other', label: 'Car registration' }],
    });
    // no documents → invalid
    s = run(s, ...(['proof_of_income', 'bank_statement', 'other'] as const).map((doc) => ({ type: 'toggleDocument', id: '6', doc, on: false }) as const));
    expect(canSave(s)).toBe(false);
  });

  it('adds custom yes/no criteria through the guardrail, up to 5', () => {
    let s = initCriteriaEditor(saved(), false);
    expect(customAddError(s.draft, 'No families with young children')).toMatchObject({
      code: 'prohibited',
      terms: ['children', 'family', 'young'],
    });
    const blocked = reduce(s, { type: 'addCustom', title: 'No Section 8', answeredBy: 'applicant' });
    expect(blocked).toBe(s);
    for (let i = 1; i <= 6; i++) s = reduce(s, { type: 'addCustom', title: `Has renters insurance ${i}`, answeredBy: 'landlord' });
    const custom = s.draft.filter((c) => c.code === 'CX');
    expect(custom).toHaveLength(5);
    expect(custom[0]).toMatchObject({ id: 'new-1', enabled: true, order: 11, params: { title: 'Has renters insurance 1', answeredBy: 'landlord' } });
    expect(customAddError(s.draft, 'Anything')).toMatchObject({ code: 'too_many_custom' });
    s = reduce(s, { type: 'removeCustom', id: 'new-2' });
    expect(s.draft.filter((c) => c.code === 'CX')).toHaveLength(4);
    expect(reduce(s, { type: 'removeCustom', id: '1' })).toBe(s); // C1 can't be removed
  });
});

describe('criteria editor — locked (has applicants)', () => {
  it('is read-only until a reason is given in the unlock sheet', () => {
    let s = initCriteriaEditor(saved(), true);
    expect(s.phase).toBe('locked');
    expect(reduce(s, { type: 'toggle', id: '9', enabled: true })).toBe(s);
    expect(canSave(s)).toBe(false);
    s = reduce(s, { type: 'requestUnlock' });
    expect(s.phase).toBe('unlocking');
    expect(reduce(s, { type: 'confirmUnlock' }).phase).toBe('unlocking'); // empty reason
    expect(reduce(s, { type: 'cancelUnlock' })).toMatchObject({ phase: 'locked', reason: '' });
    s = run(s, { type: 'setReason', reason: 'Typo — C2 should be 12 months' }, { type: 'confirmUnlock' });
    expect(s.phase).toBe('unlocked');
    s = reduce(s, { type: 'step', id: '2', delta: 1 });
    expect(paramValue(byCode(s, 'C2'))).toBe(13);
    expect(canSave(s)).toBe(true);
    expect(canSave(reduce(s, { type: 'setReason', reason: '  ' }))).toBe(false);
  });

  it('resets to the saved version', () => {
    const s = run(initCriteriaEditor(saved(), false), { type: 'step', id: '1', delta: 1 });
    const fresh = reduce(s, { type: 'reset', saved: s.draft, locked: true });
    expect(fresh.phase).toBe('locked');
    expect(isDirty(fresh)).toBe(false);
  });
});
