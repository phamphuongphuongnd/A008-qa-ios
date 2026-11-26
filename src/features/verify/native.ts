/**
 * The phone's VerifyNative: expo-linking (browser / mail app), expo-image-picker (camera, photos), expo-document-picker
 * (PDF / images from Files). Kept tiny and untested by Jest (tests pass a fake `VerifyNative`). Never logs file names.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';

import type { PickResult, PickSource, VerifyNative } from './links';

async function pickImages(source: 'camera' | 'photos'): Promise<PickResult> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: source === 'photos' };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return { status: 'canceled' };
  return { status: 'picked', files: res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null })) };
}

export const expoVerifyNative: VerifyNative = {
  async openUrl(url) {
    await Linking.openURL(url);
  },
  async pick(source: PickSource) {
    if (source !== 'files') return pickImages(source);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return { status: 'canceled' };
    return { status: 'picked', files: res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? null, name: a.name })) };
  },
};
