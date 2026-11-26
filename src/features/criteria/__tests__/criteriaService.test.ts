import { evaluateApplicant, type Criterion } from '@/engine';
import * as A from '@/db/repos/applicants';
import * as C from '@/db/repos/criteria';
import * as R from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';
import { loadRentalForEngine } from '@/db/toEngine';
import type { AppDb } from '@/db/types';
import { createRentalFromForm } from '@/features/units/rentalService';
import { emptyRentalForm } from '@/features/units/rentalForm';

import { criteriaEditorReducer as reduce, initCriteriaEditor } from '../criteriaEditor';
import { criteriaHistoryLines, describeHistoryEntry, loadCriteria, saveCriteriaDraft } from '../criteriaService';

const AT = '2026-12-05T10:00:00-05:00';

function newRental(db: AppDb): number {
  const r = createRentalFromForm(db, { ...emptyRentalForm(), street: '1 Main St', rentCents: 150000 });
  if (!r.ok) throw new Error();
  return r.id;
}

const edit = (list: Criterion[], code: string, fn: (c: Criterion) => Criterion) => list.map((c) => (c.code === code ? fn(c) : c));

describe('save criteria (S-04)', () => {
  it('saves freely before applicants, no history', () => {
    const db = makeTestDb();
    const id = newRental(db);
    const data = loadCriteria(db, id)!;
    expect(data.locked).toBe(false);
    let s = initCriteriaEditor(data.criteria, data.locked);
    s = reduce(s, { type: 'toggle', id: data.criteria[8].id, enabled: true });
    s = reduce(s, { type: 'addCustom', title: 'Has renters insurance', answeredBy: 'landlord' });
    expect(saveCriteriaDraft(db, id, s.draft, { at: AT, smokingPolicy: 'outside' })).toEqual({ ok: true, recorded: false });
    const after = loadCriteria(db, id)!;
    expect(after.criteria.find((c) => c.code === 'C9')!.enabled).toBe(true);
    expect(after.criteria.find((c) => c.code === 'CX')).toMatchObject({ params: { title: 'Has renters insurance', answeredBy: 'landlord' } });
    expect(after.rental.smokingPolicy).toBe('outside');
    expect(C.listCriteriaHistory(db, id)).toHaveLength(0);
  });

  it('rejects a prohibited custom title even if it bypassed the editor', () => {
    const db = makeTestDb();
    const id = newRental(db);
    const list = loadCriteria(db, id)!.criteria;
    const bad: Criterion = { id: 'new-1', code: 'CX', enabled: true, order: 11, params: { title: 'No kids', answeredBy: 'applicant' } };
    const r = saveCriteriaDraft(db, id, [...list, bad]);
    expect(r).toMatchObject({ ok: false, reasonRequired: false });
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'prohibited', terms: ['kids'] });
    expect(C.listCriteria(db, id)).toHaveLength(10);
  });

  it('locked: requires a reason, records before → after, and re-checks applicants', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    const data = loadCriteria(db, id)!;
    expect(data.locked).toBe(true);
    // C1 3.0× → 2.8×: Priya ($4,700 / $1,650 = 2.85×) becomes Met
    const draft = edit(data.criteria, 'C1', (c) => ({ ...c, params: { ...c.params, multipleTenths: 28 } }) as Criterion);
    expect(saveCriteriaDraft(db, id, draft, { at: AT })).toMatchObject({ ok: false, reasonRequired: true });
    expect(saveCriteriaDraft(db, id, draft, { at: AT, reason: 'Match the published listing' })).toEqual({ ok: true, recorded: true });

    const [h] = C.listCriteriaHistory(db, id);
    expect(h.reason).toBe('Match the published listing');
    expect(describeHistoryEntry(h).changes).toEqual(['Income: at least 3.0× the rent (voucher share on) → Income: at least 2.8× the rent (voucher share on)']);
    expect(criteriaHistoryLines(db, id)).toEqual([{ at: AT, reason: 'Match the published listing', changes: describeHistoryEntry(h).changes }]);

    const eng = loadRentalForEngine(db, id)!;
    const priya = eng.applicants.find((a) => a.fullName === 'Priya Raman')!;
    expect(evaluateApplicant(eng.rental, eng.criteria, priya).results.find((r) => r.code === 'C1')!.outcome).toBe('met');
  });

  it('locked: saving with no change writes no history', () => {
    const db = makeTestDb();
    const id = loadSampleRental(db);
    const data = loadCriteria(db, id)!;
    expect(saveCriteriaDraft(db, id, data.criteria, { reason: 'checking' })).toEqual({ ok: true, recorded: false });
    expect(C.listCriteriaHistory(db, id)).toHaveLength(0);
  });

  it('records added custom criteria with their new row ids', () => {
    const db = makeTestDb();
    const id = newRental(db);
    A.createApplicant(db, { rentalId: id, receivedAt: AT, fullName: 'Sam Lee', occupants: 1 });
    const list = loadCriteria(db, id)!.criteria;
    const add: Criterion = { id: 'new-1', code: 'CX', enabled: true, order: 11, params: { title: 'Has renters insurance', answeredBy: 'landlord' } };
    expect(saveCriteriaDraft(db, id, [...list, add], { reason: 'Insurance required by HOA', at: AT }).ok).toBe(true);
    const [h] = C.listCriteriaHistory(db, id);
    const after = (h.after as { criteria: Criterion[] }).criteria;
    expect(after.find((c) => c.code === 'CX')!.id).toMatch(/^\d+$/);
    expect(describeHistoryEntry(h).changes).toEqual(['Added: Has renters insurance']);
  });

  it('handles a missing rental and unknown history shapes', () => {
    const db = makeTestDb();
    expect(loadCriteria(db, 9)).toBeNull();
    expect(saveCriteriaDraft(db, 9, [])).toMatchObject({ ok: false, notFound: true });
    expect(describeHistoryEntry({ at: AT, before: null, after: { x: 1 }, reason: 'r' }).changes).toEqual([]);
    expect(R.getRental(db, 9)).toBeNull();
  });
});
