import { strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';

import {
  BackupError,
  FORMAT_VERSION,
  HEADER_LENGTH,
  deriveKey,
  keyForFile,
  keyFromJson,
  keyToJson,
  newBackupKey,
  open,
  readHeader,
  seal,
  validateBackupPassword,
} from '../format';
import { testRng } from '../testing/fakes';

const ITER = 1000;
const code = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    if (typeof p === 'function') p();
    else await p;
  } catch (e) {
    return (e as BackupError).code;
  }
  return 'ok';
};

describe('backup envelope', () => {
  it('round-trips with the password, with a fresh nonce each time', async () => {
    const k = await newBackupKey('correct horse battery', testRng, ITER);
    const plain = strToU8('zip bytes');
    const a = seal(plain, k, testRng);
    const b = seal(plain, k, testRng);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    const h = readHeader(a);
    expect(h).toMatchObject({ version: FORMAT_VERSION, iterations: ITER });
    const again = await keyForFile(a, 'correct horse battery');
    expect(Buffer.from(open(a, again)).toString()).toBe('zip bytes');
    // Nothing readable in the file.
    expect(Buffer.from(a).includes(Buffer.from('zip bytes'))).toBe(false);
  });

  it('wrong password → wrong_password (not "damaged")', async () => {
    const k = await newBackupKey('correct horse battery', testRng, ITER);
    const file = seal(strToU8('x'), k, testRng);
    expect(await code(keyForFile(file, 'Correct horse battery'))).toBe('wrong_password');
    const other = await deriveKey('other password', k.salt, ITER);
    expect(await code(() => open(file, other))).toBe('wrong_password');
  });

  it('tells not-a-backup, newer version and damage apart', async () => {
    const k = await newBackupKey('password1', testRng, ITER);
    const file = seal(strToU8('data'), k, testRng);
    expect(await code(() => readHeader(strToU8('%PDF-1.7 hello world this is long enough to pass'.repeat(3))))).toBe('not_backup');
    expect(await code(() => readHeader(file.slice(0, 20)))).toBe('corrupt');

    const newer = file.slice();
    newer[6] = FORMAT_VERSION + 1;
    // The header checksum covers the version byte: a bumped version without a new checksum is damage…
    expect(await code(() => readHeader(newer))).toBe('corrupt');
    // …a real newer file has a valid checksum.

    newer.set(sha256(newer.subarray(0, 56)).subarray(0, 8), 56);
    expect(await code(() => readHeader(newer))).toBe('newer_version');

    const flipped = file.slice();
    flipped[HEADER_LENGTH + 3] ^= 0xff;
    expect(await code(() => open(flipped, k))).toBe('corrupt');
    const salted = file.slice();
    salted[13] ^= 1;
    expect(await code(() => readHeader(salted))).toBe('corrupt');
    expect(await code(() => open(file.slice(0, file.length - 1), k))).toBe('corrupt');
  });

  it('stores the key as JSON for this phone only', async () => {
    const k = await newBackupKey('password1', testRng, ITER);
    const back = keyFromJson(keyToJson(k))!;
    expect(back.iterations).toBe(ITER);
    expect(Buffer.from(back.key).equals(Buffer.from(k.key))).toBe(true);
    expect(keyToJson(k)).not.toContain('password1');
    expect(keyFromJson('nope')).toBeNull();
    expect(keyFromJson(null)).toBeNull();
  });

  it('password: 8+ characters, typed twice', () => {
    expect(validateBackupPassword('short', 'short')).toBe('short');
    expect(validateBackupPassword('long enough', 'long enougH')).toBe('mismatch');
    expect(validateBackupPassword('long enough', 'long enough')).toBeNull();
  });
});
