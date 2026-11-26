import { makeTestDb } from '@/db/testing/testDb';
import { loadSampleRental } from '@/db/repos/sample';
import { getSettings, updateSettings } from '@/db/repos/settings';

import { autoBackupFailedAt, runAutoBackup } from '../auto';
import { BackupError } from '../format';
import { BOOKMARK_PREFIX, bookmarkFolderPort, folderSetting, isBookmarkUri, type BookmarkNative, type TempFiles } from '../iosFolder';
import { setBackupPassword } from '../service';
import { bytes, makeFakeIO, testRng } from '../testing/fakes';

/** Fake modules/ios-files: one folder per bookmark, files by name. */
function fakeNative(opts: { failAll?: boolean } = {}) {
  const folders = new Map<string, Map<string, string>>();
  const calls: string[] = [];
  const folderOf = (bm: string) => {
    if (opts.failAll || !folders.has(bm)) throw new Error('bookmark does not resolve');
    return folders.get(bm)!;
  };
  const native: BookmarkNative = {
    makeBookmark(uri) {
      calls.push(`makeBookmark ${uri}`);
      const bm = `bm(${uri})`;
      folders.set(bm, new Map());
      return bm;
    },
    async copyInto(bm, src, name) {
      calls.push(`copyInto ${bm} ${src} ${name}`);
      folderOf(bm).set(name, src);
    },
    async list(bm) {
      return [...folderOf(bm).keys()];
    },
    async remove(bm, name) {
      calls.push(`remove ${bm} ${name}`);
      folderOf(bm).delete(name);
    },
  };
  return { native, folders, calls };
}

function fakeTemp() {
  const live = new Set<string>();
  const temp: TempFiles = {
    write: (name) => {
      const uri = `cache:/backup/${name}`;
      live.add(uri);
      return uri;
    },
    remove: (uri) => {
      live.delete(uri);
    },
  };
  return { temp, live };
}

describe('G-06 iOS backup folder bookmark', () => {
  it('stores a bookmark for the picked folder, or the plain uri without the module (Android)', () => {
    const { native, calls } = fakeNative();
    const stored = folderSetting(native, 'file:///iCloud/Evenlease/');
    expect(stored).toBe(`${BOOKMARK_PREFIX}bm(file:///iCloud/Evenlease/)`);
    expect(isBookmarkUri(stored)).toBe(true);
    expect(calls).toEqual(['makeBookmark file:///iCloud/Evenlease/']);
    expect(folderSetting(null, 'content://tree/x')).toBe('content://tree/x');
    expect(isBookmarkUri('content://tree/x')).toBe(false);
  });

  it('writes through a cache file, lists and removes through the bookmark', async () => {
    const { native, folders } = fakeNative();
    const { temp, live } = fakeTemp();
    const port = bookmarkFolderPort(native, folderSetting(native, 'file:///F/'), temp);
    await port.write('evenlease-2026-12-20.evenlease', bytes('x'));
    expect([...folders.get('bm(file:///F/)')!.keys()]).toEqual(['evenlease-2026-12-20.evenlease']);
    expect(live.size).toBe(0); // the cache copy is removed
    expect(await port.list()).toEqual(['evenlease-2026-12-20.evenlease']);
    await port.remove('evenlease-2026-12-20.evenlease');
    expect(await port.list()).toEqual([]);
  });

  it('a bookmark that no longer resolves is folder_gone (and the cache copy is still removed)', async () => {
    const { native } = fakeNative({ failAll: true });
    const { temp, live } = fakeTemp();
    const port = bookmarkFolderPort(native, `${BOOKMARK_PREFIX}old`, temp);
    await expect(port.write('a', bytes('x'))).rejects.toMatchObject({ code: 'folder_gone' });
    await expect(port.list()).rejects.toBeInstanceOf(BackupError);
    expect(live.size).toBe(0);
    // A build without the module (restored settings from an iPhone, run in Expo Go): also folder_gone.
    await expect(bookmarkFolderPort(null, `${BOOKMARK_PREFIX}x`, temp).list()).rejects.toMatchObject({ code: 'folder_gone' });
  });

  it('weekly backup runs through the bookmark after a restart; a lost folder shows "choose it again"', async () => {
    const db = makeTestDb();
    loadSampleRental(db);
    await setBackupPassword(db, 'backup password', testRng, 1000);
    const { io } = makeFakeIO({ 'applicants/1/doc-1.jpg': bytes('jpg') });
    const { native, folders } = fakeNative();
    const { temp } = fakeTemp();
    updateSettings(db, { autoBackup: 'weekly', backupFolderUri: folderSetting(native, 'file:///F/') });
    const deps = { db, io, rng: testRng, now: () => new Date('2026-12-20T15:00:00.000Z') };

    // "After a restart" = only the stored setting is left; the port is rebuilt from it.
    const r = await runAutoBackup(deps, (uri) => bookmarkFolderPort(native, uri, temp), { force: true });
    expect(r).toBe('done');
    expect(folders.get('bm(file:///F/)')!.size).toBe(1);
    expect(getSettings(db).lastBackupAt).not.toBeNull();

    folders.clear(); // folder deleted in Files
    const r2 = await runAutoBackup(deps, (uri) => bookmarkFolderPort(native, uri, temp), { force: true });
    expect(r2).toBe('failed');
    expect(autoBackupFailedAt(db)).not.toBeNull();
  });
});
