import { evaluateApplicant } from '@/engine';
import { getApplicantBundle, listApplicants, listIncomes } from '@/db/repos/applicants';
import { listDocuments } from '@/db/repos/verify';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import { loadRentalForEngine, toEngineApplicant } from '@/db/toEngine';
import type { AppDb, DocumentRow, Income } from '@/db/types';

import { pick, sourcesAfter, type AttachmentPicker } from '../documents/picker';
import {
  addPickedDocument,
  documentCounts,
  documentSlots,
  incomeCheckFor,
  markChecked,
  paperFormPhotos,
  removeDocument,
  setIncomeDetails,
  toDocumentInput,
  type AttachmentFiles,
} from '../documents/service';
import { createDraft, loadApplication, saveDraft } from '../form/service';
import { loadIntakeRental } from '../rental';

const NOW = new Date(2026, 11, 5, 10, 0);
const picked = { status: 'picked' as const, uri: 'file:///cache/p.jpg', mime: 'image/jpeg', name: 'p.jpg' };

function fakeFiles(fail = false): AttachmentFiles & { saved: string[]; deleted: string[] } {
  let n = 0;
  const f = {
    saved: [] as string[],
    deleted: [] as string[],
    saveAttachment: async (o: Parameters<AttachmentFiles['saveAttachment']>[0]) => {
      if (fail) throw new Error('disk full');
      const path = `applicants/${'applicantId' in o.owner ? o.owner.applicantId : 0}/${o.kind}-t${++n}.jpg`;
      f.saved.push(path);
      return { path, mime: 'image/jpeg' };
    },
    deleteFile: (p: string) => void f.deleted.push(p),
  };
  return f;
}

const byName = (db: AppDb, rentalId: number, name: string) => listApplicants(db, rentalId).find((a) => a.fullName === name)!;

