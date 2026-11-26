import { randomBytes } from 'crypto';

import type { FolderPort } from '../auto';
import type { Rng } from '../format';
import type { AppFileIO } from '../service';

export const testRng: Rng = (n) => new Uint8Array(randomBytes(n));

/** In-memory document directory. */
export function makeFakeIO(initial: Record<string, Uint8Array> = {}) {
  const files = new Map(Object.entries(initial));
  const under = (dir: string) => [...files.keys()].filter((p) => p.startsWith(`${dir}/`));
  const io: AppFileIO & { failWrites?: boolean } = {
    async listFiles(root) {
      return under(root);
    },
    async readBytes(path) {
      const b = files.get(path);
      if (!b) throw new Error('missing');
      return b;
    },
    async writeBytes(path, bytes) {
      if (io.failWrites) throw new Error('disk');
      files.set(path, bytes);
    },
    async deleteDir(path) {
      for (const p of under(path)) files.delete(p);
    },
    async moveDir(from, to) {
      for (const p of under(from)) {
        files.set(`${to}${p.slice(from.length)}`, files.get(p)!);
        files.delete(p);
      }
    },
  };
  return { io, files };
}

export function makeFakeFolder() {
  const files = new Map<string, Uint8Array>();
  let gone = false;
  const port: FolderPort = {
    async list() {
      if (gone) throw new Error('gone');
      return [...files.keys()];
    },
    async write(name, bytes) {
      if (gone) throw new Error('gone');
      files.set(name, bytes);
    },
    async remove(name) {
      files.delete(name);
    },
  };
  return {
    port,
    files,
    setGone: (g: boolean) => {
      gone = g;
    },
  };
}

export const bytes = (s: string) => new TextEncoder().encode(s);
