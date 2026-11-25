import { escapeHtml, html, keyValues, NOT_LEGAL_ADVICE, paragraphs, pdfDocument, raw, safeFileName, section, signatureLine, statusText, table } from '../shell';

describe('pdf shell', () => {
  it('escapes every interpolated value but keeps trusted helpers', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    const name = '<script>alert(1)</script>';
    expect(html`<p>${name}</p>`.__html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html`<div>${raw('<i>ok</i>')}${['a', '<b>']}</div>`.__html).toBe('<div><i>ok</i>a&lt;b&gt;</div>');
  });

  it('builds a Letter document with header, title and the legal footer', () => {
    const doc = pdfDocument({ title: 'Rental criteria', subtitle: '1428 Maple St & Co', body: section('Income', paragraphs('Line 1\nLine 2\n\nNext')) });
    expect(doc).toMatch(/^<!doctype html>/);
    expect(doc).toContain('@page { size: letter;');
    expect(doc).toContain('<h1>Rental criteria</h1>');
    expect(doc).toContain('1428 Maple St &amp; Co');
    expect(doc).toContain('<p>Line 1<br>Line 2</p><p>Next</p>');
    expect(doc).toContain(NOT_LEGAL_ADVICE);
    expect(doc).not.toContain('position: fixed');
    expect(pdfDocument({ title: 'x', body: raw(''), legalFooter: false, appHeader: false })).not.toContain('<footer>');
  });

  it('tables repeat their header and keep rows whole', () => {
    const t = table([{ label: 'Criterion' }, { label: 'Amount', numeric: true }], [['Income <3x>', '$5,351.67'], { cells: ['Deleted', raw(statusText('met', 'Met').__html)], muted: true }]).__html;
    expect(t).toContain('<thead><tr><th>Criterion</th><th class="num">Amount</th></tr></thead>');
    expect(t).toContain('<td>Income &lt;3x&gt;</td><td class="num">$5,351.67</td>');
    expect(t).toContain('<tr class="muted">');
    expect(t).toContain('✓ Met');
    expect(pdfDocument({ title: 't', body: raw(t) })).toContain('thead { display: table-header-group; }');
  });

  it('key values, signature line, file names', () => {
    expect(keyValues([['Rent', '$1,650'], ['Name', '<x>']]).__html).toBe('<dl class="kv"><dt>Rent</dt><dd>$1,650</dd><dt>Name</dt><dd>&lt;x&gt;</dd></dl>');
    expect(signatureLine('Tenant', '<svg/>', 'Jan 1, 2027').__html).toContain('data:image/svg+xml;utf8,%3Csvg%2F%3E');
    expect(signatureLine('Landlord').__html).toContain('<span>Date</span>');
    expect(safeFileName('Decision file – 1428 Maple St, Unit B')).toBe('Decision-file-1428-Maple-St-Unit-B');
    expect(safeFileName('///')).toBe('Evenlease');
  });
});
