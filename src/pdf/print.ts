import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { safeFileName } from './shell';

/** US Letter in points (8.5 × 11 in). */
const LETTER = { width: 612, height: 792 };

/**
 * HTML → PDF file in the app cache (`cache/pdf/<name>.pdf`, replaced if it exists). Returns its file:// URI.
 * Use `savePdf` to keep a copy with the applicant (letters) — the cache can be cleared by the system.
 */
export async function printToPdf(html: string, fileName: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, ...LETTER });
  const dir = new Directory(Paths.cache, 'pdf');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `${safeFileName(fileName)}.pdf`);
  if (target.exists) target.delete();
  new File(uri).move(target);
  return target.uri;
}

/** Opens the share sheet for a PDF (Android: "Print" there shows the preview). */
export async function sharePdf(uri: string, dialogTitle?: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}

/**
 * The usual "Export PDF" / "Share" button: render, then share. Returns the cache URI (e.g. to `savePdf` it). Never logs
 * the HTML or the applicant's data; a failure is thrown for the screen to show.
 */
export async function printToPdfAndShare(html: string, fileName: string, dialogTitle?: string): Promise<string> {
  const uri = await printToPdf(html, fileName);
  await sharePdf(uri, dialogTitle);
  return uri;
}

/** System print dialog with preview (iOS AirPrint / Android print service). */
export async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html, ...LETTER });
}

/**
 * Copies a rendered PDF next to the applicant / rental (relative path under the document directory, e.g.
 * 'applicants/12/adverse-action-3.pdf'), so it is deleted with them (Disposal Rule). Returns the relative path.
 */
export function savePdf(cacheUri: string, relativePath: string): string {
  const target = new File(Paths.document, relativePath);
  const parent = target.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true });
  if (target.exists) target.delete();
  new File(cacheUri).copy(target);
  return relativePath;
}
