import type { FileStore } from '../files';
import { applicants, attempts, documents, incomes, references, rentals, reports, residences } from '../schema';
import type { AppDb, NewApplicant, NewAttempt, NewDocument, NewIncome, NewReference, NewRental, NewReport, NewResidence } from '../types';
import { listApplicants, purgeApplicant } from './applicants';
import { saveCriteria, type CriterionInput } from './criteria';
import { deleteRental, getSampleRental } from './rentals';

/** One applicant of the sample, as database rows (§8). */
export interface SampleApplicantData {
  applicant: Omit<NewApplicant, 'rentalId'>;
  residences?: Omit<NewResidence, 'applicantId'>[];
  incomes?: Omit<NewIncome, 'applicantId'>[];
  /** Sample documents have no real file: `filePath` under 'sample/' (screens show a placeholder thumbnail). */
  documents?: Omit<NewDocument, 'applicantId'>[];
  references?: {
    reference: Omit<NewReference, 'applicantId' | 'residenceId'>;
    /** Index into `residences` for a landlord reference. */
    residenceIndex?: number;
    attempts?: Omit<NewAttempt, 'referenceId'>[];
  }[];
  report?: Omit<NewReport, 'applicantId'>;
}

/** "Explore with a sample rental" (§8): rental + criteria + 4 applicants, as database rows. */
export interface SampleRentalData {
  rental: Omit<NewRental, 'isSample'>;
  criteria: CriterionInput[];
  applicants: SampleApplicantData[];
}

/**
 * The §8 sample as database rows.
 * TODO(merge 1B): build it from 1B's pure fixture `src/engine/fixtures/sample.ts` (same people, numbers and expected
 * results — the engine tests use that fixture). Until the branches are merged there is no sample: returns null.
 */
export function sampleRentalData(): SampleRentalData | null {
  return null;
}

/**
 * Loads the sample rental (S-01 "Explore with a sample rental", S-21 "Load sample rental"). One transaction; the
 * rental is flagged `isSample`. Already loaded → returns the existing id. No data (before the 1B merge) → null.
 */
export function loadSampleRental(db: AppDb, data: SampleRentalData | null = sampleRentalData()): number | null {
  const existing = getSampleRental(db);
  if (existing) return existing.id;
  if (!data) return null;
  return db.transaction((tx) => {
    const rentalId = tx
      .insert(rentals)
      .values({ ...data.rental, isSample: true })
      .returning({ id: rentals.id })
      .get().id;
    saveCriteria(tx as unknown as AppDb, rentalId, data.criteria);
    for (const a of data.applicants) {
      const applicantId = tx
        .insert(applicants)
        .values({ ...a.applicant, rentalId })
        .returning({ id: applicants.id })
        .get().id;
      const resIds = (a.residences ?? []).map(
        (r, i) =>
          tx
            .insert(residences)
            .values({ order: i, ...r, applicantId })
            .returning({ id: residences.id })
            .get().id,
      );
      (a.incomes ?? []).forEach((inc, i) => tx.insert(incomes).values({ order: i, ...inc, applicantId }).run());
      for (const d of a.documents ?? []) tx.insert(documents).values({ ...d, applicantId }).run();
      for (const r of a.references ?? []) {
        const residenceId = r.residenceIndex !== undefined ? (resIds[r.residenceIndex] ?? null) : null;
        const refId = tx
          .insert(references)
          .values({ ...r.reference, applicantId, residenceId })
          .returning({ id: references.id })
          .get().id;
        for (const at of r.attempts ?? []) tx.insert(attempts).values({ ...at, referenceId: refId }).run();
      }
      if (a.report) tx.insert(reports).values({ ...a.report, applicantId }).run();
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
