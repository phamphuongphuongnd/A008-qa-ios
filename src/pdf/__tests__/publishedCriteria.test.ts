import { SAMPLE_CRITERIA, defaultCriteria, type Criterion } from '@/engine';
import { copyText } from '@/features/criteria/clipboard';

import {
  publishedCriteriaContent,
  publishedCriteriaFileName,
  publishedCriteriaHtml,
  publishedCriteriaText,
  sharePublishedCriteriaPdf,
  type PublishedRental,
} from '../publishedCriteria';
import type { PdfAdapter } from '../shell';

jest.mock('../shellNative', () => ({ expoPdfAdapter: { printToFile: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const SAMPLE: PublishedRental = {
  street: '1428 Maple St',
  unit: 'Unit B',
  city: 'Columbus',
  state: 'OH',
  zip: '43215',
  rentCents: 165000,
  availableOn: '2027-01-01',
  depositCents: 165000,
  feeCents: 0,
  smokingPolicy: 'non_smoking',
  reviewMode: 'compare',
};

describe('published criteria content (S-05)', () => {
  const p = publishedCriteriaContent(SAMPLE, SAMPLE_CRITERIA);

  it('matches the mockup sentences for the §8 sample', () => {
    expect(p.title).toBe('Rental criteria');
    expect(p.address).toBe('1428 Maple St, Unit B, Columbus, OH 43215');
    expect(p.terms).toBe('$1,650/mo · Available Jan 1, 2027');
    expect(p.checks).toEqual([
      'Income of at least 3× your share of the rent',
      '12 months of rental or home-ownership history',
      'No eviction judgment in the past 5 years',
      'A previous landlord who would rent to you again',
      'No unpaid balance owed to a past landlord',
      'Up to 2 people per bedroom · cats and dogs, max 2',
      'Criminal history: convictions in the past 7 years only, reviewed individually after a conditional offer',
    ]);
    expect(p.bring).toEqual(['Photo ID', 'Proof of income (2 recent pay stubs, offer letter, or benefits / voucher letter)']);
    expect(p.howWeReview).toBeNull();
    expect(p.goodToKnow).toEqual([
      'We do not charge an application fee.',
      'Security deposit: $1,650.',
      'Non-smoking property.',
      'You may ask for more time or a reasonable accommodation.',
      'We do not ask for your Social Security number on this application.',
    ]);
    expect(p.fairHousing).toContain('familial status, disability');
  });

  it('follows parameters, mode, fee and custom criteria; never a score or ranking', () => {
    const list: Criterion[] = defaultCriteria().map((c): Criterion => {
      if (c.code === 'C1') return { ...c, params: { multipleTenths: 25, applyToTenantShare: false } };
      if (c.code === 'C2') return { ...c, params: { months: 0 } };
      if (c.code === 'C7') return { ...c, params: { perBedroom: 1 } };
      if (c.code === 'C8') return { ...c, enabled: false };
      if (c.code === 'C9') return { ...c, enabled: true };
      return c;
    });
    list.push({ id: 'x', code: 'CX', enabled: true, order: 11, params: { title: 'Has renters insurance', answeredBy: 'landlord' } });
    const q = publishedCriteriaContent({ ...SAMPLE, reviewMode: 'first_come', feeCents: 3500, depositCents: null, smokingPolicy: 'outside' }, list);
    expect(q.checks).toEqual([
      'Income of at least 2.5× the rent',
      'Rental or home-ownership history (no minimum)',
      'No eviction judgment in the past 5 years',
      'A previous landlord who would rent to you again',
      'No unpaid balance owed to a past landlord',
      'Up to 1 person per bedroom',
      'Credit score of at least 600',
      'Has renters insurance',
    ]);
    expect(q.howWeReview).toBe(
      'Applications are reviewed in the order received. If information is missing you will have 72 hours to provide it. Offers are open for 48 hours.',
    );
    expect(q.goodToKnow.slice(0, 2)).toEqual(['Application fee: $35.', 'Smoking allowed outside only.']);
    const all = JSON.stringify(q).toLowerCase();
    for (const w of ['score:', 'rank', 'recommended', 'winner']) expect(all).not.toContain(w);
  });

  it('lists pets alone when occupancy is off', () => {
    const list = SAMPLE_CRITERIA.map((c) => (c.code === 'C7' ? { ...c, enabled: false } : c));
    expect(publishedCriteriaContent(SAMPLE, list).checks).toContain('Cats and dogs, max 2');
  });
});

describe('published criteria PDF + text', () => {
  it('builds a Letter page with every section, the footer, and escaped values', () => {
    const p = publishedCriteriaContent({ ...SAMPLE, street: '12 <b>Elm</b> & Co' }, SAMPLE_CRITERIA);
    const html = publishedCriteriaHtml(p);
    expect(html).toContain('<title>Rental criteria</title>');
    expect(html).toContain('12 &lt;b&gt;Elm&lt;/b&gt; &amp; Co, Unit B, Columbus, OH 43215');
    expect(html).not.toContain('<b>Elm</b>');
    expect(html).toContain('<h2>We will check</h2>');
    expect(html).toContain('<li>No eviction judgment in the past 5 years</li>');
    expect(html).toContain('<h2>Bring</h2>');
    expect(html).toContain('$1,650/mo · Available Jan 1, 2027');
    expect(html).toContain('Evenlease is a checklist, not legal advice. Laws vary by state and city.');
    expect(html).not.toContain('How we review');
    expect(publishedCriteriaHtml({ ...p, howWeReview: 'In order.' })).toContain('<h2>How we review</h2><p>In order.</p>');
  });

  it('copies as plain text for a listing', () => {
    const text = publishedCriteriaText(publishedCriteriaContent(SAMPLE, SAMPLE_CRITERIA));
    expect(text.startsWith('Rental criteria — 1428 Maple St, Unit B, Columbus, OH 43215\n$1,650/mo · Available Jan 1, 2027\n\nWe will check:\n• Income of at least 3× your share of the rent')).toBe(true);
    expect(text).toContain('Bring:\n• Photo ID\n');
    expect(text).toContain('Good to know:\n• We do not charge an application fee.');
    expect(text.endsWith('any other characteristic protected by law.')).toBe(true);
    expect(text).not.toContain('<');
  });

  it('prints and shares under a safe file name', async () => {
    const p = publishedCriteriaContent(SAMPLE, SAMPLE_CRITERIA);
    expect(publishedCriteriaFileName(p)).toBe('Rental criteria - 1428 Maple St Unit B Columbus OH 43215');
    const adapter: PdfAdapter = {
      printToFile: jest.fn().mockResolvedValue({ uri: 'file:///cache/print.pdf', numberOfPages: 1 }),
      moveToCache: jest.fn().mockImplementation(async (_u: string, name: string) => `file:///cache/pdf/${name}`),
      isSharingAvailable: jest.fn().mockResolvedValue(true),
      share: jest.fn().mockResolvedValue(undefined),
    };
    const r = await sharePublishedCriteriaPdf(p, { adapter });
    expect(adapter.moveToCache).toHaveBeenCalledWith('file:///cache/print.pdf', 'Rental criteria - 1428 Maple St Unit B Columbus OH 43215.pdf');
    expect(r).toEqual({ uri: 'file:///cache/pdf/Rental criteria - 1428 Maple St Unit B Columbus OH 43215.pdf', numberOfPages: 1, shared: true });
    expect((adapter.printToFile as jest.Mock).mock.calls[0][0]).toContain('We will check');
  });

  it('copy reports success / failure from the clipboard adapter', async () => {
    const setText = jest.fn().mockResolvedValue(undefined);
    await expect(copyText('hello', { setText })).resolves.toBe(true);
    expect(setText).toHaveBeenCalledWith('hello');
    await expect(copyText('x', { setText: jest.fn().mockRejectedValue(new Error('no')) })).resolves.toBe(false);
  });
});
