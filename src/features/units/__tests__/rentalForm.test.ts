import { t } from '@/i18n';

import {
  emptyRentalForm,
  firstErrorField,
  formToRentalValues,
  isRentalFormDirty,
  rentalModeHint,
  validateRental,
  validateRentalField,
  type RentalForm,
} from '../rentalForm';
import { isUsState, stateName, US_STATES } from '../usStates';
import {
  addressLine,
  cityLine,
  fullAddress,
  receivedText,
  rentalCardLine,
  rentalHubLine,
  rentalPublishedLine,
} from '../format';

const valid = (extra: Partial<RentalForm> = {}): RentalForm => ({
  ...emptyRentalForm(),
  street: '1428 Maple St',
  unit: 'Unit B',
  city: 'Columbus',
  state: 'OH',
  zip: '43215',
  rentCents: 165000,
  bedrooms: 2,
  ...extra,
});

describe('rental form validation (S-03)', () => {
  it('accepts a complete form', () => {
    expect(validateRental(valid())).toEqual({});
  });

  it('requires street and rent > 0, with the product wording', () => {
    const e = validateRental({ ...emptyRentalForm() });
    expect(e.street).toBe('streetRequired');
    expect(e.rentCents).toBe('rentRequired');
    expect(t(`units:s03.errors.${e.street!}`)).toBe('Enter the street address');
    expect(t(`units:s03.errors.${e.rentCents!}`)).toBe('Enter the monthly rent');
    expect(validateRental(valid({ rentCents: 0 })).rentCents).toBe('rentRequired');
    expect(validateRental(valid({ street: '   ' })).street).toBe('streetRequired');
  });

  it('checks ZIP = 5 digits only when given', () => {
    expect(validateRental(valid({ zip: '9810' })).zip).toBe('zip');
    expect(t('units:s03.errors.zip')).toBe('ZIP must be 5 digits');
    expect(validateRental(valid({ zip: '98101-1234' })).zip).toBe('zip');
    expect(validateRental(valid({ zip: '' })).zip).toBeUndefined();
  });

  it('checks state, bedrooms 0–8, bathrooms in halves, date, money ≥ 0', () => {
    expect(validateRental(valid({ state: 'XX' })).state).toBe('state');
    expect(validateRental(valid({ state: 'wa' })).state).toBeUndefined();
    expect(validateRental(valid({ bedrooms: 9 })).bedrooms).toBe('bedrooms');
    expect(validateRental(valid({ bedrooms: 0 })).bedrooms).toBeUndefined();
    expect(validateRental(valid({ bathrooms: 1.5 })).bathrooms).toBeUndefined();
    expect(validateRental(valid({ bathrooms: 1.25 })).bathrooms).toBe('bathrooms');
    expect(validateRental(valid({ availableOn: '2027-02-30' })).availableOn).toBe('date');
    expect(validateRental(valid({ availableOn: '2028-02-29' })).availableOn).toBeUndefined();
    expect(validateRental(valid({ depositCents: -1 })).depositCents).toBe('money');
    expect(validateRental(valid({ feeCents: 12.5 })).feeCents).toBe('money');
  });

  it('gives one field on blur and the first error in screen order on Save', () => {
    const f = valid({ zip: '1', rentCents: null, street: '' });
    expect(validateRentalField(f, 'zip')).toBe('zip');
    expect(validateRentalField(f, 'city')).toBeNull();
    expect(firstErrorField(validateRental(f))).toBe('street');
    expect(firstErrorField({})).toBeNull();
  });

  it('maps to row values (trim, blanks → null, fee blank → 0) and detects edits', () => {
    const v = formToRentalValues(valid({ unit: '  ', city: ' Columbus ', state: 'oh', feeCents: null, notes: '' }));
    expect(v).toMatchObject({ street: '1428 Maple St', unit: null, city: 'Columbus', state: 'OH', feeCents: 0, notes: null });
    const a = valid();
    expect(isRentalFormDirty(a, { ...a, notes: '' })).toBe(false);
    expect(isRentalFormDirty(a, { ...a, rentCents: 170000 })).toBe(true);
  });

  it('shows the Seattle hint for WA and never changes the mode', () => {
    expect(rentalModeHint({ state: 'WA' })).toBe('Seattle requires first-come order.');
    expect(rentalModeHint({ state: 'OH' })).toBeNull();
  });

  it('has 50 states + DC', () => {
    expect(US_STATES).toHaveLength(51);
    expect(isUsState('DC')).toBe(true);
    expect(stateName('WA')).toBe('Washington');
  });
});

describe('rental display text', () => {
  const r = { street: '1428 Maple St', unit: 'Unit B', city: 'Columbus', state: 'OH', zip: '43215', rentCents: 165000, bedrooms: 2, availableOn: '2027-01-01' };

  it('formats address, rent and availability like the mockup', () => {
    expect(addressLine(r)).toBe('1428 Maple St, Unit B');
    expect(cityLine(r)).toBe('Columbus, OH 43215');
    expect(fullAddress(r)).toBe('1428 Maple St, Unit B, Columbus, OH 43215');
    expect(rentalCardLine(r)).toBe('$1,650/mo · 2 bd');
    expect(rentalCardLine({ rentCents: 120000, bedrooms: 0 })).toBe('$1,200/mo · Studio');
    expect(rentalHubLine(r)).toBe('$1,650/mo · 2 bd · Available Jan 1');
    expect(rentalPublishedLine(r)).toBe('$1,650/mo · Available Jan 1, 2027');
    expect(rentalHubLine({ ...r, availableOn: null })).toBe('$1,650/mo · 2 bd');
    expect(addressLine({ street: '310 Oak Ct', unit: null })).toBe('310 Oak Ct');
  });

  it('shows the received wall-clock time as written', () => {
    expect(receivedText('2026-12-02T09:14:00-05:00')).toBe('Dec 2, 9:14 AM');
    expect(receivedText('2026-12-02T14:40:00-05:00')).toBe('Dec 2, 2:40 PM');
    expect(receivedText('2026-12-03T00:05:00-05:00')).toBe('Dec 3, 12:05 AM');
  });
});
