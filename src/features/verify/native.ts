/**
 * The phone's VerifyNative: expo-linking (browser / mail app), expo-image-picker (camera, photos), expo-document-picker
 * (PDF / images from Files). Every one runs inside 2E's `withLockSuspended` so App lock ("Lock after: Immediately")
 * does not lock the landlord out when they come back. Kept tiny and untested by Jest (tests pass a fake
 * `VerifyNative`). Never logs file names.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

import { withLockSuspended } from '@/features/settings/lockController';

import { waitForReturn, type PickResult, type PickSource, type VerifyNative } from './links';

async function pickImages(source: 'camera' | 'photos'): Promise<PickResult> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: source === 'photos' };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return { status: 'canceled' };
  return { status: 'picked', files: res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null })) };
}

async function pickFiles(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return { status: 'canceled' };
  return { status: 'picked', files: res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? null, name: a.name })) };
}

export const expoVerifyNative: VerifyNative = {
  openUrl(url) {
    return withLockSuspended(async () => {
      const back = waitForReturn(AppState);
      await Linking.openURL(url);
      await back;
    });
  },
  pick(source: PickSource) {
    return withLockSuspended(() => (source === 'files' ? pickFiles() : pickImages(source)));
  },
};
