/**
 * Native helpers for 2D, kept out of the tested modules:
 * - `thumbnailReader`: small JPEG data: URIs of document photos for the Decision file ("Include document thumbnails").
 * - `previewPdf`: "Preview PDF" (S-16) opens the system print preview without saving.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';

import { files } from '@/files';

export const thumbnailReader = {
  async read(path: string): Promise<string | null> {
    try {
      const ref = await ImageManipulator.manipulate(files.uri(path)).resize({ width: 300 }).renderAsync();
      const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
      return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
    } catch {
      return null;
    }
  },
};

export async function previewPdf(html: string): Promise<void> {
  await Print.printAsync({ html, width: 612, height: 792 });
}
