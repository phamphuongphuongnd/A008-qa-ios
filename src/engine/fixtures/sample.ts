/**
 * §8 "Explore with a sample rental" — plain data with stable ids.
 * Used by the engine tests (expected results = product.md §8) and by 1C to seed the sample rental (`is_sample`).
 * Times are Columbus, OH local (EST, −05:00).
 */
import type { ApplicantInput, Criterion, LandlordReference, RentalInput, ScreeningReport } from '../types';

export interface SampleRental extends RentalInput {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  bathrooms: number;
  availableOn: string;
  depositCents: number;
  feeCents: number;
  isSample: true;
}

export interface SampleApplicant extends ApplicantInput {
  phone: string | null;
  email: string | null;
}

export const SAMPLE_RENTAL: SampleRental = {
  id: 'sample-rental',
  street: '1428 Maple St',
  unit: 'Unit B',
  city: 'Columbus',
  state: 'OH',
  zip: '43215',
  rentCents: 165000,
  bedrooms: 2,
  bathrooms: 1,
  availableOn: '2027-01-01',
  depositCents: 165000,
  feeCents: 0,
  reviewMode: 'compare',
  isSample: true,
};

export const SAMPLE_CRITERIA: Criterion[] = [
  { id: 'sample-c1', code: 'C1', enabled: true, order: 1, params: { multipleTenths: 30, applyToTenantShare: true } },
  { id: 'sample-c2', code: 'C2', enabled: true, order: 2, params: { months: 12 } },
  { id: 'sample-c3', code: 'C3', enabled: true, order: 3, params: { years: 5 } },
  { id: 'sample-c4', code: 'C4', enabled: true, order: 4, params: {} },
  { id: 'sample-c5', code: 'C5', enabled: true, order: 5, params: {} },
  {
    id: 'sample-c6',
    code: 'C6',
    enabled: true,
    order: 6,
    params: { documents: [{ type: 'photo_id' }, { type: 'proof_of_income' }] },
  },
  { id: 'sample-c7', code: 'C7', enabled: true, order: 7, params: { perBedroom: 2 } },
  { id: 'sample-c8', code: 'C8', enabled: true, order: 8, params: { policy: 'cats_and_dogs', maxPets: 2 } },
  { id: 'sample-c9', code: 'C9', enabled: false, order: 9, params: { minScore: 600 } },
  { id: 'sample-c10', code: 'C10', enabled: true, order: 10, params: { lookbackYears: 7 } },
];

// TODO(question): company address / phone "entered from the sample report" — confirm before release (printed on the
// sample FCRA notice).
const TURSS = {
  companyName: 'TransUnion Rental Screening Solutions',
  companyAddress: '6430 S. Fiddlers Green Circle, Suite 500, Greenwood Village, CO 80111',
  companyPhone: '1-866-775-0961',
};

function report(id: string, over: Partial<ScreeningReport>): ScreeningReport {
  return {
    id,
    ...TURSS,
    reportDate: null,
    evictions: [],
    landlordCollectionsCents: 0,
    score: null,
    noScore: false,
    scoreModel: null,
    scoreRange: null,
    scoreDate: null,
    keyFactors: [],
    ...over,
  };
}

function reference(over: Partial<LandlordReference> & Pick<LandlordReference, 'id' | 'residenceId'>): LandlordReference {
  return {
    ownerConfirmed: false,
    confirmSource: null,
    answeredOn: null,
    rentedFromYou: null,
    from: null,
    to: null,
    rentCents: null,
    owes: null,
    owesCents: null,
    rentAgain: null,
    unreachable: false,
    attempts: [],
    ...over,
  };
}

const NO_ANSWERS = { evicted: 'no', bankruptcy: 'no', smokes: 'no' } as const;

