import * as Dec from '@/db/repos/decisions';
import * as R from '@/db/repos/rentals';
import * as Set from '@/db/repos/settings';
import * as V from '@/db/repos/verify';
import { FCRA_REQUIRED_LINES } from '@/engine';
import type { PdfAdapter } from '@/pdf/shell';

import { loadDecisionContext, saveDecisionAction } from '../decision';
import { decodeLetterBody, encodeLetterBody, exportLetter, letterDocument, letterText, loadLetterContext, markSent } from '../letters';
import { makeDeps, sampleDb } from '../testing/helpers';
import { localDateTime, localIso, longDate, shortStamp } from '../time';

function fakePdf() {
  const printed: string[] = [];
  const adapter: PdfAdapter = {
    async printToFile(html) {
      printed.push(html);
      return { uri: 'file:///cache/print.pdf', numberOfPages: 1 };
    },
    async moveToCache(_uri, name) {
      return `file:///cache/pdf/${name}`;
    },
    async isSharingAvailable() {
      return true;
    },
    async share() {},
  };
  return { adapter, printed };
}

function fakeFiles() {
  const saved: { owner: unknown; kind: string; id?: number | string }[] = [];
  return {
    saved,
    files: {
      async saveCopy(o: { owner: unknown; kind: string; id?: number | string }) {
        saved.push(o);
        return { path: `applicants/x/letter-${o.id}.pdf`, mime: 'application/pdf' };
      },
    },
  };
}

async function denyPriya() {
  const s = sampleDb();
  Set.updateSettings(s.db, { landlordName: 'Alex Morgan' });
  const { deps } = makeDeps(s.db, '2026-12-06T20:12:00Z');
  const ctx = loadDecisionContext(s.db, s.id('Priya'), '2026-12-06T15:12:00-05:00')!;
  const c5 = ctx.reasonChoices.find((c) => c.reason.code === 'C5')!.reason;
  const res = await saveDecisionAction(deps, s.id('Priya'), { kind: 'deny', conditions: [], reasons: [c5], note: '', reportInfluenced: true });
  if (!res.ok) throw new Error(res.message);
  return { ...s, decisionId: res.decisionId };
}

describe('time helpers', () => {
  it('formats local stamps', () => {
    expect(localIso(new Date('2026-12-06T20:12:05Z'), -300)).toBe('2026-12-06T15:12:05-05:00');
    expect(localIso(new Date('2026-07-06T20:12:05Z'), -240)).toBe('2026-07-06T16:12:05-04:00');
    expect(localIso(new Date('2026-12-06T20:12:05Z'), 330)).toBe('2026-12-07T01:42:05+05:30');
    expect(localDateTime('2026-12-08T20:12:00.000Z', -300)).toBe('Dec 8, 2026 at 3:12 PM');
    expect(localDateTime('2026-12-08T05:02:00.000Z', -300)).toBe('Dec 8, 2026 at 12:02 AM');
    // Device zone: same instant, offset written in the string.
    const now = new Date('2026-12-06T20:12:05Z');
    expect(new Date(localIso(now)).getTime()).toBe(now.getTime());
    expect(longDate('2026-12-06')).toBe('December 6, 2026');
    expect(shortStamp('2026-12-02T09:14:00-05:00')).toBe('Dec 2, 9:14 AM');
  });
});

