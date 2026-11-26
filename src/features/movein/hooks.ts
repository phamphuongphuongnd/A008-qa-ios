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
import type { SignatureValue } from '@/ui';

import { canExport, moveInProgress, signaturePathToSvg, svgPathData, type MoveInEdit, type SignatureRole } from './model';
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
    /** Signature pad "Done" (value from the UI kit's SignaturePad); an empty pad is ignored (returns false). */
    async sign(role: SignatureRole, value: SignatureValue | null) {
      if (!value || !value.path.trim()) return false;
      const svg = signaturePathToSvg(value.path, value.width, value.height);
      const saved = await files.saveText({ owner: { rentalId }, kind: 'signature', text: svg, ext: 'svg', id: `movein-${role}-${Date.now()}` });
      const current = getMoveIn(db, rentalId);
      if (!current) return false;
      signMoveIn(db, fileStore, current, role, saved.path);
      return true;
    },
    /** Stored signature as path data to draw it again (null while unsigned / unreadable). */
    signatureShape(role: SignatureRole) {
      const p = draft?.signatures[role]?.path;
      if (!p) return null;
      try {
        const f = new File(Paths.document, assertAppPath(p));
        return f.exists ? svgPathData(f.textSync()) : null;
      } catch {
        return null;
      }
    },
    /** "Export PDF" / "Share". */
    exportPdf(includePhotos: boolean) {
      const current = getMoveIn(db, rentalId);
      if (!current) throw new Error('no checklist');
      return withLockSuspended(() => exportMoveIn(db, current, expoMoveInReader, { includePhotos }));
    },
  };
}
