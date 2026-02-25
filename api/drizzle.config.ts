import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/core/db/postgres/schema.ts',
  out: './src/core/db/postgres/migrations',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
