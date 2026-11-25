import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import type { FileStore } from '../files';
import * as schema from '../schema';
import type { AppDb } from '../types';

/** Fresh in-memory database with the same migrations the app ships (Jest only). */
export function makeTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  return db as unknown as AppDb;
}

/** In-memory file store: records what exists and what was deleted. */
export function makeTestFiles(initial: string[] = []): FileStore & { files: Set<string> } {
  const files = new Set(initial);
  return {
    files,
    deleteFile(p) {
      files.delete(p);
    },
    deleteDir(dir) {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`;
      for (const f of [...files]) if (f.startsWith(prefix)) files.delete(f);
    },
  };
}
