import { vValidator } from '@hono/valibot-validator';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { poweredBy } from 'hono/powered-by';
import { prettyJSON } from 'hono/pretty-json';

import { KVCache } from '@/common/cache';
import { type Logger, createLogger } from '@/common/logger';
import { schema } from '@/database';
import {
  calculateExpirationDate,
  generateOtp,
  sendTransactionalEmail,
  verifyOtp,
} from '@/helpers';
import { AuthCompletionValidator, AuthInitiationValidator } from '@/validators';
import { newId } from './common/id';

const app = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    PLUNK_API_KEY: string;
  };
  Variables: {
    services: {
      db: DrizzleD1Database<typeof schema>;
      logger: Logger;
      cache: KVCache;
    };
  };
}>({ strict: true });

const routes = app
  .use(prettyJSON())
  .use(poweredBy())
  .use(cors())
  .use(async (c, next) => {
    const db = drizzle(c.env.DB, { schema });
    const logger = createLogger({ level: 'info', mode: 'pretty' });
    const cache = new KVCache({ expirationTtl: 86400, kv: c.env.KV, logger });

    c.set('services', { logger, db, cache });

    await next();
  })
  .get('/', (c) =>
    c.json({ success: true, message: 'neuron API is up and running!' }),
  )
  .post(
    '/api/auth/initiate',
    vValidator('json', AuthInitiationValidator),
    async (c) => {
      const { email } = c.req.valid('json');
      const { logger, cache } = c.get('services');

      try {
        const userId = newId('user');
        const otp = generateOtp({ length: 6 });
        const expiresAt = calculateExpirationDate(10, 'minutes');

        await cache.set(
          `otp:${userId}`,
          { otp, expiresAt: expiresAt.toISOString(), email },
          { expirationTtl: 600 }, // 10 minutes
        );

        await sendTransactionalEmail(c.env.PLUNK_API_KEY, {
          to: email,
          logger: logger,
          templateName: 'otp',
          templateOptions: { otp: otp, expirationMinutes: 10 },
        });

        return c.json({
          success: true,
          message: 'OTP sent to provided email address',
          data: { id: userId },
        });
      } catch (error) {
        logger.error({
          msg: 'error in auth initiation',
          error: error as Error,
          service: 'api',
        });
        return c.json(
          { success: false, message: 'Internal server error' },
          500,
        );
      }
    },
  )
  .post(
    '/api/auth/complete',
    vValidator('json', AuthCompletionValidator),
    async (c) => {
      const { id, otp } = c.req.valid('json');
      const { logger, cache, db } = c.get('services');

      try {
        const { isValid, message } = await verifyOtp({
          cache,
          userId: id,
          otpToVerify: otp,
        });
        if (!isValid) {
          return c.json({ success: false, message }, 400);
        }

        const cachedData = await cache.get<{ email: string }>(`otp:${id}`);
        if (!cachedData) {
          return c.json(
            { success: false, message: 'OTP not found or expired' },
            400,
          );
        }

        const { email } = cachedData;

        await db
          .insert(schema.users)
          .values({
            email,
            id: id,
          })
          .onConflictDoNothing();

        await cache.delete(`otp:${id}`);

        return c.json({
          success: true,
          message: 'Authentication successful',
        });
      } catch (error) {
        logger.error({
          msg: 'error in auth completion',
          error: error as Error,
          service: 'api',
        });
        return c.json(
          { success: false, message: 'Internal server error' },
          500,
        );
      }
    },
  )
  .onError((err, c) => {
    const { logger } = c.get('services');

    logger.error({
      service: 'api',
      error: err,
      msg: 'error occurred while processing request',
    });
    const status = err instanceof HTTPException ? err.status : 500;
    return c.json({ success: false, message: err.message }, status);
  })
  .notFound((c) => {
    return c.json({ success: false, message: `${c.req.path} not found` }, 404);
  });

export default routes;
