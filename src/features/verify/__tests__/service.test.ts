import { evaluateApplicant } from '@/engine';
import { getApplicantBundle, listApplicants, listIncomes, listResidences } from '@/db/repos/applicants';
import { listCriteria, updateCriterion } from '@/db/repos/criteria';
import { saveDecision } from '@/db/repos/decisions';
import { loadSampleRental } from '@/db/repos/sample';
import { getBackground, getReference, getReport, listAttempts } from '@/db/repos/verify';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import { loadRentalForEngine } from '@/db/toEngine';
import type { AppDb } from '@/db/types';

import {
  attachReportFiles,
  chooseBackgroundOutcome,
  clearReport,
  ensureEmployerRef,
  liveRedFlags,
  loadBackgroundSheet,
  loadEmployerSheet,
  loadLandlordSheet,
  loadReportSheet,
  logAttempt,
  markUnreachable,
  removeAttempt,
  removeReportFile,
  saveBackgroundSheet,
  saveEmployerSheet,
  saveLandlordSheet,
  saveReportSheet,
  verifyProgress,
  type ReportFileSaver,
} from '..';

const NOW = new Date('2026-12-10T15:00:00Z');

function setup() {
  const db = makeTestDb();
  const rentalId = loadSampleRental(db);
  const byName = (name: string) => listApplicants(db, rentalId).find((a) => a.fullName === name)!.id;
  return { db, rentalId, jordan: byName('Jordan Ellis'), priya: byName('Priya Raman'), marcus: byName('Marcus Webb'), dana: byName('Dana Ortiz') };
}

const result = (db: AppDb, rentalId: number, applicantId: number, code: string) => {
  const data = loadRentalForEngine(db, rentalId)!;
  const a = data.applicants.find((x) => x.id === String(applicantId))!;
  return evaluateApplicant(data.rental, data.criteria, a).results.find((r) => r.code === code)!;
};

