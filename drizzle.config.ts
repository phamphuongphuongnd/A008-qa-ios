import type { Config } from 'drizzle-kit';

// Schema and migrations are owned by session 1C (src/db/**, drizzle/**).
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
