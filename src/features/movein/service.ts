/**
 * S-20 Move-in checklist data: open (create from the rental + approved applicant on first open), autosave, sign,
 * export. Rows via 1C (`getMoveIn` / `createMoveIn` / `updateMoveIn`); files (photos, signature SVGs) live under
 * rentals/{id}/ via `@/files` and are deleted when an edit drops them.
 */
import { listApplicants } from '@/db/repos/applicants';
import { createMoveIn, getMoveIn, updateMoveIn } from '@/db/repos/movein';
import { getRental } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import type { AppDb, MoveIn, Rental } from '@/db/types';
import type { PdfAdapter, PdfShareResult } from '@/pdf/shell';
import { exportMoveInPdf, type MoveInPdfInput } from '@/pdf/moveIn';

import { bothSigned, droppedFiles, editMoveIn, newDraft, sign, type MoveInDraft, type MoveInEdit, type SignatureRole } from './model';

/** "1428 Maple St, Unit B, Columbus, OH 43215". */
export function rentalAddress(r: Pick<Rental, 'street' | 'unit' | 'city' | 'state' | 'zip'>): string {
  const line1 = [r.street, r.unit].filter(Boolean).join(', ');
  return `${line1}, ${r.city}, ${r.state} ${r.zip}`.trim();
}

export function draftOf(row: MoveIn): MoveInDraft {
  return {
    rooms: row.rooms ?? [],
    meters: row.meters ?? {},
    keys: row.keys ?? null,
    alarmsTested: row.alarmsTested ?? null,
    signatures: row.signatures ?? {},
  };
}

/** Approved applicants of the rental — who a checklist can be for (newest decision first is the hub's concern). */
export function moveInTenants(db: AppDb, rentalId: number) {
  return listApplicants(db, rentalId).filter((a) => a.status === 'approved');
}

/**
 * The rental's checklist id, creating it on first open: rooms from bedrooms / bathrooms, tenant = `applicantId`
 * (or the only approved applicant), move-in date = their move-in date, else the rental's available date.
 * null when the rental doesn't exist.
 */
export function openMoveIn(db: AppDb, rentalId: number, applicantId?: number | null): number | null {
  const existing = getMoveIn(db, rentalId);
  if (existing) {
    if (applicantId != null && existing.applicantId == null) updateMoveIn(db, existing.id, { applicantId });
    return existing.id;
  }
  const rental = getRental(db, rentalId);
  if (!rental) return null;
  const approved = moveInTenants(db, rentalId);
  const tenant = applicantId != null ? approved.find((a) => a.id === applicantId) : approved.length === 1 ? approved[0] : undefined;
  const d = newDraft(rental.bedrooms, rental.bathrooms);
  return createMoveIn(db, {
    rentalId,
    applicantId: tenant?.id ?? null,
    handoverOn: tenant?.moveInOn ?? rental.availableOn ?? null,
    rooms: d.rooms,
    meters: d.meters,
    keys: d.keys,
    alarmsTested: d.alarmsTested,
    signatures: d.signatures,
  });
}

export interface FileDeleter {
  deleteFile(path: string): void;
}

function save(db: AppDb, id: number, d: MoveInDraft, at?: string) {
  updateMoveIn(db, id, { rooms: d.rooms, meters: d.meters, keys: d.keys, alarmsTested: d.alarmsTested, signatures: d.signatures, doneAt: bothSigned(d) ? (at ?? new Date().toISOString()) : null }, at);
}

/** Autosave of one edit ("can be done in parts and continued"). Returns whether signatures were cleared. */
export function applyMoveInEdit(db: AppDb, files: FileDeleter, id: number, row: MoveIn, e: MoveInEdit, at?: string): { clearedSignatures: boolean } {
  const before = draftOf(row);
  const { draft, clearedSignatures } = editMoveIn(before, e);
  save(db, id, draft, at);
  for (const p of droppedFiles(before, draft)) files.deleteFile(p);
  return { clearedSignatures };
}

/** Stores a signature (its SVG already saved under rentals/{id}/); replaces and deletes an older one. */
export function signMoveIn(db: AppDb, files: FileDeleter, row: MoveIn, role: SignatureRole, path: string, at: string = new Date().toISOString()): void {
  const before = draftOf(row);
  const after = sign(before, role, path, at);
  save(db, row.id, after, at);
  for (const p of droppedFiles(before, after)) files.deleteFile(p);
}

/** What the PDF needs, the files read through `read` (data URI for photos, SVG text for signatures). */
export interface MoveInFileReader {
  dataUri(path: string): Promise<string | null>;
  text(path: string): Promise<string | null>;
}

export async function moveInPdfInput(db: AppDb, row: MoveIn, read: MoveInFileReader, opts: { includePhotos: boolean }): Promise<{ input: MoveInPdfInput; street: string }> {
  const rental = getRental(db, row.rentalId);
  if (!rental) throw new Error('rental missing');
  const tenant = row.applicantId != null ? listApplicants(db, row.rentalId).find((a) => a.id === row.applicantId) : undefined;
  const d = draftOf(row);
  const photos: Record<string, string> = {};
  if (opts.includePhotos) {
    for (const p of d.rooms.flatMap((r) => r.items.flatMap((i) => i.photoPaths ?? []))) {
      const uri = await read.dataUri(p);
      if (uri) photos[p] = uri;
    }
  }
  const svg = async (role: SignatureRole) => (d.signatures[role]?.path ? read.text(d.signatures[role]!.path) : null);
  return {
    street: [rental.street, rental.unit].filter(Boolean).join(' '),
    input: {
      address: rentalAddress(rental),
      tenantName: tenant?.fullName || null,
      handoverOn: row.handoverOn,
      draft: d,
      signatureSvg: { landlord: await svg('landlord'), tenant: await svg('tenant') },
      photos: opts.includePhotos ? photos : undefined,
      landlordName: getSettings(db).landlordName || null,
    },
  };
}

/** "Export PDF" / "Share" (both signatures required — the button is disabled otherwise). */
export async function exportMoveIn(db: AppDb, row: MoveIn, read: MoveInFileReader, opts: { includePhotos: boolean; adapter?: PdfAdapter }): Promise<PdfShareResult> {
  if (!bothSigned(draftOf(row))) throw new Error('both signatures needed');
  const { input, street } = await moveInPdfInput(db, row, read, opts);
  return exportMoveInPdf(input, street, opts.adapter);
}
