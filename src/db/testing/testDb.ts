import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import type { FileStore } from '../files';
import * as schema from '../schema';
import type { AppDb } from '../types';

/**
 * Fresh in-memory database with the same migrations the app ships (Jest only).
 *
 * `db.transaction()` behaves like expo-sqlite on the phone: it throws when a transaction is already open (expo-sqlite
 * runs a raw `begin`; better-sqlite3 would silently nest with a savepoint and hide the bug — B-53). Inside a
 * transaction, pass `tx` down: `tx.transaction()` (a savepoint) works on both drivers.
 */
export function makeTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  const begin = db.transaction.bind(db);
  db.transaction = ((fn, config) => {
    if (sqlite.inTransaction) throw new Error("Failed to run the query 'begin' (cannot start a transaction within a transaction)");
    return begin(fn, config);
  }) as typeof db.transaction;
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
