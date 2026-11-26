import { localIso } from '../time';
import { emptyForm, emptyResidence, firstName, type ApplicationForm, type ResidenceDraft } from '../form/model';
import { errorFor, isEmail, isPhone, residenceCoverageMonths, validateForm, validateResidence, validateSection } from '../form/validate';

// Local noon on Dec 2, 2026.
const NOW = new Date(2026, 11, 2, 12, 0, 0);
const L = { mode: 'landlord' as const, now: NOW };
const A = { mode: 'applicant' as const, now: NOW };

const res = (p: Partial<ResidenceDraft>): ResidenceDraft => ({ ...emptyResidence(), address: '88 Elm St', type: 'rent', ...p });
const codes = (f: ApplicationForm, s: Parameters<typeof validateSection>[0], ctx: { mode: 'landlord' | 'applicant'; now: Date } = L) => validateSection(s, f, ctx).errors.map((e) => `${e.field}:${e.code}`);

function filled(): ApplicationForm {
  return {
    ...emptyForm(localIso(new Date(2026, 11, 2, 9, 14))),
    fullName: 'Jordan Ellis',
    phone: '(614) 555-0142',
    occupants: 2,
    otherAdults: [{ key: 'a', name: 'Sam Ellis', monthlyCents: null }],
    residences: [res({ fromMonth: '2024-10', current: true })],
    consent: { authorize: true, certify: true },
    pendingSignature: { kind: 'typed', name: 'Jordan Ellis' },
    signedName: 'Jordan Ellis',
  };
}

