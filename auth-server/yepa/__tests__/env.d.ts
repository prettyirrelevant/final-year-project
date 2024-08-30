declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    KV: KVNamespace;
    TEST_MIGRATIONS: D1Migration[];
  }
}
