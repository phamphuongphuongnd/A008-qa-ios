/** S-07 "Print a blank application": load the rental, build the PDF, open the share sheet. */
import type { AppDb } from '@/db/types';
import { blankApplicationFileName, blankApplicationHtml } from '@/pdf/blankApplication';
import { printToPdfAndShare, type PdfAdapter, type PdfShareResult } from '@/pdf/shell';

import { loadIntakeRental } from './rental';

export function blankApplicationForRental(db: AppDb, rentalId: number): { html: string; fileName: string } | null {
  const r = loadIntakeRental(db, rentalId);
  if (!r) return null;
  return {
    html: blankApplicationHtml({
      address: r.address,
      fullAddress: r.fullAddress,
      rentCents: r.rental.rentCents,
      customQuestions: r.customQuestions,
      requiredDocuments: r.requiredLabels,
    }),
    fileName: blankApplicationFileName(rentalId),
  };
}

export async function shareBlankApplication(db: AppDb, rentalId: number, adapter?: PdfAdapter): Promise<PdfShareResult> {
  const doc = blankApplicationForRental(db, rentalId);
  if (!doc) throw new Error('Rental not found');
  return printToPdfAndShare(doc.html, doc.fileName, { adapter });
}