/** #1 Jordan Ellis — everything verified → Ready to decide. */
const JORDAN: SampleApplicant = {
  id: 'sample-a1',
  fullName: 'Jordan Ellis',
  phone: '(614) 555-0142',
  email: 'jordan.ellis@example.com',
  receivedAt: '2026-12-02T09:14:00-05:00',
  status: 'new',
  conditionalOfferAt: null,
  occupants: 2,
  pets: [{ kind: 'dog', count: 1 }],
  hasVoucher: false,
  voucherMonthlyCents: null,
  residences: [
    {
      id: 'sample-a1-r1',
      address: '220 Oak Ave, Apt 3, Columbus, OH 43201',
      from: '2024-10',
      to: null,
      current: true,
      type: 'rent',
      rentCents: 140000,
    },
  ],
  incomes: [{ id: 'sample-a1-i1', kind: 'employment', monthlyCents: 540000, label: 'Riverside Medical Center' }],
  documents: [
    { id: 'sample-a1-d1', type: 'photo_id', checkedOn: '2026-12-02' },
    {
      id: 'sample-a1-d2',
      type: 'proof_of_income',
      checkedOn: '2026-12-02',
      incomeId: 'sample-a1-i1',
      payGrossCents: 247000,
      payFrequency: 'biweekly',
    },
    {
      id: 'sample-a1-d3',
      type: 'proof_of_income',
      checkedOn: '2026-12-02',
      incomeId: 'sample-a1-i1',
      payGrossCents: 247000,
      payFrequency: 'biweekly',
    },
  ],
  landlordReferences: [
    reference({
      id: 'sample-a1-ref1',
      residenceId: 'sample-a1-r1',
      ownerConfirmed: true,
      confirmSource: 'county_records',
      answeredOn: '2026-12-03',
      rentedFromYou: 'yes',
      from: '2024-10',
      to: 'still_there',
      rentCents: 140000,
      owes: 'no',
      owesCents: null,
      rentAgain: 'yes',
      attempts: [{ at: '2026-12-03T10:05:00-05:00', method: 'call', result: 'reached' }],
    }),
  ],
  employerReferences: [],
  report: report('sample-a1-rep', { reportDate: '2026-12-03' }),
  background: null,
  answers: NO_ANSWERS,
  customAnswers: {},
  landlordChecks: {},
};

/** #2 Priya Raman — income claimed, landlord not reached, report shows $2,310 owed → "2 items missing". */
const PRIYA: SampleApplicant = {
  id: 'sample-a2',
  fullName: 'Priya Raman',
  phone: '(614) 555-0187',
  email: null,
  receivedAt: '2026-12-02T14:40:00-05:00',
  status: 'new',
  conditionalOfferAt: null,
  occupants: 1,
  pets: [],
  hasVoucher: false,
  voucherMonthlyCents: null,
  residences: [
    {
      id: 'sample-a2-r1',
      address: '87 King Ave, Columbus, OH 43201',
      from: '2024-06',
      to: null,
      current: true,
      type: 'rent',
      rentCents: 125000,
    },
  ],
  incomes: [{ id: 'sample-a2-i1', kind: 'employment', monthlyCents: 470000, label: 'Northside Logistics' }],
  documents: [{ id: 'sample-a2-d1', type: 'photo_id', checkedOn: null }],
  landlordReferences: [
    reference({
      id: 'sample-a2-ref1',
      residenceId: 'sample-a2-r1',
      attempts: [
        { at: '2026-12-03T09:30:00-05:00', method: 'call', result: 'no_answer' },
        { at: '2026-12-04T16:10:00-05:00', method: 'call', result: 'no_answer' },
      ],
    }),
  ],
  employerReferences: [],
  report: report('sample-a2-rep', { reportDate: '2026-12-03', landlordCollectionsCents: 231000 }),
  background: null,
  answers: NO_ANSWERS,
  customAnswers: {},
  landlordChecks: {},
};

