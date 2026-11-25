/**
 * Shared HTML shell for every PDF (expo-print): US Letter, light "paper" colours from the design tokens, app name +
 * title header, "not legal advice" footer, tables whose header row repeats on each page. Pure string building — no
 * Expo import, so it is unit-tested; printing / sharing is in ./print.ts.
 *
 * Safety: every interpolated value is HTML-escaped. Use the `html` tag for markup with values:
 *   html`<p>${applicant.fullName}</p>`            → name escaped
 *   html`<div>${raw(table(...))}</div>`            → trusted markup from these helpers kept as is
 * Never log the HTML (it holds applicant data).
 *
 * Android WebView printing ignores `position: fixed` footers (drawn mid page 2 — A006 fact) and has no CSS page counters,
 * so the footer is printed once at the end of the document; page numbers are not available.
 */
import { palettes } from '@/theme/tokens';

const P = palettes.light;

/** Trusted HTML (already escaped / built by these helpers). */
export interface Raw {
  readonly __html: string;
}
export const raw = (s: string): Raw => ({ __html: s });
const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && '__html' in v;

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

type Part = unknown;
function part(v: Part): string {
  if (Array.isArray(v)) return v.map(part).join('');
  return isRaw(v) ? v.__html : escapeHtml(v);
}

/** Tagged template: escapes every value except `raw(...)`; arrays are joined. Returns trusted markup. */
export function html(strings: TemplateStringsArray, ...values: Part[]): Raw {
  let out = strings[0];
  values.forEach((v, i) => {
    out += part(v) + strings[i + 1];
  });
  return raw(out);
}

export const NOT_LEGAL_ADVICE = 'Evenlease is a checklist, not legal advice. Laws vary by state and city.';

export interface PdfDocumentOptions {
  /** Big title ("Adverse action notice", "Rental criteria"). */
  title: string;
  /** Line under the title (rental address, date). */
  subtitle?: string;
  body: Raw;
  /** Extra footer text above the legal line. */
  footerNote?: string;
  /** Default true. Letters to applicants may turn the app header off. */
  appHeader?: boolean;
  /** Default true. */
  legalFooter?: boolean;
}

/** Full HTML document for `printToPdfAndShare`. */
export function pdfDocument({ title, subtitle, body, footerNote, appHeader = true, legalFooter = true }: PdfDocumentOptions): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${PDF_CSS}</style></head><body>${
    appHeader ? `<div class="app">Evenlease</div>` : ''
  }<header><h1>${escapeHtml(title)}</h1>${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}</header><main>${body.__html}</main>${
    footerNote || legalFooter
      ? `<footer>${footerNote ? `<p>${escapeHtml(footerNote)}</p>` : ''}${legalFooter ? `<p class="legal">${escapeHtml(NOT_LEGAL_ADVICE)}</p>` : ''}</footer>`
      : ''
  }</body></html>`;
}

/** Section heading + content. */
export function section(heading: string, content: Raw): Raw {
  return html`<section><h2>${heading}</h2>${content}</section>`;
}

export interface TableColumn {
  label: string;
  /** Right-aligned, tabular figures (money, counts). */
  numeric?: boolean;
  /** CSS width ("30%"). */
  width?: string;
}

/**
 * Table with a `<thead>` (repeats on every printed page) and rows that don't split across pages.
 * Cells are text (escaped) or `raw(...)`.
 */
export function table(columns: (TableColumn | string)[], rows: (Part[] | { cells: Part[]; muted?: boolean })[]): Raw {
  const cols = columns.map((c) => (typeof c === 'string' ? { label: c } : c));
  const head = cols.map((c) => `<th${c.numeric ? ' class="num"' : ''}${c.width ? ` style="width:${escapeHtml(c.width)}"` : ''}>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((r) => {
      const cells = Array.isArray(r) ? r : r.cells;
      const muted = !Array.isArray(r) && r.muted;
      return `<tr${muted ? ' class="muted"' : ''}>${cells.map((v, i) => `<td${cols[i]?.numeric ? ' class="num"' : ''}>${part(v)}</td>`).join('')}</tr>`;
    })
    .join('');
  return raw(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
}

