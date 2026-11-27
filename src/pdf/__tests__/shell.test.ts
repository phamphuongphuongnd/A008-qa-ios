/** @jest-environment node */
import fs from 'fs';
import path from 'path';

import {
  dateTime,
  escapeHtml,
  fileDate,
  html,
  multiline,
  PDF_CSS,
  PDF_FOOTER,
  PDF_LOGO,
  pdfDocument,
  printToPdfAndShare,
  raw,
  refFileName,
  safeFileName,
  section,
  table,
  usd,
  type PdfAdapter,
} from '../shell';

jest.mock('../shellNative', () => ({ expoPdfAdapter: { printToFile: jest.fn() } }));

describe('escaping', () => {
  it('escapes & < > " \' and drops null / undefined', () => {
    expect(escapeHtml(`<b class="x">Tom & Jerry's</b>`)).toBe('&lt;b class=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });
  it('html`` escapes values, joins arrays, passes nested html / raw through', () => {
    const name = '<script>alert(1)</script>';
    const out = html`<p>${name}</p>${['a', '<b>']}${html`<i>${'&'}</i>`}${raw('<hr>')}${false}`.value;
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>a&lt;b&gt;<i>&amp;</i><hr>');
  });
  it('multiline keeps line breaks, escapes the rest', () => {
    expect(multiline('Line 1\n<Line 2>').value).toBe('Line 1<br>&lt;Line 2&gt;');
  });
});

describe('formatting', () => {
  it('money from cents and dates', () => {
    expect(usd(165000)).toBe('$1,650');
    expect(usd(535167)).toBe('$5,351.67');
    expect(dateTime('2026-12-02T09:14:00-05:00')).toBe('Dec 2, 2026, 9:14 AM');
    expect(dateTime('2026-12-02T00:05:00-05:00')).toBe('Dec 2, 2026, 12:05 AM');
    expect(dateTime('2026-12-02T14:40:00-05:00')).toBe('Dec 2, 2026, 2:40 PM');
  });
  it('B-52: a UTC (Z) timestamp prints in local time, not as UTC wall-clock', () => {
    // Signed 4:16 PM in Vietnam (+07:00) = 09:16 UTC.
    expect(dateTime('2026-11-26T09:16:00.000Z', 7 * 60)).toBe('Nov 26, 2026, 4:16 PM');
    expect(dateTime('2026-11-26T20:30:00Z', 7 * 60)).toBe('Nov 27, 2026, 3:30 AM');
    expect(dateTime('2026-12-02T14:12:00Z', -5 * 60)).toBe('Dec 2, 2026, 9:12 AM');
    // Device zone by default: same text as formatting the instant with local getters.
    const d = new Date('2026-11-26T09:16:00.000Z');
    const h = d.getHours();
    expect(dateTime('2026-11-26T09:16:00.000Z')).toContain(`${h % 12 === 0 ? 12 : h % 12}:16 ${h < 12 ? 'AM' : 'PM'}`);
    // Offset timestamps keep the wall clock in the string, whatever offset is asked for.
    expect(dateTime('2026-11-26T16:16:00+07:00', -5 * 60)).toBe('Nov 26, 2026, 4:16 PM');
    expect(dateTime('not a date')).toBe('not a date');
  });
});

describe('building blocks', () => {
  it('table has a repeating <thead>, escaped headers and cells, column alignment', () => {
    const t = table(
      [{ header: 'Criterion' }, { header: 'Rent <$>', align: 'right', width: '20%' }],
      [['Income & docs', usd(165000)]],
      'Results',
    ).value;
    expect(t).toContain('<thead><tr><th>Criterion</th><th style="text-align:right;width:20%">Rent &lt;$&gt;</th></tr></thead>');
    expect(t).toContain('<td>Income &amp; docs</td>');
    expect(t).toContain('<caption>Results</caption>');
  });
  it('section wraps a heading', () => {
    expect(section('Decision', html`<p>Deny</p>`).value).toBe('<section><h2>Decision</h2><p>Deny</p></section>');
  });
});

describe('pdfDocument', () => {
  const doc = pdfDocument({ title: 'Adverse action notice', subtitle: '1428 Maple St, Unit B', body: html`<p>${'Body <x>'}</p>` });
  it('is a full US Letter HTML page with header, footer and body', () => {
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toContain('@page { size: letter;');
    expect(doc).toContain('<span class="app">Evenlease</span>');
    expect(doc).toContain(`<span class="brand">${PDF_LOGO}<span class="app">`);
    expect(doc).toContain('<h1>Adverse action notice</h1>');
    expect(doc).toContain('<p>Body &lt;x&gt;</p>');
    expect(doc).toContain(PDF_FOOTER);
  });
  it('header / footer and table headers repeat on every page', () => {
    expect(doc).toContain('table.page > thead { display: table-header-group; }');
    expect(doc).toContain('table.page > tfoot { display: table-footer-group; }');
    expect(doc).toContain('table.grid > thead { display: table-header-group; }');
    expect(doc.indexOf('<tfoot>')).toBeGreaterThan(doc.indexOf('<thead>'));
  });
  it('B-57: on Android the footer also goes in the page bottom margin (bottom of the last page too), <tfoot> hidden', () => {
    const android = pdfDocument({ title: 'Rental application', body: html`<p>x</p>`, footerNote: 'Note "1" <b>', footerInPageMargin: true });
    expect(android).toContain('@supports (reading-flow: normal)');
    expect(android).toMatch(/@page \{\s*margin-bottom: [\d.]+in;\s*@bottom-left \{/);
    expect(android).toContain(String.raw`content: "Note \"1\" \3C b>\A ` + `${PDF_FOOTER}";`);
    expect(android).toContain('table.page > tfoot { display: none; }');
    expect(android).not.toContain('position: fixed');
    // The <tfoot> stays in the HTML: the fallback when the WebView has no margin boxes.
    expect(android).toContain('<tfoot>');
    const ios = pdfDocument({ title: 'Rental application', body: html`<p>x</p>`, footerInPageMargin: false });
    expect(ios).not.toContain('@bottom-left');
    expect(ios).not.toContain('tfoot { display: none; }');
    // Default (jest: shellNative mocked, no platform flag) = the <tfoot> footer only.
    expect(doc).not.toContain('@bottom-left');
  });
  it('stays black and white: the logo and the print style use no colour', () => {
    expect(PDF_LOGO).toContain('viewBox="232 216 560 584"');
    expect(PDF_LOGO.match(/#[0-9A-Fa-f]{3,6}\b/g)!.every((c) => ['#000', '#fff'].includes(c.toLowerCase()))).toBe(true);
    expect(doc).not.toMatch(/TODO\(design\)/);
    for (const c of PDF_CSS.match(/#[0-9A-Fa-f]{3,6}\b/g) ?? []) expect(c).toMatch(/^#([0-9a-f])\1\1(\1\1\1)?$/i); // greys only
  });
  it.each(['publishedCriteria', 'blankApplication', 'letters', 'decisionFile', 'moveIn'])('%s.ts prints through pdfDocument (same header)', (f) => {
    expect(fs.readFileSync(path.join(__dirname, '..', `${f}.ts`), 'utf8')).toMatch(/pdfDocument\(/);
  });
  it('escapes the title', () => {
    expect(pdfDocument({ title: 'A & B', body: html`` })).toContain('<title>A &amp; B</title>');
  });
});

describe('refFileName (B-49)', () => {
  it('type + record id + local date, nothing about the person', () => {
    expect(refFileName('Decision file', { kind: 'rental', id: 3 }, new Date(2026, 10, 27, 23, 59))).toBe('Decision file - rental 3 - 2026-11-27');
    expect(safeFileName(refFileName('Adverse action notice', { kind: 'letter', id: 12 }, new Date(2027, 0, 5)))).toBe(
      'Adverse action notice - letter 12 - 2027-01-05.pdf',
    );
    expect(fileDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});

describe('safeFileName', () => {
  it.each([
    ['Adverse action — Priya Raman', 'Adverse action - Priya Raman.pdf'],
    ['Decision file: 1428 Maple St/Unit B', 'Decision file- 1428 Maple St-Unit B.pdf'],
    ['report.PDF', 'report.pdf'],
    ['***', 'Evenlease.pdf'],
  ])('%s → %s', (input, out) => {
    expect(safeFileName(input)).toBe(out);
  });
  it('caps the length', () => {
    expect(safeFileName('x'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('printToPdfAndShare', () => {
  const adapter = (sharing = true): jest.Mocked<PdfAdapter> => ({
    printToFile: jest.fn().mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 3 }),
    moveToCache: jest.fn().mockResolvedValue('file:///cache/pdf/Letter.pdf'),
    isSharingAvailable: jest.fn().mockResolvedValue(sharing),
    share: jest.fn().mockResolvedValue(undefined),
  });
  it('prints, renames in the cache and shares as a PDF', async () => {
    const a = adapter();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const r = await printToPdfAndShare('<html>secret applicant data</html>', 'Letter', { adapter: a, dialogTitle: 'Share letter' });
    expect(a.printToFile).toHaveBeenCalledWith('<html>secret applicant data</html>');
    expect(a.moveToCache).toHaveBeenCalledWith('file:///cache/Print/abc.pdf', 'Letter.pdf');
    expect(a.share).toHaveBeenCalledWith('file:///cache/pdf/Letter.pdf', {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share letter',
    });
    expect(r).toEqual({ uri: 'file:///cache/pdf/Letter.pdf', numberOfPages: 3, shared: true });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('no share sheet → keeps the file, shared = false', async () => {
    const a = adapter(false);
    const r = await printToPdfAndShare('<html></html>', 'x', { adapter: a });
    expect(a.share).not.toHaveBeenCalled();
    expect(r.shared).toBe(false);
  });
  it('print errors propagate', async () => {
    const a = adapter();
    a.printToFile.mockRejectedValueOnce(new Error('print failed'));
    await expect(printToPdfAndShare('<html></html>', 'x', { adapter: a })).rejects.toThrow('print failed');
    expect(a.share).not.toHaveBeenCalled();
  });
});