/** #3 Marcus Webb — landlord dates and rent disagree, "Wouldn't say" → "1 item missing". */
const MARCUS: SampleApplicant = {
  id: 'sample-a3',
  fullName: 'Marcus Webb',
  phone: '(614) 555-0119',
  email: 'mwebb@example.com',
  receivedAt: '2026-12-03T11:05:00-05:00',
  status: 'new',
  conditionalOfferAt: null,
  occupants: 3,
  pets: [],
  hasVoucher: false,
  voucherMonthlyCents: null,
  residences: [
    {
      id: 'sample-a3-r1',
      address: '1510 Summit St, Columbus, OH 43201',
      from: '2022-03',
      to: null,
      current: true,
      type: 'rent',
      rentCents: 120000,
    },
  ],
  incomes: [{ id: 'sample-a3-i1', kind: 'employment', monthlyCents: 610000, label: 'Buckeye Electric' }],
  documents: [
    { id: 'sample-a3-d1', type: 'photo_id', checkedOn: '2026-12-03' },
    {
      id: 'sample-a3-d2',
      type: 'proof_of_income',
      checkedOn: '2026-12-03',
      incomeId: 'sample-a3-i1',
      payGrossCents: 305000,
      payFrequency: 'semimonthly',
    },
    {
      id: 'sample-a3-d3',
      type: 'proof_of_income',
      checkedOn: '2026-12-03',
      incomeId: 'sample-a3-i1',
      payGrossCents: 305000,
      payFrequency: 'semimonthly',
    },
  ],
  landlordReferences: [
    reference({
      id: 'sample-a3-ref1',
      residenceId: 'sample-a3-r1',
      ownerConfirmed: true,
      confirmSource: 'county_records',
      answeredOn: '2026-12-04',
      rentedFromYou: 'yes',
      from: '2023-01',
      to: 'still_there',
      rentCents: 155000,
      owes: 'wouldnt_say',
      rentAgain: 'wouldnt_say',
      attempts: [{ at: '2026-12-04T13:20:00-05:00', method: 'call', result: 'reached' }],
    }),
  ],
  employerReferences: [],
  report: null,
  background: null,
  answers: NO_ANSWERS,
  customAnswers: {},
  landlordChecks: {},
};

/** #4 Dana Ortiz — voucher $900 → tenant share $750; a 2021 Settled case → Needs review, still Ready to decide. */
const DANA: SampleApplicant = {
  id: 'sample-a4',
  fullName: 'Dana Ortiz',
  phone: '(614) 555-0163',
  email: 'dana.ortiz@example.com',
  receivedAt: '2026-12-04T08:20:00-05:00',
  status: 'new',
  conditionalOfferAt: null,
  occupants: 2,
  pets: [],
  hasVoucher: true,
  voucherMonthlyCents: 90000,
  residences: [
    {
      id: 'sample-a4-r1',
      address: '45 Linden Pl, Columbus, OH 43211',
      from: '2023-08',
      to: null,
      current: true,
      type: 'rent',
      rentCents: 110000,
    },
  ],
  incomes: [{ id: 'sample-a4-i1', kind: 'benefits', monthlyCents: 260000, label: 'Social Security' }],
  documents: [
    { id: 'sample-a4-d1', type: 'photo_id', checkedOn: '2026-12-04' },
    {
      id: 'sample-a4-d2',
      type: 'proof_of_income',
      checkedOn: '2026-12-04',
      incomeId: 'sample-a4-i1',
      monthlyCents: 260000,
    },
  ],
  landlordReferences: [
    reference({
      id: 'sample-a4-ref1',
      residenceId: 'sample-a4-r1',
      ownerConfirmed: true,
      confirmSource: 'management_website',
      answeredOn: '2026-12-05',
      rentedFromYou: 'yes',
      from: '2023-08',
      to: 'still_there',
      rentCents: 110000,
      owes: 'no',
      rentAgain: 'yes',
      attempts: [{ at: '2026-12-05T11:00:00-05:00', method: 'call', result: 'reached' }],
    }),
  ],
  employerReferences: [],
  report: report('sample-a4-rep', {
    reportDate: '2026-12-05',
    evictions: [{ date: '2021', outcome: 'settled' }],
  }),
  background: null,
  answers: { evicted: 'yes', bankruptcy: 'no', smokes: 'no' },
  customAnswers: {},
  landlordChecks: {},
};

export const SAMPLE_APPLICANTS: SampleApplicant[] = [JORDAN, PRIYA, MARCUS, DANA];

export const SAMPLE = { rental: SAMPLE_RENTAL, criteria: SAMPLE_CRITERIA, applicants: SAMPLE_APPLICANTS } as const;
