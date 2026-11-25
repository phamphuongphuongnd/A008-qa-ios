import { Directory, File, Paths } from 'expo-file-system';

import type { FileStore } from './files';

/** The phone's file store: paths relative to the document directory. Errors are swallowed (missing = deleted). */
export const fileStore: FileStore = {
  deleteFile(path) {
    try {
      const f = new File(Paths.document, path);
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
};

/** Absolute URI of a stored relative path (for <Image>, sharing, printing). */
export function fileUri(path: string): string {
  return new File(Paths.document, path).uri;
}
