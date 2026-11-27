import * as A from '@/db/repos/applicants';
import * as C from '@/db/repos/criteria';
import * as Dec from '@/db/repos/decisions';
import { makeTestFiles } from '@/db/testing/testDb';
import { decisionFileHtml } from '@/pdf/decisionFile';
import { fileDate, PDF_FOOTER, type PdfAdapter } from '@/pdf/shell';

import { loadDecisionContext, saveDecisionAction } from '../decision';
import { buildDecisionFile, exportDecisionFile, stampText } from '../decisionFile';
import { toEngineCriteria } from '@/db/toEngine';
import { makeDeps, sampleDb } from '../testing/helpers';

async function decided() {
  const s = sampleDb();
  const { deps } = makeDeps(s.db, '2026-12-06T20:12:00Z');
  const ctx = loadDecisionContext(s.db, s.id('Priya'), '2026-12-06T15:12:00-05:00')!;
  const c5 = ctx.reasonChoices.find((c) => c.reason.code === 'C5')!.reason;
  const res = await saveDecisionAction(deps, s.id('Priya'), { kind: 'deny', conditions: [], reasons: [c5], note: 'Balance owed', reportInfluenced: true });
  if (!res.ok) throw new Error(res.message);
  const letterId = Dec.createLetter(s.db, { decisionId: res.decisionId, kind: 'adverse_action', body: null });
  Dec.markLetterSent(s.db, letterId, 'email', '2026-12-06T16:00:00-05:00');
  return { ...s, decisionId: res.decisionId };
}

