import { sql } from 'drizzle-orm';

import { FILE_ROOTS, type FileStore } from '../files';
import {
  applicants,
  attempts,
  background,
  criteria,
  criteriaHistory,
  decisions,
  documents,
  incomes,
  letters,
  movein,
  references,
  rentals,
  reports,
  residences,
  settings,
  timers,
} from '../schema';
import type { AppDb } from '../types';

/** Tables in insert order (parents first). Keys are the SQL table names (= `useLive` table names). */
const TABLES = {
  rentals,
  criteria,
  criteria_history: criteriaHistory,
  applicants,
  residences,
  incomes,
  documents,
  references,
  attempts,
  reports,
  background,
  decisions,
  letters,
  timers,
  movein,
  settings,
} as const;
export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

/** Every row of every table — the body of a backup file (S-22; packing / encryption is the backup service's). */
export type DataDump = { [K in TableName]: (typeof TABLES)[K]['$inferSelect'][] };

export function dumpAll(db: AppDb): DataDump {
  const out = {} as Record<TableName, unknown[]>;
  for (const name of TABLE_NAMES) out[name] = db.select().from(TABLES[name]).all();
  return out as DataDump;
}

/** S-27 "Delete all data": every row and every applicant / rental file; ids restart (old deep links reach nothing). */
export function deleteAllData(db: AppDb, files: FileStore): void {
  db.transaction((tx) => {
    for (const name of [...TABLE_NAMES].reverse()) tx.delete(TABLES[name]).run();
    tx.run(sql`delete from sqlite_sequence`);
  });
  for (const root of FILE_ROOTS) files.deleteDir(root);
}

/** S-22 Restore "Replace": one transaction — a bad file leaves the old data untouched. Files are the caller's. */
export function replaceAllData(db: AppDb, dump: DataDump): void {
  db.transaction((tx) => {
    for (const name of [...TABLE_NAMES].reverse()) tx.delete(TABLES[name]).run();
    tx.run(sql`delete from sqlite_sequence`);
    for (const name of TABLE_NAMES) {
      const rows = dump[name] ?? [];
      // Chunks keep each statement under SQLite's variable limit.
      for (let i = 0; i < rows.length; i += 40) {
        const chunk = rows.slice(i, i + 40);
        if (chunk.length) tx.insert(TABLES[name] as typeof settings).values(chunk as (typeof settings.$inferInsert)[]).run();
      }
    }
  });
}

/** Counts for the restore preview ("2 rentals · 7 applicants"). Data-deleted applicants are not counted. */
export function countDump(dump: DataDump): { rentals: number; applicants: number } {
  return { rentals: dump.rentals.length, applicants: dump.applicants.filter((a) => a.deletedAt === null && !a.draft).length };
}
