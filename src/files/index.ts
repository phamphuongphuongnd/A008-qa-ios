/**
 * App files (src/files): `files.saveAttachment({ owner: { applicantId }, kind: 'doc', sourceUri, mime, name, id })`
 * → `{ path, mime }` for the database; `files.uri(path)` to show it; `fileStore` for the repositories' deletes
 * (`purgeApplicant(db, fileStore, id)`). Paths are relative to the document directory (see ./paths.ts).
 */
import { makeFiles } from './files';
import { expoFileAdapter } from './native';

export const files = makeFiles(expoFileAdapter);
export const fileStore = files.fileStore;
export { makeFiles, IMAGE_MAX_SIZE, IMAGE_QUALITY, type AppFiles, type FileAdapter, type FileOwner, type SavedFile, type SaveOptions } from './files';
export * from './paths';