describe('S-16 letter service', () => {
  it('Priya: adverse action notice from the decision, report company and §8 placeholders', async () => {
    const { db, id, decisionId } = await denyPriya();
    const ctx = loadLetterContext(db, id('Priya'), null)!;
    expect(ctx.decisionRow.id).toBe(decisionId);
    expect(ctx.kinds).toEqual(['adverse_action']);
    expect(ctx.blockedHref).toBeNull();
    const body = letterText(ctx, 'adverse_action');
    const html = letterDocument(ctx, 'adverse_action', body, '2026-12-06');
    expect(html).toContain('December 6, 2026');
    expect(html).toContain('Priya Raman');
    expect(html).toContain('87 King Ave, Columbus, OH 43201');
    expect(html).toContain('Re: 1428 Maple St, Unit B, Columbus, OH 43215');
    expect(html).toContain('unpaid balance owed to a past landlord');
    expect(html).toContain('[Mailing address from the report]');
    for (const l of FCRA_REQUIRED_LINES) expect(html).toContain(l);
    expect(html).toContain('Alex Morgan');
    expect(html).not.toMatch(/recommend|ranking|score of/i);
  });

  it('export: PDF printed + shared, copy kept with the applicant, notice pending → created → sent', async () => {
    const { db, id, decisionId } = await denyPriya();
    const pdf = fakePdf();
    const f = fakeFiles();
    const deps = { db, now: () => new Date('2026-12-06T20:30:00Z'), files: f.files, pdf: pdf.adapter };
    const ctx = loadLetterContext(db, id('Priya'), decisionId)!;
    const body = { ...letterText(ctx, 'adverse_action'), closing: 'Call me with questions.' };
    const res = await exportLetter(deps, { applicantId: id('Priya'), decisionId, kind: 'adverse_action', body });
    expect(res).toMatchObject({ ok: true, uri: 'file:///cache/pdf/Adverse action notice - Priya Raman.pdf', shared: true });
    if (!res.ok) return;
    expect(pdf.printed[0]).toContain('Call me with questions.');
    expect(f.saved).toEqual([{ owner: { applicantId: id('Priya') }, kind: 'letter', sourceUri: res.uri, mime: 'application/pdf', id: res.letterId }]);
    expect(Dec.getLetter(db, res.letterId)).toMatchObject({ kind: 'adverse_action', pdfPath: `applicants/x/letter-${res.letterId}.pdf` });
    expect(decodeLetterBody(Dec.getLetter(db, res.letterId)!.body)).toEqual(body);
    expect(Dec.latestDecision(db, id('Priya'))!.noticeStatus).toBe('created');

    // Re-export updates the same letter; edited text comes back from the row.
    const again = await exportLetter(deps, { applicantId: id('Priya'), decisionId, kind: 'adverse_action', body: { opening: 'New', closing: '' } });
    expect(again).toMatchObject({ ok: true, letterId: res.letterId });
    expect(letterText(loadLetterContext(db, id('Priya'), decisionId)!, 'adverse_action').opening).toBe('New');

    const sent = markSent(deps, { applicantId: id('Priya'), decisionId, kind: 'adverse_action', body: { opening: 'New', closing: '' }, method: 'email' });
    expect(sent).toMatchObject({ ok: true, letterId: res.letterId, sentAt: localIso(new Date('2026-12-06T20:30:00Z')) });
    expect(Dec.getLetter(db, res.letterId)).toMatchObject({ sentMethod: 'email' });
    expect(Dec.latestDecision(db, id('Priya'))!.noticeStatus).toBe('sent');
  });

  it('blocks the adverse notice while the report company is incomplete (→ S-13) and refuses other kinds', async () => {
    const { db, id, decisionId } = await denyPriya();
    V.saveReport(db, id('Priya'), { companyPhone: '  ' });
    const ctx = loadLetterContext(db, id('Priya'), decisionId)!;
    expect(ctx.notice.missingCompanyFields).toEqual(['phone']);
    expect(ctx.blockedHref).toBe(`/verify/${id('Priya')}/report`);
    const deps = { db, now: () => new Date(), files: fakeFiles().files, pdf: fakePdf().adapter };
    const body = { opening: 'x', closing: '' };
    expect(await exportLetter(deps, { applicantId: id('Priya'), decisionId, kind: 'adverse_action', body })).toMatchObject({ ok: false, error: 'company_missing' });
    expect(markSent(deps, { applicantId: id('Priya'), decisionId, kind: 'adverse_action', body, method: 'mail' })).toMatchObject({ ok: false, error: 'company_missing' });
    expect(await exportLetter(deps, { applicantId: id('Priya'), decisionId, kind: 'denial', body })).toMatchObject({ ok: false, error: 'wrong_kind' });
    expect(Dec.latestDecision(db, id('Priya'))!.noticeStatus).toBe('pending');
  });

  it('first-come conditional offer letter carries the 48 h reply-by in local time', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const { deps } = makeDeps(db, '2026-12-06T20:12:00Z');
    const res = await saveDecisionAction(deps, id('Jordan'), { kind: 'conditional_offer', conditions: [], reasons: [], note: '', reportInfluenced: false });
    if (!res.ok) throw new Error(res.message);
    const ctx = loadLetterContext(db, id('Jordan'), res.decisionId)!;
    expect(ctx.kinds).toEqual(['conditional_offer']);
    expect(ctx.landlordNameMissing).toBe(true);
    const html = letterDocument(ctx, 'conditional_offer', letterText(ctx, 'conditional_offer'), '2026-12-06');
    // 48 h after the decision, in the device's zone.
    expect(html).toContain(`Please reply by ${localDateTime('2026-12-08T20:12:00.000Z')} (48 hours).`);
    expect(html).toContain('We&#39;re glad to offer you 1428 Maple St, Unit B, Columbus, OH 43215');
  });

  it('body JSON round trip, tolerant of plain text', () => {
    expect(decodeLetterBody(encodeLetterBody({ opening: 'a', closing: 'b' }))).toEqual({ opening: 'a', closing: 'b' });
    expect(decodeLetterBody('plain')).toEqual({ opening: 'plain', closing: '' });
    expect(decodeLetterBody(null)).toBeNull();
  });
});
