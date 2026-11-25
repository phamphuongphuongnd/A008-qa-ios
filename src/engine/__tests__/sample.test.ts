/** @jest-environment node */
// product.md §8 — the sample rental's expected results, cell by cell (§3.16).
import { compareApplicants, evaluateApplicant, noticeRequirement, reasonOptions, defaultReportInfluenced } from '..';
import { SAMPLE_APPLICANTS, SAMPLE_CRITERIA, SAMPLE_RENTAL } from '../fixtures/sample';
import type { ApplicantEvaluation, CriterionCode, Evidence, Outcome } from '../types';

const [jordan, priya, marcus, dana] = SAMPLE_APPLICANTS;
const evalOf = (i: number) => evaluateApplicant(SAMPLE_RENTAL, SAMPLE_CRITERIA, SAMPLE_APPLICANTS[i]);
const cell = (e: ApplicantEvaluation, code: CriterionCode) => {
  const r = e.results.find((x) => x.code === code);
  if (!r) throw new Error(`no ${code}`);
  return r;
};
const expectCells = (e: ApplicantEvaluation, table: [CriterionCode, Outcome, Evidence | null][]) => {
  for (const [code, outcome, evidence] of table) {
    expect([code, cell(e, code).outcome, cell(e, code).evidence]).toEqual([code, outcome, evidence]);
  }
};

describe('§8 #1 Jordan Ellis', () => {
  const e = evalOf(0);
  it('every cell matches', () => {
    expectCells(e, [
      ['C1', 'met', 'verified'],
      ['C2', 'met', 'verified'],
      ['C3', 'met', 'verified'],
      ['C4', 'met', 'verified'],
      ['C5', 'met', 'verified'],
      ['C6', 'met', 'verified'],
      ['C7', 'met', 'claimed'],
      ['C8', 'met', 'claimed'],
      ['C10', 'not_reviewed', null],
    ]);
  });
  it('C1 uses the pay stubs: $5,351.67/mo is 3.24× rent', () => {
    expect(cell(e, 'C1').reason).toContain('$5,351.67/mo is 3.24× rent');
    expect(cell(e, 'C1').income?.householdCents).toBe(535167);
  });
  it('C10 shows "Not reviewed yet (after offer)" and C9 (off) is absent', () => {
    expect(cell(e, 'C10').reason).toBe('Not reviewed yet (after offer)');
    expect(e.results.some((r) => r.code === 'C9')).toBe(false);
  });
  it('Ready to decide, no issues', () => {
    expect(e.summary).toEqual({ ready: true, missingCount: 0, text: 'Ready to decide' });
    expect(e.issues).toEqual([]);
  });
});

describe('§8 #2 Priya Raman', () => {
  const e = evalOf(1);
  it('every cell matches', () => {
    expectCells(e, [
      ['C1', 'not_met', 'claimed'],
      ['C2', 'met', 'claimed'],
      ['C3', 'met', 'verified'],
      ['C4', 'missing', null],
      ['C5', 'not_met', 'verified'],
      ['C6', 'missing', null],
      ['C7', 'met', 'claimed'],
      ['C8', 'met', 'claimed'],
    ]);
  });
  it('C1 reason: 2.85× rent, short by $250/mo', () => {
    expect(cell(e, 'C1').reason).toContain('$4,700/mo is 2.85× rent; required 3.0× · Short by $250/mo');
    expect(cell(e, 'C1').income?.shortByCents).toBe(25000);
  });
  it('C2 30 months, C4 not reached after 2 calls, C5 from the report, C6 lists Proof of income', () => {
    expect(cell(e, 'C2').historyMonths).toBe(30);
    expect(cell(e, 'C4').reason).toBe('Not reached yet (2 attempts)');
    expect(cell(e, 'C5').source).toBe('screening_report');
    expect(cell(e, 'C5').reason).toContain('$2,310');
    expect(cell(e, 'C6').reason).toBe('Missing: Proof of income');
  });
  it('"2 items missing"', () => {
    expect(e.summary).toEqual({ ready: false, missingCount: 2, text: '2 items missing' });
  });
  it('Deny for C5 requires an FCRA adverse action notice', () => {
    const reasons = reasonOptions(e.results).filter((r) => r.code === 'C5');
    const n = noticeRequirement(
      { kind: 'deny', conditions: [], reasons, note: '', reportInfluenced: defaultReportInfluenced(priya.report) },
      priya.report,
    );
    expect(n.letter).toBe('adverse_action');
    expect(n.canExport).toBe(true);
  });
});