describe('S-11 landlord reference service', () => {
  test('Marcus (§8): red flags for dates + rent (+29%), C4 is the current residence', () => {
    const { db, marcus } = setup();
    const residence = listResidences(db, marcus)[0];
    const sheet = loadLandlordSheet(db, marcus, residence.id, NOW)!;
    expect(sheet.applicant.fullName).toBe('Marcus Webb');
    expect(sheet.redFlags.map((f) => f.code)).toEqual(['dates_mismatch', 'rent_mismatch', 'rent_again_wouldnt_say']);
    expect(sheet.redFlags[1].text).toBe('Rent differs by more than 5% (+29%)');
    expect(sheet.redFlags[0].detail).toMatch(/^Landlord says Jan 2023/);
    expect(sheet.usedForC4).toBe(true);
    expect(sheet.showBothLandlordsTip).toBe(true);
    expect(sheet.form.rentText).toBe('1,550.00');
    expect(sheet.countySearchUrl.startsWith('https://www.google.com/search?q=')).toBe(true);
    // Live flags follow the form before Save.
    expect(liveRedFlags(sheet, { ...sheet.form, rentText: '1,210', from: '2022-03' }, NOW).map((f) => f.code)).toEqual(['rent_again_wouldnt_say']);
  });

  test('save → engine reads it: owner confirmed + Yes → C4 Met · Verified with the call date', () => {
    const { db, rentalId, marcus } = setup();
    const residence = listResidences(db, marcus)[0];
    const sheet = loadLandlordSheet(db, marcus, residence.id, NOW)!;
    const res = saveLandlordSheet(db, marcus, residence.id, { ...sheet.form, rentAgain: 'yes', rentText: '1,200', from: '2022-03' }, NOW);
    expect(res.ok).toBe(true);
    const c4 = result(db, rentalId, marcus, 'C4');
    expect(c4).toMatchObject({ outcome: 'met', evidence: 'verified', verifiedOn: '2026-12-10' });
    expect(saveLandlordSheet(db, marcus, residence.id, { ...sheet.form, owes: 'yes', owesText: '' }, NOW)).toEqual({ ok: false, errors: [{ field: 'owesText', code: 'required' }] });
  });

  test('Priya (§8): 2 calls no answer → one email → Mark as unreachable → C4 Missing "Unreachable after 3 attempts"', () => {
    const { db, rentalId, priya } = setup();
    const residence = listResidences(db, priya)[0];
    let sheet = loadLandlordSheet(db, priya, residence.id, NOW)!;
    const refId = sheet.reference!.id;
    expect(sheet.unreachable).toMatchObject({ canMark: false, failedCount: 2 });
    expect(markUnreachable(db, refId, NOW)).toBe(false);
    const emailId = logAttempt(db, refId, { method: 'email', result: 'no_answer' }, NOW);
    sheet = loadLandlordSheet(db, priya, residence.id, NOW)!;
    expect(sheet.unreachable.canMark).toBe(true);
    expect(markUnreachable(db, refId, NOW)).toBe(true);
    expect(result(db, rentalId, priya, 'C4')).toMatchObject({ outcome: 'missing', reason: 'Unreachable after 3 attempts' });
    // Deleting the attempt the mark relied on clears it.
    removeAttempt(db, emailId, refId, NOW);
    expect(getReference(db, refId)!.unreachable).toBe(false);
    // Reaching the landlord clears an unreachable mark.
    logAttempt(db, refId, { method: 'text', result: 'no_answer' }, NOW);
    markUnreachable(db, refId, NOW);
    logAttempt(db, refId, { method: 'call', result: 'reached', at: '2026-12-10T09:00:00-05:00' }, NOW);
    expect(getReference(db, refId)!.unreachable).toBe(false);
    expect(listAttempts(db, refId).map((a) => a.at)).toContain('2026-12-10T09:00:00-05:00');
  });

  test('first save on a residence with no sheet creates it; unknown ids → null / throw', () => {
    const { db, jordan } = setup();
    expect(loadLandlordSheet(db, jordan, 99999, NOW)).toBeNull();
    expect(() => saveLandlordSheet(db, jordan, 99999, loadLandlordSheet(db, jordan, listResidences(db, jordan)[0].id, NOW)!.form, NOW)).toThrow();
    expect(() => logAttempt(db, 99999, { method: 'call', result: 'no_answer' })).toThrow();
  });
});

describe('S-12 employer reference service', () => {
  test('creates one sheet per income, records the call date', () => {
    const { db, priya } = setup();
    const income = listIncomes(db, priya)[0];
    const sheet = loadEmployerSheet(db, priya, income.id)!;
    expect(sheet.reference).toBeNull();
    const res = saveEmployerSheet(db, priya, income.id, { ...sheet.form, employed: 'yes', since: '2021-04', title: 'Dispatcher' }, NOW);
    expect(res.ok).toBe(true);
    expect(ensureEmployerRef(db, priya, income.id)).toBe(res.ok ? res.id : -1);
    const after = loadEmployerSheet(db, priya, income.id)!;
    expect(after.reference!.answers).toMatchObject({ employed: 'yes', since: '2021-04', title: 'Dispatcher', answeredOn: '2026-12-10' });
    expect(verifyProgress(getApplicantBundle(db, priya)!).employer[0].status).toBe('answered');
    expect(loadEmployerSheet(db, priya, 99999)).toBeNull();
  });
});

