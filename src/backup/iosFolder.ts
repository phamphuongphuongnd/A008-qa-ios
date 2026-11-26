/**
 * G-06, iOS "Automatic backup" folder. The URL from the folder picker is security-scoped and lapses when the app
 * restarts, so settings keep a bookmark instead (`ios-bookmark:<base64>` in `backupFolderUri`) and every file
 * operation reopens the folder through it (modules/ios-files, as A006 modules/backup-folder). Android keeps the SAF
 * tree uri (its permission survives restarts). Pure (no Expo import) so it is unit-tested with a fake native module.
 */
import type { FolderPort } from './auto';
import { BackupError } from './format';

export const BOOKMARK_PREFIX = 'ios-bookmark:';

/** The part of modules/ios-files the backup folder uses. */
export interface BookmarkNative {
  makeBookmark(folderUri: string): string;
  copyInto(bookmark: string, sourceUri: string, name: string): Promise<void>;
  list(bookmark: string): Promise<string[]>;
  remove(bookmark: string, name: string): Promise<void>;
}

/** A local file to copy from (the backup bytes in the cache), removed after the copy. */
export interface TempFiles {
  write(name: string, bytes: Uint8Array): string;
  remove(uri: string): void;
}

export const isBookmarkUri = (uri: string): boolean => uri.startsWith(BOOKMARK_PREFIX);

/**
 * What settings store for a folder just picked: the bookmark when the native module is there (call right after the
 * picker, while the URL is still in scope), else the plain uri (Android; an old build — works until the app restarts).
 */
export function folderSetting(native: BookmarkNative | null, pickedUri: string): string {
  if (!native) return pickedUri;
  return BOOKMARK_PREFIX + native.makeBookmark(pickedUri);
}

/**
 * FolderPort over a stored bookmark. Any native failure (bookmark no longer resolves, folder deleted, iCloud
 * unavailable) is `folder_gone`, so S-22 says "couldn't reach the folder — choose it again".
 */
export function bookmarkFolderPort(native: BookmarkNative | null, uri: string, temp: TempFiles): FolderPort {
  const bookmark = uri.slice(BOOKMARK_PREFIX.length);
  const call = async <T>(op: (n: BookmarkNative) => Promise<T>): Promise<T> => {
    if (!native || !bookmark) throw new BackupError('folder_gone');
    try {
      return await op(native);
    } catch (e) {
      if (e instanceof BackupError) throw e;
      throw new BackupError('folder_gone', e instanceof Error ? e.message : String(e));
    }
  };
  return {
    list: () => call((n) => n.list(bookmark)),
    async write(name, bytes) {
      const src = temp.write(name, bytes);
      try {
        await call((n) => n.copyInto(bookmark, src, name));
      } finally {
        try {
          temp.remove(src);
        } catch {
          // Cache; the OS cleans it.
        }
      }
    },
    remove: (name) => call((n) => n.remove(bookmark, name)),
  };
}