describe('§8 #3 Marcus Webb', () => {
  const e = evalOf(2);
  it('every cell matches', () => {
    expectCells(e, [
      ['C1', 'met', 'verified'],
      ['C2', 'met', 'mismatch'],
      ['C3', 'met', 'claimed'],
      ['C4', 'needs_review', 'mismatch'],
      ['C5', 'missing', null],
      ['C6', 'met', 'verified'],
      ['C7', 'met', 'claimed'],
      ['C8', 'met', 'claimed'],
    ]);
  });
  it('C1 3.70×, C7 3 ≤ 4', () => {
    expect(cell(e, 'C1').reason).toContain('3.70×');
    expect(cell(e, 'C7').reason).toContain('up to 4');
  });
  it('issues: rent mismatch +29% and dates; sorted Mismatch → Needs review → Missing', () => {
    expect(e.issues.some((i) => i.code === 'C4' && i.message.includes('+29%'))).toBe(true);
    expect(e.issues.some((i) => i.code === 'C2' && i.message.includes('Jan 2023'))).toBe(true);
    const kinds = e.issues.map((i) => i.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => rank(a) - rank(b)));
    expect(kinds[0]).toBe('mismatch');
    expect(kinds[kinds.length - 1]).toBe('missing');
  });
  it('"1 item missing"', () => {
    expect(e.summary.text).toBe('1 item missing');
  });
  it('Deny only on C4 (self-called reference, no report) → plain Denial letter', () => {
    const reasons = reasonOptions(e.results).filter((r) => r.code === 'C4');
    expect(reasons[0].source).toBe('landlord_reference');
    const n = noticeRequirement(
      { kind: 'deny', conditions: [], reasons, note: '', reportInfluenced: defaultReportInfluenced(marcus.report) },
      marcus.report,
    );
    expect(n).toMatchObject({ letter: 'denial', adverseAction: false });
  });
});

describe('§8 #4 Dana Ortiz', () => {
  const e = evalOf(3);
  it('every cell matches', () => {
    expectCells(e, [
      ['C1', 'met', 'verified'],
      ['C2', 'met', 'verified'],
      ['C3', 'needs_review', 'verified'],
      ['C4', 'met', 'verified'],
      ['C5', 'met', 'verified'],
      ['C6', 'met', 'verified'],
      ['C7', 'met', 'claimed'],
      ['C8', 'met', 'claimed'],
    ]);
  });
  it('C1: 3.47× your share of the rent ($750)', () => {
    expect(cell(e, 'C1').reason).toContain('3.47× your share of the rent ($750)');
    expect(cell(e, 'C1').income?.rentForTestCents).toBe(75000);
  });
  it('C3 reason: filed, no judgment', () => {
    expect(cell(e, 'C3').reason).toBe('A case was filed but there was no judgment against the applicant');
  });
  it('Ready to decide (Needs review does not block)', () => {
    expect(e.summary.text).toBe('Ready to decide');
    expect(e.issues.map((i) => i.kind)).toEqual(['needs_review']);
  });
});

describe('§8 Compare', () => {
  it('columns in received order, never a score', () => {
    const t = compareApplicants(SAMPLE_RENTAL, SAMPLE_CRITERIA, [dana, marcus, jordan, priya]);
    expect(t.columns.map((c) => c.fullName)).toEqual(['Jordan Ellis', 'Priya Raman', 'Marcus Webb', 'Dana Ortiz']);
    expect(t.rows.map((r) => r.code)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C10']);
    expect(t.issueCounts[0]).toBe(0);
    expect(JSON.stringify(t)).not.toMatch(/score|rank|total/i);
  });
  it('hide denied / withdrawn', () => {
    const t = compareApplicants(SAMPLE_RENTAL, SAMPLE_CRITERIA, [{ ...priya, status: 'denied' }, jordan], { hideClosed: true });
    expect(t.columns.map((c) => c.applicantId)).toEqual(['sample-a1']);
  });
  it('50 applicants × 15 criteria evaluate in < 50 ms', () => {
    const extra = Array.from({ length: 5 }, (_, i) => ({
      id: `x${i}`,
      code: 'CX' as const,
      enabled: true,
      order: 20 + i,
      params: { title: `Custom ${i}`, answeredBy: 'applicant' as const },
    }));
    const crit = [...SAMPLE_CRITERIA.map((c) => ({ ...c, enabled: true })), ...extra];
    const many = Array.from({ length: 50 }, (_, i) => ({ ...SAMPLE_APPLICANTS[i % 4], id: `a${i}` }));
    compareApplicants(SAMPLE_RENTAL, crit, many);
    const t0 = performance.now();
    const t = compareApplicants(SAMPLE_RENTAL, crit, many);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(t.rows).toHaveLength(15);
  });
});

function rank(k: string): number {
  return { mismatch: 0, needs_review: 1, unconfirmed: 2, missing: 3 }[k] ?? 9;
}
