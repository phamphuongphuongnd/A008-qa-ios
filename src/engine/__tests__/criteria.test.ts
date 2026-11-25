/** @jest-environment node */
// §3.2 defaults, §3.12 guardrails, §3.13 lock & history.
import {
  criteriaWarnings,
  criterionTitle,
  customTitleError,
  defaultCriteria,
  editCriteria,
  findProhibitedTerms,
  isCriteriaLocked,
  PROHIBITED_MESSAGE,
  reviewModeHint,
  validateCriteria,
} from '..';
import type { Criterion } from '../types';

describe('§3.2 template', () => {
  it('C1–C8 on, C9 and C10 off, with the default parameters', () => {
    const d = defaultCriteria('r1');
    expect(d.filter((c) => c.enabled).map((c) => c.code)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
    expect(d.map(criterionTitle).slice(0, 3)).toEqual([
      'Income: at least 3.0× the rent',
      'At least 12 months of rental or home-ownership history',
      'No eviction judgment in the past 5 years',
    ]);
    expect(criterionTitle(d[8])).toBe('Credit score of at least 600');
    expect(validateCriteria(d)).toEqual([]);
  });
  it('parameter ranges: 2.0–4.0×, 0–60 months, 1–7 years', () => {
    const d = defaultCriteria();
    const bad = d.map((c): Criterion => {
      if (c.code === 'C1') return { ...c, params: { ...c.params, multipleTenths: 41 } };
      if (c.code === 'C2') return { ...c, params: { months: 61 } };
      if (c.code === 'C3') return { ...c, params: { years: 0 } };
      return c;
    });
    expect(validateCriteria(bad).map((e) => e.criterionId)).toEqual(['crit-c1', 'crit-c2', 'crit-c3']);
  });
});

describe('§3.12 prohibited terms', () => {
  it.each([
    'No kids',
    'NO KIDS',
    'Families welcome only',
    'Must be a US citizen',
    'Citizens only',
    'No Section 8',
    'no section-8 tenants',
    'Speaks English',
    'Not on welfare or SSI',
    'Married couples',
    'Under age 60',
    'No wheelchairs',
    'Christian household',
    'Pregnancies',
    'No child under 5',
  ])('blocks "%s"', (title) => {
    expect(findProhibitedTerms(title).length).toBeGreaterThan(0);
  });
  it.each(['Pays rent on time', 'Has a mortgage history', 'Household income verified', 'Can move in by Jan 15', 'Classic car parking'])(
    'allows "%s" (whole words only)',
    (title) => {
      expect(findProhibitedTerms(title)).toEqual([]);
    },
  );
  it('custom title errors carry the fair-housing message; ≤ 80 chars; ≤ 5 custom', () => {
    expect(customTitleError('No voucher holders')).toMatchObject({ code: 'prohibited', message: PROHIBITED_MESSAGE, terms: ['voucher'] });
    expect(customTitleError('x'.repeat(81))?.code).toBe('title_too_long');
    expect(customTitleError('  ')?.code).toBe('empty_title');
    const six = Array.from({ length: 6 }, (_, i): Criterion => ({
      id: `x${i}`,
      code: 'CX',
      enabled: true,
      order: i,
      params: { title: `Rule ${i}`, answeredBy: 'landlord' },
    }));
    expect(validateCriteria(six).map((e) => e.code)).toEqual(['too_many_custom']);
  });
});

describe('§3.12 warnings', () => {
  it('voucher OFF, C7 below 2, C9 on, C10 on', () => {
    const d = defaultCriteria().map((c): Criterion => {
      if (c.code === 'C1') return { ...c, params: { ...c.params, applyToTenantShare: false } };
      if (c.code === 'C7') return { ...c, params: { perBedroom: 1 } };
      if (c.code === 'C9' || c.code === 'C10') return { ...c, enabled: true };
      return c;
    });
    expect(criteriaWarnings(d).map((w) => w.code)).toEqual(['voucher_off', 'occupancy_below_two', 'credit_enabled', 'criminal_local_law']);
    expect(criteriaWarnings(defaultCriteria())).toEqual([]);
  });
  it('WA rentals get the Seattle hint', () => {
    expect(reviewModeHint('wa')).toBe('Seattle requires first-come order.');
    expect(reviewModeHint('OH')).toBeNull();
  });
});

describe('§3.13 lock & history', () => {
  const before = defaultCriteria('r');
  const after = before.map((c): Criterion => (c.code === 'C1' ? { ...c, params: { ...c.params, multipleTenths: 25 } } : c));
  it('no applicants → free edit, no history', () => {
    expect(isCriteriaLocked(0)).toBe(false);
    expect(editCriteria({ before, after, applicantCount: 0, at: '2026-12-05T10:00:00-05:00' })).toMatchObject({ ok: true, history: null });
  });
  it('locked → reason required', () => {
    expect(isCriteriaLocked(1)).toBe(true);
    expect(editCriteria({ before, after, applicantCount: 2, reason: ' ', at: '2026-12-05T10:00:00-05:00' })).toMatchObject({
      ok: false,
      reasonRequired: true,
    });
  });
  it('locked with a reason → history entry (date, old → new, reason)', () => {
    const r = editCriteria({ before, after, applicantCount: 2, reason: 'Matched local market', at: '2026-12-05T10:00:00-05:00' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.history?.changes).toEqual([
      'Income: at least 3.0× the rent (voucher share on) → Income: at least 2.5× the rent (voucher share on)',
    ]);
    expect(r.history?.reason).toBe('Matched local market');
    expect(r.history?.at).toBe('2026-12-05T10:00:00-05:00');
  });
  it('turning a criterion on, adding and removing are described', () => {
    const on = before.map((c): Criterion => (c.code === 'C9' ? { ...c, enabled: true } : c)).filter((c) => c.code !== 'C8');
    const added: Criterion[] = [...on, { id: 'cx', code: 'CX', enabled: true, order: 11, params: { title: 'Has renters insurance', answeredBy: 'applicant' } }];
    const r = editCriteria({ before, after: added, applicantCount: 1, reason: 'Update', at: '2026-12-05T10:00:00-05:00' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.history?.changes).toEqual([
      'Turned on: Credit score of at least 600',
      'Added: Has renters insurance',
      'Removed: Pet policy: Pets considered case by case',
    ]);
  });
});
