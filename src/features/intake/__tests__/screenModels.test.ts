import intake from '@/i18n/en/intake.json';

import { emptyForm, emptyResidence } from '../form/model';
import {
  checkedLine,
  doneText,
  errorText,
  formatMonthDay,
  formatMonthInput,
  formFooter,
  formHeader,
  parseMonthInput,
  parseTimeInput,
  petPillLabel,
  receivedLine,
  receivedParts,
  residenceSummary,
  reviewSections,
  slotChip,
  slotHint,
  thumbLabel,
  withDateTime,
} from '../screenModels';
import { padToSignature, pathToStrokes, validateSignature } from '../signature';

describe('intake screen models', () => {
  it('every runtime-built key exists in intake.json', () => {
    const groups: Record<string, readonly string[]> = {
      errors: ['nameRequired', 'contactRequired', 'phoneInvalid', 'emailInvalid', 'emergencyPhoneInvalid', 'occupantsRange', 'adultNameRequired', 'adultsExceedHousehold', 'petsRange', 'moveInPast', 'dateInvalid', 'amountInvalid', 'addressRequired', 'fromRequired', 'toRequired', 'toBeforeFrom', 'monthInFuture', 'typeRequired', 'landlordPhoneInvalid', 'landlordEmailInvalid', 'incomeAmountRequired', 'consentRequired', 'signatureRequired', 'signatureTooShort', 'signedNameRequired', 'receivedInFuture', 'receivedInvalid'],
      sections: ['about', 'household', 'residences', 'work', 'questions', 'consent', 'review'],
      residenceType: ['rent', 'own', 'with_family', 'other'],
      petKind: ['cat', 'dog', 'other'],
      incomeKind: ['employment', 'self_employment', 'benefits', 'child_support', 'retirement', 'other', 'other_adult'],
      payFrequency: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      questions: ['evicted', 'bankruptcy', 'smokes'],
    };
    for (const [g, keys] of Object.entries(groups)) for (const k of keys) expect((intake as Record<string, Record<string, string>>)[g][k]).toEqual(expect.any(String));
  });

  it('header and footer per mode / part / save state', () => {
    expect(formHeader({ isNew: true, save: 'saved' })).toEqual({ title: 'New application', subtitle: 'Draft saved' });
    expect(formHeader({ isNew: true, save: 'pending' }).subtitle).toBe('Saving…');
    expect(formHeader({ isNew: false, save: 'saved' })).toEqual({ title: 'Application', subtitle: undefined });
    expect(formHeader({ isNew: false, save: 'error' }).subtitle).toBe("Couldn't save the draft");
    expect(formFooter(1, 'applicant')).toEqual({ primaryLabel: 'Next', showBack: false, isLast: false });
    expect(formFooter(1, 'landlord').showBack).toBe(true);
    expect(formFooter(7, 'landlord')).toMatchObject({ primaryLabel: 'Save applicant', isLast: true });
    expect(formFooter(7, 'applicant').primaryLabel).toBe('Submit application');
  });

  it('error text from codes', () => {
    expect(errorText([{ field: 'fullName', code: 'nameRequired' }], 'fullName')).toBe('Enter a full name');
    expect(errorText([{ field: 'residences.0.toMonth', code: 'toBeforeFrom' }], 'residences.0.toMonth')).toBe("'To' must be after 'From'");
    expect(errorText([], 'x')).toBeNull();
  });

  it('month input ⇄ YYYY-MM', () => {
    expect(formatMonthInput('2024-10')).toBe('10 / 2024');
    expect(formatMonthInput(null)).toBe('');
    for (const s of ['10 / 2024', '10/2024', '102024', '10-2024']) expect(parseMonthInput(s)).toBe('2024-10');
    expect(parseMonthInput('1/2024')).toBe('2024-01');
    for (const s of ['13/2024', '00/2024', '10/24', '', 'abc']) expect(parseMonthInput(s)).toBeNull();
  });

  it('received time: wall clock kept, edits keep the offset', () => {
    expect(receivedParts('2026-12-02T09:14:00-05:00')).toEqual({ date: 'Dec 2, 2026', time: '9:14 AM' });
    expect(receivedParts('2026-12-02T14:40:00-05:00')?.time).toBe('2:40 PM');
    expect(receivedParts('2026-12-02T00:05:00Z')?.time).toBe('12:05 AM');
    expect(receivedParts('bad')).toBeNull();
    expect(receivedLine('2026-12-02T09:14:00-05:00')).toBe('Dec 2, 2026 · 9:14 AM');
    expect(parseTimeInput('9:14 AM')).toEqual({ h: 9, m: 14 });
    expect(parseTimeInput('12:30 am')).toEqual({ h: 0, m: 30 });
    expect(parseTimeInput('12:30 PM')).toEqual({ h: 12, m: 30 });
    expect(parseTimeInput('2:40pm')).toEqual({ h: 14, m: 40 });
    expect(parseTimeInput('21:05')).toEqual({ h: 21, m: 5 });
    for (const s of ['13:00 PM', '9:60', '25:00', 'nine']) expect(parseTimeInput(s)).toBeNull();
    expect(withDateTime('2026-12-02T09:14:00-05:00', '2026-12-01', null)).toBe('2026-12-01T09:14:00-05:00');
    expect(withDateTime('2026-12-02T09:14:00-05:00', null, { h: 15, m: 2 })).toBe('2026-12-02T15:02:00-05:00');
    expect(formatMonthDay('2027-01-01')).toBe('Jan 1, 2027');
  });

  it('residence card + pets pill', () => {
    const r = { ...emptyResidence(), address: '88 Elm St', fromMonth: '2024-10', current: true, type: 'rent' as const, rentCents: 145000, landlordName: 'Oakline Property Mgmt' };
    expect(residenceSummary(r)).toBe('Oct 2024 – now · $1,450/mo · Oakline Property Mgmt');
    expect(residenceSummary({ ...r, current: false, toMonth: '2025-01', rentCents: null, landlordName: '' })).toBe('Oct 2024 – Jan 2025');
    expect(petPillLabel('dog', 1)).toBe('Dog · 1');
    expect(petPillLabel('cat', 0)).toBe('Cat');
  });

  it('review: answers per part, Yes/No shown, explanations kept', () => {
    const f = {
      ...emptyForm('x'),
      fullName: 'Jordan Ellis',
      phone: '(614) 555-0142',
      occupants: 2,
      pets: { cat: 0, dog: 1, other: 0 },
      petsAnswered: true,
      hasVoucher: true,
      voucherCents: 90000,
      residences: [{ ...emptyResidence(), address: '88 Elm St', fromMonth: '2024-10', current: true, type: 'rent' as const }],
      answers: { evicted: 'no' as const, bankruptcy: 'yes' as const, smokes: null },
      explain: { evicted: '', bankruptcy: '2020', smokes: '' },
      customAnswers: { '12': true },
      signedName: 'Jordan Ellis',
      signaturePath: 'applicants/1/signature-1.svg',
    };
    const s = reviewSections(f, [{ id: '12', title: 'Can you sign a 12-month lease?' }]);
    expect(s.map((x) => x.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s[0].rows).toEqual([
      { label: 'Full legal name', value: 'Jordan Ellis' },
      { label: 'Phone', value: '(614) 555-0142' },
    ]);
    expect(s[1].rows.map((r) => r.value)).toEqual(['2', 'Dog · 1', 'Yes', '$900']);
    expect(s[2].rows).toEqual([{ label: '88 Elm St', value: 'Rent · Oct 2024 – now' }]);
    expect(s[3].rows).toEqual([]);
    expect(s[4].rows.map((r) => r.value)).toEqual(['No', 'Yes · 2020', '—', 'Yes']);
    expect(s[5].rows).toEqual([
      { label: 'Printed name', value: 'Jordan Ellis' },
      { label: 'Signature', value: 'signed' },
    ]);
  });

  it('document slots: chip, hint, checked line, spoken thumbnail label', () => {
    expect(slotChip('missing')).toMatchObject({ kind: 'missing', label: 'Missing' });
    expect(slotChip('provided')).toEqual({ kind: 'chip', label: 'Provided', tone: 'neutral' });
    expect(slotChip('checked')).toEqual({ kind: 'chip', label: 'Checked', tone: 'accent' });
    expect(slotHint('proof_of_income', 'missing')).toBe('2 recent pay stubs, offer letter, or benefits / voucher letter');
    expect(slotHint('proof_of_income', 'provided')).toBeNull();
    expect(slotHint('photo_id', 'missing')).toBeNull();
    expect(checkedLine(['2026-12-04T10:00:00-05:00', '2026-12-05T08:00:00-05:00'])).toBe('Checked Dec 5, 2026 · by you');
    expect(checkedLine(['2026-12-04T10:00:00-05:00', null])).toBeNull();
    expect(checkedLine([])).toBeNull();
    expect(thumbLabel('Proof of income', 1, 3, true)).toBe('Proof of income, 2 / 3, Checked');
  });

  it('S-08b text', () => {
    expect(doneText('Jordan', '2026-12-02T09:14:00-05:00')).toEqual({ thanks: 'Thank you, Jordan.', received: 'Your application was received on Dec 2, 2026 at 9:14 AM.' });
    expect(doneText('', null)).toEqual({ thanks: 'Application received', received: null });
  });

  it("SignaturePad's path becomes strokes the validator judges", () => {
    expect(pathToStrokes('M10 20L30 40L50 60M5 5L6 6')).toEqual([
      [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }],
      [{ x: 5, y: 5 }, { x: 6, y: 6 }],
    ]);
    expect(pathToStrokes('M1.5 2.5L3 4')).toEqual([[{ x: 1.5, y: 2.5 }, { x: 3, y: 4 }]]);
    expect(padToSignature(null)).toBeNull();
    expect(padToSignature({ path: '', width: 300, height: 150 })).toBeNull();
    const zig = Array.from({ length: 12 }, (_, i) => `${i ? 'L' : 'M'}${10 + i * 12} ${i % 2 ? 30 : 90}`).join('');
    expect(validateSignature(padToSignature({ path: zig, width: 300, height: 150 }))).toBeNull();
    expect(validateSignature(padToSignature({ path: 'M10 10L10.5 10', width: 300, height: 150 }))).toBe('signatureTooShort');
  });
});