describe('documents (S-10)', () => {
  let db: AppDb;
  let rentalId: number;
  beforeEach(() => {
    db = makeTestDb();
    rentalId = loadSampleRental(db);
  });

  it('slots from C6: Priya has an unchecked ID and no proof of income, Jordan has both checked', () => {
    const required = loadIntakeRental(db, rentalId)!.requiredDocuments;
    const priya = byName(db, rentalId, 'Priya Raman');
    const p = documentSlots(required, listDocuments(db, priya.id));
    expect(p.slots.map((s) => [s.label, s.state])).toEqual([
      ['Photo ID', 'provided'],
      ['Proof of income', 'missing'],
    ]);
    expect(documentCounts(required, listDocuments(db, priya.id))).toMatchObject({ required: 2, provided: 1, checked: 0, missing: ['Proof of income'] });
    const jordan = byName(db, rentalId, 'Jordan Ellis');
    expect(documentSlots(required, listDocuments(db, jordan.id)).slots.map((s) => s.state)).toEqual(['checked', 'checked']);
  });

  it('add → provided → checked; C6 follows (Missing → Met claimed → Met verified)', async () => {
    const required = loadIntakeRental(db, rentalId)!.requiredDocuments;
    const priya = byName(db, rentalId, 'Priya Raman');
    const files = fakeFiles();
    const c6 = () => {
      const d = loadRentalForEngine(db, rentalId)!;
      return evaluateApplicant(d.rental, d.criteria, toEngineApplicant(getApplicantBundle(db, priya.id)!)).results.find((r) => r.code === 'C6')!;
    };
    expect(c6()).toMatchObject({ outcome: 'missing', reason: 'Missing: Proof of income' });
    const sampleId = listDocuments(db, priya.id)[0].id;
    removeDocument(db, makeTestFiles(), sampleId);
    expect(c6()).toMatchObject({ outcome: 'missing', reason: 'Missing: Photo ID, Proof of income' });

    const idDoc = await addPickedDocument(db, files, { applicantId: priya.id, type: 'photo_id', picked }, NOW);
    const payDoc = await addPickedDocument(db, files, { applicantId: priya.id, type: 'proof_of_income', picked }, NOW);
    expect(files.saved).toEqual([`applicants/${priya.id}/doc-t1.jpg`, `applicants/${priya.id}/doc-t2.jpg`]);
    expect(documentSlots(required, listDocuments(db, priya.id)).slots.map((s) => s.state)).toEqual(['provided', 'provided']);
    expect(c6()).toMatchObject({ outcome: 'met', evidence: 'claimed' });

    markChecked(db, idDoc, true, NOW);
    markChecked(db, payDoc, true, NOW);
    expect(listDocuments(db, priya.id).every((d) => d.checkedAt?.startsWith('2026-12-05T10:00'))).toBe(true);
    expect(c6()).toMatchObject({ outcome: 'met', evidence: 'verified' });
    markChecked(db, payDoc, false, NOW);
    expect(documentSlots(required, listDocuments(db, priya.id)).slots[1].state).toBe('provided');

    const store = makeTestFiles(listDocuments(db, priya.id).map((d) => d.filePath));
    removeDocument(db, store, idDoc);
    expect(store.files.has(`applicants/${priya.id}/doc-t1.jpg`)).toBe(false);
    expect(documentSlots(required, listDocuments(db, priya.id)).slots[0].state).toBe('missing');
  });

  it('other files and paper-form photos are kept apart from the required slots', async () => {
    const priya = byName(db, rentalId, 'Priya Raman');
    const files = fakeFiles();
    await addPickedDocument(db, files, { applicantId: priya.id, type: 'bank_statement', picked }, NOW);
    await addPickedDocument(db, files, { applicantId: priya.id, type: 'other', label: '  ', picked }, NOW);
    await addPickedDocument(db, files, { applicantId: priya.id, type: 'paper_form', picked }, NOW);
    const rows = listDocuments(db, priya.id);
    const r = documentSlots([{ type: 'photo_id' }, { type: 'other', label: 'Pet records' }], rows);
    expect(r.slots.map((s) => [s.key, s.state])).toEqual([
      ['photo_id', 'provided'],
      ['other:pet records', 'missing'],
    ]);
    expect(r.otherFiles.map((d) => [d.type, d.label])).toEqual([
      ['bank_statement', null],
      ['other', 'Other'],
    ]);
    expect(paperFormPhotos(rows)).toHaveLength(1);
    expect(files.saved[2]).toContain('/paper-');
    expect(toDocumentInput(paperFormPhotos(rows)[0])).toBeNull();
    // An "Other" file with the required label fills that slot (case-insensitive).
    await addPickedDocument(db, files, { applicantId: priya.id, type: 'other', label: 'pet RECORDS', picked }, NOW);
    expect(documentSlots([{ type: 'other', label: 'Pet records' }], listDocuments(db, priya.id)).slots[0].state).toBe('provided');
  });

  // B-160: a paper-form photo attached to a new application can be removed again (row + file), draft or saved.
  it('deleting a paper-form photo removes its row and file; the others and the saved application stay', async () => {
    const files = fakeFiles();
    const store = makeTestFiles();
    const draft = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    const id1 = await addPickedDocument(db, files, { applicantId: draft, type: 'paper_form', picked }, NOW);
    await addPickedDocument(db, files, { applicantId: draft, type: 'paper_form', picked }, NOW);
    // Back to the draft later: both photos are still there.
    expect(paperFormPhotos(listDocuments(db, draft))).toHaveLength(2);
    const path1 = listDocuments(db, draft).find((d) => d.id === id1)!.filePath;
    store.files.add(path1);
    removeDocument(db, store, id1);
    expect(store.files.has(path1)).toBe(false);
    expect(paperFormPhotos(listDocuments(db, draft)).map((d) => d.id)).not.toContain(id1);
    expect(paperFormPhotos(listDocuments(db, draft))).toHaveLength(1);
    // Autosave / Save never bring it back (the form only writes the application, not the files).
    saveDraft(db, draft, { ...loadApplication(db, draft)!.form, fullName: 'Paper Person' }, 7, NOW);
    expect(paperFormPhotos(listDocuments(db, draft))).toHaveLength(1);
    expect(listDocuments(db, draft).some((d) => d.id === id1)).toBe(false);
  });

  it('a failed save adds no row; a failed insert removes the file', async () => {
    const priya = byName(db, rentalId, 'Priya Raman');
    const before = listDocuments(db, priya.id).length;
    await expect(addPickedDocument(db, fakeFiles(true), { applicantId: priya.id, type: 'photo_id', picked })).rejects.toThrow('disk full');
    expect(listDocuments(db, priya.id)).toHaveLength(before);
    const files = fakeFiles();
    await expect(addPickedDocument(db, files, { applicantId: 99999, type: 'photo_id', picked })).rejects.toThrow();
    expect(files.deleted).toEqual(files.saved);
  });
});

