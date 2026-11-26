/** The phone's CloudBackupPort (G-05): iOS with the ios-files module; null on Android / Jest / Expo Go. */
import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { IosFiles, type IosFilesNative } from '../../modules/ios-files';
import type { CloudBackupPort } from './cloudBackup';

function makePort(native: IosFilesNative): CloudBackupPort {
  return {
    excludeDir(path) {
      const d = new Directory(Paths.document, path);
      d.create({ idempotent: true, intermediates: true });
      native.excludeFromBackup(d.uri);
    },
  };
}

export const cloudBackupPort: CloudBackupPort | null = Platform.OS === 'ios' && IosFiles ? makePort(IosFiles) : null;
