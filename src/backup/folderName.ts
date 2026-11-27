/**
 * The backup folder's name as S-22 shows it ("Folder: Documents"). Android SAF gives document ids like
 * "primary:Documents/Evenlease" (volume:path) as the folder's name — B-76 showed "Folder: primary:Documents" — and
 * Google Drive gives opaque ids ("acc=6;doc=encoded=…", B-102): there the provider's display name (modules/
 * android-folders) is used, else "Google Drive folder". A raw id is never shown.
 */
import { t } from '@/i18n';

/** volume:path, e.g. "primary:Documents", "1A2B-3C4D:Backups/Evenlease", "primary:" (volume root). */
const SAF_DOC_ID = /^([A-Za-z0-9-]+):(.*)$/;

function fromDocId(id: string): string | null {
  const m = SAF_DOC_ID.exec(id);
  if (!m) return null;
  const path = m[2].replace(/\/+$/, '');
  if (!path) return m[1].toLowerCase() === 'primary' ? t('system:s22.internalStorage') : m[1];
  return path.split('/').pop() || null;
}

/** An id no person should read: Drive "acc=6;doc=encoded=…", or still %-encoded. */
const looksRaw = (s: string) => /[;=]/.test(s) || /%[0-9a-f]{2}/i.test(s);

const isDriveUri = (uri: string | null | undefined) => !!uri && /^content:\/\/com\.google\.android\.apps\.docs\./.test(uri);

/** What to show when the real name can't be read. */
const unnamed = (uri?: string | null) => (isDriveUri(uri) || !uri ? t('system:s22.driveFolder') : t('system:s22.chosenFolder'));

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Label for a picked folder: the provider's display name when there is one (B-102), else its name when readable, else
 * from the SAF tree uri (…/tree/primary%3ADocuments), else "Google Drive folder" / "Chosen folder".
 */
export function folderLabel(uri: string, name?: string | null, displayName?: string | null): string {
  const shown = displayName?.trim();
  if (shown) return shown; // the provider's own name: trust it as is
  if (name && !looksRaw(name)) return fromDocId(name) ?? name;
  const decoded = decode(uri);
  const tree = decoded.split('/tree/')[1]?.split('/document/')[0];
  const fromTree = tree && !looksRaw(tree) ? fromDocId(tree) : null;
  if (fromTree) return fromTree;
  const last = decoded.split(/[/:]/).filter(Boolean).pop();
  return last && !looksRaw(last) && !isDriveUri(uri) ? last : unnamed(uri);
}

/** A label saved by an older version ("primary:Documents", a Drive id) shown the readable way. */
export function readableFolderLabel(label: string, uri?: string | null): string {
  if (looksRaw(label)) return unnamed(uri ?? null);
  return fromDocId(label) ?? label;
}