describe('income check (S-10, §3.3)', () => {
  const doc = (p: Partial<DocumentRow>): DocumentRow =>
    ({ id: 1, applicantId: 1, type: 'proof_of_income', label: null, filePath: 'applicants/1/d.jpg', mime: null, addedAt: '', checkedAt: null, incomeId: null, payGrossCents: null, payFrequency: null, monthlyCents: null, ...p }) as DocumentRow;
  const inc = (id: number, monthlyCents: number | null): Income =>
    ({ id, applicantId: 1, kind: 'employment', employer: null, title: null, startOn: null, monthlyCents, phone: null, supervisor: null, person: null, order: 0 }) as Income;

  it('mockup v2: $2,123.08 every 2 weeks vs $5,200 stated → −12 % Mismatch', () => {
    const r = incomeCheckFor(doc({ payGrossCents: 212308, payFrequency: 'biweekly' }), [inc(5, 520000)]);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.check).toMatchObject({ docMonthlyCents: 460001, mismatch: true });
    expect(r.check.text).toBe('≈ $4,600.01/mo vs $5,200 stated (−12%)');
  });

  it('§8 Jordan: $2,470 biweekly = $5,351.67/mo vs $5,400 — no mismatch', () => {
    const r = incomeCheckFor(doc({ payGrossCents: 247000, payFrequency: 'biweekly' }), [inc(5, 540000)]);
    expect(r.status === 'ok' && r.check).toMatchObject({ docMonthlyCents: 535167, mismatch: false });
  });

  it('letters use the typed monthly amount; links pick the income line', () => {
    const incomes = [inc(5, 300000), inc(6, 100000)];
    expect(incomeCheckFor(doc({ monthlyCents: 90000 }), incomes)).toMatchObject({ status: 'choose_income' });
    const r = incomeCheckFor(doc({ monthlyCents: 90000, incomeId: 6 }), incomes);
    expect(r.status === 'ok' && r.check.mismatch).toBe(false);
    expect(incomeCheckFor(doc({}), incomes)).toEqual({ status: 'no_amount' });
    expect(incomeCheckFor(doc({ monthlyCents: 1 }), [inc(5, null)])).toEqual({ status: 'no_stated' });
    expect(incomeCheckFor(doc({ monthlyCents: 1 }), [])).toEqual({ status: 'no_stated' });
  });

  it('saving pay details clears the other kind and updates C1 evidence', async () => {
    const db = makeTestDb();
    const rentalId = loadSampleRental(db);
    const priya = byName(db, rentalId, 'Priya Raman');
    const files = fakeFiles();
    const id = await addPickedDocument(db, files, { applicantId: priya.id, type: 'proof_of_income', picked }, NOW);
    setIncomeDetails(db, id, { kind: 'monthly', monthlyCents: 470000 });
    setIncomeDetails(db, id, { kind: 'pay_stub', payGrossCents: 150000, payFrequency: 'biweekly', incomeId: listIncomes(db, priya.id)[0].id });
    const row = listDocuments(db, priya.id).find((x) => x.id === id)!;
    expect(row).toMatchObject({ monthlyCents: null, payGrossCents: 150000, payFrequency: 'biweekly', incomeId: listIncomes(db, priya.id)[0].id });
    markChecked(db, id, true, NOW);
    const d = loadRentalForEngine(db, rentalId)!;
    const c1 = evaluateApplicant(d.rental, d.criteria, toEngineApplicant(getApplicantBundle(db, priya.id)!)).results.find((r) => r.code === 'C1')!;
    expect(c1.evidence).toBe('mismatch'); // $3,250/mo on paper vs $4,700 stated
  });
});

describe('attachment picker', () => {
  const picker = (camera: Awaited<ReturnType<AttachmentPicker['camera']>>): AttachmentPicker => ({
    camera: async () => camera,
    library: async () => picked,
    file: () => Promise.reject(new Error('native')),
  });

  it('camera denied → photos and files still offered', async () => {
    const r = await pick(picker({ status: 'denied', source: 'camera', canAskAgain: false }), 'camera');
    expect(r).toEqual({ status: 'denied', source: 'camera', canAskAgain: false });
    expect(sourcesAfter(r)).toEqual(['library', 'file']);
    expect(await pick(picker({ status: 'cancelled' }), 'library')).toBe(picked);
    expect(sourcesAfter(picked)).toEqual(['camera', 'library', 'file']);
  });

  it('a native failure is an error result, not a crash', async () => {
    expect(await pick(picker({ status: 'cancelled' }), 'file')).toEqual({ status: 'error' });
  });
});
