/**
 * Database rows → engine inputs (src/engine). Engine ids are strings: the row id as text ('12'); custom criterion
 * answers are keyed by the criterion row id as text. Screens evaluate with e.g.
 * `evaluateApplicant(toEngineRental(r), toEngineCriteria(rows), toEngineApplicant(bundle))`, or use `loadRentalForEngine`.
 */
import {
  dateOf,
  type ApplicantInput,
  type Criterion as EngineCriterion,
  type DecisionInput,
  type DocumentInput,
  type EmployerReference,
  type LandlordReference,
  type QueueApplicant,
  type RentalInput,
  type Timer as EngineTimer,
} from '@/engine';

import { getApplicantBundle, listApplicants, type ApplicantBundle } from './repos/applicants';
import { listCriteria } from './repos/criteria';
import { getRental } from './repos/rentals';
import type { AppDb, Criterion, Decision, Rental, Timer } from './types';

export const engineId = (id: number) => String(id);

export function toEngineRental(r: Rental): RentalInput {
  return { id: engineId(r.id), rentCents: r.rentCents, bedrooms: r.bedrooms, reviewMode: r.reviewMode, state: r.state };
}

export function toEngineCriteria(rows: readonly Criterion[]): EngineCriterion[] {
  return rows.map((c) => ({ id: engineId(c.id), code: c.code, enabled: c.enabled, order: c.order, params: c.params }) as EngineCriterion);
}

export function toEngineTimers(rows: readonly Timer[]): EngineTimer[] {
  return rows.map((t) => ({ kind: t.kind, startedAt: t.startedAt, endsAt: t.endsAt, resolvedAt: t.resolvedAt }));
}

export function toDecisionInput(d: Decision): DecisionInput {
  return { kind: d.kind, conditions: d.conditions ?? [], reasons: d.reasons ?? [], note: d.note ?? '', reportInfluenced: d.reportInfluenced };
}

/** When the (latest) Conditional offer was made — opens C10 / the Background review. */
export function conditionalOfferAt(decisions: readonly Decision[]): string | null {
  const offers = decisions.filter((d) => d.kind === 'conditional_offer');
  return offers.length ? offers[offers.length - 1].at : null;
}

export function toEngineApplicant(b: ApplicantBundle): ApplicantInput {
  const a = b.applicant;
  const documents: DocumentInput[] = b.documents
    .filter((d) => d.type !== 'paper_form')
    .map((d) => ({
      id: engineId(d.id),
      type: d.type as DocumentInput['type'],
      label: d.label,
      checkedOn: d.checkedAt ? dateOf(d.checkedAt) : null,
      incomeId: d.incomeId === null ? null : engineId(d.incomeId),
      payGrossCents: d.payGrossCents,
      payFrequency: d.payFrequency,
      monthlyCents: d.monthlyCents,
    }));
  const landlordReferences: LandlordReference[] = b.references
    .filter((r) => r.kind === 'landlord' && r.residenceId !== null)
    .map((r) => {
      const x = r.answers ?? {};
      return {
        id: engineId(r.id),
        residenceId: engineId(r.residenceId!),
        ownerConfirmed: r.ownerConfirmed,
        confirmSource: r.confirmSource,
        answeredOn: x.answeredOn ?? null,
        rentedFromYou: x.rentedFromYou ?? null,
        from: x.from ?? null,
        to: x.to ?? null,
        rentCents: x.rentCents ?? null,
        owes: x.owes ?? null,
        owesCents: x.owesCents ?? null,
        rentAgain: x.rentAgain ?? null,
        unreachable: r.unreachable,
        attempts: r.attempts.map((t) => ({ at: t.at, method: t.method, result: t.result })),
      };
    });
  const employerReferences: EmployerReference[] = b.references
    .filter((r) => r.kind === 'employer')
    .map((r) => ({
      id: engineId(r.id),
      incomeId: r.incomeId === null ? null : engineId(r.incomeId),
      employed: r.answers?.employed ?? null,
      since: r.answers?.since ?? null,
      title: r.answers?.title ?? null,
      attempts: r.attempts.map((t) => ({ at: t.at, method: t.method, result: t.result })),
    }));
  const rep = b.report;
  const bg = b.background;
  return {
    id: engineId(a.id),
    fullName: a.fullName,
    receivedAt: a.receivedAt,
    status: a.status,
    conditionalOfferAt: conditionalOfferAt(b.decisions),
    occupants: a.occupants,
    pets: a.pets ? a.pets.map((p) => ({ kind: p.kind, count: p.count })) : null,
    hasVoucher: a.hasVoucher,
    voucherMonthlyCents: a.voucherCents,
    // A residence without its "From" month is an unfinished entry: it can't count as history yet.
    residences: b.residences
      .filter((r) => r.fromMonth)
      .map((r) => ({ id: engineId(r.id), address: r.address, from: r.fromMonth!, to: r.current ? null : r.toMonth, current: r.current, type: r.type ?? 'other', rentCents: r.rentCents })),
    incomes: b.incomes.map((i) => ({ id: engineId(i.id), kind: i.kind, monthlyCents: i.monthlyCents, label: i.employer ?? i.person ?? i.title })),
    documents,
    landlordReferences,
    employerReferences,
    report: rep
      ? {
          id: engineId(rep.id),
          companyName: rep.companyName,
          companyAddress: rep.companyAddress,
          companyPhone: rep.companyPhone,
          reportDate: rep.reportDate,
          evictions: rep.evictions,
          landlordCollectionsCents: rep.landlordCollectionsCents,
          score: rep.score,
          noScore: rep.noScore,
          scoreModel: rep.scoreModel,
          scoreRange: rep.scoreRange,
          scoreDate: rep.scoreDate,
          keyFactors: rep.keyFactors ?? [],
        }
      : null,
    background: bg
      ? {
          noConvictions: bg.noConvictions,
          convictions: (bg.convictions ?? []).filter((c) => !!c.convictedOn),
          reviewedOn: bg.reviewedOn,
          assessment: { seriousness: bg.assessment?.seriousness ?? null, rehabilitation: bg.assessment?.rehabilitation ?? null, other: bg.assessment?.other ?? null },
        }
      : null,
    answers: { evicted: a.answers?.evicted ?? null, bankruptcy: a.answers?.bankruptcy ?? null, smokes: a.answers?.smokes ?? null },
    customAnswers: a.customAnswers ?? {},
    landlordChecks: a.landlordChecks ?? {},
  };
}

/** S-18 queue row (`missingCount` from `evaluateApplicant(...).summary.missingCount`). */
export function toQueueApplicant(b: Pick<ApplicantBundle, 'applicant' | 'timers'>, missingCount: number): QueueApplicant {
  return { id: engineId(b.applicant.id), fullName: b.applicant.fullName, receivedAt: b.applicant.receivedAt, status: b.applicant.status, timers: toEngineTimers(b.timers), missingCount };
}

/** A rental with its criteria and every (submitted, not data-deleted) applicant, ready for the engine (S-09, S-17, S-18, S-19). */
export function loadRentalForEngine(db: AppDb, rentalId: number): { rental: RentalInput; criteria: EngineCriterion[]; applicants: ApplicantInput[]; bundles: ApplicantBundle[] } | null {
  const r = getRental(db, rentalId);
  if (!r) return null;
  const bundles = listApplicants(db, rentalId)
    .map((a) => getApplicantBundle(db, a.id))
    .filter((x): x is ApplicantBundle => x !== null);
  return { rental: toEngineRental(r), criteria: toEngineCriteria(listCriteria(db, rentalId)), applicants: bundles.map(toEngineApplicant), bundles };
}
