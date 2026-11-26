/**
 * S-19 Decision file PDF (F-15): the Rental's published criteria + criteria history, then every Applicant in the order
 * received with their criterion results and evidence (source, date), Decisions (reasons, timestamp) and letters
 * (created / sent, how). No total score, no ranking. Document images are left out unless the landlord switches on
 * "Include document thumbnails" (off by default).
 *
 * Pure: the caller (src/features/decision/decisionFile.ts) loads and formats; this file only lays out + escapes.
 */
import { t } from '@/i18n';

import { html, pdfDocument, raw, section, table, type SafeHtml } from './shell';

export interface DecisionFileResultRow {
  title: string;
  /** "Met", "Not met"… (display text). */
  outcome: string;
  evidence: string | null;
  /** "Screening report · Dec 3, 2026". */
  sourceText: string | null;
  reason: string;
}

export interface DecisionFileDecision {
  /** "Deny · Dec 6, 2026, 3:12 PM". */
  heading: string;
  reasons: string[];
  note: string | null;
  conditions: string[];
  reportInfluenced: boolean;
  noticePending: boolean;
  /** "Adverse action notice sent Dec 6, 2026 (Email)". */
  letters: string[];
}

export type DecisionFileApplicant =
  | { deleted: true; position: number; deletedText: string }
  | {
      deleted: false;
      position: number;
      name: string;
      /** "Dec 2, 2026, 9:14 AM". */
      receivedText: string;
      /** "Ready to decide" / "2 items missing" (engine summary, never a score). */
      summary: string;
      results: DecisionFileResultRow[];
      decisions: DecisionFileDecision[];
      /** data: URIs, only when "Include document thumbnails" is on. */
      thumbnails?: string[];
    };

export interface DecisionFileInput {
  rentalAddress: string;
  /** "Dec 20, 2026". */
  exportedText: string;
  reviewMode: 'compare' | 'first_come';
  criteria: string[];
  history: { atText: string; lines: string[]; reason: string }[];
  applicants: DecisionFileApplicant[];
}

const THUMB_CSS = `.thumbs img { width: 1.4in; height: 1.4in; object-fit: cover; margin: 0 6pt 6pt 0; border: 1px solid #000; }
.applicant { break-before: auto; } .decision p { margin: 0 0 3pt; } ul { margin: 0 0 6pt 16pt; padding: 0; }`;

function applicantBlock(a: DecisionFileApplicant): SafeHtml {
  if (a.deleted) return html`<section class="applicant"><h2>${a.position}. ${a.deletedText}</h2></section>`;
  const rows = a.results.map((r) => [r.title, r.outcome, r.evidence ?? '—', r.sourceText ?? '—', r.reason]);
  const decisions = a.decisions.length
    ? a.decisions.map(
        (d) => html`<div class="decision"><p><strong>${d.heading}</strong></p>${
          d.conditions.length ? html`<p>${t('decision:decisionFile.conditions', { list: d.conditions.join('; ') })}</p>` : ''
        }${d.reasons.length ? html`<p>${t('decision:decisionFile.reasons', { list: d.reasons.join('; ') })}</p>` : ''}${
          d.note ? html`<p>${t('decision:decisionFile.note', { note: d.note })}</p>` : ''
        }${d.reportInfluenced ? html`<p>${t('decision:decisionFile.reportInfluenced')}</p>` : ''}${
          d.noticePending ? html`<p><strong>${t('decision:decisionFile.noticePending')}</strong></p>` : ''
        }${d.letters.map((l) => html`<p>${l}</p>`)}</div>`,
      )
    : html`<p>${t('decision:decisionFile.noDecision')}</p>`;
  return html`<section class="applicant"><h2>${a.position}. ${a.name} — ${t('decision:decisionFile.received', { when: a.receivedText })}</h2>
<p class="muted">${a.summary} · ${t('decision:decisionFile.notScore')}</p>
${table(
  [
    { header: t('decision:decisionFile.colCriterion'), width: '24%' },
    { header: t('decision:decisionFile.colResult'), width: '12%' },
    { header: t('decision:decisionFile.colEvidence'), width: '11%' },
    { header: t('decision:decisionFile.colSource'), width: '19%' },
    { header: t('decision:decisionFile.colReason') },
  ],
  rows,
)}
<h3>${t('decision:decisionFile.decision')}</h3>${decisions}${
    a.thumbnails?.length
      ? html`<h3>${t('decision:decisionFile.documents')}</h3><div class="thumbs">${a.thumbnails.map(
          (src) => html`<img src="${src}" alt="">`,
        )}</div>`
      : ''
  }</section>`;
}

export function decisionFileHtml(input: DecisionFileInput): string {
  const history = input.history.length
    ? html`<ul>${input.history.map(
        (h) => html`<li>${h.atText} · ${h.lines.length ? h.lines.join('; ') : ''}${h.lines.length ? ' · ' : ''}“${h.reason}”</li>`,
      )}</ul>`
    : html`<p>${t('decision:decisionFile.noHistory')}</p>`;
  const body = html`<style>${raw(THUMB_CSS)}</style>
${section(t('decision:decisionFile.criteria'), html`<p>${t(`decision:decisionFile.reviewMode.${input.reviewMode}`)}</p><ol>${input.criteria.map((c) => html`<li>${c}</li>`)}</ol>`)}
${section(t('decision:decisionFile.history'), history)}
<h2>${t('decision:decisionFile.applicants')}</h2>
${input.applicants.length ? input.applicants.map(applicantBlock) : html`<p>${t('decision:decisionFile.noApplicants')}</p>`}`;
  return pdfDocument({
    title: t('decision:decisionFile.title'),
    subtitle: t('decision:decisionFile.exported', { address: input.rentalAddress, date: input.exportedText }),
    body,
  });
}

/** "Decision file - 1428 Maple St, Unit B". */
export function decisionFileName(rentalShortAddress: string): string {
  return `${t('decision:decisionFile.title')} - ${rentalShortAddress.replace(/,\s*/g, ' ')}`;
}