describe('S-19 decision file', () => {
  it('lists criteria, applicants in received order with results + evidence, decisions and letters', async () => {
    const { db, rentalId, id } = await decided();
    const data = (await buildDecisionFile(db, rentalId, new Date('2026-12-20T15:00:00Z')))!;
    expect(data.rentalAddress).toBe('1428 Maple St, Unit B, Columbus, OH 43215');
    expect(data.criteria[0]).toBe('Income: at least 3.0× the rent');
    expect(data.applicants.map((a) => (a.deleted ? 'deleted' : `${a.position}. ${a.name} · ${a.receivedText} · ${a.summary}`))).toEqual([
      '1. Jordan Ellis · Dec 2, 2026, 9:14 AM · Ready to decide',
      '2. Priya Raman · Dec 2, 2026, 2:40 PM · 2 items missing',
      '3. Marcus Webb · Dec 3, 2026, 11:05 AM · 1 item missing',
      '4. Dana Ortiz · Dec 4, 2026, 8:20 AM · Ready to decide',
    ]);
    const priya = data.applicants[1];
    if (priya.deleted) throw new Error('unexpected');
    expect(priya.results.find((r) => r.title.startsWith('No unpaid'))).toMatchObject({ outcome: 'Not met', evidence: 'Verified' });
    expect(priya.results.find((r) => r.title.startsWith('No unpaid'))!.sourceText).toMatch(/^Screening report/);
    expect(priya.decisions).toEqual([
      {
        heading: `Deny · ${stampText(Dec.latestDecision(db, id('Priya'))!.at)}`, // device-local stamp
        reasons: ['No unpaid balance owed to a past landlord (Screening report)'],
        note: 'Balance owed',
        conditions: [],
        reportInfluenced: true,
        noticePending: false,
        letters: ['Adverse action notice sent Dec 6, 2026 (Email)'],
        short: expect.stringMatching(/^Denied Dec \d+, \d+:\d{2} [AP]M$/),
        reasonCodes: ['C5 (Screening report)'],
      },
    ]);
    expect(priya.metText).toMatch(/^\d+ of \d+ Met$/);

    const html = decisionFileHtml(data);
    expect(html).toContain(priya.metText);
    expect(html).toContain('Decision file');
    expect(html).toContain('1428 Maple St, Unit B, Columbus, OH 43215 · Exported Dec 20, 2026');
    expect(html).toContain('Applicants (order received)');
    expect(html).toContain('2. Priya Raman — Received Dec 2, 2026, 2:40 PM');
    expect(html).toContain('Adverse action notice sent Dec 6, 2026 (Email)');
    expect(html).toContain('No decision recorded.');
    expect(html).toContain(PDF_FOOTER);
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/rank(ed|ing)? |recommended|total score/i);
  });

  it('shows "Notice pending", criteria history and data-deleted applicants', async () => {
    const { db, rentalId, id } = sampleDb();
    const { deps } = makeDeps(db, '2026-12-06T20:12:00Z');
    const ctx = loadDecisionContext(db, id('Priya'), '2026-12-06T15:12:00-05:00')!;
    await saveDecisionAction(deps, id('Priya'), { kind: 'deny', conditions: [], reasons: [ctx.reasonChoices[1].reason], note: '', reportInfluenced: true });
    // 2A's history shape: { criteria: engine Criterion[] with ids }.
    const before = toEngineCriteria(C.listCriteria(db, rentalId));
    const after = before.map((c) => (c.code === 'C2' ? { ...c, params: { ...c.params, months: 24 } } : c));
    C.addCriteriaHistory(db, rentalId, { before: { criteria: before }, after: { criteria: after }, reason: 'Typo — as published', at: '2026-11-28T10:00:00-05:00' });
    A.purgeApplicant(db, makeTestFiles(), id('Marcus'), { keepRecord: true, at: '2027-01-10T09:00:00-05:00' });

    const data = (await buildDecisionFile(db, rentalId, new Date('2027-01-11T15:00:00Z')))!;
    expect(data.history).toEqual([{ atText: 'Nov 28, 2026', lines: ['At least 12 months of rental or home-ownership history → At least 24 months of rental or home-ownership history'], reason: 'Typo — as published' }]);
    expect(data.applicants[2]).toEqual({ deleted: true, position: 3, deletedText: 'Applicant 3 — data deleted Jan 10, 2027' });
    const priya = data.applicants[1];
    expect(!priya.deleted && priya.decisions[0].noticePending).toBe(true);
    const html = decisionFileHtml(data);
    expect(html).toContain('Adverse action notice: not created yet.');
    expect(html).toContain('3. Applicant 3 — data deleted Jan 10, 2027');
    expect(html).not.toContain('Marcus');
  });

  it('adds thumbnails only when asked, and exports through the PDF shell', async () => {
    const { db, rentalId } = await decided();
    const images = A.listApplicants(db, rentalId).flatMap((a) => A.getApplicantBundle(db, a.id)!.documents).filter((d) => d.mime?.startsWith('image/'));
    const read = jest.fn(async () => 'data:image/jpeg;base64,AAAA');
    const withThumbs = (await buildDecisionFile(db, rentalId, new Date(), { thumbnails: { read } }))!;
    expect(read).toHaveBeenCalledTimes(images.length);
    if (images.length) expect(decisionFileHtml(withThumbs)).toContain('<img src="data:image/jpeg;base64,AAAA"');

    const printed: string[] = [];
    const pdf: PdfAdapter = {
      printToFile: async (html) => (printed.push(html), { uri: 'file:///p.pdf', numberOfPages: 3 }),
      moveToCache: async (_u, name) => `file:///cache/${name}`,
      isSharingAvailable: async () => false,
      share: async () => undefined,
    };
    const res = await exportDecisionFile({ db, now: () => new Date('2026-12-20T15:00:00Z'), pdf }, rentalId);
    // B-49: type + rental id + date, never the address.
    expect(res).toEqual({ ok: true, uri: `file:///cache/Decision file - rental ${rentalId} - ${fileDate(new Date('2026-12-20T15:00:00Z'))}.pdf`, shared: false, pages: 3 });
    expect(printed[0]).toContain('Decision file');
    expect(await exportDecisionFile({ db, now: () => new Date(), pdf }, 999)).toEqual({ ok: false, error: 'not_found' });
  });

  it('helpers: stamps', () => {
    expect(stampText('2026-12-02T09:14:00-05:00')).toBe('Dec 2, 2026, 9:14 AM');
    expect(stampText('2026-12-02T14:14:00Z')).toMatch(/^Dec \d, 2026, \d{1,2}:14 [AP]M$/);
  });
});
