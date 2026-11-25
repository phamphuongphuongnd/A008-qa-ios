/**
 * 1A smoke test: repository tests run Drizzle on better-sqlite3 (in memory) under Jest. 1C replaces it with real tests.
 */
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const rentals = sqliteTable('rentals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  address: text('address').notNull(),
  rentCents: integer('rent_cents').notNull(),
});

describe('sqlite test driver', () => {
  it('creates, writes and reads a table', () => {
    const db = drizzle(new Database(':memory:'));
    db.run(sql`CREATE TABLE rentals (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL, rent_cents INTEGER NOT NULL)`);
    db.insert(rentals).values({ address: '1428 Maple St, Unit B', rentCents: 185000 }).run();
    expect(db.select().from(rentals).all()).toEqual([{ id: 1, address: '1428 Maple St, Unit B', rentCents: 185000 }]);
  });
});
