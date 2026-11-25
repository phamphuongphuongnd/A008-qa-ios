/**
 * Applicant files (documents, report PDFs, signatures, letters) live under the app's document directory at
 * `applicants/{applicantId}/…`; rental-level files (move-in photos, decision file) under `rentals/{rentalId}/…`.
 * The database stores these RELATIVE paths (an iOS reinstall / restore moves the container).
 * Repositories delete files through a FileStore so the Disposal Rule delete is testable without a phone.
 */
export interface FileStore {
  /** Deletes one file; missing is fine. `path` is relative to the document directory. */
  deleteFile(path: string): void;
  /** Deletes a folder and everything in it; missing is fine. */
  deleteDir(path: string): void;
}

export const applicantDir = (applicantId: number) => `applicants/${applicantId}`;
export const rentalDir = (rentalId: number) => `rentals/${rentalId}`;
/** Root folders the app writes to (Delete all data removes them). */
export const FILE_ROOTS = ['applicants', 'rentals'] as const;
