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

/** The part of React Native's AppState that `waitForReturn` needs (injected so Jest uses a fake). */
export interface AppStateLike {
  currentState?: string | null;
  addEventListener(type: 'change', cb: (state: string) => void): { remove(): void };
}

/**
 * Resolves when the landlord comes back after we opened another app (browser, mail). `Linking.openURL` resolves as
 * soon as that app opens, so the App lock suspension is held until the return instead (no race with the background
 * event). If the phone never leaves the app within `leaveTimeoutMs` (link refused, in-app chooser closed), resolves then.
 */
export function waitForReturn(appState: AppStateLike, leaveTimeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let left = appState.currentState != null && appState.currentState !== 'active';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sub.remove();
      resolve();
    };
    const sub = appState.addEventListener('change', (s) => {
      if (s !== 'active') left = true;
      else if (left) finish();
    });
    const timer = setTimeout(() => {
      if (!left) finish();
    }, leaveTimeoutMs);
  });
}
