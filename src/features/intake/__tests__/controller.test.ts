import { advance, formReducer, INITIAL_FORM_STATE, mergeSavedIds, remainingErrors } from '../form/controller';
import { emptyForm, emptyResidence } from '../form/model';

const NOW = new Date(2026, 11, 2, 12, 0);
const L = { mode: 'landlord' as const, now: NOW };

describe('form controller', () => {
  const base = emptyForm('2026-12-02T09:14:00');

  it('load → edit marks dirty/pending → saved keeps later edits', () => {
    let s = formReducer(INITIAL_FORM_STATE, { type: 'load', form: base, step: 3, receivedEditable: true });
    expect(s).toMatchObject({ step: 3, dirty: false, save: 'saved', receivedEditable: true });
    s = formReducer(s, { type: 'patch', patch: { fullName: 'A' } });
    expect(s).toMatchObject({ dirty: true, save: 'pending' });
    const snapshot = s.form!;
    s = formReducer(s, { type: 'edit', fn: (f) => ({ ...f, phone: '1' }) });
    s = formReducer(s, { type: 'saved', saved: snapshot, stillDirty: true });
    expect(s.form).toMatchObject({ fullName: 'A', phone: '1' });
    expect(s.save).toBe('pending');
    s = formReducer(s, { type: 'saveFailed' });
    expect(s.save).toBe('error');
    expect(formReducer(INITIAL_FORM_STATE, { type: 'patch', patch: { fullName: 'x' } })).toBe(INITIAL_FORM_STATE);
    expect(formReducer(INITIAL_FORM_STATE, { type: 'notFound' }).notFound).toBe(true);
  });

  it('go clears errors and clamps the part', () => {
    let s = formReducer(INITIAL_FORM_STATE, { type: 'load', form: base, step: 1, receivedEditable: false });
    s = formReducer(s, { type: 'checked', errors: [{ field: 'fullName', code: 'nameRequired' }], warnings: [] });
    s = formReducer(s, { type: 'go', step: 9 as never });
    expect(s).toMatchObject({ step: 7, errors: [] });
  });

  it('copies new DB ids by row key without touching edits', () => {
    const r = { ...emptyResidence(), address: 'old' };
    const current = { ...base, residences: [{ ...r, address: 'typed meanwhile' }], otherIncome: [{ key: 'o', kind: 'other' as const, monthlyCents: 1 }], otherAdults: [{ key: 'a', name: 'S', monthlyCents: null }] };
    const saved = { ...base, jobIncomeId: 9, residences: [{ ...r, id: 4 }], otherIncome: [{ key: 'o', kind: 'other' as const, monthlyCents: 1, id: 5 }], otherAdults: [{ key: 'a', name: 'S', monthlyCents: null, incomeId: 6 }] };
    const m = mergeSavedIds(current, saved);
    expect(m.residences[0]).toMatchObject({ id: 4, address: 'typed meanwhile' });
    expect(m.otherIncome[0].id).toBe(5);
    expect(m.otherAdults[0].incomeId).toBe(6);
    expect(m.jobIncomeId).toBe(9);
  });

  it('Next: errors block, warnings pass, last part has no next', () => {
    expect(advance(base, 1, L)).toMatchObject({ ok: false });
    const f = { ...base, fullName: 'A B', email: 'a@b.co' };
    expect(advance(f, 1, L)).toEqual({ ok: true, next: 2, warnings: [] });
    expect(advance(f, 3, L)).toEqual({ ok: true, next: 4, warnings: ['coverShortOfThreeYears'] });
    expect(advance({ ...f, receivedAt: new Date(2026, 11, 2, 9).toISOString() }, 7, L)).toEqual({ ok: true, next: null, warnings: [] });
  });

  it('errors disappear field by field once fixed', () => {
    const shown = advance(base, 1, L);
    if (shown.ok) throw new Error('expected errors');
    expect(remainingErrors({ ...base, fullName: 'A' }, 1, shown.errors, L).map((e) => e.code)).toEqual(['contactRequired']);
    expect(remainingErrors(base, 1, [], L)).toEqual([]);
  });
});
