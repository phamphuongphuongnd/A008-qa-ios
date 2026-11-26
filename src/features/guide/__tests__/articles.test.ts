import { GUIDE, GUIDE_ORDER, getArticle, isGuideSlug, listArticles, searchArticles } from '../articles';

describe('S-25 Guide', () => {
  it('has the 11 articles of product.md S-25, in order', () => {
    expect(listArticles().map((a) => a.title)).toEqual([
      'How Evenlease works',
      'Writing fair criteria',
      'Fair housing basics',
      'Housing vouchers and income rules',
      'Spotting fake references',
      'Verifying income',
      'Screening reports explained (credit, eviction, criminal)',
      'When you must send an adverse action notice',
      'First-come rules (Seattle)',
      'Criminal history laws by city',
      'Getting rid of applicant data',
    ]);
    expect(GUIDE_ORDER).toHaveLength(11);
  });

  it.each(GUIDE_ORDER)('%s: ≤ 400 words, has https sources, no promise of being "compliant" / "legal"', (slug) => {
    const a = getArticle(slug)!;
    expect(a.words).toBeLessThanOrEqual(400);
    expect(a.words).toBeGreaterThan(60);
    expect(a.minutes).toBeGreaterThanOrEqual(1);
    expect(a.summary.length).toBeGreaterThan(0);
    expect(a.sources.length).toBeGreaterThan(0);
    for (const s of a.sources) expect(s.url).toMatch(/^https:\/\/[a-z0-9.-]+\.(gov|com|org|edu)\//);
    const text = [a.title, a.summary, ...a.body].join(' ');
    expect(text).not.toMatch(/\bcompliant\b|\bcompliance\b|fair housing approved|guarantee|\bis legal\b|\blegally safe\b|\brecommended\b/i);
    expect(text).not.toMatch(/social security number(?!s? or date)/i);
  });

  it('search by title, any order, ignoring case', () => {
    expect(searchArticles('').length).toBe(11);
    expect(searchArticles('ADVERSE').map((a) => a.slug)).toEqual([GUIDE.adverseAction]);
    expect(searchArticles('income housing').map((a) => a.slug)).toEqual([GUIDE.vouchers]);
    expect(searchArticles('seattle').map((a) => a.slug)).toEqual([GUIDE.firstCome]);
    expect(searchArticles('zzz')).toEqual([]);
  });

  it('unknown slug → null (deep link to a removed article)', () => {
    expect(getArticle('nope')).toBeNull();
    expect(isGuideSlug('adverse-action')).toBe(true);
  });
});
