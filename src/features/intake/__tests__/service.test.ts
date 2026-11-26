import { evaluateApplicant } from '@/engine';
import { getApplicant, getApplicantBundle, listApplicants, listIncomes, listResidences } from '@/db/repos/applicants';
import { addDocument } from '@/db/repos/verify';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import { loadRentalForEngine, toEngineApplicant } from '@/db/toEngine';
import type { AppDb } from '@/db/types';

import { emptyResidence, type ApplicationForm } from '../form/model';
import { clearSignature, createDraft, discardDraft, loadApplication, saveDraft, saveSignature, submitApplication, type SignatureFiles } from '../form/service';
import { loadIntakeRental, rentalAddress, rentalFullAddress } from '../rental';
import { localIso } from '../time';

const NOW = new Date(2026, 11, 2, 9, 14, 0);
const LATER = new Date(2026, 11, 2, 10, 30, 0);

function fakeFiles(): SignatureFiles & { written: Map<string, string>; deleted: string[] } {
  const written = new Map<string, string>();
  const deleted: string[] = [];
  return {
    written,
    deleted,
    saveText: async (o) => {
      const path = `applicants/${'applicantId' in o.owner ? o.owner.applicantId : 0}/${o.kind}-${o.id}.${o.ext}`;
      written.set(path, o.text);
      return { path, mime: 'image/svg+xml' };
    },
    deleteFile: (p) => {
      deleted.push(p);
      written.delete(p);
    },
  };
}

function jordanLike(f: ApplicationForm): ApplicationForm {
  return {
    ...f,
    fullName: '  Alex Kim ',
    phone: '(614) 555-0100',
    email: '',
    emergencyName: 'Pat Kim',
    occupants: 2,
    otherAdults: [{ key: 'a1', name: 'Sam Kim', monthlyCents: 100000 }],
    pets: { cat: 0, dog: 1, other: 0 },
    petsAnswered: true,
    hasVoucher: false,
    voucherCents: 5000,
    residences: [{ ...emptyResidence(), address: '88 Elm St', fromMonth: '2024-10', current: true, type: 'rent', rentCents: 145000, landlordName: 'Oakline' }],
    employer: 'Columbus Metro Clinic',
    jobTitle: 'Nurse',
    startMonth: '2021-03',
    monthlyCents: 520000,
    otherIncome: [{ key: 'o1', kind: 'child_support', monthlyCents: 20000 }],
    answers: { evicted: 'no', bankruptcy: 'yes', smokes: null },
    explain: { evicted: 'ignored when No', bankruptcy: ' 2020, discharged ', smokes: '' },
    consent: { authorize: true, certify: true },
    signedName: 'Alex Kim',
  };
}

