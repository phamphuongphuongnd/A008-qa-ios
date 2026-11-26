/**
 * Validation per form part (product.md S-08 "Lỗi"). Errors block "Next" / Save; warnings are soft (e.g. fewer than 3
 * years of addresses). Messages: `intake:errors.<code>` / `intake:warnings.<code>`.
 */
import { validateSignature } from '../signature';
import { instantOf, isIsoDate, isYearMonth, localDate, localMonth, monthNumber } from '../time';
import {
  MAX_OCCUPANTS,
  MAX_PETS_PER_KIND,
  RESIDENCE_YEARS,
  SECTIONS,
  SIGN_SECTION,
  type ApplicationForm,
  type FormMode,
  type FormSection,
  type ResidenceDraft,
} from './model';

export type ErrorCode =
  | 'nameRequired'
  | 'contactRequired'
  | 'phoneInvalid'
  | 'emailInvalid'
  | 'emergencyPhoneInvalid'
  | 'occupantsRange'
  | 'adultNameRequired'
  | 'adultsExceedHousehold'
  | 'petsRange'
  | 'moveInPast'
  | 'dateInvalid'
  | 'amountInvalid'
  | 'addressRequired'
  | 'fromRequired'
  | 'toRequired'
  | 'toBeforeFrom'
  | 'monthInFuture'
  | 'typeRequired'
  | 'landlordPhoneInvalid'
  | 'landlordEmailInvalid'
  | 'incomeAmountRequired'
  | 'consentRequired'
  | 'signatureRequired'
  | 'signatureTooShort'
  | 'signedNameRequired'
  | 'receivedInFuture'
  | 'receivedInvalid';

export type WarningCode = 'coverShortOfThreeYears';

export interface FieldError {
  /** Field path: 'fullName', 'residences.2.toMonth', 'otherIncome.0.monthlyCents'… */
  field: string;
  code: ErrorCode;
}

export interface SectionCheck {
  errors: FieldError[];
  warnings: WarningCode[];
}

export interface ValidateContext {
  mode: FormMode;
  /** "Now" for past / future checks (tests pass a fixed date). */
  now?: Date;
}

const digits = (s: string) => s.replace(/\D/g, '');
/** US numbers: 10 digits, or 11 starting with 1. Empty is "not given" (checked separately). */
export function isPhone(s: string): boolean {
  const d = digits(s);
  return d.length === 10 || (d.length === 11 && d.startsWith('1'));
}
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
const blank = (s: string | null | undefined) => !s || s.trim() === '';
const badMoney = (c: number | null) => c != null && (!Number.isSafeInteger(c) || c < 0);

function about(f: ApplicationForm): FieldError[] {
  const e: FieldError[] = [];
  if (blank(f.fullName)) e.push({ field: 'fullName', code: 'nameRequired' });
  if (blank(f.phone) && blank(f.email)) e.push({ field: 'phone', code: 'contactRequired' });
  if (!blank(f.phone) && !isPhone(f.phone)) e.push({ field: 'phone', code: 'phoneInvalid' });
  if (!blank(f.email) && !isEmail(f.email)) e.push({ field: 'email', code: 'emailInvalid' });
  if (!blank(f.emergencyPhone) && !isPhone(f.emergencyPhone)) e.push({ field: 'emergencyPhone', code: 'emergencyPhoneInvalid' });
  return e;
}

function household(f: ApplicationForm, now: Date): FieldError[] {
  const e: FieldError[] = [];
  if (f.occupants == null || !Number.isInteger(f.occupants) || f.occupants < 1 || f.occupants > MAX_OCCUPANTS)
    e.push({ field: 'occupants', code: 'occupantsRange' });
  f.otherAdults.forEach((a, i) => {
    if (blank(a.name)) e.push({ field: `otherAdults.${i}.name`, code: 'adultNameRequired' });
  });
  if (f.occupants != null && f.otherAdults.length + 1 > f.occupants)
    e.push({ field: 'otherAdults', code: 'adultsExceedHousehold' });
  for (const [kind, n] of Object.entries(f.pets))
    if (!Number.isInteger(n) || n < 0 || n > MAX_PETS_PER_KIND) e.push({ field: `pets.${kind}`, code: 'petsRange' });
  if (f.moveInOn != null) {
    if (!isIsoDate(f.moveInOn)) e.push({ field: 'moveInOn', code: 'dateInvalid' });
    else if (f.moveInOn < localDate(now)) e.push({ field: 'moveInOn', code: 'moveInPast' });
  }
  // Voucher amount may be left blank (C1 then shows Missing, product.md §3.3).
  if (f.hasVoucher && badMoney(f.voucherCents)) e.push({ field: 'voucherCents', code: 'amountInvalid' });
  return e;
}

function residence(r: ResidenceDraft, i: number, now: Date): FieldError[] {
  const e: FieldError[] = [];
  const at = (k: string) => `residences.${i}.${k}`;
  const thisMonth = localMonth(now);
  if (blank(r.address)) e.push({ field: at('address'), code: 'addressRequired' });
  if (!isYearMonth(r.fromMonth)) e.push({ field: at('fromMonth'), code: 'fromRequired' });
  else if (r.fromMonth > thisMonth) e.push({ field: at('fromMonth'), code: 'monthInFuture' });
  if (!r.current) {
    if (!isYearMonth(r.toMonth)) e.push({ field: at('toMonth'), code: 'toRequired' });
    else if (r.toMonth > thisMonth) e.push({ field: at('toMonth'), code: 'monthInFuture' });
    else if (isYearMonth(r.fromMonth) && r.toMonth < r.fromMonth) e.push({ field: at('toMonth'), code: 'toBeforeFrom' });
  }
  if (r.type == null) e.push({ field: at('type'), code: 'typeRequired' });
  if (badMoney(r.rentCents)) e.push({ field: at('rentCents'), code: 'amountInvalid' });
  if (!blank(r.landlordPhone) && !isPhone(r.landlordPhone)) e.push({ field: at('landlordPhone'), code: 'landlordPhoneInvalid' });
  if (!blank(r.landlordEmail) && !isEmail(r.landlordEmail)) e.push({ field: at('landlordEmail'), code: 'landlordEmailInvalid' });
  return e;
}

