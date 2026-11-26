import { BACKUP_EXCLUDED_ROOTS, excludeAppDataFromBackup, excludeRootOf, rootOf, type CloudBackupPort } from '../cloudBackup';

function fakePort(failing: string[] = []) {
  const excluded: string[] = [];
  const port: CloudBackupPort = {
    excludeDir(path) {
      if (failing.includes(path)) throw new Error('read-only');
      excluded.push(path);
    },
  };
  return { port, excluded };
}

describe('G-05 iOS: applicant files and the database stay out of iCloud backup', () => {
  it('flags applicants/, rentals/ and SQLite/ at app start', () => {
    const { port, excluded } = fakePort();
    expect(excludeAppDataFromBackup(port)).toEqual([]);
    expect(excluded).toEqual(['applicants', 'rentals', 'SQLite']);
    expect(BACKUP_EXCLUDED_ROOTS).toEqual(['applicants', 'rentals', 'SQLite']);
  });

  it('never throws; reports the folders that failed', () => {
    const { port, excluded } = fakePort(['rentals']);
    expect(excludeAppDataFromBackup(port)).toEqual(['rentals']);
    expect(excluded).toEqual(['applicants', 'SQLite']);
  });

  it('does nothing without a port (Android: allowBackup=false; Jest; Expo Go)', () => {
    expect(excludeAppDataFromBackup(null)).toEqual([]);
    expect(() => excludeRootOf(null, 'applicants/1/doc-1.jpg')).not.toThrow();
  });

  it('flags the root folder again before a file is written under it', () => {
    const { port, excluded } = fakePort();
    excludeRootOf(port, 'applicants/12/doc-3.jpg');
    excludeRootOf(port, 'rentals/2/movein-1.jpg');
    excludeRootOf(port, 'other/x.txt'); // not app data
    excludeRootOf(port, 'top.txt');
    expect(excluded).toEqual(['applicants', 'rentals']);
    expect(() => excludeRootOf(fakePort(['applicants']).port, 'applicants/1/a.pdf')).not.toThrow();
  });

  it('root of a relative path', () => {
    expect(rootOf('applicants/3/doc-1.jpg')).toBe('applicants');
    expect(rootOf('/rentals/1')).toBe('rentals');
    expect(rootOf('')).toBe('');
  });
});
