/**
 * S-05 Published criteria (F-03): the page the landlord shares with applicants. One content model feeds the screen
 * preview, the PDF (`publishedCriteriaHtml`) and "Copy as text" (`publishedCriteriaText`), so all three say the same.
 * Plain sentences only — no score, no ranking. Never contains applicant data.
 */
import {
  DOC_TYPE_LABELS,
  FIRST_COME_PUBLISHED_TEXT,
  activeCriteria,
  criterionTitle,
  formatUsd,
  type Criterion,
  type RequiredDocument,
} from '@/engine';
import { fullAddress, rentalPublishedLine, type AddressParts } from '@/features/units/format';
import { t } from '@/i18n';

import { html, pdfDocument, printToPdfAndShare, type PdfAdapter, type PdfShareResult } from './shell';

export interface PublishedRental extends AddressParts {
  rentCents: number;
  availableOn: string | null;
  depositCents: number | null;
  feeCents: number;
  smokingPolicy: 'non_smoking' | 'outside' | 'allowed';
  reviewMode: 'compare' | 'first_come';
}

export interface PublishedCriteria {
  title: string;
  /** "1428 Maple St, Unit B, Columbus, OH 43215". */
  address: string;
  /** "$1,650/mo · Available Jan 1, 2027". */
  terms: string;
  /** "We will check" sentences, in criteria order. */
  checks: string[];
  /** "Bring": required documents (C6). Empty when C6 is off. */
  bring: string[];
  /** First-come explanation, or null in Compare mode. */
  howWeReview: string | null;
  goodToKnow: string[];
  fairHousing: string;
}

/** 30 → "3", 25 → "2.5" (tenths → shortest text). */
function multipleText(tenths: number): string {
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function docText(d: RequiredDocument): string {
  if (d.type === 'proof_of_income') return t('units:published.proofOfIncome');
  if (d.type === 'other') return d.label?.trim() || DOC_TYPE_LABELS.other;
  return DOC_TYPE_LABELS[d.type];
}

function petText(c: Extract<Criterion, { code: 'C8' }>): string {
  return t(`units:published.pets.${c.params.policy}`, { max: c.params.maxPets });
}

/** "We will check" line of one criterion (C6 goes to "Bring", C8 joins C7 when both are on — mockup v2). */
function checkText(c: Criterion): string | null {
  switch (c.code) {
    case 'C1':
      return t(c.params.applyToTenantShare ? 'units:published.check.C1share' : 'units:published.check.C1', {
        multiple: multipleText(c.params.multipleTenths),
      });
    case 'C2':
      return c.params.months > 0
        ? t('units:published.check.C2', { count: c.params.months })
        : t('units:published.check.C2none');
    case 'C3':
      return t('units:published.check.C3', { count: c.params.years });
    case 'C4':
      return t('units:published.check.C4');
    case 'C5':
      return t('units:published.check.C5');
    case 'C6':
      return null;
    case 'C7':
      return t('units:published.check.C7', { count: c.params.perBedroom });
    case 'C8':
      return petText(c);
    case 'C9':
      return t('units:published.check.C9', { score: c.params.minScore });
    case 'C10':
      return t('units:published.check.C10', { count: c.params.lookbackYears });
    case 'CX':
      return criterionTitle(c);
  }
}

export function publishedCriteriaContent(rental: PublishedRental, criteria: readonly Criterion[]): PublishedCriteria {
  const active = activeCriteria(criteria);
  const c7 = active.find((c) => c.code === 'C7');
  const c8 = active.find((c): c is Extract<Criterion, { code: 'C8' }> => c.code === 'C8');
  const checks: string[] = [];
  for (const c of active) {
    if (c.code === 'C8' && c7) continue;
    let line = checkText(c);
    if (c.code === 'C7' && c8 && line) line = `${line} · ${lowerFirst(petText(c8))}`;
    if (line) checks.push(line);
  }
  const c6 = active.find((c): c is Extract<Criterion, { code: 'C6' }> => c.code === 'C6');
  const bring = c6 ? c6.params.documents.map(docText) : [];
  const goodToKnow = [
    rental.feeCents > 0 ? t('units:published.fee', { fee: formatUsd(rental.feeCents) }) : t('units:published.noFee'),
    ...(rental.depositCents ? [t('units:published.deposit', { deposit: formatUsd(rental.depositCents) })] : []),
    t(`units:published.smoking.${rental.smokingPolicy}`),
    t('units:published.accommodation'),
    t('units:published.noSsn'),
  ];
  return {
    title: t('units:published.title'),
    address: fullAddress(rental),
    terms: rentalPublishedLine(rental),
    checks,
    bring,
    howWeReview: rental.reviewMode === 'first_come' ? FIRST_COME_PUBLISHED_TEXT : null,
    goodToKnow,
    fairHousing: t('units:published.fairHousing'),
  };
}

/** Full PDF page (US Letter, shared shell with the "not legal advice" footer). */
export function publishedCriteriaHtml(p: PublishedCriteria): string {
  const list = (items: readonly string[]) => html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
  const body = html`<p><strong>${p.terms}</strong></p>
<section><h2>${t('units:published.weWillCheck')}</h2>${list(p.checks)}</section>
${p.bring.length ? html`<section><h2>${t('units:published.bring')}</h2>${list(p.bring)}</section>` : ''}
${p.howWeReview ? html`<section><h2>${t('units:published.howWeReview')}</h2><p>${p.howWeReview}</p></section>` : ''}
<section><h2>${t('units:published.goodToKnow')}</h2>${list(p.goodToKnow)}</section>
<p class="fair-housing"><em>${p.fairHousing}</em></p>`;
  return pdfDocument({ title: p.title, subtitle: p.address, body });
}

/** "Copy as text" for a Zillow / Facebook listing (no app footer: it's the landlord's own post). */
export function publishedCriteriaText(p: PublishedCriteria): string {
  const block = (heading: string, items: readonly string[]) =>
    items.length ? [`${heading}:`, ...items.map((i) => `• ${i}`)].join('\n') : null;
  return [
    `${p.title} — ${p.address}
${p.terms}`,
    block(t('units:published.weWillCheck'), p.checks),
    block(t('units:published.bring'), p.bring),
    p.howWeReview ? `${t('units:published.howWeReview')}:\n${p.howWeReview}` : null,
    block(t('units:published.goodToKnow'), p.goodToKnow),
    p.fairHousing,
  ]
    .filter((x): x is string => !!x)
    .join('\n\n');
}

export function publishedCriteriaFileName(p: PublishedCriteria): string {
  return t('units:published.fileName', { address: p.address.replace(/,/g, '') });
}

/** S-05 "Export PDF" / "Share" (and S-06 "Share criteria"): print + share sheet. */
export async function sharePublishedCriteriaPdf(
  p: PublishedCriteria,
  options: { adapter?: PdfAdapter; dialogTitle?: string } = {},
): Promise<PdfShareResult> {
  return printToPdfAndShare(publishedCriteriaHtml(p), publishedCriteriaFileName(p), options);
}
