/**
 * Native side of the PDF shell: expo-print → cache file → share sheet. Kept tiny so jest can mock it
 * (`jest.mock('@/pdf/shellNative')`). Never logs HTML or file contents (applicant data).
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { PdfAdapter } from './shell';

/** US Letter in points (expo-print default, stated explicitly). */
const LETTER = { width: 612, height: 792 };

/**
 * Android prints through Chromium (WebView), which draws `@page` margin boxes → the footer goes in the bottom margin so it
 * sits at the bottom of the last page too (B-57). iOS (WebKit) has no margin boxes: keeps the repeating <tfoot>.
 */
export const PDF_FOOTER_IN_PAGE_MARGIN = Platform.OS === 'android';

export const expoPdfAdapter: PdfAdapter = {
  async printToFile(html) {
    const { uri, numberOfPages } = await Print.printToFileAsync({ html, ...LETTER });
    return { uri, numberOfPages };
  },
  async moveToCache(uri, fileName) {
    const dir = new Directory(Paths.cache, 'pdf');
    dir.create({ idempotent: true, intermediates: true });
    const target = new File(dir, fileName);
    await new File(uri).move(target, { overwrite: true });
    return target.uri;
  },
  isSharingAvailable: () => Sharing.isAvailableAsync(),
  share: (uri, options) => Sharing.shareAsync(uri, options),
};
