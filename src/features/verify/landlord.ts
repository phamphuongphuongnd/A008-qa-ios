/**
 * S-11 Landlord reference call sheet (one per Residence) — pure form logic: DB row ↔ form, validation, the patch to
 * save, live red flags (engine `referenceRedFlags`), "Search county records" link, verification email (mailto).
 * Rules: product.md §3.4, §3.6, §3.7, §5 S-11. The engine decides outcomes; nothing here scores.
 */
import {
  canMarkUnreachable,
  compareReferenceDates,
  compareReferenceRent,
  dateOf,
  formatPercentDiff,
  formatUsd,
  referenceRedFlags,
  type Answer3,
  type ApplicantInput,
  type Attempt,
  type ConfirmSource,
  type LandlordReference,
  type RedFlag,
  type YearMonth,
} from '@/engine';
import type { ReferenceAnswers } from '@/db/model';
import type { NewReference, Patch, Reference } from '@/db/types';
import { t } from '@/i18n';

import { isMonth, monthText, moneyInputText, parseMoneyInput, type FieldError } from './common';

export type PaidOnTime = NonNullable<ReferenceAnswers['paidOnTime']>;
export type LeftUnit = NonNullable<ReferenceAnswers['leftUnit']>;
export type ProperNotice = NonNullable<ReferenceAnswers['properNotice']>;

export const CONFIRM_SOURCES: readonly ConfirmSource[] = ['county_records', 'management_website', 'lease_shown', 'other'];
export const ANSWER3: readonly Answer3[] = ['yes', 'no', 'wouldnt_say'];
export const PAID_ON_TIME: readonly PaidOnTime[] = ['always', 'mostly', 'often_late', 'wouldnt_say'];
export const LEFT_UNIT: readonly LeftUnit[] = ['good', 'normal_wear', 'damage', 'still_living', 'wouldnt_say'];
export const PROPER_NOTICE: readonly ProperNotice[] = ['yes', 'no', 'still_living', 'wouldnt_say'];

/** Editable state of the S-11 sheet. Money fields stay text until saved (validated on blur / Save). */
export interface LandlordForm {
  /** Who the landlord actually reached (found in county records…), not necessarily the number on the application. */
  contactName: string;
  contactPhone: string;
  ownerConfirmed: boolean;
  confirmSource: ConfirmSource | null;
  /** Q1 */
  rentedFromYou: Answer3 | null;
  /** Q2 */
  from: YearMonth | null;
  to: YearMonth | 'still_there' | null;
  /** Q3 */
  rentText: string;
  /** Q4 */
  paidOnTime: PaidOnTime | null;
  /** Q5 */
  violations: 'yes' | 'no' | null;
  violationsNote: string;
  /** Q6 */
  leftUnit: LeftUnit | null;
  /** Q7 */
  properNotice: ProperNotice | null;
  /** Q8 */
  owes: Answer3 | null;
  owesText: string;
  /** Q9 */
  rentAgain: Answer3 | null;
  rentAgainWhy: string;
  notes: string;
}

export type LandlordField = keyof LandlordForm;

export function emptyLandlordForm(): LandlordForm {
  return {
    contactName: '',
    contactPhone: '',
    ownerConfirmed: false,
    confirmSource: null,
    rentedFromYou: null,
    from: null,
    to: null,
    rentText: '',
    paidOnTime: null,
    violations: null,
    violationsNote: '',
    leftUnit: null,
    properNotice: null,
    owes: null,
    owesText: '',
    rentAgain: null,
    rentAgainWhy: '',
    notes: '',
  };
}

/** The application's landlord name / phone prefill the contact (the sheet still asks to look the owner up). */
export function toLandlordForm(ref: Reference | null, prefill?: { landlordName?: string | null; landlordPhone?: string | null }): LandlordForm {
  const f = emptyLandlordForm();
  if (!ref) return { ...f, contactName: prefill?.landlordName ?? '', contactPhone: prefill?.landlordPhone ?? '' };
  const a = ref.answers ?? {};
  return {
    contactName: ref.contactName ?? prefill?.landlordName ?? '',
    contactPhone: ref.contactPhone ?? prefill?.landlordPhone ?? '',
    ownerConfirmed: ref.ownerConfirmed,
    confirmSource: ref.confirmSource,
    rentedFromYou: a.rentedFromYou ?? null,
    from: a.from ?? null,
    to: a.to ?? null,
    rentText: moneyInputText(a.rentCents),
    paidOnTime: a.paidOnTime ?? null,
    violations: a.violations ?? null,
    violationsNote: a.violationsNote ?? '',
    leftUnit: a.leftUnit ?? null,
    properNotice: a.properNotice ?? null,
    owes: a.owes ?? null,
    owesText: moneyInputText(a.owesCents),
    rentAgain: a.rentAgain ?? null,
    rentAgainWhy: a.rentAgainWhy ?? '',
    notes: ref.notes ?? '',
  };
}