describe('S-13 screening report service', () => {
  test('Priya (§8): report loads with company placeholders; C9 off', () => {
    const { db, priya } = setup();
    const sheet = loadReportSheet(db, priya, NOW)!;
    expect(sheet.c9Enabled).toBe(false);
    expect(sheet.form).toMatchObject({ evictionsMode: 'none', collectionsMode: 'listed', collectionsText: '2,310.00', companyName: 'TransUnion Rental Screening Solutions' });
    expect(sheet.missingCompany).toEqual([]);
  });

  test('Marcus: enter a report → C3 Verified, C5 Met; clearing it falls back', () => {
    const { db, rentalId, marcus } = setup();
    const files = makeTestFiles();
    const sheet = loadReportSheet(db, marcus, NOW)!;
    expect(sheet.report).toBeNull();
    expect(sheet.missingCompany).toEqual(['name', 'address', 'phone']);
    const res = saveReportSheet(db, marcus, { ...sheet.form, service: 'mysmartmove', reportDate: '2026-12-09', evictionsMode: 'none', collectionsMode: 'none' }, NOW);
    expect(res.ok).toBe(true);
    expect(result(db, rentalId, marcus, 'C3')).toMatchObject({ outcome: 'met', evidence: 'verified' });
    expect(result(db, rentalId, marcus, 'C5')).toMatchObject({ outcome: 'met', evidence: 'verified' });
    expect(saveReportSheet(db, marcus, { ...sheet.form, reportDate: '2026-12-11' }, NOW)).toEqual({ ok: false, errors: [{ field: 'reportDate', code: 'date_future' }] });
    clearReport(db, files, marcus);
    expect(result(db, rentalId, marcus, 'C5').outcome).toBe('missing');
  });

  test('C9 on: score block required fields apply', () => {
    const { db, rentalId, marcus } = setup();
    const c9 = listCriteria(db, rentalId).find((c) => c.code === 'C9')!;
    updateCriterion(db, c9.id, { enabled: true });
    const sheet = loadReportSheet(db, marcus, NOW)!;
    expect(sheet.c9Enabled).toBe(true);
    const res = saveReportSheet(db, marcus, { ...sheet.form, scoreText: '640' }, NOW);
    expect(res.ok ? [] : res.errors.map((e) => e.field)).toEqual(['scoreModel', 'scoreRange', 'scoreDate']);
  });

  test('attach / remove report files through src/files (fake saver)', async () => {
    const { db, marcus } = setup();
    const files = makeTestFiles();
    let n = 0;
    const saver: ReportFileSaver = {
      saveAttachment: jest.fn(async (o) => {
        if (o.sourceUri === 'bad') throw new Error('copy failed');
        const path = `applicants/${o.owner.applicantId}/report-${++n}.${o.mime === 'application/pdf' ? 'pdf' : 'jpg'}`;
        files.files.add(path);
        return { path };
      }),
    };
    const added = await attachReportFiles(db, saver, marcus, [{ uri: 'file:///a.pdf', mime: 'application/pdf', name: 'r.pdf' }, { uri: 'file:///b.jpg' }], NOW);
    expect(added).toEqual([`applicants/${marcus}/report-1.pdf`, `applicants/${marcus}/report-2.jpg`]);
    expect(saver.saveAttachment).toHaveBeenCalledWith(expect.objectContaining({ owner: { applicantId: marcus }, kind: 'report' }));
    // A failure keeps what was saved before it.
    await expect(attachReportFiles(db, saver, marcus, [{ uri: 'file:///c.pdf', mime: 'application/pdf' }, { uri: 'bad' }], NOW)).rejects.toThrow('copy failed');
    expect(getReport(db, marcus)!.filePaths).toHaveLength(3);
    removeReportFile(db, files, marcus, added[0], NOW);
    expect(getReport(db, marcus)!.filePaths).not.toContain(added[0]);
    expect(files.files.has(added[0])).toBe(false);
    removeReportFile(db, files, marcus, 'applicants/999/x.pdf', NOW); // not this report's → ignored
    expect(files.files.size).toBe(2);
    // Attaching only files does not count as entered results.
    expect(verifyProgress(getApplicantBundle(db, marcus)!).report).toBe('none');
  });
});

