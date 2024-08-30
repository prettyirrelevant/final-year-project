import type { Logger } from './logger';

interface CacheOptions {
  expirationTtl?: number;
  namespace?: string;
}

interface KVCacheInit {
  kv: KVNamespace;
  logger: Logger;
}

export class KVCache {
  private namespace: string;
  private kv: KVNamespace;
  private logger: Logger;

  constructor(options: KVCacheInit & CacheOptions) {
    this.kv = options.kv;
    this.logger = options.logger;
    this.namespace = options.namespace || '';
  }

  private getNamespacedKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = this.getNamespacedKey(key);
    this.logger.debug({
      msg: `Attempting to get value for key: ${namespacedKey}`,
      service: 'cache',
    });

    try {
      const value = await this.kv.get(namespacedKey);
      if (value === null) {
        this.logger.info({
          msg: `No value found for key: ${namespacedKey}`,
          service: 'cache',
        });
        return null;
      }

      const parsedValue = JSON.parse(value) as T;
      this.logger.debug({
        msg: `Successfully retrieved and parsed value for key: ${namespacedKey}`,
        service: 'cache',
      });
      return parsedValue;
    } catch (error) {
      this.logger.error({
        msg: `Error retrieving or parsing cached value for key: ${namespacedKey}`,
        error: error as Error,
        service: 'cache',
      });
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key);
    this.logger.debug({
      msg: `Attempting to set value for key: ${namespacedKey}`,
      service: 'cache',
    });

    try {
      const serializedValue = JSON.stringify(value);
      await this.kv.put(namespacedKey, serializedValue, {
        expirationTtl: options.expirationTtl,
      });
      this.logger.info({
        msg: `Successfully set value for key: ${namespacedKey}`,
        service: 'cache',
      });
    } catch (error) {
      this.logger.error({
        msg: `Error setting value for key: ${namespacedKey}`,
        error: error as Error,
        service: 'cache',
      });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key);
    this.logger.debug({
      msg: `Attempting to delete key: ${namespacedKey}`,
      service: 'cache',
    });

    try {
      await this.kv.delete(namespacedKey);
      this.logger.info({
        msg: `Successfully deleted key: ${namespacedKey}`,
        service: 'cache',
      });
    } catch (error) {
      this.logger.error({
        msg: `Error deleting key: ${namespacedKey}`,
        error: error as Error,
        service: 'cache',
      });
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    this.logger.debug({
      msg: `Checking existence of key: ${namespacedKey}`,
      service: 'cache',
    });

    try {
      const value = await this.kv.get(namespacedKey);
      const exists = value !== null;
      this.logger.debug({
        msg: `Key ${namespacedKey} exists: ${exists}`,
        service: 'cache',
      });
      return exists;
    } catch (error) {
      this.logger.error({
        msg: `Error checking existence of key: ${namespacedKey}`,
        error: error as Error,
        service: 'cache',
      });
      throw error;
    }
  }

  async *list(options?: KVNamespaceListOptions): AsyncIterableIterator<string> {
    this.logger.debug({ msg: 'Starting to list keys', service: 'cache' });
    let cursor: string | undefined;
    let count = 0;

    try {
      do {
        const result = await this.kv.list({ ...options, cursor });
        for (const key of result.keys) {
          count++;
          const yieldKey = this.namespace
            ? key.name.slice(this.namespace.length + 1)
            : key.name;
          yield yieldKey;
        }
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);

      this.logger.info({ msg: `Listed ${count} keys`, service: 'cache' });
    } catch (error) {
      this.logger.error({
        msg: 'Error listing keys',
        error: error as Error,
        service: 'cache',
      });
      throw error;
    }
  }

  async clear(prefix = ''): Promise<void> {
    const namespacedPrefix = this.getNamespacedKey(prefix);
    this.logger.debug({
      msg: `Starting to clear keys with prefix: ${namespacedPrefix}`,
      service: 'cache',
    });
    let deletedCount = 0;

    try {
      for await (const key of this.list({ prefix: namespacedPrefix })) {
        await this.delete(key);
        deletedCount++;
      }
      this.logger.info({
        msg: `Cleared ${deletedCount} keys with prefix: ${namespacedPrefix}`,
        service: 'cache',
      });
    } catch (error) {
      this.logger.error({
        msg: `Error clearing keys with prefix: ${namespacedPrefix}`,
        error: error as Error,
        service: 'cache',
      });
      throw error;
    }
  }
}
