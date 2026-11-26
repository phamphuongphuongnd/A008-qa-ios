import { requireOptionalNativeModule } from 'expo';

export interface IosFilesNative {
  /** G-05: marks a file / folder (and everything in it) as not backed up to iCloud or a computer. */
  excludeFromBackup(uri: string): void;
  isExcludedFromBackup(uri: string): boolean;
  /** G-06: security-scoped bookmark (base64) for a folder from Directory.pickDirectoryAsync — call right after picking. */
  makeBookmark(folderUri: string): string;
  resolve(bookmark: string): { uri: string; stale: boolean };
  copyInto(bookmark: string, sourceUri: string, name: string): Promise<void>;
  list(bookmark: string): Promise<string[]>;
  remove(bookmark: string, name: string): Promise<void>;
}

/** iOS only; null on Android, in Jest and in a build made before this module existed. */
export const IosFiles = requireOptionalNativeModule<IosFilesNative>('EvenleaseIosFiles');