describe('application form validation', () => {
  it('has no SSN / birth date / protected-characteristic field', () => {
    const keys = JSON.stringify(Object.keys(emptyForm('x'))).toLowerCase();
    for (const bad of ['ssn', 'social', 'birth', 'dob', 'gender', 'sex', 'race', 'religion', 'national', 'citizen', 'disab', 'marital', 'age'])
      expect(keys).not.toContain(bad);
  });

  it('part 1: name, phone or email, formats', () => {
    const f = emptyForm('x');
    expect(codes(f, 1)).toEqual(['fullName:nameRequired', 'phone:contactRequired']);
    expect(codes({ ...f, fullName: 'A B', email: 'a@b.co' }, 1)).toEqual([]);
    expect(codes({ ...f, fullName: 'A B', phone: '(614) 555-' }, 1)).toEqual(['phone:phoneInvalid']);
    expect(codes({ ...f, fullName: 'A B', phone: '6145550142', email: 'nope', emergencyPhone: '12' }, 1)).toEqual([
      'email:emailInvalid',
      'emergencyPhone:emergencyPhoneInvalid',
    ]);
    expect(isPhone('+1 (614) 555-0142')).toBe(true);
    expect(isPhone('2614555014299')).toBe(false);
    expect(isEmail(' x@y.com ')).toBe(true);
  });

  it('part 2: household size, adults, pets, move-in date, voucher', () => {
    const f = filled();
    expect(codes(f, 2)).toEqual([]);
    expect(codes({ ...f, occupants: 0 }, 2)).toContain('occupants:occupantsRange');
    expect(codes({ ...f, occupants: 13 }, 2)).toContain('occupants:occupantsRange');
    expect(codes({ ...f, occupants: 1 }, 2)).toEqual(['otherAdults:adultsExceedHousehold']);
    expect(codes({ ...f, otherAdults: [{ key: 'a', name: ' ', monthlyCents: null }] }, 2)).toEqual(['otherAdults.0.name:adultNameRequired']);
    expect(codes({ ...f, pets: { cat: -1, dog: 10, other: 0 } }, 2)).toEqual(['pets.cat:petsRange', 'pets.dog:petsRange']);
    expect(codes({ ...f, moveInOn: '2026-12-01' }, 2)).toEqual(['moveInOn:moveInPast']);
    expect(codes({ ...f, moveInOn: '2026-12-02' }, 2)).toEqual([]);
    expect(codes({ ...f, moveInOn: '2026-13-01' }, 2)).toEqual(['moveInOn:dateInvalid']);
    // Voucher amount may stay blank (C1 → Missing), but not negative.
    expect(codes({ ...f, hasVoucher: true, voucherCents: null }, 2)).toEqual([]);
    expect(codes({ ...f, hasVoucher: true, voucherCents: -5 }, 2)).toEqual(['voucherCents:amountInvalid']);
  });

  it("part 3: residence dates ('To' after 'From'), type, contacts", () => {
    expect(validateResidence(res({ fromMonth: '2024-10', toMonth: '2024-07' }), NOW).map((e) => e.code)).toEqual(['toBeforeFrom']);
    expect(validateResidence(res({ fromMonth: '2024-10', toMonth: '2024-10' }), NOW)).toEqual([]);
    expect(validateResidence(res({ address: '', fromMonth: null, type: null }), NOW).map((e) => `${e.field}:${e.code}`)).toEqual([
      'address:addressRequired',
      'fromMonth:fromRequired',
      'toMonth:toRequired',
      'type:typeRequired',
    ]);
    expect(validateResidence(res({ fromMonth: '2027-01', current: true }), NOW).map((e) => e.code)).toEqual(['monthInFuture']);
    expect(validateResidence(res({ fromMonth: '2020-01', toMonth: '2021-01', landlordPhone: '5', landlordEmail: 'x' }), NOW).map((e) => e.code)).toEqual([
      'landlordPhoneInvalid',
      'landlordEmailInvalid',
    ]);
    const f = { ...filled(), residences: [res({ fromMonth: '2024-10', current: true }), res({ fromMonth: '2022-08', toMonth: '2021-01' })] };
    expect(codes(f, 3)).toEqual(['residences.1.toMonth:toBeforeFrom']);
  });

  it('part 3: soft warning under 3 years of addresses', () => {
    const one = [res({ fromMonth: '2024-10', current: true })];
    expect(residenceCoverageMonths(one, NOW)).toBe(27);
    expect(validateSection(3, { ...filled(), residences: one }, L).warnings).toEqual(['coverShortOfThreeYears']);
    const two = [...one, res({ fromMonth: '2022-08', toMonth: '2024-09' })];
    expect(residenceCoverageMonths(two, NOW)).toBe(53);
    expect(validateSection(3, { ...filled(), residences: two }, L).warnings).toEqual([]);
    // Overlaps are not counted twice; gaps are not filled.
    expect(residenceCoverageMonths([res({ fromMonth: '2025-01', toMonth: '2025-06' }), res({ fromMonth: '2025-03', toMonth: '2025-12' })], NOW)).toBe(12);
    expect(residenceCoverageMonths([res({ fromMonth: '2024-01', toMonth: '2024-02' }), res({ fromMonth: '2024-05', toMonth: '2024-05' })], NOW)).toBe(3);
  });

  it('part 4: other income lines need an amount', () => {
    const f = { ...filled(), otherIncome: [{ key: 'o', kind: 'benefits' as const, monthlyCents: null }], monthlyCents: 540000 };
    expect(codes(f, 4)).toEqual(['otherIncome.0.monthlyCents:incomeAmountRequired']);
    expect(codes({ ...f, otherIncome: [{ key: 'o', kind: 'benefits', monthlyCents: 0 }] }, 4)).toEqual([]);
    expect(codes({ ...f, monthlyCents: 1.5 }, 4)).toContain('monthlyCents:amountInvalid');
  });

  it('part 6: both boxes, a real signature and a printed name ("Sign to continue")', () => {
    const f = filled();
    expect(codes(f, 6, A)).toEqual([]);
    expect(codes({ ...f, consent: { authorize: false, certify: true }, pendingSignature: null, signedName: '' }, 6, A)).toEqual([
      'consent.authorize:consentRequired',
      'signature:signatureRequired',
      'signedName:signedNameRequired',
    ]);
    expect(codes({ ...f, pendingSignature: { kind: 'typed', name: 'J' } }, 6, A)).toEqual(['signature:signatureTooShort']);
    // An already saved signature is enough.
    expect(codes({ ...f, pendingSignature: null, signaturePath: 'applicants/1/signature-1.svg' }, 6, A)).toEqual([]);
  });

  it('part 7 (landlord): "Received on" not in the future', () => {
    const f = filled();
    expect(codes({ ...f, receivedAt: '2026-12-02T11:59:00' }, 7)).toEqual([]);
    expect(codes({ ...f, receivedAt: '2026-12-03T09:00:00' }, 7)).toEqual(['receivedAt:receivedInFuture']);
    expect(codes({ ...f, receivedAt: 'yesterday' }, 7)).toEqual(['receivedAt:receivedInvalid']);
    expect(codes({ ...f, receivedAt: 'yesterday' }, 7, A)).toEqual([]);
  });

  it('whole form: landlord may skip the signature; first invalid part reported', () => {
    const f = { ...filled(), pendingSignature: null, consent: { authorize: false, certify: false } };
    expect(validateForm(f, L).errors).toEqual([]);
    const r = validateForm(f, A);
    expect(r.firstInvalid).toBe(6);
    const bad = validateForm({ ...f, fullName: '' }, A);
    expect(bad.firstInvalid).toBe(1);
    expect(errorFor(bad.errors, 'fullName')).toBe('nameRequired');
    expect(errorFor(bad.errors, 'email')).toBeNull();
  });

  it('first name for S-08b', () => {
    expect(firstName('  Jordan  Ellis ')).toBe('Jordan');
    expect(firstName('')).toBe('');
  });
});