/** Field errors in screen order (Save scrolls to the first one). Unanswered questions are fine: a call can be partial. */
export function validateLandlordForm(f: LandlordForm): FieldError<LandlordField>[] {
  const errors: FieldError<LandlordField>[] = [];
  if (f.ownerConfirmed && !f.confirmSource) errors.push({ field: 'confirmSource', code: 'required' });
  if (f.from && !isMonth(f.from)) errors.push({ field: 'from', code: 'month_invalid' });
  if (f.to && f.to !== 'still_there' && !isMonth(f.to)) errors.push({ field: 'to', code: 'month_invalid' });
  if (isMonth(f.from) && isMonth(f.to) && f.to < f.from) errors.push({ field: 'to', code: 'range_order' });
  const rent = parseMoneyInput(f.rentText);
  if (Number.isNaN(rent)) errors.push({ field: 'rentText', code: 'money_invalid' });
  if (f.owes === 'yes') {
    const owes = parseMoneyInput(f.owesText);
    if (owes === null) errors.push({ field: 'owesText', code: 'required' });
    else if (Number.isNaN(owes)) errors.push({ field: 'owesText', code: 'money_invalid' });
    else if (owes === 0) errors.push({ field: 'owesText', code: 'money_zero' });
  }
  return errors;
}

function formAnswers(f: LandlordForm): Omit<ReferenceAnswers, 'answeredOn'> {
  const rent = parseMoneyInput(f.rentText);
  const owes = f.owes === 'yes' ? parseMoneyInput(f.owesText) : null;
  return {
    rentedFromYou: f.rentedFromYou,
    from: isMonth(f.from) ? f.from : null,
    to: f.to === 'still_there' || isMonth(f.to) ? f.to : null,
    rentCents: rent === null || Number.isNaN(rent) ? null : rent,
    paidOnTime: f.paidOnTime,
    violations: f.violations,
    violationsNote: f.violations === 'yes' ? f.violationsNote.trim() || null : null,
    leftUnit: f.leftUnit,
    properNotice: f.properNotice,
    owes: f.owes,
    owesCents: owes === null || Number.isNaN(owes) ? null : owes,
    rentAgain: f.rentAgain,
    rentAgainWhy: f.rentAgain && f.rentAgain !== 'yes' ? f.rentAgainWhy.trim() || null : null,
  };
}

const sameAnswers = (a: object, b: object) =>
  JSON.stringify(Object.entries(a).filter(([, v]) => v != null).sort()) === JSON.stringify(Object.entries(b).filter(([, v]) => v != null).sort());

/**
 * DB patch for `updateReference`. `answeredOn` (the evidence date, product.md §3.1 "nguồn + ngày") becomes `today`
 * when the landlord's answers change, stays as it was otherwise, and is cleared when every answer is blank.
 */
export function landlordPatch(f: LandlordForm, previous: Reference | null, today: string): Patch<Omit<NewReference, 'applicantId'>> {
  const answers = formAnswers(f);
  const { answeredOn: prevOn, ...prev } = previous?.answers ?? {};
  const any = Object.values(answers).some((v) => v != null);
  const answeredOn = !any ? null : sameAnswers(answers, prev) && prevOn ? prevOn : today;
  return {
    contactName: f.contactName.trim() || null,
    contactPhone: f.contactPhone.trim() || null,
    ownerConfirmed: f.ownerConfirmed,
    confirmSource: f.confirmSource,
    answers: { ...answers, answeredOn },
    notes: f.notes.trim() || null,
  };
}

