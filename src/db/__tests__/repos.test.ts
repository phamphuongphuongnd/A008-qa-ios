import { sql } from 'drizzle-orm';

import { evaluateApplicant, SAMPLE } from '@/engine';

import * as A from '../repos/applicants';
import * as C from '../repos/criteria';
import * as D from '../repos/data';
import * as Dec from '../repos/decisions';
import * as M from '../repos/movein';
import * as R from '../repos/rentals';
import * as S from '../repos/sample';
import * as Set from '../repos/settings';
import * as V from '../repos/verify';
import { makeTestDb, makeTestFiles } from '../testing/testDb';
import { loadRentalForEngine, toEngineApplicant, toEngineCriteria } from '../toEngine';
import type { AppDb } from '../types';

const RECEIVED = '2026-12-02T09:14:00-05:00';

function rental(db: AppDb, extra: Partial<Parameters<typeof R.createRental>[1]> = {}) {
  return R.createRental(db, { street: '1428 Maple St', unit: 'B', city: 'Columbus', state: 'OH', zip: '43215', rentCents: 165000, bedrooms: 2, bathrooms: 1, ...extra });
}

function applicant(db: AppDb, rentalId: number, name = 'Jordan Ellis', receivedAt = RECEIVED) {
  return A.createApplicant(db, { rentalId, receivedAt, fullName: name, phone: '614-555-0101', email: 'j@example.com', occupants: 2 });
}

