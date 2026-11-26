/**
 * S-20 screen hook: the rental's checklist (created on first open), edits with autosave, photos, signatures, PDF.
 */
import { File, Paths } from 'expo-file-system';
import { useEffect } from 'react';

import { db, useLive } from '@/db';
import { getApplicant } from '@/db/repos/applicants';
import { getMoveIn } from '@/db/repos/movein';
import { getRental } from '@/db/repos/rentals';
import { withLockSuspended } from '@/features/settings/lockController';
import { files, fileStore } from '@/files';
import { assertAppPath } from '@/files/paths';

import { canExport, isBlankSignature, moveInProgress, strokesToSvg, type MoveInEdit, type SignatureRole, type Stroke } from './model';
import { applyMoveInEdit, draftOf, exportMoveIn, openMoveIn, rentalAddress, signMoveIn, type MoveInFileReader } from './service';

/** Reads saved photos / signature SVGs for the PDF (never logged). */
export const expoMoveInReader: MoveInFileReader = {
  async dataUri(path) {
    try {
      const f = new File(Paths.document, assertAppPath(path));
      if (!f.exists) return null;
      return `data:image/jpeg;base64,${await f.base64()}`;
    } catch {
      return null;
    }
  },
  async text(path) {
    try {
      const f = new File(Paths.document, assertAppPath(path));
      return f.exists ? await f.text() : null;
    } catch {
      return null;
    }
  },
};

export function useMoveIn(rentalId: number, applicantId?: number | null) {
  'use no memo';
  const row = useLive(() => getMoveIn(db, rentalId), [rentalId], ['movein']);
  const rental = useLive(() => getRental(db, rentalId), [rentalId], ['rentals']);
  const tenant = useLive(() => (row?.applicantId != null ? getApplicant(db, row.applicantId) : null), [row?.applicantId], ['applicants']);

  useEffect(() => {
    if (!getMoveIn(db, rentalId) || applicantId != null) openMoveIn(db, rentalId, applicantId ?? null);
  }, [rentalId, applicantId]);

  const draft = row ? draftOf(row) : null;
  return {
    /** null while being created, or when the rental doesn't exist (`rental` null → not-found state). */
    row,
    rental,
    address: rental ? rentalAddress(rental) : '',
    tenantName: tenant?.fullName || null,
    handoverOn: row?.handoverOn ?? null,
    draft,
    progress: draft ? moveInProgress(draft) : null,
    canExport: draft ? canExport(draft) : false,
    /** One edit, saved at once. Ask "Editing clears both signatures. Continue?" first when `hasSignature(draft)`. */
    edit(e: MoveInEdit) {
      const current = getMoveIn(db, rentalId);
      if (!current) return { clearedSignatures: false };
      return applyMoveInEdit(db, fileStore, current.id, current, e);
    },
    /** Photo from the camera / library (uri from the picker) → compressed copy under rentals/{id}/. */
    async addPhoto(room: number, item: number, sourceUri: string) {
      const saved = await files.saveImage({ owner: { rentalId }, kind: 'movein', sourceUri });
      const current = getMoveIn(db, rentalId);
      if (!current) {
        files.deleteFile(saved.path);
        return;
      }
      applyMoveInEdit(db, fileStore, current.id, current, { type: 'addPhoto', room, item, path: saved.path });
    },
    /** Signature pad "Done": blank pads are ignored (returns false). */
    async sign(role: SignatureRole, strokes: readonly Stroke[], size: { width: number; height: number }) {
      if (isBlankSignature(strokes)) return false;
      const svg = strokesToSvg(strokes, size.width, size.height);
      const saved = await files.saveText({ owner: { rentalId }, kind: 'signature', text: svg, ext: 'svg', id: `movein-${role}-${Date.now()}` });
      const current = getMoveIn(db, rentalId);
      if (!current) return false;
      signMoveIn(db, fileStore, current, role, saved.path);
      return true;
    },
    /** "Export PDF" / "Share". */
    exportPdf(includePhotos: boolean) {
      const current = getMoveIn(db, rentalId);
      if (!current) throw new Error('no checklist');
      return withLockSuspended(() => exportMoveIn(db, current, expoMoveInReader, { includePhotos }));
    },
  };
}
