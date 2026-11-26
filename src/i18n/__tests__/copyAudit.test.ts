/**
 * Step 4 QA: every on-screen / PDF string (en) against the product rules — no promise of being legal or compliant,
 * no score / ranking / winner, SSN only ever mentioned as "we never ask", no empty or placeholder text.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '../en');

function flat(o: unknown, prefix: string): [string, string][] {
  if (typeof o === 'string') return [[prefix, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => flat(v, `${prefix}.${i}`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => flat(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

const STRINGS: [string, string][] = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => flat(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), f.replace('.json', '')));

describe('i18n copy audit (en)', () => {
  it('has strings to check', () => {
    expect(STRINGS.length).toBeGreaterThan(500);
  });

  it('never promises compliance, legality, a guarantee or "free forever" (APP.md, §10)', () => {
    const bad = STRINGS.filter(([, v]) => /complian|guarantee|free forever|100% legal|legally safe|lawsuit-proof/i.test(v));
    expect(bad).toEqual([]);
  });

  it('"legal" appears only as "not legal advice", "Legal & privacy" or "law firm" wording', () => {
    const bad = STRINGS.filter(([, v]) => /\blegal\b/i.test(v) && !/not legal advice|legal advice|legal & privacy|full legal name|law firm/i.test(v));
    expect(bad).toEqual([]);
  });

  it('no score, ranking or winner of applicants (§3.1); "score" only for the credit score', () => {
    const rank = STRINGS.filter(([, v]) => /\b(rank|ranked|ranking|winner|best applicant|recommended applicant|top applicant)\b/i.test(v) && !/\bnot a ranking\b|never scores, ranks/i.test(v));
    expect(rank).toEqual([]);
    const score = STRINGS.filter(([, v]) => /\bscores?\b/i.test(v) && !/credit|not a score|never scores|minimum score|score (model|range)|date the score|date of score|^score$|the score|no score|score as a number|\{\{score\}\}/i.test(v));
    expect(score).toEqual([]);
  });

  it('mentions Social Security numbers only to say they are never asked for', () => {
    const ssn = STRINGS.filter(([, v]) => /social security number|\bSSN\b/i.test(v));
    expect(ssn.length).toBeGreaterThanOrEqual(5);
    for (const [k, v] of ssn) expect([k, /never|do not|don't|not ask|directly|on the company's site/i.test(v)]).toEqual([k, true]);
  });

  it('never asks for a date of birth, gender, race, religion or nationality as a field', () => {
    const fields = STRINGS.filter(([k]) => /^intake\.fields\./.test(k));
    expect(fields.length).toBeGreaterThan(10);
    expect(fields.filter(([, v]) => /birth|gender|\bsex\b|race|religion|nationality|citizenship|marital/i.test(v))).toEqual([]);
  });

  it('has no empty, placeholder or TODO text', () => {
    expect(STRINGS.filter(([, v]) => v.trim() === '')).toEqual([]);
    expect(STRINGS.filter(([, v]) => /TODO|lorem|placeholder|TBD|xxx/i.test(v))).toEqual([]);
  });

  it('the "not legal advice" footer text matches product.md §5.0', () => {
    expect(STRINGS.find(([k]) => k === 'common.notLegalAdvice')?.[1]).toBe('Evenlease is a checklist, not legal advice. Laws vary by state and city.');
  });
});
