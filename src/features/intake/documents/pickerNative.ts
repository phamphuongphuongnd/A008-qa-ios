/** expo-image-picker + expo-document-picker behind `AttachmentPicker` (mocked in Jest). */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { AttachmentPicker, PickResult } from './picker';

function fromImage(r: ImagePicker.ImagePickerResult): PickResult {
  if (r.canceled || !r.assets?.length) return { status: 'cancelled' };
  const a = r.assets[0];
  return { status: 'picked', uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? null };
}

export const expoAttachmentPicker: AttachmentPicker = {
  async camera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { status: 'denied', source: 'camera', canAskAgain: perm.canAskAgain };
    return fromImage(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false }));
  },
  async library() {
    // The system photo picker needs no library permission (Android 13+ / iOS PHPicker).
    return fromImage(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false }));
  },
  async file() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return { status: 'cancelled' };
    const a = r.assets[0];
    return { status: 'picked', uri: a.uri, mime: a.mimeType ?? null, name: a.name ?? null };
  },
};
