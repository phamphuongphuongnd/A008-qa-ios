const ops: string[] = [];

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    exists = true;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    copy(t: File, o: object) {
      ops.push(`copy ${this.uri} -> ${t.uri} ${JSON.stringify(o)}`);
    }
    move(t: File, o: object) {
      ops.push(`move ${this.uri} -> ${t.uri} ${JSON.stringify(o)}`);
    }
    create(o?: object) {
      ops.push(`create ${this.uri}${o ? ` ${JSON.stringify(o)}` : ''}`);
    }
    write(text: string) {
      ops.push(`write ${this.uri} ${text}`);
    }
    delete() {
      ops.push(`delete ${this.uri}`);
    }
  }
  class Directory extends File {}
  return { File, Directory, Paths: { document: { uri: 'doc:' } } };
});

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string, opts: object) => {
      ops.push(`manipulate ${uri} ${JSON.stringify(opts)}`);
      return {
        renderAsync: async () => ({
          saveAsync: async (o: object) => {
            ops.push(`save ${JSON.stringify(o)}`);
            return { uri: 'cache:/small.jpg', width: 1500, height: 2000 };
          },
        }),
      };
    },
  },
}));

// eslint-disable-next-line import/first
import { expoFileAdapter } from '../native';

describe('expo file adapter', () => {
  beforeEach(() => {
    ops.length = 0;
  });

  it('downsamples while decoding and saves JPEG', async () => {
    expect(await expoFileAdapter.compressImage('content://x', { maxSize: 2000, quality: 0.7 })).toEqual({ uri: 'cache:/small.jpg', width: 1500, height: 2000 });
    expect(ops).toEqual(['manipulate content://x {"maxWidth":2000,"maxHeight":2000}', 'save {"compress":0.7,"format":"jpeg"}']);
  });

  it('creates the parent folder and overwrites on copy / move', async () => {
    await expoFileAdapter.copy('content://x', 'applicants/7/doc-1.pdf');
    await expoFileAdapter.move('cache:/a.jpg', 'applicants/7/doc-2.jpg');
    expect(ops).toEqual([
      'create doc:/applicants/7 {"idempotent":true,"intermediates":true}',
      'copy content://x -> doc:/applicants/7/doc-1.pdf {"overwrite":true}',
      'create doc:/applicants/7 {"idempotent":true,"intermediates":true}',
      'move cache:/a.jpg -> doc:/applicants/7/doc-2.jpg {"overwrite":true}',
    ]);
  });

  it('deletes folders and gives file URIs', () => {
    expoFileAdapter.deleteDir('applicants/7');
    expect(ops).toEqual(['delete doc:/applicants/7']);
    expect(expoFileAdapter.uri('applicants/7/doc-1.pdf')).toBe('doc:/applicants/7/doc-1.pdf');
    expect(expoFileAdapter.exists('applicants/7/doc-1.pdf')).toBe(true);
  });
});
