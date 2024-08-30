import path from 'node:path';
import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'src/database/migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      reporters: ['html'],
      includeTaskLocation: true,
      setupFiles: ['./__tests__/utils/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: false,
          miniflare: {
            kvNamespaces: ['KV'],
            d1Databases: ['DB'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
          wrangler: { configPath: './wrangler.toml' },
        },
      },
    },
  };
});
