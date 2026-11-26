import * as A from '@/db/repos/applicants';
import * as R from '@/db/repos/rentals';

import { evidenceDetail, issueHref, loadApplicantReview, loadCompare, loadQueue, rentalAddress, shortName } from '../review';
import { sampleDb } from '../testing/helpers';

const NOW = '2026-12-05T10:00:00-05:00';

describe('rental helpers', () => {
  it('formats the rental address and short names', () => {
    expect(rentalAddress({ street: '1428 Maple St', unit: 'Unit B', city: 'Columbus', state: 'OH', zip: '43215' })).toEqual({
      short: '1428 Maple St, Unit B',
      full: '1428 Maple St, Unit B, Columbus, OH 43215',
    });
    expect(rentalAddress({ street: '22 Lake Rd', unit: '3', city: null, state: 'WA', zip: null }).full).toBe('22 Lake Rd, Unit 3, WA');
    expect(shortName('Jordan Ellis')).toBe('Jordan E.');
    expect(shortName('Cher')).toBe('Cher');
  });
});

describe('S-09 applicant review (§8 sample)', () => {
  it('matches the §8 summaries; issues hold only Mismatch / Needs review / Missing', () => {
    const { db, id } = sampleDb();
    const texts = (['Jordan', 'Priya', 'Marcus', 'Dana'] as const).map((n) => loadApplicantReview(db, id(n), NOW)!.evaluation.summary.text);
    expect(texts).toEqual(['Ready to decide', '2 items missing', '1 item missing', 'Ready to decide']);
    for (const n of ['Jordan', 'Priya', 'Marcus', 'Dana'] as const) {
      const r = loadApplicantReview(db, id(n), NOW)!;
      for (const i of r.evaluation.issues) expect(['mismatch', 'needs_review', 'missing']).toContain(i.kind);
    }
    const marcus = loadApplicantReview(db, id('Marcus'), NOW)!;
    expect(marcus.evaluation.issues[0].kind).toBe('mismatch');
    expect(marcus.queue).toBeNull();
    expect(marcus.decide).toEqual({ allowed: true, block: null, message: null });
  });

  it('lists sections with progress and links', () => {
    const { db, id } = sampleDb();
    const priya = loadApplicantReview(db, id('Priya'), NOW)!;
    const s = Object.fromEntries(priya.sections.map((x) => [x.key, x]));
    expect(s.documents.status).toBe('1/2'); // Photo ID in, proof of income missing (§8)
    expect(s.documents.incomplete).toBe(true);
    expect(s.report.status).toBe('Entered');
    expect(s.background.status).toBe('After offer');
    expect(s.decision.status).toBe('—');
    expect(s.decision.href).toBe(`/review/applicant/${id('Priya')}/decision`);
    const jordan = loadApplicantReview(db, id('Jordan'), NOW)!;
    expect(jordan.sections.find((x) => x.key === 'documents')!.status).toBe('2/2');
  });

  it('builds the evidence sheet and the issue buttons', () => {
    const { db, id } = sampleDb();
    const dana = loadApplicantReview(db, id('Dana'), NOW)!;
    const c1 = dana.evaluation.results.find((r) => r.code === 'C1')!;
    const sheet = evidenceDetail(c1, dana.bundle, dana.applicant);
    expect(sheet.checkedBy).toBe('you');
    expect(sheet.action?.href).toBe(`/applicants/${id('Dana')}/documents`);
    const priya = loadApplicantReview(db, id('Priya'), NOW)!;
    const call = priya.evaluation.issues.find((i) => i.action === 'call_landlord')!;
    expect(issueHref(call.action, priya.applicant)).toMatch(new RegExp(`^/verify/${id('Priya')}/landlord/\\d+$`));
    expect(issueHref('add_report', priya.applicant)).toBe(`/verify/${id('Priya')}/report`);
  });

  it('returns null for an unknown applicant', () => {
    const { db } = sampleDb();
    expect(loadApplicantReview(db, 999, NOW)).toBeNull();
  });
});

describe('S-17 compare', () => {
  it('keeps received order, never ranks, hides denied / withdrawn on request', () => {
    const { db, rentalId, id } = sampleDb();
    const c = loadCompare(db, rentalId, { hideClosed: false })!;
    expect(c.enough).toBe(true);
    expect(c.table.columns.map((x) => x.fullName)).toEqual(['Jordan Ellis', 'Priya Raman', 'Marcus Webb', 'Dana Ortiz']);
    expect(c.bundles.map((b) => b.applicant.fullName)).toEqual(c.table.columns.map((x) => x.fullName));
    expect(c.address.short).toBe('1428 Maple St, Unit B');
    expect(JSON.stringify(c.table)).not.toMatch(/score|rank|recommend/i);
    A.setApplicantStatus(db, id('Priya'), 'denied');
    const hidden = loadCompare(db, rentalId, { hideClosed: true })!;
    expect(hidden.table.columns.map((x) => x.fullName)).toEqual(['Jordan Ellis', 'Marcus Webb', 'Dana Ortiz']);
    expect(hidden.applicants.map((a) => a.fullName)).toEqual(['Jordan Ellis', 'Marcus Webb', 'Dana Ortiz']);
  });

  it('flags fewer than two applicants', () => {
    const { db } = sampleDb();
    const r = R.createRental(db, { street: '22 Lake Rd', rentCents: 120000, bedrooms: 1 });
    A.createApplicant(db, { rentalId: r, receivedAt: NOW, fullName: 'Sam Okafor' });
    expect(loadCompare(db, r, { hideClosed: false })!.enough).toBe(false);
    expect(loadCompare(db, 999, { hideClosed: false })).toBeNull();
  });
});

describe('S-18 queue data', () => {
  it('orders by received time and lists missing items for "Request missing info"', () => {
    const { db, rentalId } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const q = loadQueue(db, rentalId, NOW)!;
    expect(q.rows.map((r) => `#${r.position} ${r.fullName} ${r.state}`)).toEqual([
      '#1 Jordan Ellis in_review',
      '#2 Priya Raman waiting',
      '#3 Marcus Webb waiting',
      '#4 Dana Ortiz waiting',
    ]);
    expect(q.rows[1].missing).toHaveLength(2);
    expect(q.rows[0].actions).toEqual(['review']);
  });
});
