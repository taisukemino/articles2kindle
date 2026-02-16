import { defineConfig } from 'drizzle-kit';
import { getDatabasePath } from './src/config/paths.js';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabasePath(),
  },
});
