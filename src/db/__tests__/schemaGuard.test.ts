import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../client', () => ({ expoDb: {}, sqlite: {} }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({ migrate: jest.fn() }));
jest.mock('../../../drizzle/migrations', () => ({ __esModule: true, default: {} }));

// eslint-disable-next-line import/first
import { assertSchema, REQUIRED_TABLES } from '../migrate';

const conn = (names: string[]) => ({
  getAllSync: <T,>() => names.map((name) => ({ name })) as unknown as T[],
});

describe('schema guard after migrations (wrong bundle shipped another app’s SQL, 2026-11-27)', () => {
  it('passes when the app tables exist', () => {
    expect(() => assertSchema(conn(['__drizzle_migrations', ...REQUIRED_TABLES, 'timers']) as never)).not.toThrow();
  });

  it('fails on another app’s schema', () => {
    expect(() => assertSchema(conn(['__drizzle_migrations', 'cards', 'loan_offers']) as never)).toThrow(/rentals/);
  });

  it('the bundled migration creates every required table', () => {
    const sql = readFileSync(join(__dirname, '../../../drizzle/0000_init.sql'), 'utf8');
    for (const t of REQUIRED_TABLES) expect(sql).toContain(`CREATE TABLE \`${t}\``);
  });
});
