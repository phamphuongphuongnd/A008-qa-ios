/**
 * Inside the encrypted envelope: a zip with
 *   manifest.json — format, schema version, creation time, counts, and size + SHA-256 of every file
 *   data.json     — every table row (1C `dumpAll`, minus this phone's own settings)
 *   files/…       — the attachments under applicants/ and rentals/, same relative paths
 * Photos / PDFs are stored without recompression (already compressed); JSON is deflated.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import type { DataDump } from '@/db/repos/data';
import { assertAppPath } from '@/files/paths';

import journal from '../../drizzle/meta/_journal.json';
import { BackupError } from './format';

/** Database schema version = number of migrations this app ships. A file from a newer schema can't be restored. */
export const SCHEMA_VERSION = journal.entries.length;
export const PACK_FORMAT = 1;

export interface Manifest {
  app: 'evenlease';
  pack: number;
  schema: number;
  createdAt: string;
  appVersion: string | null;
  counts: { rentals: number; applicants: number; files: number };
  files: Record<string, { size: number; sha256: string }>;
}

export interface PackInput {
  dump: DataDump;
  /** Relative path (applicants/…, rentals/…) → bytes. */
  files: Record<string, Uint8Array>;
  createdAt: string;
  appVersion?: string | null;
  counts: { rentals: number; applicants: number };
}

const STORED = /\.(jpe?g|png|webp|heic|pdf|zip)$/i;

export function pack(input: PackInput): Uint8Array {
  const manifest: Manifest = {
    app: 'evenlease',
    pack: PACK_FORMAT,
    schema: SCHEMA_VERSION,
    createdAt: input.createdAt,
    appVersion: input.appVersion ?? null,
    counts: { ...input.counts, files: Object.keys(input.files).length },
    files: {},
  };
  const zip: Zippable = { 'data.json': [strToU8(JSON.stringify(input.dump)), { level: 6 }] };
  for (const [path, bytes] of Object.entries(input.files)) {
    assertAppPath(path);
    manifest.files[path] = { size: bytes.length, sha256: bytesToHex(sha256(bytes)) };
    zip[`files/${path}`] = [bytes, { level: STORED.test(path) ? 0 : 6 }];
  }
  zip['manifest.json'] = [strToU8(JSON.stringify(manifest)), { level: 6 }];
  return zipSync(zip);
}

export interface Unpacked {
  manifest: Manifest;
  dump: DataDump;
  files: Record<string, Uint8Array>;
}

/** Unzips and checks everything (schema version, JSON, every file's size + hash, safe paths) before any write. */
export function unpack(zipBytes: Uint8Array): Unpacked {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch {
    throw new BackupError('corrupt', 'zip');
  }
  const parse = <T>(name: string): T => {
    const e = entries[name];
    if (!e) throw new BackupError('corrupt', `missing ${name}`);
    try {
      return JSON.parse(strFromU8(e)) as T;
    } catch {
      throw new BackupError('corrupt', `bad ${name}`);
    }
  };
  const manifest = parse<Manifest>('manifest.json');
  if (manifest.app !== 'evenlease') throw new BackupError('not_backup');
  if (manifest.pack > PACK_FORMAT || manifest.schema > SCHEMA_VERSION) throw new BackupError('newer_version');
  const dump = parse<DataDump>('data.json');
  if (!dump || typeof dump !== 'object' || !Array.isArray(dump.rentals)) throw new BackupError('corrupt', 'dump');

  const files: Record<string, Uint8Array> = {};
  for (const [path, meta] of Object.entries(manifest.files ?? {})) {
    try {
      assertAppPath(path);
    } catch {
      throw new BackupError('corrupt', 'path');
    }
    const bytes = entries[`files/${path}`];
    if (!bytes || bytes.length !== meta.size || bytesToHex(sha256(bytes)) !== meta.sha256) throw new BackupError('corrupt', 'file');
    files[path] = bytes;
  }
  return { manifest, dump, files };
}
