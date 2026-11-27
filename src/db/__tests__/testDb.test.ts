import { makeTestDb } from '../testing/testDb';

// B-53: expo-sqlite runs a raw `begin` for db.transaction(), so a second db.transaction() inside an open one fails on
// the phone. better-sqlite3 would nest silently; the test db must fail the same way the phone does.
describe('test db follows expo-sqlite transaction rules', () => {
  it('db.transaction() inside a transaction throws', () => {
    const db = makeTestDb();
    expect(() => db.transaction(() => db.transaction(() => 1))).toThrow(/begin/);
    // The failed attempt rolled back; the db is usable again.
    expect(db.transaction(() => 2)).toBe(2);
  });

  it('tx.transaction() (a savepoint) is allowed', () => {
    const db = makeTestDb();
    expect(db.transaction((tx) => tx.transaction(() => 3))).toBe(3);
  });
});
