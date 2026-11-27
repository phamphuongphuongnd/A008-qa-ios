/**
 * F-06 Blank application PDF (S-07 "Print a blank application"): the same 7 parts as S-08, with this Rental's custom
 * questions and required documents, to print, fill in by hand and type in later (+ photos of the paper form).
 * Never asks for SSN, date of birth or any protected characteristic. Pure HTML builder; printing: `printToPdfAndShare`.
 */
import { formatUsd } from '@/engine';
import { t } from '@/i18n';

import { html, pdfDocument, raw, refFileName, section, table, type SafeHtml } from './shell';

export interface BlankApplicationInput {
  /** "1428 Maple St, Unit B". */
  address: string;
  /** "1428 Maple St, Unit B, Columbus, OH 43215" (subtitle). */
  fullAddress: string;
  rentCents: number;
  /** CX criteria the applicant answers (yes / no). */
  customQuestions: readonly { title: string }[];
  /** C6 labels ("Photo ID", "Proof of income"). */
  requiredDocuments: readonly string[];
}

/** Writing space: blank lines on paper. */
const BLANK_CSS = `
.field { display: flex; align-items: flex-end; gap: 6pt; margin: 0 0 9pt; break-inside: avoid; page-break-inside: avoid; }
.field .label { white-space: nowrap; }
.field .line { flex: 1; border-bottom: 1px solid #000; min-height: 14pt; }
.row { display: flex; gap: 14pt; }
.row > .field { flex: 1; }
.box { border: 1px solid #000; padding: 6pt 8pt 2pt; margin: 0 0 8pt; break-inside: avoid; page-break-inside: avoid; }
.box h3 { font-size: 10.5pt; margin: 0 0 6pt; }
.q { margin: 0 0 4pt; }
.choice { white-space: nowrap; margin-right: 10pt; }
.notice { border: 1.5px solid #000; padding: 6pt 8pt; margin: 0 0 10pt; font-weight: 600; }
.sign { height: 34pt; }
table.grid td { height: 18pt; }
`;

const field = (label: string): SafeHtml => html`<div class="field"><span class="label">${label}</span><span class="line"></span></div>`;
const row = (...labels: string[]): SafeHtml => html`<div class="row">${labels.map(field)}</div>`;
const yesNo = (): SafeHtml => html`<span class="choice">☐ ${t('intake:pdf.yes')}</span><span class="choice">☐ ${t('intake:pdf.no')}</span>`;
const question = (q: string): SafeHtml => html`<div class="box"><p class="q">${q}</p><p>${yesNo()}</p>${field(t('intake:fields.explain'))}</div>`;
/** Untyped lookup for the many field labels (keys exist in intake.json; a test checks no key is returned raw). */
const f = (key: string): string => (t as unknown as (k: string) => string)(key);
const emptyRows = (n: number, cols: number) => Array.from({ length: n }, () => Array.from({ length: cols }, () => ''));

export function blankApplicationHtml(input: BlankApplicationInput): string {
  const residence = (n: number) =>
    html`<div class="box"><h3>${t('intake:pdf.residenceN', { n })}</h3>${field(f('intake:fields.address'))}${field(t('intake:pdf.fromTo'))}
<p>${t('intake:pdf.typeLine')}</p>${row(f('intake:fields.rent'), f('intake:fields.landlordName'))}${row(f('intake:fields.landlordPhone'), f('intake:fields.landlordEmail'))}${field(f('intake:fields.reason'))}</div>`;

  const body = html`<style>${raw(BLANK_CSS)}</style>
<p>${t('intake:pdf.intro')}</p>
<div class="notice">${t('intake:pdf.noSsn')}</div>
${section(
    `1. ${f('intake:sections.about')}`,
    html`${field(f('intake:fields.fullName'))}${row(f('intake:fields.phone'), f('intake:fields.email'))}${row(
      `${f('intake:fields.emergency')} — ${f('intake:fields.emergencyName')}`,
      f('intake:fields.emergencyPhone'),
    )}`,
  )}
${section(
    `2. ${f('intake:sections.household')}`,
    html`${field(f('intake:fields.occupants'))}${field(`${f('intake:fields.otherAdults')} 1`)}${field(`${f('intake:fields.otherAdults')} 2`)}
<p>${f('intake:fields.pets')}: ${t('intake:pdf.petsLine')}</p><p class="muted">${f('intake:fields.petsNote')}</p>${field(f('intake:fields.moveInOn'))}
<div class="box"><p class="q">${f('intake:fields.voucher')}</p><p>${yesNo()}</p>${row(f('intake:fields.voucherAmount'), f('intake:fields.voucherProgram'))}</div>`,
  )}
${section(`3. ${f('intake:sections.residences')}`, html`<p class="muted">${f('intake:fields.residencesHint')}</p>${[1, 2, 3].map(residence)}`)}
${section(
    `4. ${f('intake:sections.work')}`,
    html`${row(f('intake:fields.employer'), f('intake:fields.jobTitle'))}${row(f('intake:fields.startDate'), f('intake:fields.grossMonthly'))}${row(
      f('intake:fields.employerPhone'),
      f('intake:fields.supervisor'),
    )}
${table([{ header: t('intake:pdf.otherIncomeHead'), width: '70%' }, { header: t('intake:pdf.monthlyHead') }], emptyRows(3, 2), f('intake:fields.otherIncome'))}
${table([{ header: t('intake:pdf.adultHead'), width: '70%' }, { header: t('intake:pdf.monthlyHead') }], emptyRows(2, 2), f('intake:fields.adultIncome'))}
<p class="muted">${f('intake:fields.grossNote')}</p>`,
  )}
${section(
    `5. ${f('intake:sections.questions')}`,
    html`${question(f('intake:questions.evicted'))}${question(f('intake:questions.bankruptcy'))}${question(f('intake:questions.smokes'))}${
      input.customQuestions.length
        ? html`<h3>${t('intake:pdf.customHead')}</h3>${input.customQuestions.map(
            (q) => html`<div class="box"><p class="q">${q.title}</p><p>${yesNo()}</p></div>`,
          )}`
        : ''
    }`,
  )}
${
    input.requiredDocuments.length
      ? section(t('intake:pdf.documentsHead'), html`<ul>${input.requiredDocuments.map((d) => html`<li>${d}</li>`)}</ul>`)
      : ''
  }
${section(
    `6. ${f('intake:sections.consent')}`,
    html`<p>☐ ${f('intake:fields.authorize')}</p><p>☐ ${f('intake:fields.certify')}</p>
<div class="field sign"><span class="label">${f('intake:fields.signature')}</span><span class="line"></span></div>${row(
      f('intake:fields.printedName'),
      f('intake:fields.date'),
    )}`,
  )}
<p class="muted">${t('intake:pdf.landlordUse')}</p>`;

  return pdfDocument({
    title: t('intake:pdf.title'),
    subtitle: `${input.fullAddress} · ${t('intake:pdf.rentLine', { rent: formatUsd(input.rentCents) })}`,
    body,
  });
}

/** "Rental application - rental 3 - 2026-11-27" (safeFileName adds .pdf): type + id + date, like every shared file (B-49). */
export function blankApplicationFileName(rentalId: number, at?: Date): string {
  return refFileName(t('intake:pdf.title'), { kind: 'rental', id: rentalId }, at);
}