/** The form as the engine's `LandlordReference` (live red flags before Save). */
export function draftEngineReference(f: LandlordForm, base: { id: string; residenceId: string; unreachable: boolean; attempts: Attempt[] }, today: string): LandlordReference {
  const a = formAnswers(f);
  return {
    ...base,
    ownerConfirmed: f.ownerConfirmed,
    confirmSource: f.confirmSource,
    answeredOn: today,
    rentedFromYou: a.rentedFromYou ?? null,
    from: a.from ?? null,
    to: a.to ?? null,
    rentCents: a.rentCents ?? null,
    owes: a.owes ?? null,
    owesCents: a.owesCents ?? null,
    rentAgain: a.rentAgain ?? null,
  };
}

export interface RedFlagView {
  code: RedFlag;
  /** English line for the orange card ("Rent differs by more than 5% (+29%)"). */
  text: string;
  /** Dates flag: "Landlord says Jan 2023 – now; application says Mar 2022 – now". */
  detail?: string;
}

/** S-11 red flags (orange card) for a reference — engine rules, worded from `verify:redFlags.*`. */
export function redFlagViews(applicant: ApplicantInput, ref: LandlordReference): RedFlagView[] {
  const residence = applicant.residences.find((r) => r.id === ref.residenceId);
  return referenceRedFlags(applicant, ref).map((code) => {
    if (code === 'rent_mismatch' && residence) {
      const pct = compareReferenceRent(residence, ref).percent;
      return { code, text: t('verify:redFlags.rent_mismatch', { percent: pct == null ? '' : formatPercentDiff(pct) }) };
    }
    if (code === 'dates_mismatch' && residence) {
      const check = compareReferenceDates(residence, ref, dateOf(applicant.receivedAt));
      return { code, text: t('verify:redFlags.dates_mismatch'), ...(check.message ? { detail: check.message } : {}) };
    }
    return { code, text: t(`verify:redFlags.${code}`) };
  });
}

/** Attempts summary for the "Mark as unreachable" card (engine rule: ≥ 3 failed tries by ≥ 2 methods). */
export function unreachableState(attempts: readonly Attempt[], unreachable: boolean) {
  const failed = attempts.filter((a) => a.result !== 'reached');
  return {
    unreachable,
    canMark: !unreachable && canMarkUnreachable(attempts),
    failedCount: failed.length,
    methodCount: new Set(failed.map((a) => a.method)).size,
    reached: attempts.some((a) => a.result === 'reached'),
  };
}

/**
 * "Search county records": opens a plain web search, built only from the Residence address (no applicant name, never
 * sent anywhere by the app). product.md asks for "{county} {state} property records {address}"; the application stores
 * one address line (city + state included, no county), so the query is "{address} county property records".
 */
export function countyRecordsSearchUrl(address: string): string {
  const q = `${address.trim()} county property records`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
  /** `mailto:` link for Linking.openURL — the mail app opens; Evenlease sends nothing. */
  url: string;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * "Email a verification request": the structured questions as a plain email. Uses the applicant's name and the
 * Residence address only — the minimum the past landlord needs. Dates / rent the applicant stated are NOT included,
 * so the landlord answers from their own records.
 */
export function landlordEmailDraft(input: { to: string | null; applicantName: string; address: string; landlordName?: string | null }): MailDraft {
  const name = input.applicantName.trim();
  const subject = t('verify:email.landlord.subject', { name, address: input.address });
  const questions = (t('verify:email.landlord.questions', { returnObjects: true, name, address: input.address }) as unknown as string[]).map(
    (q, i) => `${i + 1}. ${q}`,
  );
  const body = [
    input.landlordName?.trim() ? t('verify:email.greetingName', { name: input.landlordName.trim() }) : t('verify:email.greeting'),
    '',
    t('verify:email.landlord.intro', { name, address: input.address }),
    '',
    ...questions,
    '',
    t('verify:email.thanks'),
  ].join('\n');
  const to = input.to?.trim() ?? '';
  return { to, subject, body, url: mailtoUrl(to, subject, body) };
}

/** Q2 shown back ("Jan 2023 – Still there"). */
export function referencePeriodText(from: YearMonth | null, to: YearMonth | 'still_there' | null): string {
  if (!from && !to) return '';
  const end = to === 'still_there' ? t('verify:landlord.q2Still') : monthText(to);
  return `${monthText(from)} – ${end}`;
}

/** Q8 amount shown back. */
export const owesText = (cents: number | null | undefined) => (cents ? formatUsd(cents) : '');
