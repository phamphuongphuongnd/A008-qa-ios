/**
 * S-19 Decision file service (F-15): load + format a Rental's record for `decisionFileHtml`, then export / share.
 * Document thumbnails are read only when the landlord switches them on (off by default, product.md S-19).
 */
import { activeCriteria, criterionTitle, describeCriteriaChanges, formatDate, type Criterion } from '@/engine';
import { listApplicants } from '@/db/repos/applicants';
import { listCriteriaHistory } from '@/db/repos/criteria';
import type { AppDb } from '@/db/types';
import { t } from '@/i18n';
import { decisionFileHtml, decisionFileName, type DecisionFileApplicant, type DecisionFileInput } from '@/pdf/decisionFile';
import { conditionText, letterTitle } from '@/pdf/letters';
import { dateTime, printToPdfAndShare, type PdfAdapter } from '@/pdf/shell';

import { loadRentalReview, rentalAddress } from './review';
import { localDate, localDateTime } from './time';

/** Stored stamp → "Dec 6, 2026, 3:12 PM": local-offset stamps keep their wall clock; UTC ('Z') ones are shown locally. */
export function stampText(ts: string): string {
  return /Z$/i.test(ts) ? localDateTime(ts).replace(' at ', ', ') : dateTime(ts);
}

const dateText = (ts: string) => formatDate(/Z$/i.test(ts) ? localDate(new Date(ts)) : ts.slice(0, 10));

/** History rows store criteria without ids; key them by code (custom ones by title) so changes line up. */
function historyCriteria(x: unknown): Criterion[] | null {
  if (!Array.isArray(x)) return null;
  return x.map((c: { code: string; params: { title?: string } }) => ({ ...c, id: c.code === 'CX' ? `CX:${c.params?.title ?? ''}` : c.code }) as Criterion);
}

export function historyLines(before: unknown, after: unknown): string[] {
  const a = historyCriteria(before);
  const b = historyCriteria(after);
  if (!a || !b) return [];
  try {
    return describeCriteriaChanges(a, b);
  } catch {
    return [];
  }
}

export interface DecisionFileOptions {
  /** "Include document thumbnails" (off by default). */
  thumbnails?: { read(path: string): Promise<string | null> } | null;
}

export async function buildDecisionFile(db: AppDb, rentalId: number, now: Date, opts: DecisionFileOptions = {}): Promise<DecisionFileInput | null> {
  const nowIso = now.toISOString();
  const review = loadRentalReview(db, rentalId, nowIso);
  if (!review) return null;
  const titles = new Map(review.criteria.map((c) => [c.id, criterionTitle(c)]));
  const all = listApplicants(db, rentalId, { deleted: true });
  const applicants: DecisionFileApplicant[] = [];
  for (const [i, row] of all.entries()) {
    const position = i + 1;
    const idx = review.bundles.findIndex((b) => b.applicant.id === row.id);
    if (row.deletedAt || idx < 0) {
      applicants.push({
        deleted: true,
        position,
        deletedText: t('decision:decisionFile.dataDeleted', { n: position, date: row.deletedAt ? dateText(row.deletedAt) : '—' }),
      });
      continue;
    }
    const bundle = review.bundles[idx];
    const ev = review.evaluations[idx];
    const sourceLabel = (s: string | null) => (s ? t(`decision:source.${s}` as 'decision:source.application') : null);
    let thumbnails: string[] | undefined;
    if (opts.thumbnails) {
      thumbnails = [];
      for (const d of bundle.documents) {
        if (!d.mime?.startsWith('image/')) continue;
        const uri = await opts.thumbnails.read(d.filePath).catch(() => null);
        if (uri) thumbnails.push(uri);
      }
    }
    applicants.push({
      deleted: false,
      position,
      name: bundle.applicant.fullName,
      receivedText: stampText(bundle.applicant.receivedAt),
      summary: ev.summary.text,
      results: ev.results.map((r) => ({
        title: r.title,
        outcome: t(`decision:outcome.${r.outcome}`),
        evidence: r.evidence ? t(`decision:evidence.${r.evidence}`) : null,
        sourceText: [sourceLabel(r.source), r.verifiedOn ? formatDate(r.verifiedOn) : null].filter(Boolean).join(' · ') || null,
        reason: r.reason,
      })),
      decisions: bundle.decisions.map((d) => ({
        heading: t('decision:decisionFile.decidedAt', { kind: t(`decision:decisionKind.${d.kind}`), when: stampText(d.at) }),
        reasons: (d.reasons ?? []).map((r) => {
          const src = sourceLabel(r.source);
          return `${titles.get(r.criterionId) ?? r.code}${src ? ` (${src})` : ''}`;
        }),
        note: d.note?.trim() || null,
        conditions: (d.conditions ?? []).map(conditionText),
        reportInfluenced: d.reportInfluenced,
        noticePending: d.noticeStatus === 'pending',
        letters: d.letters.map((l) =>
          l.sentAt
            ? t('decision:decisionFile.letterSent', {
                letter: letterTitle(l.kind),
                date: dateText(l.sentAt),
                method: l.sentMethod ? t(`decision:sentMethod.${l.sentMethod}`) : '—',
              })
            : t('decision:decisionFile.letterNotSent', { letter: letterTitle(l.kind), date: dateText(l.createdAt) }),
        ),
      })),
      thumbnails,
    });
  }
  return {
    rentalAddress: rentalAddress(review.rentalRow).full,
    exportedText: formatDate(localDate(now)),
    reviewMode: review.rental.reviewMode,
    criteria: activeCriteria(review.criteria).map(criterionTitle),
    history: listCriteriaHistory(db, rentalId)
      .slice()
      .reverse()
      .map((h) => ({ atText: dateText(h.at), lines: historyLines(h.before, h.after), reason: h.reason })),
    applicants,
  };
}

/** "Export PDF" / "Share". */
export async function exportDecisionFile(
  deps: { db: AppDb; now: () => Date; pdf?: PdfAdapter },
  rentalId: number,
  opts: DecisionFileOptions = {},
): Promise<{ ok: true; uri: string; shared: boolean; pages: number | null } | { ok: false; error: 'not_found' }> {
  const data = await buildDecisionFile(deps.db, rentalId, deps.now(), opts);
  if (!data) return { ok: false, error: 'not_found' };
  const review = loadRentalReview(deps.db, rentalId, deps.now().toISOString())!;
  const res = await printToPdfAndShare(decisionFileHtml(data), decisionFileName(rentalAddress(review.rentalRow).short), { adapter: deps.pdf });
  return { ok: true, uri: res.uri, shared: res.shared, pages: res.numberOfPages };
}
