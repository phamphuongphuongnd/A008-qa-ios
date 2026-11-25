import { SAMPLE, type Criterion as EngineCriterion, type SampleApplicant, type SampleRental } from '@/engine';

import type { FileStore } from '../files';
import { applicants, attempts, background, decisions, documents, incomes, references, rentals, reports, residences } from '../schema';
import type { AppDb } from '../types';
import { listApplicants, purgeApplicant } from './applicants';
import { saveCriteria } from './criteria';
import { deleteRental, getSampleRental } from './rentals';

/** "Explore with a sample rental" (§8) in the engine's shape — `SAMPLE` from src/engine/fixtures/sample.ts. */
export interface SampleRentalData {
  rental: SampleRental;
  criteria: readonly EngineCriterion[];
  applicants: readonly SampleApplicant[];
}

/**
 * Loads the sample rental (S-01 "Explore with a sample rental", S-21 "Load sample rental") — the same data the engine
 * tests use, so its results are §8's. One transaction; the rental is flagged `isSample`; the fixture's string ids are
 * replaced by row ids (references, documents and custom answers re-linked). Already loaded → returns the existing id.
 * Sample documents have no real file: `filePath` is under 'sample/' (screens show a placeholder thumbnail).
 */
export function loadSampleRental(db: AppDb, data: SampleRentalData = SAMPLE): number {
  const existing = getSampleRental(db);
  if (existing) return existing.id;
  return db.transaction((tx) => {
    const r = data.rental;
    const rentalId = tx
      .insert(rentals)
      .values({
        street: r.street,
        unit: r.unit,
        city: r.city,
        state: r.state,
        zip: r.zip,
        rentCents: r.rentCents,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        availableOn: r.availableOn,
        depositCents: r.depositCents,
        feeCents: r.feeCents,
        reviewMode: r.reviewMode,
        isSample: true,
      })
      .returning({ id: rentals.id })
      .get().id;

    const critIds = saveCriteria(
      tx as unknown as AppDb,
      rentalId,
      data.criteria.map((c) => ({ code: c.code, enabled: c.enabled, order: c.order, params: c.params })),
    );
    const critMap = new Map(data.criteria.map((c, i) => [c.id, String(critIds[i])]));
    const remap = (m: Record<string, boolean | null>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [critMap.get(k) ?? k, v]));

    for (const a of data.applicants) {
      const applicantId = tx
        .insert(applicants)
        .values({
          rentalId,
          receivedAt: a.receivedAt,
          status: a.status,
          source: 'landlord',
          fullName: a.fullName,
          phone: a.phone,
          email: a.email,
          occupants: a.occupants,
          pets: a.pets,
          hasVoucher: a.hasVoucher,
          voucherCents: a.voucherMonthlyCents,
          answers: { ...a.answers },
          customAnswers: remap(a.customAnswers),
          landlordChecks: remap(a.landlordChecks),
          formStep: 7,
        })
        .returning({ id: applicants.id })
        .get().id;

      const resMap = new Map<string, number>();
      a.residences.forEach((x, i) => {
        const id = tx
          .insert(residences)
          .values({ applicantId, order: i, address: x.address, fromMonth: x.from, toMonth: x.to, current: x.current, type: x.type, rentCents: x.rentCents })
          .returning({ id: residences.id })
          .get().id;
        resMap.set(x.id, id);
      });
      const incMap = new Map<string, number>();
      a.incomes.forEach((x, i) => {
        const id = tx
          .insert(incomes)
          .values({ applicantId, order: i, kind: x.kind, monthlyCents: x.monthlyCents, employer: x.kind === 'other_adult' ? null : (x.label ?? null), person: x.kind === 'other_adult' ? (x.label ?? null) : null })
          .returning({ id: incomes.id })
          .get().id;
        incMap.set(x.id, id);
      });
      a.documents.forEach((d, i) => {
        tx.insert(documents)
          .values({
            applicantId,
            type: d.type,
            label: d.label ?? null,
            filePath: `sample/${d.type}-${i + 1}.jpg`,
            mime: 'image/jpeg',
            addedAt: a.receivedAt,
            checkedAt: d.checkedOn,
            incomeId: d.incomeId ? (incMap.get(d.incomeId) ?? null) : null,
            payGrossCents: d.payGrossCents ?? null,
            payFrequency: d.payFrequency ?? null,
            monthlyCents: d.monthlyCents ?? null,
          })
          .run();
      });
      for (const ref of a.landlordReferences) {
        const refId = tx
          .insert(references)
          .values({
            applicantId,
            kind: 'landlord',
            residenceId: resMap.get(ref.residenceId) ?? null,
            ownerConfirmed: ref.ownerConfirmed,
            confirmSource: ref.confirmSource,
            unreachable: ref.unreachable,
            answers: {
              answeredOn: ref.answeredOn,
              rentedFromYou: ref.rentedFromYou,
              from: ref.from,
              to: ref.to,
              rentCents: ref.rentCents,
              owes: ref.owes,
              owesCents: ref.owesCents,
              rentAgain: ref.rentAgain,
            },
          })
          .returning({ id: references.id })
          .get().id;
        for (const t of ref.attempts) tx.insert(attempts).values({ referenceId: refId, at: t.at, method: t.method, result: t.result }).run();
      }
      for (const ref of a.employerReferences) {
        const refId = tx
          .insert(references)
          .values({ applicantId, kind: 'employer', incomeId: ref.incomeId ? (incMap.get(ref.incomeId) ?? null) : null, answers: { employed: ref.employed, since: ref.since, title: ref.title } })
          .returning({ id: references.id })
          .get().id;
        for (const t of ref.attempts) tx.insert(attempts).values({ referenceId: refId, at: t.at, method: t.method, result: t.result }).run();
      }
      if (a.report) {
        const { id: _id, ...rep } = a.report;
        tx.insert(reports).values({ ...rep, applicantId, service: 'mysmartmove' }).run();
      }
      if (a.background) {
        const bg = a.background;
        tx.insert(background).values({ applicantId, noConvictions: bg.noConvictions, convictions: bg.convictions, reviewedOn: bg.reviewedOn, assessment: bg.assessment }).run();
      }
      if (a.conditionalOfferAt) {
        tx.insert(decisions).values({ applicantId, kind: 'conditional_offer', at: a.conditionalOfferAt, reasons: [], conditions: [] }).run();
      }
    }
    return rentalId;
  });
}

/** S-21 "Remove sample rental": the rental, its applicants (no tombstones) and any file made from it. */
export function removeSampleRental(db: AppDb, files: FileStore): void {
  const s = getSampleRental(db);
  if (!s) return;
  for (const a of listApplicants(db, s.id, { drafts: true, deleted: true })) purgeApplicant(db, files, a.id, { keepRecord: false });
  deleteRental(db, files, s.id);
}
