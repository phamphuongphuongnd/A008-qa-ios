/**
 * The backup folder's name as S-22 shows it ("Folder: Documents"). Android SAF gives document ids like
 * "primary:Documents/Evenlease" (volume:path) as the folder's name — B-76 showed "Folder: primary:Documents".
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

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Label for a picked folder: its name when readable, else from the SAF tree uri (…/tree/primary%3ADocuments). */
export function folderLabel(uri: string, name?: string | null): string {
  if (name && !name.includes(';') && !name.includes('%')) return fromDocId(name) ?? name;
  const decoded = decode(uri);
  const tree = decoded.split('/tree/')[1]?.split('/document/')[0];
  const fromTree = tree ? fromDocId(tree) : null;
  if (fromTree) return fromTree;
  return decoded.split(/[/:]/).filter(Boolean).pop() ?? uri;
}

/** A label saved by an older version ("primary:Documents") shown the readable way. */
export function readableFolderLabel(label: string): string {
  return fromDocId(label) ?? label;
}
