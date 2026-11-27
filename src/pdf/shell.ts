/**
 * Shared PDF shell for every Evenlease PDF (published criteria, blank application, letters, decision file, move-in).
 *
 * - `pdfDocument({ title, subtitle, body })` → a full HTML page for US Letter: small black logo + app name + title on top, the
 *   "not legal advice" footer at the bottom of every page (outer layout table: thead / tfoot repeat per printed page).
 * - Build `body` with the `html` tagged template: interpolated values are escaped; nest trusted fragments with `raw`
 *   or other `html` results. `table()` repeats its header row on every page.
 * - `printToPdfAndShare(html, fileName)` prints with expo-print, renames the file in the cache and opens the share sheet.
 * No logging of HTML or applicant data anywhere.
 */
import { formatDate, formatUsd } from '@/engine';
import { MARK_BARS, MARK_HOUSE } from '@/ui/logoPaths';

import { expoPdfAdapter, PDF_FOOTER_IN_PAGE_MARGIN } from './shellNative';

export const APP_NAME = 'Evenlease';
export const PDF_FOOTER = 'Evenlease is a checklist, not legal advice. Laws vary by state and city.';

/**
 * Small black-and-white Evenlease mark for the running header (design/v2-indigo/logo/evenlease-mark-mono.svg in black,
 * white '=' bars): PDFs stay black and white so they print well on any printer.
 */
export const PDF_LOGO = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="232 216 560 584" width="13" height="13.6" aria-hidden="true"><path d="${MARK_HOUSE}" fill="#000" stroke="#000" stroke-width="44" stroke-linejoin="round"/>${MARK_BARS.map(
  (b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.rx}" fill="#fff"/>`,
).join('')}</svg>`;

// ---------------------------------------------------------------------------
// Safe HTML
// ---------------------------------------------------------------------------

/** Trusted HTML fragment (already escaped / built by `html`). */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

/** Escape text for HTML element content and quoted attribute values. null / undefined → ''. */
export function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Mark a string as trusted HTML. Use only for markup the app itself wrote. */
export function raw(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

function render(v: HtmlValue): string {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === false) return '';
  return escapeHtml(v);
}

/** Tagged template: `html\`<p>${name}</p>\`` escapes `name`; arrays are joined; SafeHtml passes through. */
export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let out = strings[0];
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return new SafeHtml(out);
}