describe('S-14 background review service', () => {
  test('locked before an offer; opens after a Conditional offer; never auto-denies', () => {
    const { db, rentalId, jordan } = setup();
    expect(loadBackgroundSheet(db, jordan)!.gate).toBe('locked');
    expect(verifyProgress(getApplicantBundle(db, jordan)!).background).toBe('locked');
    const form = { mode: 'listed' as const, convictions: [{ type: 'property' as const, convictedOn: '2020-06-01', sentenceEndedOn: '2020-12-01' }], seriousness: '', rehabilitation: '', other: '' };
    expect(saveBackgroundSheet(db, jordan, form, NOW)).toEqual({ ok: false, errors: [], block: 'not_editable' });

    saveDecision(db, { applicantId: jordan, kind: 'conditional_offer', at: '2026-12-05T10:00:00-05:00', reasons: [], conditions: [] }, 'conditional_offer');
    const sheet = loadBackgroundSheet(db, jordan)!;
    expect(sheet).toMatchObject({ gate: 'open', lookbackYears: 7 });
    expect(verifyProgress(getApplicantBundle(db, jordan)!).background).toBe('open');

    expect(saveBackgroundSheet(db, jordan, form, NOW).ok).toBe(true);
    expect(result(db, rentalId, jordan, 'C10')).toMatchObject({ outcome: 'needs_review', verifiedOn: '2026-12-10' });
    expect(chooseBackgroundOutcome(db, jordan, form, 'withdraw', NOW)).toEqual({ ok: false, errors: [], block: 'assessment_required' });
    // B-50: "Continue with the offer" also needs the assessment when there is a conviction in the lookback.
    expect(chooseBackgroundOutcome(db, jordan, form, 'continue', NOW)).toEqual({ ok: false, errors: [], block: 'assessment_required' });
    expect(getBackground(db, jordan)!.outcome).toBeNull();
    const assessed = { ...form, seriousness: 'Shoplifting, single offense.', rehabilitation: 'Six years clean', other: 'Explained it' };
    expect(chooseBackgroundOutcome(db, jordan, assessed, 'withdraw', NOW).ok).toBe(true);
    expect(getBackground(db, jordan)).toMatchObject({ outcome: 'withdraw', assessment: { seriousness: 'Shoplifting, single offense.' } });
    // The Applicant's status is not changed here — the withdrawal is a Decision on S-15.
    expect(getApplicantBundle(db, jordan)!.applicant.status).toBe('conditional_offer');
    expect(verifyProgress(getApplicantBundle(db, jordan)!).background).toBe('done');
  });

  test('"None" → continue; C10 Met; C10 off → not_in_criteria', () => {
    const { db, rentalId, dana } = setup();
    saveDecision(db, { applicantId: dana, kind: 'conditional_offer', at: '2026-12-05T10:00:00-05:00', reasons: [], conditions: [] }, 'conditional_offer');
    const none = { mode: 'none' as const, convictions: [], seriousness: '', rehabilitation: '', other: '' };
    expect(chooseBackgroundOutcome(db, dana, none, 'withdraw', NOW)).toMatchObject({ ok: false, block: 'no_convictions_in_lookback' });
    expect(chooseBackgroundOutcome(db, dana, none, 'continue', NOW).ok).toBe(true);
    expect(result(db, rentalId, dana, 'C10')).toMatchObject({ outcome: 'met', reason: 'No convictions in the past 7 years' });
    const c10 = listCriteria(db, rentalId).find((c) => c.code === 'C10')!;
    updateCriterion(db, c10.id, { enabled: false });
    expect(loadBackgroundSheet(db, dana)!.gate).toBe('not_in_criteria');
  });
});

describe('verify progress (S-09 rows)', () => {
  test('§8 sample', () => {
    const { db, jordan, priya, marcus } = setup();
    const p = (id: number) => verifyProgress(getApplicantBundle(db, id)!);
    expect(p(jordan)).toMatchObject({ references: { done: 1, total: 1 }, report: 'entered' });
    expect(p(priya)).toMatchObject({ references: { done: 0, total: 1 }, report: 'entered' });
    expect(p(priya).landlord[0]).toMatchObject({ status: 'in_progress', attempts: 2 });
    expect(p(marcus)).toMatchObject({ references: { done: 1, total: 1 }, report: 'none' });
  });
});
