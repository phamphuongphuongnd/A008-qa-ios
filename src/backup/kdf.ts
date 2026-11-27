/**
 * PBKDF2-HMAC-SHA256 for the backup password (B-101). @noble/hashes in JS runs ~350 iterations/s on a Galaxy A13
 * (310 000 = 14 min), so the phone uses the native module (modules/evenlease-crypto) when it proves itself:
 * before its first use in each app run, the native result must equal known vectors (RFC 7914 §11, a 1 000-round
 * one, a non-ASCII password). Any mismatch, error or missing module (Jest, web, old build) → the JS PBKDF2, which
 * is slow but always right. Both produce the same key for the same bytes, so files made either way open either way.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export interface NativePbkdf2 {
  pbkdf2Sha256(passwordHex: string, saltHex: string, iterations: number, keyLength: number): Promise<string>;
}

export type Pbkdf2 = (password: Uint8Array, salt: Uint8Array, iterations: number, keyLength: number) => Promise<Uint8Array>;

/** The JS PBKDF2 (the reference). asyncTick keeps the UI responsive while it runs. */
export const jsPbkdf2: Pbkdf2 = (password, salt, iterations, keyLength) =>
  pbkdf2Async(sha256, password, salt, { c: iterations, dkLen: keyLength, asyncTick: 25 });

/** Known answers the native code must reproduce (hex). Checked against @noble/hashes and Node in the tests. */
export const SELF_CHECK_VECTORS: readonly { password: string; salt: string; iterations: number; keyLength: number; key: string }[] = [
  // RFC 7914 §11 PBKDF2-HMAC-SHA256 P="passwd" S="salt" c=1 dkLen=64 (two blocks).
  {
    password: '706173737764',
    salt: '73616c74',
    iterations: 1,
    keyLength: 64,
    key: '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
  },
  // 1 000 rounds, 32 bytes (the backup key length).
  {
    password: '6576656e6c656173652d6b64662d73656c662d636865636b', // "evenlease-kdf-self-check"
    salt: '30313233343536373839616263646566', // "0123456789abcdef"
    iterations: 1000,
    keyLength: 32,
    key: '17158729b39820112cd256c109ded42fd0e22cc3e7216aa83f8d622e3edf4cae',
  },
  // Non-ASCII password bytes ("pässwörd 日本", NFC UTF-8) — the native side must hash bytes, not chars.
  {
    password: '70c3a4737377c3b6726420e697a5e69cac',
    salt: '73616c742dc3bc', // "salt-ü"
    iterations: 2,
    keyLength: 32,
    key: 'e17b39df103d0ab402ed662ae2e568ca7ca54aab77135f263b74b4dcc8d3e869',
  },
];

async function nativeMatches(native: NativePbkdf2): Promise<boolean> {
  try {
    for (const v of SELF_CHECK_VECTORS) {
      const got = await native.pbkdf2Sha256(v.password, v.salt, v.iterations, v.keyLength);
      if (typeof got !== 'string' || got.toLowerCase() !== v.key) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * The PBKDF2 to use: native once it passed the self-check (run once, on first use), else JS. A native call that
 * fails later falls back to JS for that call.
 */
export function makePbkdf2(native: NativePbkdf2 | null | undefined): Pbkdf2 & { usesNative: () => Promise<boolean> } {
  let checked: Promise<boolean> | null = null;
  const usesNative = () => (checked ??= native ? nativeMatches(native) : Promise.resolve(false));
  const derive: Pbkdf2 = async (password, salt, iterations, keyLength) => {
    if (native && (await usesNative())) {
      try {
        const hex = await native.pbkdf2Sha256(bytesToHex(password), bytesToHex(salt), iterations, keyLength);
        const key = hexToBytes(hex.toLowerCase());
        if (key.length === keyLength) return key;
      } catch {
        // fall through to JS
      }
    }
    return jsPbkdf2(password, salt, iterations, keyLength);
  };
  return Object.assign(derive, { usesNative });
}

let current: Pbkdf2 = jsPbkdf2;

/** The phone binds the native module at start (./index.ts); Jest and web keep the JS one. */
export function installPbkdf2(impl: Pbkdf2): void {
  current = impl;
}

/** Back to the JS PBKDF2 (tests). */
export function resetPbkdf2(): void {
  current = jsPbkdf2;
}

export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, keyLength: number): Promise<Uint8Array> {
  return current(password, salt, iterations, keyLength);
}