/** Text with line breaks kept (letters, notes). */
export function multiline(text: string | null | undefined): SafeHtml {
  return new SafeHtml(escapeHtml(text ?? '').replace(/\r?\n/g, '<br>'));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "$1,650", "$5,351.67" (same as the app screens). */
export const usd = formatUsd;

/** 'YYYY-MM-DD' → "Dec 2, 2026". */
export const date = formatDate;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC instant (`…Z`) → the same instant as local wall-clock `YYYY-MM-DDTHH:MM` at `offsetMin` (default: device zone). */
function utcToWall(ts: string, offsetMin?: number): string | null {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const off = offsetMin ?? -d.getTimezoneOffset();
  const w = new Date(d.getTime() + off * 60_000);
  return `${w.getUTCFullYear()}-${pad2(w.getUTCMonth() + 1)}-${pad2(w.getUTCDate())}T${pad2(w.getUTCHours())}:${pad2(w.getUTCMinutes())}`;
}

/**
 * Timestamp → "Dec 2, 2026, 9:14 AM".
 * - With the device offset (`…-05:00`, how the app stores times): the wall-clock time written in the string (the time
 *   the landlord saw), not the printing device's zone.
 * - UTC (`…Z`, e.g. older rows or `toISOString()`): converted to the device's local time (`offsetMin` for tests) — never
 *   printed as UTC wall-clock (B-52).
 */
export function dateTime(ts: string, offsetMin?: number): string {
  const wall = /z$/i.test(ts) ? utcToWall(ts, offsetMin) : ts;
  const m = wall ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(wall) : null;
  if (!m) return escapeHtml(ts);
  const h = Number(m[2]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatDate(m[1])}, ${h12}:${m[3]} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

export interface TableColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
  /** CSS width, e.g. '30%'. */
  width?: string;
}

/** Table whose header row repeats on every printed page; rows never split across pages. */
export function table(columns: readonly TableColumn[], rows: readonly (readonly HtmlValue[])[], caption?: string): SafeHtml {
  const cell = (tag: 'th' | 'td', v: HtmlValue, col: TableColumn | undefined) => {
    const style = [col?.align && col.align !== 'left' ? `text-align:${col.align}` : '', col?.width ? `width:${col.width}` : '']
      .filter(Boolean)
      .join(';');
    return html`<${raw(tag)}${style ? raw(` style="${escapeHtml(style)}"`) : ''}>${v}</${raw(tag)}>`;
  };
  return html`<table class="grid">${caption ? html`<caption>${caption}</caption>` : ''}<thead><tr>${columns.map((c) =>
    cell('th', c.header, c),
  )}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((v, i) => cell('td', v, columns[i]))}</tr>`)}</tbody></table>`;
}

/** Section heading + content kept together where possible. */
export function section(heading: string, content: HtmlValue): SafeHtml {
  return html`<section><h2>${heading}</h2>${content}</section>`;
}

/** Black-and-white print style (decided for 1.0: prints the same on any printer), system fonts, small logo in the header. */
export const PDF_CSS = `
@page { size: letter; margin: 0.5in 0.6in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.4;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
table.page { width: 100%; border-collapse: collapse; }
table.page > thead { display: table-header-group; }
table.page > tfoot { display: table-footer-group; }
table.page > thead td, table.page > tfoot td, table.page > tbody > tr > td { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000;
  padding-bottom: 4pt; margin-bottom: 10pt; font-size: 9pt; }
.page-header .brand { display: inline-flex; align-items: center; gap: 4pt; }
.page-header .logo { display: block; flex: none; }
.page-header .app { font-weight: 700; letter-spacing: 0.02em; }
.page-footer { border-top: 1px solid #000; margin-top: 10pt; padding-top: 4pt; font-size: 8.5pt; }
h1 { font-size: 16pt; margin: 0 0 2pt; }
.subtitle { margin: 0 0 12pt; font-size: 10pt; }
h2 { font-size: 12pt; margin: 14pt 0 6pt; break-after: avoid; page-break-after: avoid; }
p { margin: 0 0 6pt; }
table.grid { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; }
table.grid caption { text-align: left; font-weight: 700; margin-bottom: 4pt; }
table.grid > thead { display: table-header-group; }
table.grid th, table.grid td { border: 1px solid #000; padding: 3pt 5pt; text-align: left; vertical-align: top; }
table.grid th { font-weight: 700; background: #eee; }
table.grid tr { break-inside: avoid; page-break-inside: avoid; }
.muted { color: #444; }
`;

export interface PdfDocumentInput {
  /** Big title on the first page and in the running header, e.g. "Adverse action notice". */
  title: string;
  /** Second line, e.g. the Rental address. */
  subtitle?: string | null;
  body: SafeHtml;
  /** Extra footer line above the fixed disclaimer (optional). */
  footerNote?: string | null;
  /**
   * Also draw the footer in the page's bottom margin (`@page @bottom-left`), so it sits at the bottom of the LAST page
   * too (B-57). Default: on Android (Chromium WebView printing). Tests pass it explicitly.
   */
  footerInPageMargin?: boolean;
}

/** Text → a CSS string literal body (quotes, backslashes, `<` and line breaks escaped). */
function cssString(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\3C ')
    .replace(/\r?\n/g, '\\A ');
}

/**
 * B-57: the outer layout table repeats its <tfoot> at the bottom of every page EXCEPT the last, where Chromium draws it
 * right under the content (mid-page). `position: fixed` is not an option (Android draws it in the middle of page 2), and
 * expo-print's WebView runs no script. Chromium ≥ 131 draws `@page` margin boxes at the bottom of every page, last
 * included — so on Android the footer moves into the bottom margin and the <tfoot> is hidden. Gate: `reading-flow`
 * (Chromium 137+, never without margin boxes) — an older WebView keeps the <tfoot> footer instead of printing none.
 */
function pageMarginFooterCss(lines: readonly string[]): string {
  return `
@supports (reading-flow: normal) {
  @page {
    margin-bottom: 0.9in;
    @bottom-left {
      content: "${cssString(lines.join('\n'))}";
      width: 7.3in; vertical-align: top; text-align: left; white-space: pre-wrap;
      border-top: 1px solid #000; padding-top: 4pt; margin-top: 10pt;
      font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 8.5pt; line-height: 1.4; color: #000;
    }
  }
  table.page > tfoot { display: none; }
}
`;
}

/**
 * Full HTML page. Header (logo + app name + title) and footer (disclaimer) repeat on each printed page via an outer layout
 * table. Page numbers: WebView / UIKit printing does not support CSS page counters — not printed; the page count is
 * returned by `printToPdfAndShare`.
 */
export function pdfDocument(input: PdfDocumentInput): string {
  const inMargin = input.footerInPageMargin ?? PDF_FOOTER_IN_PAGE_MARGIN === true;
  const footerLines = [input.footerNote, PDF_FOOTER].filter((l): l is string => !!l);
  const doc = html`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${input.title}</title><style>${raw(PDF_CSS)}${raw(inMargin ? pageMarginFooterCss(footerLines) : '')}</style></head>
<body><table class="page" role="presentation">
<thead><tr><td><div class="page-header"><span class="brand">${raw(PDF_LOGO)}<span class="app">${APP_NAME}</span></span><span>${input.title}</span></div></td></tr></thead>
<tfoot><tr><td><div class="page-footer">${input.footerNote ? html`<div class="muted">${input.footerNote}</div>` : ''}<div>${PDF_FOOTER}</div></div></td></tr></tfoot>
<tbody><tr><td><main><h1>${input.title}</h1>${input.subtitle ? html`<p class="subtitle">${input.subtitle}</p>` : ''}${input.body}</main></td></tr></tbody>
</table></body></html>`;
  return doc.value;
}

// ---------------------------------------------------------------------------
// Print + share
// ---------------------------------------------------------------------------

/** Native operations, injectable for tests. The default is `expoPdfAdapter` from `./shellNative`. */
export interface PdfAdapter {
  printToFile(html: string): Promise<{ uri: string; numberOfPages?: number }>;
  /** Move the printed file into the cache under `fileName`; returns the new uri. */
  moveToCache(uri: string, fileName: string): Promise<string>;
  isSharingAvailable(): Promise<boolean>;
  share(uri: string, options: { mimeType: string; UTI: string; dialogTitle?: string }): Promise<void>;
}

/** "Adverse action — Priya Raman" → "Adverse action - Priya Raman.pdf" (safe characters, ≤ 80 chars). */
export function safeFileName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .replace(/[–—]/g, '-')
    .replace(/[^A-Za-z0-9 ._()-]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[.\- ]+|[.\- ]+$/g, '')
    .slice(0, 76)
    .trim();
  return `${base || 'Evenlease'}.pdf`;
}

export interface PdfShareResult {
  uri: string;
  numberOfPages: number | null;
  /** false when this device has no share sheet (the file is still in the cache at `uri`). */
  shared: boolean;
}

/** Print `html` to a PDF in the cache named `fileName` and open the share sheet. */
export async function printToPdfAndShare(
  htmlDoc: string,
  fileName: string,
  options: { dialogTitle?: string; adapter?: PdfAdapter } = {},
): Promise<PdfShareResult> {
  const adapter = options.adapter ?? expoPdfAdapter;
  const printed = await adapter.printToFile(htmlDoc);
  const uri = await adapter.moveToCache(printed.uri, safeFileName(fileName));
  const result: PdfShareResult = { uri, numberOfPages: printed.numberOfPages ?? null, shared: false };
  if (!(await adapter.isSharingAvailable())) return result;
  await adapter.share(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: options.dialogTitle });
  return { ...result, shared: true };
}
