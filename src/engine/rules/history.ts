/** C2 Rental history (§3.4), C4 Landlord reference (§3.6), S-11 red flags and "Mark as unreachable". */
import { dateOf, daysBetween, firstDayOf, formatMonth, monthIndex, monthPosition } from '../dates';
import { formatPercentDiff, percentDiff } from '../money';
import type { ApplicantInput, Attempt, CriterionOf, IsoDate, LandlordReference, Residence } from '../types';
import { makeResult, type RuleResult } from './result';

/** Date tolerance at each end when a landlord confirms dates (§3.4, §3.6). */
export const DATE_TOLERANCE_DAYS = 31;
/** Rent tolerance (§3.6): more than 5% apart = Mismatch. */
export const RENT_TOLERANCE_PERCENT = 5;

const COUNTED: ReadonlySet<Residence['type']> = new Set(['rent', 'own']);

/** [start, end) of a Residence on the month line; the current one runs to the date received. */
function span(r: Residence, receivedOn: IsoDate): [number, number] | null {
  const start = monthIndex(r.from);
  const limit = monthPosition(receivedOn);
  const rawEnd = r.current || !r.to ? limit : monthIndex(r.to);
  const end = Math.min(rawEnd, limit);
  return end > start ? [start, end] : null;
}

/** Whole months of Rent / Own history: overlaps merged, rounded down once (§3.4). */
export function rentalHistoryMonths(residences: readonly Residence[], receivedOn: IsoDate): number {
  const spans = residences
    .filter((r) => COUNTED.has(r.type))
    .map((r) => span(r, receivedOn))
    .filter((s): s is [number, number] => s != null)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else {
      if (cur) total += cur[1] - cur[0];
      cur = [s[0], s[1]];
    }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.floor(total + 1e-9);
}

function residenceLength(r: Residence, receivedOn: IsoDate): number {
  const s = span(r, receivedOn);
  return s ? s[1] - s[0] : 0;
}

function endDate(to: string | null, current: boolean, receivedOn: IsoDate): IsoDate | null {
  if (current || to === 'still_there') return receivedOn;
  return to ? firstDayOf(to) : null;
}

export interface DateCheck {
  /** Both ends answered by the landlord. */
  confirmed: boolean;
  mismatch: boolean;
  /** "Landlord says Jan 2023 – now; application says Mar 2022 – now". */
  message: string | null;
}

/** Compares the landlord's from / to with the Residence (≤ 31 days at each end). */
export function compareReferenceDates(r: Residence, ref: LandlordReference | undefined, receivedOn: IsoDate): DateCheck {
  if (!ref || !ref.from || !ref.to) return { confirmed: false, mismatch: false, message: null };
  const resEnd = endDate(r.to, r.current, receivedOn);
  const refEnd = endDate(ref.to, false, receivedOn);
  if (!resEnd || !refEnd) return { confirmed: false, mismatch: false, message: null };
  const fromOff = Math.abs(daysBetween(firstDayOf(r.from), firstDayOf(ref.from)));
  const toOff = Math.abs(daysBetween(resEnd, refEnd));
  const mismatch = fromOff > DATE_TOLERANCE_DAYS || toOff > DATE_TOLERANCE_DAYS;
  const fmt = (from: string, to: string | null, current: boolean) =>
    `${formatMonth(from)} – ${current || to === 'still_there' || !to ? 'now' : formatMonth(to)}`;
  return {
    confirmed: true,
    mismatch,
    message: mismatch
      ? `Landlord says ${fmt(ref.from, ref.to, false)}; application says ${fmt(r.from, r.to, r.current)}`
      : null,
  };
}

/** Rent the landlord gave vs the Application (> 5% apart). */
export function compareReferenceRent(
  r: Residence,
  ref: LandlordReference | undefined,
): { mismatch: boolean; percent: number | null; message: string | null } {
  if (!ref || ref.rentCents == null || r.rentCents == null || r.rentCents <= 0) {
    return { mismatch: false, percent: null, message: null };
  }
  const mismatch = Math.abs(ref.rentCents - r.rentCents) * 100 > RENT_TOLERANCE_PERCENT * r.rentCents;
  const percent = percentDiff(ref.rentCents, r.rentCents);
  return {
    mismatch,
    percent,
    message: mismatch ? `Rent the landlord gave differs from the application (${formatPercentDiff(percent)})` : null,
  };
}

function referenceFor(applicant: ApplicantInput, residenceId: string): LandlordReference | undefined {
  return applicant.landlordReferences.find((x) => x.residenceId === residenceId);
}

export function evaluateRentalHistory(c: CriterionOf<'C2'>, applicant: ApplicantInput, title: string): RuleResult {
  const m = c.params.months;
  const receivedOn = dateOf(applicant.receivedAt);
  const months = rentalHistoryMonths(applicant.residences, receivedOn);
  if (applicant.residences.length === 0 && m > 0) {
    return makeResult(c, title, { outcome: 'missing', reason: 'No residences entered', action: 'edit_application' });
  }
  const counted = applicant.residences.filter((r) => COUNTED.has(r.type));
  const longest = counted
    .slice()
    .sort((a, b) => residenceLength(b, receivedOn) - residenceLength(a, receivedOn))[0];
  const check = longest ? compareReferenceDates(longest, referenceFor(applicant, longest.id), receivedOn) : null;
  const ref = longest ? referenceFor(applicant, longest.id) : undefined;
  const met = months >= m;
  let reason = `${months} months of rental or home-ownership history; required ${m}`;
  if (!met && months === 0) {
    reason = 'No rental or home-ownership history. Consider a co-signer or other evidence — your call';
  }
  return makeResult(c, title, {
    outcome: met ? 'met' : 'not_met',
    evidence: check?.confirmed ? 'verified' : 'claimed',
    source: check?.confirmed ? 'landlord_reference' : 'application',
    verifiedOn: ref?.answeredOn ?? null,
    reason,
    mismatches: check?.mismatch && check.message ? [check.message] : [],
    mismatchAction: 'call_landlord',
    historyMonths: months,
  });
}

