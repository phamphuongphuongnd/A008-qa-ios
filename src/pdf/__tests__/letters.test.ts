import { FCRA_REQUIRED_LINES, REPORT_ADDRESS_PLACEHOLDER, REPORT_PHONE_PLACEHOLDER, type LetterData } from '@/engine';

import { conditionText, defaultLetterText, letterFileName, letterHtml, letterReason, type LetterInput } from '../letters';
import { PDF_FOOTER } from '../shell';

const base: LetterInput = {
  kind: 'adverse_action',
  decisionKind: 'deny',
  date: '2026-12-06',
  dateText: 'December 6, 2026',
  recipient: { name: 'Priya Raman', address: '87 King Ave, Columbus, OH 43201' },
  rentalAddress: '1428 Maple St, Unit B, Columbus, OH 43215',
  landlord: { name: 'Alex Morgan' },
  opening: 'Thank you for applying.',
  closing: '',
  reasons: [{ code: 'C5', title: 'No unpaid balance owed to a past landlord' }],
  note: null,
  conditions: [],
  data: {
    letter: 'adverse_action',
    company: { name: 'TransUnion Rental Screening Solutions', address: REPORT_ADDRESS_PLACEHOLDER, phone: REPORT_PHONE_PLACEHOLDER },
    scoreBlock: null,
    fcraLines: FCRA_REQUIRED_LINES,
    respondBy: null,
  },
};

describe('letters PDF', () => {
  it('adverse action notice: reason, company block, every FCRA line, footer', () => {
    const html = letterHtml(base);
    expect(html).toContain('Adverse action notice');
    expect(html).toContain('December 6, 2026');
    expect(html).toContain('Re: 1428 Maple St, Unit B, Columbus, OH 43215');
    expect(html).toContain('Dear Priya Raman,');
    expect(html).toContain('<strong>Reason:</strong> unpaid balance owed to a past landlord.');
    expect(html).toContain('TransUnion Rental Screening Solutions');
    expect(html).toContain('[Mailing address from the report]');
    expect(html).toContain('[Phone from the report]');
    for (const line of FCRA_REQUIRED_LINES) expect(html).toContain(line);
    expect(html).toContain(PDF_FOOTER);
    expect(html).toContain('Sincerely,<br>Alex Morgan');
  });

  it('escapes every user value', () => {
    const html = letterHtml({
      ...base,
      recipient: { name: '<b>Pri</b>', address: 'A & B\nLine 2' },
      landlord: { name: 'Alex "Al" O\'Neil' },
      opening: '<script>x</script>',
      reasons: [{ code: 'CX', title: 'Has <renter> insurance' }],
    });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Pri&lt;/b&gt;');
    expect(html).toContain('A &amp; B<br>Line 2');
    expect(html).toContain('Alex &quot;Al&quot; O&#39;Neil');
    expect(html).toContain('Has &lt;renter&gt; insurance');
  });

  it('score block (C9) with key factors; "no score" variant', () => {
    const data: LetterData = {
      ...base.data,
      scoreBlock: { score: 612, noScore: false, range: '300–850', date: '2026-12-03', model: 'VantageScore 3.0', keyFactors: ['Late payments'] },
    };
    const html = letterHtml({ ...base, data });
    expect(html).toContain('Credit score: 612 (possible range 300–850)');
    expect(html).toContain('Date of score: Dec 3, 2026');
    expect(html).toContain('<li>Late payments</li>');
    expect(letterHtml({ ...base, data: { ...data, scoreBlock: { ...data.scoreBlock!, noScore: true, score: null } } })).toContain(
      'No credit score was available.',
    );
  });

  it('conditional offer: reply-by line, no FCRA block, no reasons', () => {
    const html = letterHtml({
      ...base,
      kind: 'conditional_offer',
      decisionKind: 'conditional_offer',
      opening: defaultLetterText('conditional_offer', 'conditional_offer', '1428 Maple St, Unit B').opening,
      data: { letter: 'conditional_offer', company: null, scoreBlock: null, fcraLines: [], respondBy: '2026-12-08T20:12:00.000Z' },
      respondByText: 'Dec 8, 2026 at 3:12 PM',
    });
    expect(html).toContain("We&#39;re glad to offer you 1428 Maple St, Unit B, subject to the final step described in our published criteria.");
    expect(html).toContain('Please reply by Dec 8, 2026 at 3:12 PM (48 hours).');
    expect(html).not.toContain(FCRA_REQUIRED_LINES[0]);
    expect(html).not.toContain('Reason:');
  });

  it('conditions, note fallback, several reasons', () => {
    expect(conditionText({ kind: 'higher_deposit', amountCents: 247500 })).toBe('Higher deposit: $2,475');
    expect(conditionText({ kind: 'higher_rent', amountCents: 180000 })).toBe('Higher rent: $1,800/mo');
    expect(conditionText({ kind: 'cosigner' })).toBe('Co-signer or guarantor');
    const withConditions = letterHtml({
      ...base,
      decisionKind: 'approve_with_conditions',
      conditions: [{ kind: 'cosigner' }],
      reasons: [
        { code: 'C1', title: '' },
        { code: 'C5', title: '' },
      ],
    });
    expect(withConditions).toContain('<li>Co-signer or guarantor</li>');
    expect(withConditions).toContain('<strong>Reasons:</strong>');
    const noted = letterHtml({ ...base, kind: 'denial', reasons: [], note: 'Unit no longer available', data: { ...base.data, letter: 'denial', company: null, fcraLines: [] } });
    expect(noted).toContain('<strong>Reason:</strong> Unit no longer available');
    expect(letterReason({ code: 'CX', title: 'Renter insurance' })).toBe('Renter insurance');
  });

  it('default paragraphs per kind and decision; file name', () => {
    expect(defaultLetterText('adverse_action', 'deny', 'X').opening).toMatch(/information in a consumer report\.$/);
    expect(defaultLetterText('adverse_action', 'withdraw_offer', '1 Main St').opening).toMatch(/^We are withdrawing our conditional offer for 1 Main St\./);
    expect(defaultLetterText('denial', 'deny', '1 Main St').opening).toBe('Thank you for applying for 1 Main St. We are unable to approve your application.');
    expect(defaultLetterText('approval', 'approve', '1 Main St')).toEqual({
      opening: "We're glad to approve your application for 1 Main St.",
      closing: 'Please let us know if you accept.',
    });
    expect(letterFileName('adverse_action', 'Priya Raman')).toBe('Adverse action notice - Priya Raman');
  });
});
