import { makeFiles, type FileAdapter } from '../files';
import { assertAppPath, extensionFor, fileNameFor, isImageMime, mimeFor } from '../paths';

function fakeAdapter() {
  const stored = new Map<string, string>(); // path → source / text
  const calls: string[] = [];
  const a: FileAdapter = {
    async copy(src, dest) {
      calls.push(`copy ${dest}`);
      stored.set(dest, src);
    },
    async move(src, dest) {
      calls.push(`move ${dest}`);
      stored.set(dest, src);
    },
    async writeText(dest, text) {
      stored.set(dest, text);
    },
    async compressImage(uri, opts) {
      calls.push(`compress ${opts.maxSize} ${opts.quality}`);
      return { uri: `${uri}#small`, width: 1500, height: 2000 };
    },
    deleteFile(p) {
      stored.delete(p);
    },
    deleteDir(p) {
      for (const k of [...stored.keys()]) if (k === p || k.startsWith(`${p}/`)) stored.delete(k);
    },
    exists: (p) => stored.has(p),
    uri: (p) => `file:///docs/${p}`,
  };
  return { a, stored, calls };
}

describe('paths', () => {
  it('names files by kind + id, or a unique stamp — never by person', () => {
    expect(fileNameFor('doc', 'jpg', 12)).toBe('doc-12.jpg');
    expect(fileNameFor('letter', '.PDF', 'adverse-3')).toBe('letter-adverse-3.pdf');
    const a = fileNameFor('doc', 'jpg', undefined, 1000);
    const b = fileNameFor('doc', 'jpg', undefined, 1000);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^doc-[0-9a-z]+\.jpg$/);
  });

  it('guesses types', () => {
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor(null, 'Stub.JPEG')).toBe('jpg');
    expect(extensionFor(undefined, 'noext')).toBe('bin');
    expect(mimeFor(null, 'report.pdf')).toBe('application/pdf');
    expect(mimeFor('IMAGE/PNG')).toBe('image/png');
    expect(mimeFor(null, 'x')).toBeNull();
    expect(isImageMime('image/heic')).toBe(true);
    expect(isImageMime('image/svg+xml')).toBe(false);
    expect(isImageMime('application/pdf')).toBe(false);
  });

  it('refuses paths outside the app folders', () => {
    expect(assertAppPath('applicants/3/doc-1.jpg')).toBe('applicants/3/doc-1.jpg');
    expect(assertAppPath('rentals/1')).toBe('rentals/1');
    for (const bad of ['', '/applicants/1', 'applicants/../x', 'applicants//x', 'SQLite/evenlease.db', 'file:///x', 'applicants\\1', 'applicants/./x']) {
      expect(() => assertAppPath(bad)).toThrow('Invalid app file path');
    }
  });
});

describe('files', () => {
  it('compresses a photo and moves it into the applicant folder', async () => {
    const { a, stored, calls } = fakeAdapter();
    const f = makeFiles(a);
    const saved = await f.saveAttachment({ owner: { applicantId: 7 }, kind: 'doc', id: 12, sourceUri: 'content://picker/1', mime: 'image/jpeg' });
    expect(saved).toEqual({ path: 'applicants/7/doc-12.jpg', mime: 'image/jpeg', width: 1500, height: 2000 });
    expect(calls).toEqual(['compress 2000 0.7', 'move applicants/7/doc-12.jpg']);
    expect(stored.get('applicants/7/doc-12.jpg')).toBe('content://picker/1#small');
    expect(f.uri(saved.path)).toBe('file:///docs/applicants/7/doc-12.jpg');
  });

  it('copies a PDF as it is (type from the name when the picker gives none)', async () => {
    const { a, calls } = fakeAdapter();
    const f = makeFiles(a);
    const saved = await f.saveAttachment({ owner: { applicantId: 7 }, kind: 'report', id: '3-1', sourceUri: 'file:///cache/x', name: 'MySmartMove report.PDF' });
    expect(saved).toEqual({ path: 'applicants/7/report-3-1.pdf', mime: 'application/pdf' });
    expect(calls).toEqual(['copy applicants/7/report-3-1.pdf']);
  });

  it('writes a signature SVG for a rental (move-in) and deletes by owner', async () => {
    const { a, stored } = fakeAdapter();
    const f = makeFiles(a);
    const sig = await f.saveText({ owner: { rentalId: 2 }, kind: 'signature', id: 'tenant', ext: 'svg', text: '<svg/>' });
    expect(sig).toEqual({ path: 'rentals/2/signature-tenant.svg', mime: 'image/svg+xml' });
    await f.saveImage({ owner: { applicantId: 9 }, kind: 'doc', sourceUri: 'x' });
    expect(f.exists(sig.path)).toBe(true);
    f.deleteOwner({ rentalId: 2 });
    expect(f.exists(sig.path)).toBe(false);
    expect([...stored.keys()]).toEqual([expect.stringMatching(/^applicants\/9\/doc-/)]);
  });

  it('fileStore (for repositories) skips sample paths and refuses bad ones', () => {
    const { a, stored } = fakeAdapter();
    const f = makeFiles(a);
    stored.set('applicants/1/doc-1.jpg', 'x');
    f.fileStore.deleteFile('sample/photo_id-1.jpg');
    f.fileStore.deleteFile('applicants/1/doc-1.jpg');
    expect(stored.size).toBe(0);
    expect(() => f.fileStore.deleteDir('../SQLite')).toThrow();
    expect(() => f.deleteFile('/etc/hosts')).toThrow();
  });
});
