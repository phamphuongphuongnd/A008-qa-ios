/**
 * S-10 "Open PDF" (B-43): the stored PDF opens in the system print preview (expo-print `printAsync({ uri })`), read
 * straight from the app folder — no copy is made, nothing is handed to another app unless the landlord prints or saves
 * it there. Same mechanism as S-16 "Preview PDF". No PDF viewer library is bundled (offline app, no WebView).
 */
import * as Print from 'expo-print';

import { withLockSuspended } from '@/features/settings/lockController';
import { files } from '@/files';

/** false when the preview could not open (missing / unreadable file). */
export async function openStoredPdf(path: string): Promise<boolean> {
  try {
    await withLockSuspended(() => Print.printAsync({ uri: files.uri(path) }));
    return true;
  } catch {
    return false;
  }
}