describe('application service (DB)', () => {
  let db: AppDb;
  let rentalId: number;
  beforeEach(() => {
    db = makeTestDb();
    rentalId = loadSampleRental(db);
  });

  it('rental context: address, required documents, no custom questions in the sample', () => {
    const r = loadIntakeRental(db, rentalId)!;
    expect(r.address).toBe('1428 Maple St, Unit B');
    expect(r.fullAddress).toBe('1428 Maple St, Unit B, Columbus, OH 43215');
    expect(r.requiredLabels).toEqual(['Photo ID', 'Proof of income']);
    expect(r.customQuestions).toEqual([]);
    expect(loadIntakeRental(db, 999)).toBeNull();
    expect(rentalAddress({ street: '9 Oak Ave', unit: '3' })).toBe('9 Oak Ave, Unit 3');
    expect(rentalAddress({ street: '9 Oak Ave', unit: 'Apt 3' })).toBe('9 Oak Ave, Apt 3');
    expect(rentalAddress({ street: '9 Oak Ave', unit: null })).toBe('9 Oak Ave');
    expect(rentalFullAddress({ street: '9 Oak Ave', unit: null, city: 'Austin', state: 'TX', zip: null })).toBe('9 Oak Ave, Austin, TX');
  });

  it('a draft is not listed until saved; autosave round-trips every part', () => {
    const before = listApplicants(db, rentalId).length;
    const id = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    expect(listApplicants(db, rentalId)).toHaveLength(before);
    const loaded = loadApplication(db, id)!;
    expect(loaded.step).toBe(1);
    expect(loaded.receivedEditable).toBe(true);
    expect(loaded.form.receivedAt).toBe(localIso(NOW));

    const saved = saveDraft(db, id, jordanLike(loaded.form), 4, NOW);
    expect(saved.residences[0].id).toEqual(expect.any(Number));
    expect(saved.jobIncomeId).toEqual(expect.any(Number));
    expect(saved.otherAdults[0].incomeId).toEqual(expect.any(Number));

    const a = getApplicant(db, id)!;
    expect(a.fullName).toBe('Alex Kim');
    expect(a.email).toBeNull();
    expect(a.formStep).toBe(4);
    expect(a.pets).toEqual([{ kind: 'dog', count: 1 }]);
    expect(a.voucherCents).toBeNull(); // no voucher → amount dropped
    expect(a.answers).toEqual({ evicted: 'no', bankruptcy: 'yes', smokes: null, explain: { bankruptcy: '2020, discharged' } });
    expect(a.otherAdults).toEqual([{ name: 'Sam Kim' }]);
    expect(listIncomes(db, id).map((i) => [i.kind, i.monthlyCents])).toEqual([
      ['employment', 520000],
      ['child_support', 20000],
      ['other_adult', 100000],
    ]);

    // Second autosave updates the same rows (no duplicates), and reloading gives the same form back.
    saveDraft(db, id, saved, 3, NOW);
    expect(listResidences(db, id)).toHaveLength(1);
    expect(listIncomes(db, id)).toHaveLength(3);
    expect(getApplicant(db, id)!.formStep).toBe(4); // furthest part kept
    const again = loadApplication(db, id)!.form;
    expect(again.employer).toBe('Columbus Metro Clinic');
    expect(again.otherAdults).toEqual([{ key: `i${saved.otherAdults[0].incomeId}`, incomeId: saved.otherAdults[0].incomeId, name: 'Sam Kim', monthlyCents: 100000 }]);
    expect(again.explain.bankruptcy).toBe('2020, discharged');

    // Removing a line deletes its row.
    saveDraft(db, id, { ...saved, otherIncome: [] }, 4, NOW);
    expect(listIncomes(db, id).map((i) => i.kind)).toEqual(['employment', 'other_adult']);
  });

  it('pets stay "not answered" until part 2 is passed', () => {
    const id = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    saveDraft(db, id, { ...loadApplication(db, id)!.form, fullName: 'A' }, 1, NOW);
    expect(getApplicant(db, id)!.pets).toBeNull();
    saveDraft(db, id, { ...loadApplication(db, id)!.form, petsAnswered: true }, 3, NOW);
    expect(getApplicant(db, id)!.pets).toEqual([]);
  });

  it('landlord "Save applicant": chosen received time, then locked', () => {
    const id = createDraft(db, { rentalId, mode: 'landlord', now: LATER });
    const form = { ...jordanLike(loadApplication(db, id)!.form), receivedAt: localIso(NOW) };
    const r = submitApplication(db, id, form, { mode: 'landlord', now: LATER });
    expect(r.ok).toBe(true);
    const a = getApplicant(db, id)!;
    expect(a).toMatchObject({ draft: false, status: 'new', source: 'landlord', receivedAt: localIso(NOW) });
    expect(listApplicants(db, rentalId).map((x) => x.id)).toContain(id);
    expect(loadApplication(db, id)!.receivedEditable).toBe(false);

    // Later edits never move the received time.
    const edit = { ...loadApplication(db, id)!.form, receivedAt: localIso(LATER), phone: '6145550199' };
    saveDraft(db, id, edit, 1, LATER);
    expect(submitApplication(db, id, edit, { mode: 'landlord', now: LATER }).ok).toBe(true);
    expect(getApplicant(db, id)!.receivedAt).toBe(localIso(NOW));
    expect(getApplicant(db, id)!.phone).toBe('6145550199');
  });

  it('landlord with paper-form photos → source paper; future received time refused', () => {
    const id = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    addDocument(db, { applicantId: id, type: 'paper_form', filePath: `applicants/${id}/paper-1.jpg`, mime: 'image/jpeg' });
    const form = jordanLike(loadApplication(db, id)!.form);
    const bad = submitApplication(db, id, { ...form, receivedAt: localIso(LATER) }, { mode: 'landlord', now: NOW });
    expect(bad).toMatchObject({ ok: false, section: 7, errors: [{ field: 'receivedAt', code: 'receivedInFuture' }] });
    expect(getApplicant(db, id)!.draft).toBe(true);
    expect(submitApplication(db, id, form, { mode: 'landlord', now: NOW }).ok).toBe(true);
    expect(getApplicant(db, id)!.source).toBe('paper');
  });

  it('invalid form: nothing submitted, first invalid part returned', () => {
    const id = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    const r = submitApplication(db, id, loadApplication(db, id)!.form, { mode: 'landlord', now: NOW });
    expect(r).toMatchObject({ ok: false, section: 1 });
    expect(getApplicant(db, id)!.draft).toBe(true);
  });

  it('applicant mode: signature required as a saved file; received = Submit time', async () => {
    const files = fakeFiles();
    const id = createDraft(db, { rentalId, mode: 'applicant', now: NOW });
    const form = jordanLike(loadApplication(db, id)!.form);
    const noSig = submitApplication(db, id, form, { mode: 'applicant', now: LATER });
    expect(noSig).toMatchObject({ ok: false, section: 6 });

    expect(await saveSignature(db, files, id, { kind: 'typed', name: 'A' }, 'Alex Kim', NOW)).toEqual({ ok: false, error: 'signatureTooShort' });
    const sig = await saveSignature(db, files, id, { kind: 'typed', name: 'Alex Kim' }, 'Alex Kim', NOW);
    expect(sig).toEqual({ ok: true, path: `applicants/${id}/signature-${id}.svg`, signedAt: localIso(NOW) });
    expect(files.written.get(`applicants/${id}/signature-${id}.svg`)).toContain('Alex Kim');

    const r = submitApplication(db, id, { ...form, signaturePath: sig.ok ? sig.path : null }, { mode: 'applicant', now: LATER });
    expect(r).toMatchObject({ ok: true, receivedAt: localIso(LATER) });
    expect(getApplicant(db, id)).toMatchObject({ draft: false, source: 'applicant_mode', receivedAt: localIso(LATER), signedName: 'Alex Kim' });

    clearSignature(db, files, id);
    expect(files.deleted).toEqual([`applicants/${id}/signature-${id}.svg`]);
    expect(getApplicant(db, id)!.signaturePath).toBeNull();
  });

  it('the engine reads a typed-in application (C1 claimed from the form numbers)', () => {
    const id = createDraft(db, { rentalId, mode: 'landlord', now: NOW });
    submitApplication(db, id, jordanLike(loadApplication(db, id)!.form), { mode: 'landlord', now: NOW });
    const data = loadRentalForEngine(db, rentalId)!;
    const input = toEngineApplicant(getApplicantBundle(db, id)!);
    const c1 = evaluateApplicant(data.rental, data.criteria, input).results.find((x) => x.code === 'C1')!;
    // 5,200 + 200 + 1,000 = 6,400 / 1,650 = 3.88×
    expect(c1).toMatchObject({ outcome: 'met', evidence: 'claimed' });
    expect(c1.reason).toContain("3.88×");
  });

  it('discard removes a draft entirely, never a saved applicant', () => {
    const files = makeTestFiles();
    const id = createDraft(db, { rentalId, mode: 'applicant', now: NOW });
    expect(discardDraft(db, files, id)).toBe(true);
    expect(getApplicant(db, id)).toBeNull();
    const saved = listApplicants(db, rentalId)[0].id;
    expect(discardDraft(db, files, saved)).toBe(false);
    expect(getApplicant(db, saved)).not.toBeNull();
    expect(loadApplication(db, 12345)).toBeNull();
  });
});
