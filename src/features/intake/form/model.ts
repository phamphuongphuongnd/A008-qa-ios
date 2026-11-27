/**
 * The 7-part Application (product.md S-08) as screen state. Text fields are '' when empty (null in the DB), money is
 * integer cents or null, months 'YYYY-MM', dates 'YYYY-MM-DD'. There is NO field for SSN, date of birth, sex,
 * nationality or any other protected characteristic — never add one (a test checks the keys).
 */
import type { PetKind, ResidenceType, YesNo } from '@/engine';
import type { FormSection } from '@/routes';

import type { SignatureInput } from '../signature';

export type { FormSection };

export const SECTIONS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly FormSection[];
export const SECTION_COUNT = 7;
/** i18n key suffix of each part: `intake:sections.<key>`. */
export const SECTION_KEYS: Record<FormSection, 'about' | 'household' | 'residences' | 'work' | 'questions' | 'consent' | 'review'> = {
  1: 'about',
  2: 'household',
  3: 'residences',
  4: 'work',
  5: 'questions',
  6: 'consent',
  7: 'review',
};
export const SIGN_SECTION: FormSection = 6;
export const REVIEW_SECTION: FormSection = 7;

/** Who is filling the form: the landlord (typing / paper) or the applicant on the landlord's phone. */
export type FormMode = 'landlord' | 'applicant';

export const MAX_OCCUPANTS = 12;
export const MAX_PETS_PER_KIND = 9;
export const RESIDENCE_YEARS = 3;

export interface ResidenceDraft {
  /** Stable key for lists (DB id as string, or a local key for new rows). */
  key: string;
  id?: number;
  address: string;
  fromMonth: string | null;
  toMonth: string | null;
  /** "I live here now". */
  current: boolean;
  type: ResidenceType | null;
  rentCents: number | null;
  landlordName: string;
  landlordPhone: string;
  landlordEmail: string;
  reason: string;
}

export type OtherIncomeKind = 'self_employment' | 'benefits' | 'child_support' | 'retirement' | 'other';
export const OTHER_INCOME_KINDS: readonly OtherIncomeKind[] = ['self_employment', 'benefits', 'child_support', 'retirement', 'other'];

export interface OtherIncomeDraft {
  key: string;
  id?: number;
  kind: OtherIncomeKind;
  monthlyCents: number | null;
}

/** "Other adults (18+)" — one per adult, with their gross monthly income (part 4). */
export interface OtherAdultDraft {
  key: string;
  /** incomes row id of this adult's income (kept stable so documents stay linked). */
  incomeId?: number;
  name: string;
  monthlyCents: number | null;
}

export type QuestionKey = 'evicted' | 'bankruptcy' | 'smokes';
export const QUESTION_KEYS: readonly QuestionKey[] = ['evicted', 'bankruptcy', 'smokes'];

export interface ApplicationForm {
  // 1. About you
  fullName: string;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  // 2. Household
  occupants: number | null;
  otherAdults: OtherAdultDraft[];
  pets: Record<PetKind, number>;
  /** Pets were answered (part 2 passed). Until then the DB keeps "not answered" (engine C8 Missing). */
  petsAnswered: boolean;
  moveInOn: string | null;
  hasVoucher: boolean | null;
  voucherCents: number | null;
  voucherProgram: string;
  // 3. Where you've lived
  residences: ResidenceDraft[];
  // 4. Work & income
  /** incomes row id of the job line. */
  jobIncomeId?: number;
  employer: string;
  jobTitle: string;
  startMonth: string | null;
  monthlyCents: number | null;
  employerPhone: string;
  supervisor: string;
  otherIncome: OtherIncomeDraft[];
  // 5. A few questions (+ custom "applicant answers" criteria, keyed by criterion row id)
  answers: Record<QuestionKey, YesNo | null>;
  explain: Record<QuestionKey, string>;
  customAnswers: Record<string, boolean | null>;
  // 6. Consent & signature
  consent: { authorize: boolean; certify: boolean };
  /** Signature drawn / typed in this session, not saved yet. */
  pendingSignature: SignatureInput | null;
  /** Saved signature file (relative path) + when. */
  signaturePath: string | null;
  signedAt: string | null;
  signedName: string;
  // 7. Review (landlord): "Received on"
  receivedAt: string;
}

let seq = 0;
/** Local list key for a new row. */
export const newKey = (prefix = 'n') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyForm(receivedAt: string): ApplicationForm {
  return {
    fullName: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    occupants: 1,
    otherAdults: [],
    pets: { cat: 0, dog: 0, other: 0 },
    petsAnswered: false,
    moveInOn: null,
    hasVoucher: null,
    voucherCents: null,
    voucherProgram: '',
    residences: [],
    employer: '',
    jobTitle: '',
    startMonth: null,
    monthlyCents: null,
    employerPhone: '',
    supervisor: '',
    otherIncome: [],
    answers: { evicted: null, bankruptcy: null, smokes: null },
    explain: { evicted: '', bankruptcy: '', smokes: '' },
    customAnswers: {},
    consent: { authorize: false, certify: false },
    pendingSignature: null,
    signaturePath: null,
    signedAt: null,
    signedName: '',
    receivedAt,
  };
}

export function emptyResidence(): ResidenceDraft {
  return {
    key: newKey('r'),
    address: '',
    fromMonth: null,
    toMonth: null,
    current: false,
    type: null,
    rentCents: null,
    landlordName: '',
    landlordPhone: '',
    landlordEmail: '',
    reason: '',
  };
}

const blank = (v: string | null | undefined) => !v?.trim();

/**
 * Nothing typed in: no text, no filled rows, no answers, no consent / signature. Defaults the form shows on its own
 * (1 occupant, voucher "No", an empty residence row) do not count. Such a draft is not an applicant (B-62).
 */
export function isBlankForm(f: ApplicationForm): boolean {
  const texts = [f.fullName, f.phone, f.email, f.emergencyName, f.emergencyPhone, f.voucherProgram, f.employer, f.jobTitle, f.employerPhone, f.supervisor];
  return (
    texts.every(blank) &&
    Object.values(f.explain).every(blank) &&
    f.otherAdults.every((o) => blank(o.name) && o.monthlyCents == null) &&
    Object.values(f.pets).every((n) => n === 0) &&
    f.moveInOn == null &&
    f.voucherCents == null &&
    f.residences.every(
      (r) =>
        [r.address, r.landlordName, r.landlordPhone, r.landlordEmail, r.reason].every(blank) &&
        r.fromMonth == null &&
        r.toMonth == null &&
        r.type == null &&
        r.rentCents == null,
    ) &&
    f.startMonth == null &&
    f.monthlyCents == null &&
    f.otherIncome.every((i) => i.monthlyCents == null) &&
    Object.values(f.answers).every((v) => v == null) &&
    Object.values(f.customAnswers).every((v) => v == null) &&
    !f.consent.authorize &&
    !f.consent.certify &&
    !f.pendingSignature &&
    !f.signaturePath
  );
}

/** First name for S-08b "Thank you, {first name}." */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export const clampSection = (n: number): FormSection => Math.min(SECTION_COUNT, Math.max(1, Math.trunc(n) || 1)) as FormSection;
