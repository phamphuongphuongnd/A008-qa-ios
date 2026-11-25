/**
 * The deletes repositories need (purge an applicant, delete a rental, delete all). The phone's implementation is
 * `fileStore` from `@/files`; tests use `makeTestFiles()`.
 */
export interface FileStore {
  /** Deletes one file; missing is fine. `path` is relative to the document directory. */
  deleteFile(path: string): void;
  /** Deletes a folder and everything in it; missing is fine. */
  deleteDir(path: string): void;
}

export { applicantDir, FILE_ROOTS, rentalDir } from '@/files/paths';
