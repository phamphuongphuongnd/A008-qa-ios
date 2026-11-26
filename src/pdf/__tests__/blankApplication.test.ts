import { saveCriteria, listCriteria } from '@/db/repos/criteria';
import { loadSampleRental } from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';
import { blankApplicationForRental, shareBlankApplication } from '@/features/intake/blankPdf';

import { blankApplicationFileName, blankApplicationHtml } from '../blankApplication';
import { PDF_FOOTER, safeFileName, type PdfAdapter } from '../shell';

const input = {
  address: '1428 Maple St, Unit B',
  fullAddress: '1428 Maple St, Unit B, Columbus, OH 43215',
  rentCents: 165000,
  customQuestions: [{ title: 'Can you sign a 12-month lease?' }],
  requiredDocuments: ['Photo ID', 'Proof of income'],
};

describe('blank application PDF (F-06)', () => {
  const doc = blankApplicationHtml(input);
  const text = doc.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');

  it('has the rental, the 7 parts and every S-08 question', () => {
    expect(doc).toContain('1428 Maple St, Unit B, Columbus, OH 43215 · $1,650/mo');
    for (const h of ['1. About you', '2. Household', "3. Where you&#39;ve lived", '4. Work &amp; income', '5. A few questions', '6. Consent &amp; signature'])
      expect(doc).toContain(h);
    for (const q of ['Full legal name', 'Emergency contact', 'How many people will live here, including you?', 'Desired move-in date', 'Monthly rent or mortgage', 'Gross monthly income', 'Supervisor name', 'Have you filed for bankruptcy in the past 7 years?', 'Does anyone in the household smoke?', 'I certify the information is true and complete.', 'Printed name'])
      expect(text).toContain(q);
    expect(text).toContain('Have you been evicted or had an eviction case filed against you in the past 7 years?');
    expect((doc.match(/Address \d/g) ?? []).length).toBe(3);
  });

  it('adds the rental-specific questions and required documents', () => {
    expect(text).toContain('Rental-specific questions');
    expect(text).toContain('Can you sign a 12-month lease?');
    expect(doc).toContain('<li>Photo ID</li><li>Proof of income</li>');
    const plain = blankApplicationHtml({ ...input, customQuestions: [], requiredDocuments: [] });
    expect(plain).not.toContain('Rental-specific questions');
    expect(plain).not.toContain('Please bring or send');
  });

  it('never asks for SSN or date of birth — only warns not to write them', () => {
    const fields = [...doc.matchAll(/<span class="label">([^<]*)<\/span>/g)].map((m) => m[1].toLowerCase());
    expect(fields.length).toBeGreaterThan(20);
    for (const f of fields) for (const bad of ['social', 'ssn', 'birth', 'gender', 'sex', 'race', 'national', 'citizen']) expect(f).not.toContain(bad);
    expect(text).toContain('Do not write your Social Security number or date of birth on this form.');
  });

  it('escapes rental text, carries the disclaimer footer, no raw i18n keys', () => {
    const evil = blankApplicationHtml({ ...input, fullAddress: '<script>x</script> & Co', customQuestions: [{ title: 'Pets <b>ok</b>?' }] });
    expect(evil).not.toContain('<script>x');
    expect(evil).toContain('&lt;script&gt;x&lt;/script&gt; &amp; Co');
    expect(evil).toContain('Pets &lt;b&gt;ok&lt;/b&gt;?');
    expect(doc).toContain(PDF_FOOTER);
    expect(doc).not.toMatch(/intake:|pdf\.\w+|fields\.\w+/);
  });

  it('file name', () => {
    expect(safeFileName(blankApplicationFileName('1428 Maple St, Unit B'))).toBe('Rental application - 1428 Maple St Unit B.pdf');
  });

  it('builds from the database and shares through the PDF adapter', async () => {
    const db = makeTestDb();
    const rentalId = loadSampleRental(db);
    const rows = listCriteria(db, rentalId);
    saveCriteria(db, rentalId, [
      ...rows.map(({ id, code, enabled, params, order }) => ({ id, code, enabled, params, order })),
      { code: 'CX', enabled: true, order: 99, params: { title: 'Can you start on Jan 1?', answeredBy: 'applicant' } },
      { code: 'CX', enabled: true, order: 100, params: { title: 'Landlord-only check', answeredBy: 'landlord' } },
    ]);
    const built = blankApplicationForRental(db, rentalId)!;
    expect(built.fileName).toBe('Rental application - 1428 Maple St Unit B');
    expect(built.html).toContain('Can you start on Jan 1?');
    expect(built.html).not.toContain('Landlord-only check');
    expect(blankApplicationForRental(db, 999)).toBeNull();

    const calls: string[] = [];
    const adapter: PdfAdapter = {
      printToFile: async (h) => (calls.push(`print:${h.length > 1000}`), { uri: 'file:///cache/x.pdf', numberOfPages: 3 }),
      moveToCache: async (_u, name) => (calls.push(`move:${name}`), `file:///cache/pdf/${name}`),
      isSharingAvailable: async () => true,
      share: async (u) => void calls.push(`share:${u}`),
    };
    const r = await shareBlankApplication(db, rentalId, adapter);
    expect(r).toEqual({ uri: 'file:///cache/pdf/Rental application - 1428 Maple St Unit B.pdf', numberOfPages: 3, shared: true });
    expect(calls[0]).toBe('print:true');
    await expect(shareBlankApplication(db, 999, adapter)).rejects.toThrow();
  });
});