/** S-08 part 3 residence editor ("Save" on one address). */
export function validateResidence(r: ResidenceDraft, now = new Date()): FieldError[] {
  return residence(r, 0, now).map((x) => ({ ...x, field: x.field.replace(/^residences\.0\./, '') }));
}

/**
 * Months covered by the addresses, overlaps merged, up to this month (inclusive both ends: Oct 2024 – now in Dec 2026
 * = 27 months). Used only for the soft "cover 3 years" hint, not for a criterion (C2 is the engine's).
 */
export function residenceCoverageMonths(rs: readonly ResidenceDraft[], now = new Date()): number {
  const end = monthNumber(localMonth(now));
  const spans = rs
    .filter((r) => isYearMonth(r.fromMonth) && (r.current || isYearMonth(r.toMonth)))
    .map((r) => [monthNumber(r.fromMonth!), Math.min(end, r.current ? end : monthNumber(r.toMonth!))] as [number, number])
    .filter(([a, b]) => b >= a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1] + 1) cur[1] = Math.max(cur[1], s[1]);
    else {
      if (cur) total += cur[1] - cur[0] + 1;
      cur = [s[0], s[1]];
    }
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total;
}

function work(f: ApplicationForm): FieldError[] {
  const e: FieldError[] = [];
  if (badMoney(f.monthlyCents)) e.push({ field: 'monthlyCents', code: 'amountInvalid' });
  if (f.startMonth != null && !isYearMonth(f.startMonth)) e.push({ field: 'startMonth', code: 'dateInvalid' });
  f.otherIncome.forEach((o, i) => {
    if (o.monthlyCents == null) e.push({ field: `otherIncome.${i}.monthlyCents`, code: 'incomeAmountRequired' });
    else if (badMoney(o.monthlyCents)) e.push({ field: `otherIncome.${i}.monthlyCents`, code: 'amountInvalid' });
  });
  f.otherAdults.forEach((a, i) => {
    if (badMoney(a.monthlyCents)) e.push({ field: `otherAdults.${i}.monthlyCents`, code: 'amountInvalid' });
  });
  return e;
}

function consent(f: ApplicationForm): FieldError[] {
  const e: FieldError[] = [];
  if (!f.consent.authorize) e.push({ field: 'consent.authorize', code: 'consentRequired' });
  if (!f.consent.certify) e.push({ field: 'consent.certify', code: 'consentRequired' });
  if (!f.signaturePath || f.pendingSignature) {
    const s = validateSignature(f.pendingSignature);
    if (s) e.push({ field: 'signature', code: s });
  }
  if (blank(f.signedName)) e.push({ field: 'signedName', code: 'signedNameRequired' });
  return e;
}

function received(f: ApplicationForm, ctx: ValidateContext): FieldError[] {
  if (ctx.mode !== 'landlord') return [];
  const t = instantOf(f.receivedAt);
  if (Number.isNaN(t)) return [{ field: 'receivedAt', code: 'receivedInvalid' }];
  // One minute of grace for a clock read on another screen.
  if (t > (ctx.now ?? new Date()).getTime() + 60_000) return [{ field: 'receivedAt', code: 'receivedInFuture' }];
  return [];
}

/** Errors + warnings of one part (what "Next" checks). Part 7 re-checks nothing but "Received on". */
export function validateSection(section: FormSection, f: ApplicationForm, ctx: ValidateContext): SectionCheck {
  const now = ctx.now ?? new Date();
  switch (section) {
    case 1:
      return { errors: about(f), warnings: [] };
    case 2:
      return { errors: household(f, now), warnings: [] };
    case 3: {
      const errors = f.residences.flatMap((r, i) => residence(r, i, now));
      const warnings: WarningCode[] = residenceCoverageMonths(f.residences, now) < RESIDENCE_YEARS * 12 ? ['coverShortOfThreeYears'] : [];
      return { errors, warnings };
    }
    case 4:
      return { errors: work(f), warnings: [] };
    case 5:
      return { errors: [], warnings: [] };
    case SIGN_SECTION:
      return { errors: consent(f), warnings: [] };
    default:
      return { errors: received(f, ctx), warnings: [] };
  }
}

/** Whole form at Submit / Save: the first part with an error is where the screen goes back to. */
export function validateForm(f: ApplicationForm, ctx: ValidateContext): { errors: FieldError[]; firstInvalid: FormSection | null; warnings: WarningCode[] } {
  const errors: FieldError[] = [];
  const warnings: WarningCode[] = [];
  let firstInvalid: FormSection | null = null;
  for (const s of SECTIONS) {
    // The landlord may save an application without a signature (paper form, Zillow): part 6 is the applicant's.
    if (s === SIGN_SECTION && ctx.mode === 'landlord') continue;
    const r = validateSection(s, f, ctx);
    if (r.errors.length && firstInvalid == null) firstInvalid = s;
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { errors, firstInvalid, warnings };
}

/** First error message key of a field ('intake:errors.<code>'), for the screen. */
export function errorFor(errors: readonly FieldError[], field: string): ErrorCode | null {
  return errors.find((e) => e.field === field)?.code ?? null;
}
