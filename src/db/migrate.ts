import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { expoDb } from './client';

let running: Promise<void> | null = null;

/**
 * Runs the bundled migrations once per JS runtime. Awaited by the root layout before any screen reads the database,
 * and by anything that can start without a screen (notification taps, background tasks). Retried on the next call
 * after a failure.
 */
export function ensureMigrated(): Promise<void> {
  running ??= migrate(expoDb, migrations).catch((e: unknown) => {
    running = null;
    throw e;
  });
  return running;
}
