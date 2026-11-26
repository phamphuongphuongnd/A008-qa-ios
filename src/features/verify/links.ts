/**
 * Outside links and file picking for S-11 / S-13, behind a tiny adapter so Jest never loads native modules
 * (the phone's adapter is ./native.ts). Opening a link sends nothing: only https pages and `mailto:` drafts.
 */
import { isSafeWebUrl } from './common';
import type { PickedFile } from './service';

export type PickSource = 'camera' | 'photos' | 'files';

export type PickResult = { status: 'picked'; files: PickedFile[] } | { status: 'canceled' } | { status: 'denied' };

export interface VerifyNative {
  openUrl(url: string): Promise<void>;
  /** Camera / photo library (images) or Files (PDF + images). Permission denied → `{ status: 'denied' }`. */
  pick(source: PickSource): Promise<PickResult>;
}

/** Only https pages and mailto drafts are ever opened. */
export function isOpenableUrl(url: string): boolean {
  return isSafeWebUrl(url) || /^mailto:[^\s]*$/i.test(url.trim());
}

/** false = refused (not an allowed link) or the system could not open it (no browser / mail app). */
export async function openExternal(native: Pick<VerifyNative, 'openUrl'>, url: string): Promise<boolean> {
  if (!isOpenableUrl(url)) return false;
  try {
    await native.openUrl(url.trim());
    return true;
  } catch {
    return false;
  }
}
