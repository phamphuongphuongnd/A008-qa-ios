import { pbkdf2Sync } from 'crypto';

import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { keyForFile, newBackupKey, open, seal } from '../format';
import { SELF_CHECK_VECTORS, installPbkdf2, jsPbkdf2, makePbkdf2, resetPbkdf2, type NativePbkdf2 } from '../kdf';
import { testRng } from '../testing/fakes';

/** Stand-in for modules/evenlease-crypto: an independent PBKDF2 (Node / OpenSSL). */
const nodeNative = (): NativePbkdf2 & { calls: number } => {
  const n = {
    calls: 0,
    async pbkdf2Sha256(pw: string, salt: string, c: number, len: number) {
      n.calls++;
      return pbkdf2Sync(Buffer.from(pw, 'hex'), Buffer.from(salt, 'hex'), c, len, 'sha256').toString('hex');
    },
  };
  return n;
};

afterEach(() => resetPbkdf2());

describe('B-101 PBKDF2-HMAC-SHA256 vectors', () => {
  it('the JS PBKDF2 and Node agree with every self-check vector (RFC 7914 §11, 1 000 rounds, non-ASCII)', async () => {
    for (const v of SELF_CHECK_VECTORS) {
      expect(bytesToHex(await jsPbkdf2(hexToBytes(v.password), hexToBytes(v.salt), v.iterations, v.keyLength))).toBe(v.key);
      expect(pbkdf2Sync(Buffer.from(v.password, 'hex'), Buffer.from(v.salt, 'hex'), v.iterations, v.keyLength, 'sha256').toString('hex')).toBe(v.key);
    }
  });

  it('RFC 7914 §11 second vector (P="Password", S="NaCl", c=80 000)', async () => {
    const key = await jsPbkdf2(utf8ToBytes('Password'), utf8ToBytes('NaCl'), 80_000, 64);
    expect(bytesToHex(key)).toBe(
      '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d',
    );
  });

  it('the self-check vector passwords are the bytes they claim', () => {
    expect(SELF_CHECK_VECTORS[2].password).toBe(bytesToHex(utf8ToBytes('pässwörd 日本'.normalize('NFC'))));
  });
});

describe('B-101 native or JS', () => {
  const pw = utf8ToBytes('correct horse battery');
  const salt = hexToBytes('000102030405060708090a0b0c0d0e0f');

  it('no native module (Jest, web, old build) → JS', async () => {
    const d = makePbkdf2(null);
    expect(await d.usesNative()).toBe(false);
    expect(bytesToHex(await d(pw, salt, 500, 32))).toBe(bytesToHex(await jsPbkdf2(pw, salt, 500, 32)));
  });

  it('a native module that passes the self-check is used, the check runs once per app run', async () => {
    const native = nodeNative();
    const d = makePbkdf2(native);
    const key = await d(pw, salt, 500, 32);
    expect(bytesToHex(key)).toBe(bytesToHex(await jsPbkdf2(pw, salt, 500, 32)));
    expect(native.calls).toBe(SELF_CHECK_VECTORS.length + 1);
    await d(pw, salt, 500, 32);
    expect(native.calls).toBe(SELF_CHECK_VECTORS.length + 2);
    expect(await d.usesNative()).toBe(true);
  });

  it('a native module that gets a vector wrong is never used → JS (no wrong key, no lost data)', async () => {
    const calls: number[] = [];
    const wrong: NativePbkdf2 = {
      async pbkdf2Sha256(p, s, c, len) {
        calls.push(c);
        // e.g. hashing chars instead of UTF-8 bytes: right for ASCII, wrong for "pässwörd 日本".
        const asLatin1 = Buffer.from(Buffer.from(p, 'hex').toString('utf8'), 'latin1');
        return pbkdf2Sync(asLatin1, Buffer.from(s, 'hex'), c, len, 'sha256').toString('hex');
      },
    };
    const d = makePbkdf2(wrong);
    expect(await d.usesNative()).toBe(false);
    const n = calls.length;
    expect(bytesToHex(await d(pw, salt, 500, 32))).toBe(bytesToHex(await jsPbkdf2(pw, salt, 500, 32)));
    expect(calls.length).toBe(n); // not asked again
  });

  it('a native call that throws or returns a bad length falls back to JS for that call', async () => {
    let fail = false;
    const flaky: NativePbkdf2 = {
      async pbkdf2Sha256(p, s, c, len) {
        if (fail) throw new Error('out of memory');
        return pbkdf2Sync(Buffer.from(p, 'hex'), Buffer.from(s, 'hex'), c, len, 'sha256').toString('hex');
      },
    };
    const d = makePbkdf2(flaky);
    expect(await d.usesNative()).toBe(true);
    fail = true;
    expect(bytesToHex(await d(pw, salt, 500, 32))).toBe(bytesToHex(await jsPbkdf2(pw, salt, 500, 32)));

    const short: NativePbkdf2 = { pbkdf2Sha256: async (p, s, c, len) => (len === 32 && c === 500 ? 'abcd' : nodeNative().pbkdf2Sha256(p, s, c, len)) };
    expect(bytesToHex(await makePbkdf2(short)(pw, salt, 500, 32))).toBe(bytesToHex(await jsPbkdf2(pw, salt, 500, 32)));
  });
});

describe('B-101 backup files across the two PBKDF2s (format unchanged)', () => {
  it('a file made with the JS PBKDF2 (old builds) opens with the native one, and the other way round', async () => {
    const plain = new Uint8Array([1, 2, 3, 4, 5]);

    resetPbkdf2();
    const jsKey = await newBackupKey('pässwörd 12', testRng, 2000);
    const oldFile = seal(plain, jsKey, testRng);

    installPbkdf2(makePbkdf2(nodeNative()));
    expect(Array.from(open(oldFile, await keyForFile(oldFile, 'pässwörd 12')))).toEqual([1, 2, 3, 4, 5]);
    const nativeKey = await newBackupKey('pässwörd 12', testRng, 2000);
    const newFile = seal(plain, nativeKey, testRng);

    resetPbkdf2();
    expect(Array.from(open(newFile, await keyForFile(newFile, 'pässwörd 12')))).toEqual([1, 2, 3, 4, 5]);
    await expect(keyForFile(newFile, 'passwörd 12')).rejects.toMatchObject({ code: 'wrong_password' });
  });
});
