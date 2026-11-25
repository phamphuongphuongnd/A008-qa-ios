/**
 * Where the app keeps its files, as paths RELATIVE to the document directory (the database stores these; an iOS
 * reinstall / restore moves the container, so absolute URIs would break):
 * - `applicants/{applicantId}/…` documents, report PDFs, signature SVGs, letters, paper-form photos — deleted with the
 *   applicant (FTC Disposal Rule);
 * - `rentals/{rentalId}/…` move-in photos and signatures, decision file — deleted with the rental.
 * Pure helpers (no Expo import) so they are unit-tested.
 */

export const FILE_ROOTS = ['applicants', 'rentals'] as const;

export const applicantDir = (applicantId: number) => `applicants/${applicantId}`;
export const rentalDir = (rentalId: number) => `rentals/${rentalId}`;

/** What a file is for — the first part of its name ("doc-12.jpg", "report-3-1.pdf"). */
export type FileKind = 'doc' | 'report' | 'paper' | 'signature' | 'letter' | 'movein' | 'file';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'image/svg+xml': 'svg',
};
const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', pdf: 'application/pdf', svg: 'image/svg+xml' };

/** File extension for a MIME type, else from the original name ("Stub.PDF" → "pdf"), else "bin". */
export function extensionFor(mime?: string | null, originalName?: string | null): string {
  const byMime = mime ? EXT_BY_MIME[mime.toLowerCase()] : undefined;
  if (byMime) return byMime;
  const m = originalName?.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'bin';
}

/** MIME type from a MIME hint or a file name; null when unknown. */
export function mimeFor(mime?: string | null, name?: string | null): string | null {
  if (mime) return mime.toLowerCase();
  const ext = name?.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  return ext ? (MIME_BY_EXT[ext] ?? null) : null;
}

export const isImageMime = (mime: string | null | undefined) => !!mime && mime.startsWith('image/') && mime !== 'image/svg+xml';

/**
 * File name inside an owner folder: `{kind}-{id}.{ext}` when the caller has an id (document row id, letter id), else
 * `{kind}-{stamp}.{ext}` with a time + counter stamp that never repeats within a run. Never contains the person's
 * name (file names show in share sheets and backups).
 */
let counter = 0;
export function fileNameFor(kind: FileKind, ext: string, id?: number | string, now = Date.now()): string {
  const clean = ext.replace(/^\./, '').toLowerCase() || 'bin';
  if (id !== undefined && id !== null && `${id}` !== '') return `${kind}-${String(id).replace(/[^\w-]/g, '')}.${clean}`;
  counter = (counter + 1) % 1296;
  return `${kind}-${now.toString(36)}${counter.toString(36).padStart(2, '0')}.${clean}`;
}

/**
 * A safe relative path under one of FILE_ROOTS: no absolute path, no "..", no backslash, no empty segment.
 * Throws otherwise — a bad path must never delete or overwrite something else.
 */
export function assertAppPath(path: string): string {
  const parts = path.split('/');
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes(':') ||
    parts.some((p) => p === '' || p === '.' || p === '..') ||
    !(FILE_ROOTS as readonly string[]).includes(parts[0])
  ) {
    throw new Error('Invalid app file path');
  }
  return path;
}

export const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;