describe('migration', () => {
  it('creates every table and runs clean on an empty database', () => {
    const db = makeTestDb();
    const tables = db
      .all<{ name: string }>(sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'`)
      .map((r) => r.name)
      .sort();
    expect(tables).toEqual([...D.TABLE_NAMES].sort());
  });

  it('has no SSN, date of birth or protected-characteristic column anywhere', () => {
    const db = makeTestDb();
    for (const t of D.TABLE_NAMES) {
      const cols = db.all<{ name: string }>(sql.raw(`pragma table_info("${t}")`)).map((c) => c.name);
      for (const c of cols) expect(c).not.toMatch(/ssn|social|birth|dob|gender|sex|race|religion|national|citizen|disab|marital/i);
    }
  });

  it('stores money as INTEGER columns', () => {
    const db = makeTestDb();
    for (const t of D.TABLE_NAMES) {
      for (const c of db.all<{ name: string; type: string }>(sql.raw(`pragma table_info("${t}")`))) {
        if (c.name.endsWith('_cents')) expect(`${t}.${c.name} ${c.type.toLowerCase()}`).toBe(`${t}.${c.name} integer`);
      }
    }
  });
});

describe('rentals', () => {
  it('creates, lists with applicant counts, updates, closes and deletes', () => {
    const db = makeTestDb();
    const files = makeTestFiles(['applicants/1/id.jpg', 'rentals/1/movein.pdf']);
    const id = rental(db);
    const other = rental(db, { street: '77 Birch Ave', reviewMode: 'first_come' });
    applicant(db, id);
    A.createApplicant(db, { rentalId: id, receivedAt: RECEIVED, fullName: 'Draft', draft: true });

    expect(R.listRentals(db, 'open').map((r) => [r.street, r.applicantCount])).toEqual([
      ['77 Birch Ave', 0],
      ['1428 Maple St', 1],
    ]);
    R.updateRental(db, id, { rentCents: 170000 });
    expect(R.getRental(db, id)?.rentCents).toBe(170000);

    R.setRentalStatus(db, other, 'closed', '2027-01-10T10:00:00Z');
    expect(R.getRental(db, other)?.closedAt).toBe('2027-01-10T10:00:00Z');
    expect(R.listRentals(db, 'closed').map((r) => r.id)).toEqual([other]);
    expect(R.countRentals(db)).toEqual({ open: 1, closed: 1 });
    R.setRentalStatus(db, other, 'open');
    expect(R.getRental(db, other)?.closedAt).toBeNull();

    R.deleteRental(db, files, id);
    expect(R.getRental(db, id)).toBeNull();
    expect(A.listApplicants(db, id, { drafts: true, deleted: true })).toEqual([]);
    expect([...files.files]).toEqual([]);
  });

  it('keeps cents exact (no float drift)', () => {
    const db = makeTestDb();
    const id = rental(db, { rentCents: 535167, depositCents: 999999999, feeCents: 1 });
    const r = R.getRental(db, id)!;
    expect([r.rentCents, r.depositCents, r.feeCents]).toEqual([535167, 999999999, 1]);
    expect(Number.isInteger(r.rentCents)).toBe(true);
    const raw = db.get<{ t: string }>(sql`select typeof(rent_cents) as t from rentals where id = ${id}`);
    expect(raw?.t).toBe('integer');
  });
});

describe('criteria', () => {
  const set: C.CriterionInput[] = [
    { code: 'C1', params: { multipleTenths: 30, applyToTenantShare: true } },
    { code: 'C2', params: { months: 12 } },
    { code: 'C9', enabled: false, params: { minScore: 600 } },
  ];

  it('saves the set, updates by code, removes missing codes', () => {
    const db = makeTestDb();
    const id = rental(db);
    C.saveCriteria(db, id, set);
    expect(C.listCriteria(db, id).map((c) => [c.code, c.enabled, c.params])).toEqual([
      ['C1', true, { multipleTenths: 30, applyToTenantShare: true }],
      ['C2', true, { months: 12 }],
      ['C9', false, { minScore: 600 }],
    ]);
    const c1 = C.listCriteria(db, id)[0];
    const ids = C.saveCriteria(db, id, [
      { code: 'C1', params: { multipleTenths: 25, applyToTenantShare: true } },
      { code: 'CX', params: { title: 'Has renter insurance', answeredBy: 'landlord' } },
      { code: 'CX', params: { title: 'Can move in by Jan 15', answeredBy: 'applicant' } },
    ]);
    const after = C.listCriteria(db, id);
    expect(after.map((c) => c.code)).toEqual(['C1', 'CX', 'CX']);
    expect(after[0].id).toBe(c1.id);
    // Two custom criteria are told apart by id.
    C.saveCriteria(db, id, [
      { id: ids[0], code: 'C1', params: { multipleTenths: 25, applyToTenantShare: true } },
      { id: ids[2], code: 'CX', params: { title: 'Can move in by Jan 20', answeredBy: 'applicant' } },
    ]);
    expect(C.listCriteria(db, id).map((c) => [c.id, c.params])).toEqual([
      [ids[0], { multipleTenths: 25, applyToTenantShare: true }],
      [ids[2], { title: 'Can move in by Jan 20', answeredBy: 'applicant' }],
    ]);
    C.updateCriterion(db, c1.id, { enabled: false });
    expect(C.listCriteria(db, id)[0].enabled).toBe(false);
  });

  it('locks with the first applicant and records changes with a reason', () => {
    const db = makeTestDb();
    const id = rental(db);
    C.saveCriteria(db, id, set);
    expect(C.isCriteriaLocked(db, id)).toBe(false);
    A.createApplicant(db, { rentalId: id, receivedAt: RECEIVED, fullName: 'Draft', draft: true });
    expect(C.isCriteriaLocked(db, id)).toBe(false);
    applicant(db, id);
    expect(C.isCriteriaLocked(db, id)).toBe(true);
    C.saveCriteriaWithReason(db, id, [{ code: 'C1', params: { multipleTenths: 25, applyToTenantShare: true } }], 'Market rents fell', '2026-12-05T10:00:00Z');
    const h = C.listCriteriaHistory(db, id);
    expect(h).toHaveLength(1);
    expect(h[0].reason).toBe('Market rents fell');
    expect((h[0].before as { code: string }[]).map((c) => c.code)).toEqual(['C1', 'C2', 'C9']);
    expect(h[0].after).toEqual([expect.objectContaining({ code: 'C1', params: { multipleTenths: 25, applyToTenantShare: true } })]);
  });
});

describe('applicants', () => {
  it('lists in received order, saves the application parts and bundles everything', () => {
    const db = makeTestDb();
    const r = rental(db);
    const b = applicant(db, r, 'Priya Raman', '2026-12-02T14:40:00-05:00');
    const a = applicant(db, r, 'Jordan Ellis', '2026-12-02T09:14:00-05:00');
    expect(A.listApplicants(db, r).map((x) => x.id)).toEqual([a, b]);

    A.updateApplicant(db, a, { pets: [{ kind: 'dog', count: 1 }], hasVoucher: false, emergency: { name: 'Sam', phone: '1' } });
    expect(A.getApplicant(db, a)?.pets).toEqual([{ kind: 'dog', count: 1 }]);

    const [r1, r2] = A.saveResidences(db, a, [
      { address: '9 Oak Rd', fromMonth: '2024-10', current: true, type: 'rent', rentCents: 140000 },
      { address: '1 Elm St', fromMonth: '2022-01', toMonth: '2024-09', type: 'rent', rentCents: 120000 },
    ]);
    // Editing keeps the id of a residence still there and drops the other.
    A.saveResidences(db, a, [{ id: r1, address: '9 Oak Rd, Apt 2', fromMonth: '2024-10', current: true }]);
    expect(A.listResidences(db, a).map((x) => [x.id, x.address])).toEqual([[r1, '9 Oak Rd, Apt 2']]);
    expect(r2).not.toBe(r1);

    A.saveIncomes(db, a, [
      { kind: 'employment', employer: 'Acme', monthlyCents: 540000 },
      { kind: 'other_adult', person: 'Sam', monthlyCents: 120050 },
    ]);
    expect(A.listIncomes(db, a).map((x) => x.monthlyCents)).toEqual([540000, 120050]);

    const ref = V.ensureLandlordReference(db, a, r1);
    expect(V.ensureLandlordReference(db, a, r1)).toBe(ref);
    V.addAttempt(db, { referenceId: ref, at: '2026-12-03T10:00:00Z', method: 'call', result: 'no_answer' });
    const bundle = A.getApplicantBundle(db, a)!;
    expect(bundle.applicant.fullName).toBe('Jordan Ellis');
    expect(bundle.references[0].attempts).toHaveLength(1);
    expect(bundle.residences).toHaveLength(1);
    expect(A.getApplicantBundle(db, 999)).toBeNull();
  });
});

describe('verification', () => {
  it('documents: add, check, income check, delete with file', () => {
    const db = makeTestDb();
    const a = applicant(db, rental(db));
    const files = makeTestFiles([`applicants/${a}/stub1.jpg`, `applicants/${a}/id.jpg`]);
    const d = V.addDocument(db, { applicantId: a, type: 'proof_of_income', filePath: `applicants/${a}/stub1.jpg`, mime: 'image/jpeg' });
    V.addDocument(db, { applicantId: a, type: 'photo_id', filePath: `applicants/${a}/id.jpg` });
    V.updateDocument(db, d, { payGrossCents: 247000, payFrequency: 'biweekly' });
    V.setDocumentChecked(db, d, '2026-12-03T09:00:00Z');
    expect(V.listDocuments(db, a)[0]).toMatchObject({ payGrossCents: 247000, payFrequency: 'biweekly', checkedAt: '2026-12-03T09:00:00Z' });
    V.deleteDocument(db, files, d);
    expect(V.listDocuments(db, a).map((x) => x.type)).toEqual(['photo_id']);
    expect([...files.files]).toEqual([`applicants/${a}/id.jpg`]);
  });

  it('report and background are one per applicant (upsert)', () => {
    const db = makeTestDb();
    const a = applicant(db, rental(db));
    const files = makeTestFiles([`applicants/${a}/report.pdf`]);
    const id1 = V.saveReport(db, a, { companyName: 'TransUnion Rental Screening Solutions', landlordCollectionsCents: 231000, evictions: [] });
    const id2 = V.saveReport(db, a, { companyPhone: '1-800-230-9376', filePaths: [`applicants/${a}/report.pdf`] });
    expect(id2).toBe(id1);
    expect(V.getReport(db, a)).toMatchObject({ companyName: 'TransUnion Rental Screening Solutions', landlordCollectionsCents: 231000, evictions: [], companyPhone: '1-800-230-9376' });
    V.deleteReport(db, files, a);
    expect(V.getReport(db, a)).toBeNull();
    expect(files.files.size).toBe(0);

    V.saveBackground(db, a, { noConvictions: true });
    V.saveBackground(db, a, { outcome: 'continue' });
    expect(V.getBackground(db, a)).toMatchObject({ noConvictions: true, outcome: 'continue' });
  });
});

describe('decisions, letters, timers', () => {
  it('a report-based denial starts as notice pending → created → sent', () => {
    const db = makeTestDb();
    const r = rental(db);
    const a = applicant(db, r);
    const d = Dec.saveDecision(db, { applicantId: a, kind: 'deny', reasons: [{ criterionId: '5', code: 'C5', source: 'screening_report' }], reportInfluenced: true, at: '2026-12-06T10:00:00Z', noticeRequired: true }, 'denied');
    expect(A.getApplicant(db, a)?.status).toBe('denied');
    expect(Dec.latestDecision(db, a)?.noticeStatus).toBe('pending');
    expect(Dec.listPendingNotices(db, r).map((x) => x.id)).toEqual([d]);
    const l = Dec.createLetter(db, { decisionId: d, kind: 'adverse_action', pdfPath: `applicants/${a}/letter.pdf` });
    expect(Dec.latestDecision(db, a)?.noticeStatus).toBe('created');
    Dec.markLetterSent(db, l, 'mail', '2026-12-06T12:00:00Z');
    expect(Dec.getLetter(db, l)).toMatchObject({ sentAt: '2026-12-06T12:00:00Z', sentMethod: 'mail' });
    expect(Dec.latestDecision(db, a)?.noticeStatus).toBe('sent');
    expect(Dec.listPendingNotices(db, r)).toEqual([]);
  });

  it('a decision without a notice is not pending', () => {
    const db = makeTestDb();
    const a = applicant(db, rental(db));
    Dec.saveDecision(db, { applicantId: a, kind: 'deny', reasons: [{ criterionId: '4', code: 'C4', source: 'landlord_reference' }], at: '2026-12-06T10:00:00Z', noticeRequired: false });
    expect(Dec.latestDecision(db, a)?.noticeStatus).toBe('not_required');
  });

  it('timers: start, active, resolve', () => {
    const db = makeTestDb();
    const r = rental(db, { reviewMode: 'first_come' });
    const a = applicant(db, r);
    const t = Dec.startTimer(db, { applicantId: a, kind: 'missing_info', startedAt: '2026-12-02T10:00:00Z', endsAt: '2026-12-05T10:00:00Z' });
    Dec.setTimerNotifications(db, t, ['n1', 'n2']);
    expect(Dec.activeTimer(db, a, 'missing_info')?.notificationIds).toEqual(['n1', 'n2']);
    expect(Dec.listActiveTimers(db, r).map((x) => x.id)).toEqual([t]);
    expect(Dec.listActiveTimers(db, 999)).toEqual([]);
    Dec.resolveTimer(db, t, '2026-12-03T10:00:00Z');
    expect(Dec.activeTimer(db, a)).toBeNull();
  });
});

describe('move-in + settings', () => {
  it('move-in checklist saves in parts', () => {
    const db = makeTestDb();
    const r = rental(db);
    const a = applicant(db, r);
    const id = M.createMoveIn(db, { rentalId: r, applicantId: a, rooms: [{ name: 'Kitchen', items: [{ name: 'Walls' }] }] });
    M.updateMoveIn(db, id, { keys: 2, meters: { electric: '04512' } });
    expect(M.getMoveIn(db, r)).toMatchObject({ keys: 2, meters: { electric: '04512' }, rooms: [{ name: 'Kitchen', items: [{ name: 'Walls' }] }] });
  });

  it('settings: defaults, partial update, bad JSON falls back', () => {
    const db = makeTestDb();
    expect(Set.getSettings(db)).toEqual(Set.DEFAULT_SETTINGS);
    Set.updateSettings(db, { theme: 'dark', landlordName: 'Alex Kim', cleanupAfterDays: null });
    expect(Set.getSetting(db, 'theme')).toBe('dark');
    expect(Set.getSettings(db)).toMatchObject({ landlordName: 'Alex Kim', cleanupAfterDays: null, onboarded: false });
    db.run(sql`update settings set value = '{oops' where key = 'theme'`);
    expect(Set.getSetting(db, 'theme')).toBe('system');
  });
});

describe('Disposal Rule delete', () => {
  function fullApplicant(db: AppDb, r: number, name: string) {
    const a = applicant(db, r, name);
    const [res] = A.saveResidences(db, a, [{ address: '9 Oak Rd', current: true }]);
    A.saveIncomes(db, a, [{ kind: 'employment', monthlyCents: 540000 }]);
    V.addDocument(db, { applicantId: a, type: 'photo_id', filePath: `applicants/${a}/id.jpg` });
    const ref = V.ensureLandlordReference(db, a, res);
    V.addAttempt(db, { referenceId: ref, at: RECEIVED, method: 'call', result: 'reached' });
    V.saveReport(db, a, { companyName: 'X', filePaths: [`applicants/${a}/r.pdf`] });
    V.saveBackground(db, a, { noConvictions: true });
    const d = Dec.saveDecision(db, { applicantId: a, kind: 'deny', at: RECEIVED, noticeRequired: true }, 'denied');
    Dec.createLetter(db, { decisionId: d, kind: 'adverse_action' });
    Dec.startTimer(db, { applicantId: a, kind: 'offer', startedAt: RECEIVED, endsAt: RECEIVED });
    A.updateApplicant(db, a, { signaturePath: `applicants/${a}/sig.svg`, signedName: name, answers: { evicted: 'no', bankruptcy: null, smokes: null }, customAnswers: { '9': true } });
    return a;
  }
  const count = (db: AppDb, table: string, a: number) =>
    Number(db.get<{ n: number }>(sql.raw(`select count(*) as n from "${table}" where applicant_id = ${a}`))?.n);

  it('erases every row and file of one applicant, keeps an anonymous record, leaves others alone', () => {
    const db = makeTestDb();
    const r = rental(db);
    const a = fullApplicant(db, r, 'Priya Raman');
    const b = fullApplicant(db, r, 'Marcus Webb');
    const files = makeTestFiles([`applicants/${a}/id.jpg`, `applicants/${a}/r.pdf`, `applicants/${a}/sig.svg`, `applicants/${b}/id.jpg`]);

    A.purgeApplicant(db, files, a, { at: '2027-01-10T09:00:00Z' });

    for (const t of ['residences', 'incomes', 'documents', 'references', 'reports', 'background', 'decisions', 'timers']) expect(count(db, t, a)).toBe(0);
    expect(Number(db.get<{ n: number }>(sql`select count(*) as n from attempts`)?.n)).toBe(1); // b's
    expect(Number(db.get<{ n: number }>(sql`select count(*) as n from letters`)?.n)).toBe(1); // b's
    const tomb = A.getApplicant(db, a)!;
    expect(tomb).toMatchObject({ fullName: '', phone: null, email: null, signaturePath: null, signedName: null, answers: null, customAnswers: null, deletedAt: '2027-01-10T09:00:00Z', status: 'denied', receivedAt: RECEIVED });
    expect(A.listApplicants(db, r).map((x) => x.id)).toEqual([b]);
    expect(A.listApplicants(db, r, { deleted: true }).map((x) => x.id)).toEqual([a, b]);
    expect([...files.files]).toEqual([`applicants/${b}/id.jpg`]);
    expect(A.getApplicantBundle(db, b)!.documents).toHaveLength(1);
  });

  it('can remove the record too, and purge several at once', () => {
    const db = makeTestDb();
    const r = rental(db);
    const a = fullApplicant(db, r, 'A');
    const b = fullApplicant(db, r, 'B');
    const c = fullApplicant(db, r, 'C');
    const files = makeTestFiles();
    A.purgeApplicant(db, files, a, { keepRecord: false });
    expect(A.getApplicant(db, a)).toBeNull();
    A.purgeApplicants(db, files, [b, c]);
    expect(A.listApplicants(db, r)).toEqual([]);
    expect(A.listApplicants(db, r, { deleted: true })).toHaveLength(2);
  });

  it('lists closed rentals that still hold data of applicants not selected', () => {
    const db = makeTestDb();
    const r1 = rental(db);
    const r2 = rental(db, { street: 'Sample', isSample: true });
    const a = applicant(db, r1, 'A');
    const b = applicant(db, r1, 'B');
    applicant(db, r2, 'S');
    A.setApplicantStatus(db, b, 'approved');
    expect(R.listCleanupCandidates(db)).toEqual([]);
    R.setRentalStatus(db, r1, 'closed', '2026-11-01T00:00:00Z');
    R.setRentalStatus(db, r2, 'closed', '2026-11-01T00:00:00Z');
    expect(R.listCleanupCandidates(db).map((c) => [c.rental.id, c.applicantIds])).toEqual([[r1, [a]]]);
    expect(R.listCleanupCandidates(db, '2026-10-01T00:00:00Z')).toEqual([]);
    A.purgeApplicant(db, makeTestFiles(), a);
    expect(R.listCleanupCandidates(db)).toEqual([]);
  });
});

describe('delete all, backup dump', () => {
  it('deleteAllData empties every table, removes the file roots and restarts ids', () => {
    const db = makeTestDb();
    const r = rental(db);
    applicant(db, r);
    Set.updateSettings(db, { onboarded: true });
    const files = makeTestFiles(['applicants/1/id.jpg', 'rentals/1/x.pdf']);
    D.deleteAllData(db, files);
    const dump = D.dumpAll(db);
    for (const t of D.TABLE_NAMES) expect(dump[t]).toEqual([]);
    expect(files.files.size).toBe(0);
    expect(rental(db)).toBe(1);
    expect(Set.getSetting(db, 'onboarded')).toBe(false);
  });

  it('dump → replace round-trips every row exactly', () => {
    const db = makeTestDb();
    const r = rental(db, { rentCents: 535167 });
    const a = applicant(db, r);
    C.saveCriteria(db, r, [{ code: 'C1', params: { multipleTenths: 30, applyToTenantShare: true } }]);
    A.saveResidences(db, a, [{ address: 'x' }]);
    Dec.saveDecision(db, { applicantId: a, kind: 'approve', at: RECEIVED, conditions: [{ kind: 'higher_deposit', amountCents: 200050 }] });
    Set.updateSettings(db, { theme: 'dark' });
    const dump = JSON.parse(JSON.stringify(D.dumpAll(db))) as D.DataDump;

    const other = makeTestDb();
    rental(other, { street: 'old' });
    D.replaceAllData(other, dump);
    expect(D.dumpAll(other)).toEqual(D.dumpAll(db));
    expect(D.countDump(dump)).toEqual({ rentals: 1, applicants: 1 });
  });
});

describe('sample rental (engine SAMPLE)', () => {
  const view = (e: ReturnType<typeof evaluateApplicant>) => ({
    summary: e.summary,
    results: e.results.map((r) => ({
      code: r.code,
      outcome: r.outcome,
      evidence: r.evidence,
      source: r.source,
      verifiedOn: r.verifiedOn,
      reason: r.reason,
      issues: r.issues.map((x) => [x.kind, x.message, x.action]),
    })),
  });

  it('loads once, flagged sample, and gives the same engine results as the fixture (round trip)', () => {
    const db = makeTestDb();
    const id = S.loadSampleRental(db);
    expect(S.loadSampleRental(db)).toBe(id);
    expect(R.getRental(db, id)).toMatchObject({ isSample: true, street: '1428 Maple St', rentCents: 165000 });
    const loaded = loadRentalForEngine(db, id)!;
    expect(loaded.applicants.map((a) => a.fullName)).toEqual(SAMPLE.applicants.map((a) => a.fullName));
    SAMPLE.applicants.forEach((orig, i) => {
      const fromDb = evaluateApplicant(loaded.rental, loaded.criteria, loaded.applicants[i]);
      expect(view(fromDb)).toEqual(view(evaluateApplicant(SAMPLE.rental, SAMPLE.criteria, orig)));
    });
    // §8 headline results.
    expect(loaded.applicants.map((a) => evaluateApplicant(loaded.rental, loaded.criteria, a).summary.text)).toEqual([
      'Ready to decide',
      '2 items missing',
      '1 item missing',
      'Ready to decide',
    ]);
  });

  it('is removed completely', () => {
    const db = makeTestDb();
    const id = S.loadSampleRental(db);
    const [a] = A.listApplicants(db, id);
    const files = makeTestFiles([`applicants/${a.id}/letter.pdf`]);
    S.removeSampleRental(db, files);
    expect(R.listRentals(db)).toEqual([]);
    expect(A.getApplicant(db, a.id)).toBeNull();
    expect(files.files.size).toBe(0);
    expect(R.listCleanupCandidates(db)).toEqual([]);
  });
});

describe('toEngine', () => {
  it('maps a hand-entered applicant (custom answers keyed by criterion row id, unfinished residence left out)', () => {
    const db = makeTestDb();
    const r = rental(db);
    const [, cx] = C.saveCriteria(db, r, [
      { code: 'C1', params: { multipleTenths: 30, applyToTenantShare: true } },
      { code: 'CX', params: { title: 'Has renter insurance', answeredBy: 'applicant' } },
    ]);
    const a = applicant(db, r);
    A.updateApplicant(db, a, { customAnswers: { [String(cx)]: true }, hasVoucher: null });
    const [res] = A.saveResidences(db, a, [{ address: 'x', fromMonth: '2024-01', current: true, type: 'rent' }, { address: 'unfinished' }]);
    const [inc] = A.saveIncomes(db, a, [{ kind: 'employment', employer: 'Acme', monthlyCents: 540000 }]);
    V.addDocument(db, {
      applicantId: a,
      type: 'proof_of_income',
      filePath: 'p',
      incomeId: inc,
      payGrossCents: 247000,
      payFrequency: 'biweekly',
      checkedAt: '2026-12-03T10:00:00-05:00',
    });
    V.addDocument(db, { applicantId: a, type: 'paper_form', filePath: 'q' });
    const ref = V.ensureLandlordReference(db, a, res);
    V.updateReference(db, ref, { ownerConfirmed: true, answers: { rentAgain: 'yes', answeredOn: '2026-12-03', paidOnTime: 'always' } });
    Dec.saveDecision(db, { applicantId: a, kind: 'conditional_offer', at: '2026-12-05T10:00:00-05:00' }, 'conditional_offer');
    const e = toEngineApplicant(A.getApplicantBundle(db, a)!);
    expect(e.customAnswers).toEqual({ [String(cx)]: true });
    expect(e.hasVoucher).toBeNull();
    expect(e.residences.map((x) => x.address)).toEqual(['x']);
    expect(e.documents).toEqual([
      expect.objectContaining({ type: 'proof_of_income', checkedOn: '2026-12-03', incomeId: String(inc), payGrossCents: 247000 }),
    ]);
    expect(e.landlordReferences[0]).toMatchObject({ residenceId: String(res), ownerConfirmed: true, rentAgain: 'yes', answeredOn: '2026-12-03', owes: null });
    expect(e.conditionalOfferAt).toBe('2026-12-05T10:00:00-05:00');
    expect(e.status).toBe('conditional_offer');
    const crit = toEngineCriteria(C.listCriteria(db, r));
    expect(crit[1]).toMatchObject({ id: String(cx), code: 'CX', params: { title: 'Has renter insurance', answeredBy: 'applicant' } });
  });
});
