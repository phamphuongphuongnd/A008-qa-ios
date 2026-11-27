import { folderLabel, readableFolderLabel } from '../folderName';

describe('B-76 backup folder name', () => {
  it('SAF document id as the name → the folder itself, not "primary:Documents"', () => {
    const uri = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments';
    expect(folderLabel(uri, 'primary:Documents')).toBe('Documents');
    expect(folderLabel(uri, null)).toBe('Documents');
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FEvenlease', 'primary:Documents/Evenlease')).toBe('Evenlease');
    expect(folderLabel('content://com.android.externalstorage.documents/tree/1A2B-3C4D%3ABackups', null)).toBe('Backups');
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3A', 'primary:')).toBe('Internal storage');
  });

  it('a plain name stays (Drive, iOS)', () => {
    expect(folderLabel('content://com.google.android.apps.docs.storage/tree/acc%3D1%3Bdoc%3Dabc', 'Evenlease')).toBe('Evenlease');
    expect(folderLabel('file:///private/var/mobile/Evenlease/', 'Evenlease')).toBe('Evenlease');
  });

  it('labels saved before the fix read the same way', () => {
    expect(readableFolderLabel('primary:Documents')).toBe('Documents');
    expect(readableFolderLabel('Evenlease')).toBe('Evenlease');
  });

  it('B-102: Google Drive → the provider display name, never the raw "acc=6;doc=encoded=…" id', () => {
    const drive = 'content://com.google.android.apps.docs.storage/tree/acc%3D6%3Bdoc%3Dencoded%3DZEWjKw-Yc2Tl';
    expect(folderLabel(drive, 'acc=6;doc=encoded=ZEWjKw-Yc2Tl', 'EvenleaseQA')).toBe('EvenleaseQA');
    expect(folderLabel(drive, 'acc=6;doc=encoded=ZEWjKw-Yc2Tl', null)).toBe('Google Drive folder');
    expect(folderLabel(drive, null)).toBe('Google Drive folder');
    expect(folderLabel('content://com.example.provider/tree/x%3Dy%3Bz', null)).toBe('Chosen folder');
    // A local folder keeps working with or without the provider name.
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FEvenleaseQA', 'primary:Documents/EvenleaseQA', 'EvenleaseQA')).toBe('EvenleaseQA');
  });

  it('B-102: a raw Drive id saved by an older build reads "Google Drive folder"', () => {
    expect(readableFolderLabel('acc=6;doc=encoded=ZEWjKw', 'content://com.google.android.apps.docs.storage/tree/acc%3D6')).toBe('Google Drive folder');
    expect(readableFolderLabel('acc=6;doc=encoded=ZEWjKw')).toBe('Google Drive folder');
    expect(readableFolderLabel('EvenleaseQA', 'content://com.google.android.apps.docs.storage/tree/acc%3D6')).toBe('EvenleaseQA');
  });
});
