/**
 * Step 4 QA: big rental — 50 applicants × 15 criteria (C1–C10 all on + 5 custom) through the real DB, the S-17 view,
 * the S-18 queue and the S-19 Decision file. Received order kept, never ranked, no "N of M Met" outside S-19.
 */
import * as A from '@/db/repos/applicants';
import * as C from '@/db/repos/criteria';
import * as R from '@/db/repos/rentals';
import * as S from '@/db/repos/sample';
import { makeTestDb } from '@/db/testing/testDb';
import { defaultCriteria, SAMPLE } from '@/engine';
import { decisionFileHtml } from '@/pdf/decisionFile';

import { criteriaToRows } from '../../criteria/criteriaRows';
import { buildDecisionFile } from '../decisionFile';
import { loadApplicantReview, loadCompare, loadQueue } from '../review';
import { applicantDetailView, compareView } from '../viewModel';

const N = 50;
const base = Date.parse('2026-12-01T08:00:00-05:00');
const stamp = (i: number) => new Date(base + i * 37 * 60_000).toISOString().replace('Z', '+00:00');

function bigRental() {
  const db = makeTestDb();
  const rentalId = R.createRental(db, { street: '9 Big St', city: 'Columbus', state: 'OH', zip: '43215', rentCents: 165000, bedrooms: 2, bathrooms: 1 });
  const crits = defaultCriteria().map((c) => ({ ...c, enabled: true }));
  const custom = [1, 2, 3, 4, 5].map((n) => ({
    id: `cx${n}`,
    code: 'CX' as const,
    enabled: true,
    order: 10 + n,
    params: { title: `Custom question ${n}`, answeredBy: n % 2 ? ('applicant' as const) : ('landlord' as const) },
  }));
  C.saveCriteria(db, rentalId, criteriaToRows([...crits, ...custom] as never));
  // Received out of insertion order on purpose: odd rows first in time.
  const ids: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i % 2 ? i : N + i;
    ids.push(A.createApplicant(db, { rentalId, receivedAt: stamp(t), fullName: `Tenant${String(i).padStart(2, '0')} Test`, phone: '614-555-0100', occupants: 1 + (i % 5) }));
  }
  return { db, rentalId, ids };
}

describe('50 applicants × 15 criteria', () => {
  it('Compare: 50 columns in received order, 15 criterion rows + Issues, no score', () => {
    const { db, rentalId } = bigRental();
    const t0 = Date.now();
    const data = loadCompare(db, rentalId, { hideClosed: false })!;
    const view = compareView(data);
    const ms = Date.now() - t0;
    expect(view.state).toBe('table');
    expect(view.columns).toHaveLength(N);
    expect(view.rows).toHaveLength(16);
    expect(view.rows[15].key).toBe('issues');
    const received = data.applicants.map((a) => Date.parse(a.receivedAt));
    expect([...received].sort((a, b) => a - b)).toEqual(received);
    expect(JSON.stringify(view)).not.toMatch(/of \d+ Met|\brank|winner/i);
    // The engine alone is < 50 ms (sample.test); DB load + view for the whole rental stays well under a second.
    expect(ms).toBeLessThan(1500);
  });

  it('S-09 for any of them: 15 criteria lines, a summary, no count of Met', () => {
    const { db, ids } = bigRental();
    const v = applicantDetailView(loadApplicantReview(db, ids[17], '2026-12-10T10:00:00-05:00')!);
    expect(v.criteria).toHaveLength(15);
    expect(JSON.stringify(v)).not.toMatch(/of \d+ Met/);
  });

  it('First-come: one In review, 49 waiting, numbered by received time', () => {
    const { db, rentalId } = bigRental();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const q = loadQueue(db, rentalId, '2026-12-10T10:00:00-05:00')!;
    expect(q.rows).toHaveLength(N);
    expect(q.rows.filter((r) => r.state === 'in_review')).toHaveLength(1);
    const times = q.rows.map((r) => Date.parse(r.receivedAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('Decision file: every applicant once, in received order, "N of M Met" only here', async () => {
    const { db, rentalId } = bigRental();
    const input = (await buildDecisionFile(db, rentalId, new Date('2026-12-10T15:00:00Z')))!;
    const html = decisionFileHtml(input);
    const names = [...html.matchAll(/Tenant(\d\d) Test/g)].map((m) => m[1]);
    const firstSeen = names.filter((n, i) => names.indexOf(n) === i);
    expect(firstSeen).toHaveLength(N);
    expect(firstSeen.slice(0, 3)).toEqual(['01', '03', '05']);
    expect(html).toMatch(/\d+ of 15 Met/);
  });
});

/** The §8 sample rental with its 4 applicants copied `times` times (A13 TC-193 used 20 = 4 × 5). */
function sampleTimes(times: number) {
  const applicants = Array.from({ length: times }, (_, k) =>
    SAMPLE.applicants.map((a) => JSON.parse(JSON.stringify(a).replaceAll(`"${a.id}`, `"${a.id}-k${k}`)) as (typeof SAMPLE.applicants)[number]),
  ).flat();
  const db = makeTestDb();
  const rentalId = S.loadSampleRental(db, { ...SAMPLE, applicants });
  return { db, rentalId };
}

/** SQL statements prepared while `f` runs (better-sqlite3 prepares one per Drizzle query). */
function countQueries(db: ReturnType<typeof makeTestDb>, f: () => void): number {
  const client = (db as unknown as { $client: { prepare: (...a: unknown[]) => unknown } }).$client;
  const spy = jest.spyOn(client, 'prepare');
  f();
  const n = spy.mock.calls.length;
  spy.mockRestore();
  return n;
}

describe('B-71: S-17 with 20 applicants', () => {
  it('loading the rental is a fixed number of queries, whatever the number of applicants', () => {
    const four = sampleTimes(1);
    const twenty = sampleTimes(5);
    const q4 = countQueries(four.db, () => loadCompare(four.db, four.rentalId, { hideClosed: false }));
    const q20 = countQueries(twenty.db, () => loadCompare(twenty.db, twenty.rentalId, { hideClosed: false }));
    expect(q20).toBe(q4);
    expect(q20).toBeLessThan(20);
  });

  it('20 applicants: same results as the 4 of §8, and load + view well under the old time', () => {
    const { db, rentalId } = sampleTimes(5);
    const run = () => compareView(loadCompare(db, rentalId, { hideClosed: false })!);
    run(); // warm up (first prepare / JIT)
    const t0 = performance.now();
    const view = run();
    const ms = performance.now() - t0;
    expect(view.columns).toHaveLength(20);
    // Copies share their received time: each of the 4 §8 applicants appears 5 times with the same Issues count.
    const counts = (v: ReturnType<typeof run>) => {
      const issues = v.rows[v.rows.length - 1];
      return v.columns.map((c) => (issues.cells[c.key] as { text: string }).text);
    };
    const four = sampleTimes(1);
    const base = counts(compareView(loadCompare(four.db, four.rentalId, { hideClosed: false })!));
    expect(counts(view)).toEqual(base.flatMap((n) => [n, n, n, n, n]));
    // Dev PC: ~25 ms after the fix (was ~220 ms with ~12 queries per applicant). Generous bound against regressions.
    expect(ms).toBeLessThan(120);
  });
});
