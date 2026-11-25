/**
 * Saving / deleting the app's files (documents, photos, report PDFs, signatures, letters), shared by every feature.
 * Platform work goes through a small `FileAdapter` (./native.ts on the phone, a fake in Jest), so the rules here are
 * tested: compress photos, name by id, stay inside the app folders, delete with their owner.
 * Never log file contents or paths with names in them (applicant data).
 */
import { applicantDir, assertAppPath, extensionFor, fileNameFor, isImageMime, joinPath, mimeFor, rentalDir, type FileKind } from './paths';

/** Platform operations, all on paths relative to the document directory (except picker / cache URIs as sources). */
export interface FileAdapter {
  /** Copies a picker / camera / cache URI to `dest` (parent folders created, existing file replaced). */
  copy(sourceUri: string, dest: string): Promise<void>;
  /** Moves a cache URI (our own temporary file) to `dest`. */
  move(sourceUri: string, dest: string): Promise<void>;
  writeText(dest: string, text: string): Promise<void>;
  /** Downscales to fit `maxSize` × `maxSize` and re-encodes as JPEG; returns a temporary file. */
  compressImage(sourceUri: string, opts: { maxSize: number; quality: number }): Promise<{ uri: string; width: number; height: number }>;
  deleteFile(path: string): void;
  deleteDir(path: string): void;
  exists(path: string): boolean;
  /** file:// URI of a stored path (for <Image>, sharing, printing). */
  uri(path: string): string;
}

/** Who a file belongs to: deleted with them. */
export type FileOwner = { applicantId: number } | { rentalId: number };

const ownerDir = (o: FileOwner) => ('applicantId' in o ? applicantDir(o.applicantId) : rentalDir(o.rentalId));

export interface SavedFile {
  /** Relative path to store in the database. */
  path: string;
  mime: string;
  width?: number;
  height?: number;
}

export interface SaveOptions {
  owner: FileOwner;
  kind: FileKind;
  /** Picker / camera URI. */
  sourceUri: string;
  /** From the picker (`mimeType`), if known. */
  mime?: string | null;
  /** Original file name (to guess the type). Not used in the stored name. */
  name?: string | null;
  /** Name the file by this id ("doc-12.jpg") — e.g. the document row id. Default: a unique stamp. */
  id?: number | string;
}

/** Photos are stored at most 2000 px on the long side, JPEG 70 % — readable pay stubs at ~300–600 KB. */
export const IMAGE_MAX_SIZE = 2000;
export const IMAGE_QUALITY = 0.7;

export function makeFiles(a: FileAdapter) {
  /** A photo (camera / library): downscaled + JPEG, then moved into the owner's folder. */
  async function saveImage(o: Omit<SaveOptions, 'mime' | 'name'> & { maxSize?: number; quality?: number }): Promise<SavedFile> {
    const img = await a.compressImage(o.sourceUri, { maxSize: o.maxSize ?? IMAGE_MAX_SIZE, quality: o.quality ?? IMAGE_QUALITY });
    const path = assertAppPath(joinPath(ownerDir(o.owner), fileNameFor(o.kind, 'jpg', o.id)));
    await a.move(img.uri, path);
    return { path, mime: 'image/jpeg', width: img.width, height: img.height };
  }

  /** Any file kept as it is (a PDF from the document picker, a generated letter). */
  async function saveCopy(o: SaveOptions): Promise<SavedFile> {
    const mime = mimeFor(o.mime, o.name) ?? 'application/octet-stream';
    const path = assertAppPath(joinPath(ownerDir(o.owner), fileNameFor(o.kind, extensionFor(mime, o.name), o.id)));
    await a.copy(o.sourceUri, path);
    return { path, mime };
  }

  /**
   * What S-10 / S-13 / S-20 "+ Add" call with a picker result: images are compressed, PDFs and other files copied.
   * Returns the relative path + MIME type for the `documents` / `reports` row.
   */
  function saveAttachment(o: SaveOptions): Promise<SavedFile> {
    const mime = mimeFor(o.mime, o.name);
    return isImageMime(mime) ? saveImage(o) : saveCopy(o);
  }

  /** Text file in the owner's folder (signature SVG from `signatureToSvg`). */
  async function saveText(o: { owner: FileOwner; kind: FileKind; text: string; ext: string; id?: number | string }): Promise<SavedFile> {
    const path = assertAppPath(joinPath(ownerDir(o.owner), fileNameFor(o.kind, o.ext, o.id)));
    await a.writeText(path, o.text);
    return { path, mime: mimeFor(null, path) ?? 'text/plain' };
  }

  return {
    saveImage,
    saveCopy,
    saveAttachment,
    saveText,
    /** Deletes one stored file (missing is fine). */
    deleteFile: (path: string) => a.deleteFile(assertAppPath(path)),
    /** Deletes an owner folder and everything in it. */
    deleteOwner: (o: FileOwner) => a.deleteDir(ownerDir(o)),
    exists: (path: string) => a.exists(assertAppPath(path)),
    uri: (path: string) => a.uri(assertAppPath(path)),
    /**
     * For the database repositories (`purgeApplicant(db, fileStore, id)`): same checks. A sample rental's document
     * paths ('sample/…') have no file and are skipped.
     */
    fileStore: {
      deleteFile(path: string) {
        if (path.startsWith('sample/')) return;
        a.deleteFile(assertAppPath(path));
      },
      deleteDir(path: string) {
        a.deleteDir(assertAppPath(path));
      },
    },
  };
}

export type AppFiles = ReturnType<typeof makeFiles>;
