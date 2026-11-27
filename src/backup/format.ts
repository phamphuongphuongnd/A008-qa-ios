/**
 * The backup file envelope (S-22): a fixed header + AES-256-GCM ciphertext of a zip (see pack.ts).
 *
 *   0  magic "EVLBAK" (6)          28 nonce (12)
 *   6  format version (1)          40 key check (16) = sha256("evenlease-key-check" ‖ key)[0..16]
 *   7  KDF id (1): 1 = PBKDF2-SHA256   56 header checksum (8) = sha256(bytes 0..56)[0..8]
 *   8  KDF cost (u32 BE): iterations   64 ciphertext + 16-byte GCM tag; AAD = bytes 0..64
 *  12  salt (16)
 *
 * Errors tell apart: not a backup · made by a newer app · damaged header / data · wrong password (the key check).
 * The KDF cost is written in every file, so `BACKUP_KDF` can be tuned (measure on the A13) without breaking old files.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { pbkdf2Sha256 } from './kdf';

export const MAGIC = utf8ToBytes('EVLBAK');
export const FORMAT_VERSION = 1;
export const KDF_PBKDF2_SHA256 = 1;
export const HEADER_LENGTH = 64;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const CHECK_LEN = 16;

/**
 * Password → key cost. PBKDF2 runs in native code on the phone (./kdf.ts, B-101: JS took 14 min on the A13 for
 * 310 000). TODO(A13): time native deriveKey on the A13 release build before raising it (OWASP 2023: 600 000).
 */
export const BACKUP_KDF = { id: KDF_PBKDF2_SHA256, iterations: 310_000 } as const;
export const MIN_PASSWORD_LENGTH = 8;

export type BackupErrorCode =
  | 'not_backup'
  | 'newer_version'
  | 'corrupt'
  | 'wrong_password'
  | 'no_password'
  | 'no_space'
  | 'folder_gone';

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export type Rng = (length: number) => Uint8Array;

/** Key derived from the backup password, kept on this phone so weekly backups run without asking (keyStore.ts). */
export interface BackupKey {
  kdf: number;
  iterations: number;
  salt: Uint8Array;
  key: Uint8Array;
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = BACKUP_KDF.iterations,
  kdf: number = BACKUP_KDF.id,
): Promise<BackupKey> {
  if (kdf !== KDF_PBKDF2_SHA256) throw new BackupError('newer_version', `unknown kdf ${kdf}`);
  const key = await pbkdf2Sha256(utf8ToBytes(password.normalize('NFC')), salt, iterations, 32);
  return { kdf, iterations, salt, key };
}

/** New random salt + key for a password the landlord just set. */
export function newBackupKey(password: string, rng: Rng, iterations: number = BACKUP_KDF.iterations): Promise<BackupKey> {
  return deriveKey(password, rng(SALT_LEN), iterations);
}

const keyCheck = (key: Uint8Array) => sha256(concatBytes(utf8ToBytes('evenlease-key-check'), key)).slice(0, CHECK_LEN);

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export interface BackupHeader {
  version: number;
  kdf: number;
  iterations: number;
  salt: Uint8Array;
  nonce: Uint8Array;
  check: Uint8Array;
}

function writeHeader(k: BackupKey, nonce: Uint8Array): Uint8Array {
  const h = new Uint8Array(HEADER_LENGTH);
  h.set(MAGIC, 0);
  h[6] = FORMAT_VERSION;
  h[7] = k.kdf;
  new DataView(h.buffer).setUint32(8, k.iterations, false);
  h.set(k.salt, 12);
  h.set(nonce, 28);
  h.set(keyCheck(k.key), 40);
  h.set(sha256(h.subarray(0, 56)).subarray(0, 8), 56);
  return h;
}

/** Reads and checks the header only (before asking for the password). */
export function readHeader(file: Uint8Array): BackupHeader {
  if (file.length < MAGIC.length || !equal(file.subarray(0, MAGIC.length), MAGIC)) throw new BackupError('not_backup');
  if (file.length < HEADER_LENGTH + 16) throw new BackupError('corrupt', 'too short');
  const version = file[6];
  if (!equal(file.subarray(56, 64), sha256(file.subarray(0, 56)).subarray(0, 8))) throw new BackupError('corrupt', 'header');
  if (version > FORMAT_VERSION) throw new BackupError('newer_version');
  if (version < 1) throw new BackupError('corrupt', 'version');
  const kdf = file[7];
  if (kdf !== KDF_PBKDF2_SHA256) throw new BackupError('newer_version', 'kdf');
  const iterations = new DataView(file.buffer, file.byteOffset, file.byteLength).getUint32(8, false);
  if (iterations < 1) throw new BackupError('corrupt', 'iterations');
  return {
    version,
    kdf,
    iterations,
    salt: file.slice(12, 12 + SALT_LEN),
    nonce: file.slice(28, 28 + NONCE_LEN),
    check: file.slice(40, 40 + CHECK_LEN),
  };
}

/** Encrypts `plain` (the zip) with a fresh random nonce. */
export function seal(plain: Uint8Array, k: BackupKey, rng: Rng): Uint8Array {
  const header = writeHeader(k, rng(NONCE_LEN));
  const nonce = header.subarray(28, 28 + NONCE_LEN);
  const sealed = gcm(k.key, nonce, header).encrypt(plain);
  return concatBytes(header, sealed);
}

/** The password's key for this file; throws 'wrong_password' when it doesn't match the file's key check. */
export async function keyForFile(file: Uint8Array, password: string): Promise<BackupKey> {
  const h = readHeader(file);
  const k = await deriveKey(password, h.salt, h.iterations, h.kdf);
  if (!equal(keyCheck(k.key), h.check)) throw new BackupError('wrong_password');
  return k;
}

/** Decrypts with a key that passed the key check; a failed tag means the data was damaged. */
export function open(file: Uint8Array, k: BackupKey): Uint8Array {
  const h = readHeader(file);
  if (!equal(keyCheck(k.key), h.check)) throw new BackupError('wrong_password');
  try {
    return gcm(k.key, h.nonce, file.subarray(0, HEADER_LENGTH)).decrypt(file.subarray(HEADER_LENGTH));
  } catch {
    throw new BackupError('corrupt', 'tag');
  }
}

/** Serialized form stored on the phone (never in a backup file). */
export function keyToJson(k: BackupKey): string {
  return JSON.stringify({ kdf: k.kdf, iterations: k.iterations, salt: bytesToHex(k.salt), key: bytesToHex(k.key) });
}

export function keyFromJson(json: string | null | undefined): BackupKey | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as { kdf: number; iterations: number; salt: string; key: string };
    const key = hexToBytes(o.key);
    if (key.length !== 32 || !Number.isInteger(o.iterations)) return null;
    return { kdf: o.kdf, iterations: o.iterations, salt: hexToBytes(o.salt), key };
  } catch {
    return null;
  }
}

export type PasswordError = 'short' | 'mismatch';

/** S-22 first backup: password typed twice, at least 8 characters. */
export function validateBackupPassword(password: string, again: string): PasswordError | null {
  if ([...password].length < MIN_PASSWORD_LENGTH) return 'short';
  if (password !== again) return 'mismatch';
  return null;
}
