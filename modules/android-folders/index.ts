import { requireOptionalNativeModule } from 'expo';

export interface AndroidFoldersNative {
  /** Display name of a SAF tree uri from the folder picker ("EvenleaseQA" for a Drive folder); null when unknown. */
  displayName(treeUri: string): string | null;
}

/** Android only; null on iOS, in Jest and in a build made before this module existed. */
export const AndroidFolders = requireOptionalNativeModule<AndroidFoldersNative>('EvenleaseAndroidFolders');
