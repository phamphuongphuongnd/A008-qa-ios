/**
 * Live data hooks of intake screens ('use no memo': fact react-compiler-use-no-memo — the compiler would freeze the
 * query result). Each re-runs when its tables change.
 */
import { useLive } from '@/db/useLive';
import { getApplicant, listIncomes } from '@/db/repos/applicants';
import type { AppDb, DocumentRow } from '@/db/types';

import { documentCounts, documentSlots, listApplicantDocuments, paperFormPhotos } from '../documents/service';
import { loadIntakeRental, type IntakeRental } from '../rental';

/** S-07 / S-08a / S-08 part 5 / S-10: the rental's address, custom questions, required documents. */
export function useIntakeRental(db: AppDb, rentalId: number | null): IntakeRental | null {
  'use no memo';
  return useLive(() => (rentalId == null ? null : loadIntakeRental(db, rentalId)), [db, rentalId], ['rentals', 'criteria']);
}

/** S-10: the applicant, their required-document slots, other files, income lines (for the income check). */
export function useApplicantDocuments(db: AppDb, applicantId: number | null) {
  'use no memo';
  return useLive(
    () => {
      if (applicantId == null) return null;
      const applicant = getApplicant(db, applicantId);
      if (!applicant || applicant.deletedAt) return null;
      const rental = loadIntakeRental(db, applicant.rentalId);
      const rows = listApplicantDocuments(db, applicantId);
      const required = rental?.requiredDocuments ?? [];
      return {
        applicant,
        rental,
        ...documentSlots(required, rows),
        counts: documentCounts(required, rows),
        incomes: listIncomes(db, applicantId),
        paperPhotos: paperFormPhotos(rows),
      };
    },
    [db, applicantId],
    ['applicants', 'documents', 'incomes', 'criteria', 'rentals'],
  );
}

/** S-08 part 7 (landlord): photos of the paper form. */
export function usePaperPhotos(db: AppDb, applicantId: number | null): DocumentRow[] {
  'use no memo';
  return useLive(() => (applicantId == null ? [] : paperFormPhotos(listApplicantDocuments(db, applicantId))), [db, applicantId], ['documents']);
}