/** The Residence whose landlord C4 uses: most recent past rental, else the current one (§3.6). */
export function c4Residence(applicant: ApplicantInput): Residence | null {
  const rentals = applicant.residences.filter((r) => r.type === 'rent');
  const past = rentals
    .filter((r) => !r.current && r.to)
    .sort((a, b) => monthIndex(b.to as string) - monthIndex(a.to as string));
  return past[0] ?? rentals.find((r) => r.current) ?? null;
}

/** ≥ 3 attempts without reaching anyone, by ≥ 2 methods (S-11 "Mark as unreachable"). */
export function canMarkUnreachable(attempts: readonly Attempt[]): boolean {
  const failed = attempts.filter((a) => a.result !== 'reached');
  return failed.length >= 3 && new Set(failed.map((a) => a.method)).size >= 2;
}

export function evaluateLandlordReference(c: CriterionOf<'C4'>, applicant: ApplicantInput, title: string): RuleResult {
  const receivedOn = dateOf(applicant.receivedAt);
  const residence = c4Residence(applicant);
  if (!residence) {
    // TODO(question): §3.6 does not cover applicants with no rented residence (owned / lived with family).
    return makeResult(c, title, {
      outcome: 'needs_review',
      evidence: 'claimed',
      source: 'application',
      reason: 'No previous landlord to call (no rented residence) — your call',
      action: 'edit_application',
    });
  }
  const ref = referenceFor(applicant, residence.id);
  if (!ref || ref.rentAgain == null) {
    const attempts = ref?.attempts.length ?? 0;
    const reason = ref?.unreachable
      ? `Unreachable after ${attempts} attempts`
      : attempts > 0
        ? `Not reached yet (${attempts} attempt${attempts === 1 ? '' : 's'})`
        : `Call the landlord at ${residence.address}`;
    return makeResult(c, title, { outcome: 'missing', reason, action: 'call_landlord' });
  }
  const dates = compareReferenceDates(residence, ref, receivedOn);
  const rent = compareReferenceRent(residence, ref);
  const mismatches = [rent.message, dates.mismatch ? dates.message : null].filter((x): x is string => !!x);
  const outcome = ref.rentAgain === 'yes' ? 'met' : ref.rentAgain === 'no' ? 'not_met' : 'needs_review';
  const reason =
    outcome === 'met'
      ? 'Previous landlord would rent to them again'
      : outcome === 'not_met'
        ? 'Previous landlord would not rent to them again'
        : "Landlord wouldn't say whether they would rent to them again";
  const result = makeResult(c, title, {
    outcome,
    evidence: ref.ownerConfirmed ? 'verified' : 'claimed',
    source: 'landlord_reference',
    verifiedOn: ref.answeredOn,
    reason,
    action: 'call_landlord',
    mismatches,
    mismatchAction: 'call_landlord',
  });
  if (!ref.ownerConfirmed) {
    result.issues.push({
      kind: 'unconfirmed',
      criterionId: c.id,
      code: 'C4',
      outcome,
      message: 'Landlord identity not confirmed',
      action: 'confirm_landlord',
    });
  }
  return result;
}

export type RedFlag = 'dates_mismatch' | 'rent_mismatch' | 'owner_not_confirmed' | 'rent_again_wouldnt_say' | 'gap_over_two_months';

/** S-11 automatic red flags for one reference. */
export function referenceRedFlags(applicant: ApplicantInput, ref: LandlordReference): RedFlag[] {
  const receivedOn = dateOf(applicant.receivedAt);
  const residence = applicant.residences.find((r) => r.id === ref.residenceId);
  const flags: RedFlag[] = [];
  if (residence && compareReferenceDates(residence, ref, receivedOn).mismatch) flags.push('dates_mismatch');
  if (residence && compareReferenceRent(residence, ref).mismatch) flags.push('rent_mismatch');
  if (!ref.ownerConfirmed) flags.push('owner_not_confirmed');
  if (ref.rentAgain === 'wouldnt_say') flags.push('rent_again_wouldnt_say');
  if (residenceGaps(applicant.residences).some((g) => g > 2)) flags.push('gap_over_two_months');
  return flags;
}

/** Gaps in months between consecutive residences (sorted by start). */
export function residenceGaps(residences: readonly Residence[]): number[] {
  const sorted = residences.slice().sort((a, b) => monthIndex(a.from) - monthIndex(b.from));
  const gaps: number[] = [];
  let lastEnd: number | null = null;
  for (const r of sorted) {
    if (lastEnd != null && monthIndex(r.from) > lastEnd) gaps.push(monthIndex(r.from) - lastEnd);
    const end = r.current || !r.to ? Number.POSITIVE_INFINITY : monthIndex(r.to);
    lastEnd = lastEnd == null ? end : Math.max(lastEnd, end);
  }
  return gaps;
}
