/**
 * The phone's FileAdapter: expo-file-system (document directory) + expo-image-manipulator. Kept tiny so Jest never
 * loads it (tests use `makeFiles(fakeAdapter)`).
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { FileAdapter } from './files';

const fileAt = (path: string) => new File(Paths.document, path);

function ensureParent(path: string) {
  const parts = path.split('/');
  parts.pop();
  if (parts.length) new Directory(Paths.document, ...parts).create({ idempotent: true, intermediates: true });
}

export const expoFileAdapter: FileAdapter = {
  async copy(sourceUri, dest) {
    ensureParent(dest);
    new File(sourceUri).copy(fileAt(dest), { overwrite: true });
  },
  async move(sourceUri, dest) {
    ensureParent(dest);
    new File(sourceUri).move(fileAt(dest), { overwrite: true });
  },
  async writeText(dest, text) {
    ensureParent(dest);
    const f = fileAt(dest);
    if (!f.exists) f.create();
    f.write(text);
  },
  async compressImage(sourceUri, { maxSize, quality }) {
    // Downsampled while decoding: a 12 MP photo is never loaded whole (memory on low-end phones).
    const ref = await ImageManipulator.manipulate(sourceUri, { maxWidth: maxSize, maxHeight: maxSize }).renderAsync();
    const out = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return { uri: out.uri, width: out.width, height: out.height };
  },
  deleteFile(path) {
    try {
      const f = fileAt(path);
      if (f.exists) f.delete();
    } catch {
      // Already gone.
    }
  },
  deleteDir(path) {
    try {
      const d = new Directory(Paths.document, path);
      if (d.exists) d.delete();
    } catch {
      // Already gone.
    }
  },
  exists(path) {
    try {
      return fileAt(path).exists;
    } catch {
      return false;
    }
  },
  uri: (path) => fileAt(path).uri,
};