/** Label / value pairs (two columns). */
export function keyValues(pairs: [label: string, value: Part][]): Raw {
  return raw(`<dl class="kv">${pairs.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${part(v)}</dd>`).join('')}</dl>`);
}

/** Paragraphs from plain text (blank line = new paragraph, newline = <br>). */
export function paragraphs(text: string): Raw {
  return raw(
    text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join(''),
  );
}

/** Status words in print: the same words as the app, with a mark, never colour alone. */
export function statusText(kind: 'met' | 'not_met' | 'missing' | 'needs_review' | 'not_reviewed', label: string): Raw {
  const mark = { met: '✓', not_met: '✕', missing: '○', needs_review: '!', not_reviewed: '–' }[kind];
  return html`<span class="st ${kind}">${mark} ${label}</span>`;
}

/** Signature line (an inline SVG from `signatureToSvg`, or an empty line to sign on paper). */
export function signatureLine(label: string, svg?: string | null, date?: string): Raw {
  return raw(
    `<div class="sig"><div class="sigbox">${svg ? `<img alt="" src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}">` : ''}</div><div class="sigline"><span>${escapeHtml(label)}</span>${
      date ? `<span>${escapeHtml(date)}</span>` : '<span>Date</span>'
    }</div></div>`,
  );
}

/** A file name safe on Android / iOS share sheets: "Decision file – 1428 Maple St.pdf" → "Decision-file-1428-Maple-St". */
export function safeFileName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'Evenlease'
  );
}

export const PDF_CSS = `
@page { size: letter; margin: 0.6in 0.6in 0.7in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, 'Helvetica Neue', Roboto, Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45;
  color: ${P.text}; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.app { font-size: 9pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${P.accent}; margin-bottom: 6pt; }
header { border-bottom: 1.5pt solid ${P.accent}; padding-bottom: 8pt; margin-bottom: 14pt; }
h1 { font-size: 18pt; line-height: 1.2; margin: 0; font-weight: 700; }
h2 { font-size: 12pt; margin: 16pt 0 6pt; font-weight: 700; page-break-after: avoid; break-after: avoid; }
h3 { font-size: 10.5pt; margin: 10pt 0 4pt; font-weight: 700; page-break-after: avoid; break-after: avoid; }
p { margin: 0 0 6pt; }
.sub { color: ${P.text2}; margin: 3pt 0 0; }
section { margin-bottom: 8pt; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 9.5pt; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; break-inside: avoid; }
th { text-align: left; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: ${P.text2};
  border-bottom: 1pt solid ${P.border}; padding: 5pt 6pt; background: ${P.surface2}; }
td { border-bottom: .75pt solid ${P.border}; padding: 5pt 6pt; vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.muted td { color: ${P.text2}; }
dl.kv { display: grid; grid-template-columns: 34% 66%; gap: 3pt 10pt; margin: 4pt 0 10pt; }
dl.kv dt { color: ${P.text2}; }
dl.kv dd { margin: 0; font-weight: 600; }
.box { border: 1pt solid ${P.border}; border-radius: 6pt; padding: 8pt 10pt; margin: 8pt 0; page-break-inside: avoid; break-inside: avoid; }
.box.required { border-color: ${P.text}; }
.st { font-weight: 700; white-space: nowrap; }
.st.met { color: ${P.accent}; } .st.not_met { color: ${P.danger}; } .st.needs_review { color: ${P.warning}; }
.st.missing, .st.not_reviewed { color: ${P.missing}; }
.sig { margin: 18pt 0 6pt; page-break-inside: avoid; break-inside: avoid; width: 60%; }
.sigbox { height: 48pt; }
.sigbox img { height: 48pt; }
.sigline { border-top: 1pt solid ${P.text}; display: flex; justify-content: space-between; font-size: 8.5pt; color: ${P.text2}; padding-top: 2pt; }
footer { margin-top: 18pt; padding-top: 8pt; border-top: .75pt solid ${P.border}; font-size: 8.5pt; color: ${P.text2}; }
footer .legal { font-style: italic; }
`;
