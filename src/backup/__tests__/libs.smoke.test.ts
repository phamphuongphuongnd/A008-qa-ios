/**
 * 1A smoke test: the backup libraries load under Jest (ESM-only @noble packages go through Babel) and round-trip.
 * 2E replaces this with the real backup format tests.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

describe('backup libraries', () => {
  it('zips, encrypts with AES-256-GCM and reverses', () => {
    const zip = zipSync({ 'data.json': strToU8('{"rentals":[]}') });
    const key = pbkdf2(sha256, strToU8('correct horse'), new Uint8Array(16).fill(7), { c: 1000, dkLen: 32 });
    const nonce = new Uint8Array(12).fill(1);
    const sealed = gcm(key, nonce).encrypt(zip);
    const opened = gcm(key, nonce).decrypt(sealed);
    expect(strFromU8(unzipSync(opened)['data.json'])).toBe('{"rentals":[]}');
    const wrong = pbkdf2(sha256, strToU8('wrong'), new Uint8Array(16).fill(7), { c: 1000, dkLen: 32 });
    expect(() => gcm(wrong, nonce).decrypt(sealed)).toThrow();
  });
});
