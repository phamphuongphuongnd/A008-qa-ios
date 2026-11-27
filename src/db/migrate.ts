import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { expoDb, sqlite } from './client';

let running: Promise<void> | null = null;

/**
 * Runs the bundled migrations once per JS runtime. Awaited by the root layout before any screen reads the database,
 * and by anything that can start without a screen (notification taps, background tasks). Retried on the next call
 * after a failure.
 */
export function ensureMigrated(): Promise<void> {
  running ??= migrate(expoDb, migrations)
    .then(() => assertSchema(sqlite))
    .catch((e: unknown) => {
      running = null;
      throw e;
    });
  return running;
}

/** Tables every screen relies on. */
export const REQUIRED_TABLES = ['rentals', 'applicants', 'settings'] as const;

/**
 * After migrating, the app's own tables must exist. A wrong migration bundle (2026-11-27: a shared Metro cache shipped
 * another app's SQL) "succeeds" with the wrong schema; failing here shows the database error screen instead of
 * crashing on the first query.
 */
export function assertSchema(conn: Pick<typeof sqlite, 'getAllSync'>): void {
  const rows = conn.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  const have = new Set(rows.map((r) => r.name));
  const missing = REQUIRED_TABLES.filter((t) => !have.has(t));
  if (missing.length > 0) throw new Error(`Database schema is missing tables: ${missing.join(', ')}`);
}
