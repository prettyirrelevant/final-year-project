import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  strict: true,
  dialect: 'sqlite',
  driver: 'd1-http',
  out: './src/database/migrations',
  schema: './src/database/schema.ts',
  dbCredentials: {
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
