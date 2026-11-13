import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { loadConfig } from './config.js';

/**
 * Unite as a Vercel function. Every request reaches this handler. The first request on an instance
 * opens the database and builds the app. It needs Postgres: with no DATABASE_URL each instance would
 * have a PGlite of its own that vanishes, so it refuses instead, unless demo mode is on (UNITE_DEMO=1).
 * Then each instance opens PGlite in memory and seeds the examples: a demonstration whose additions
 * are lost whenever the instance is recycled, and are not shared between instances.
 */
export function createHandler() {
  let ready: Promise<express.Express> | undefined;
  const start = async () => {
    let config = loadConfig();
    if (!config.databaseUrl) {
      if (!config.demo) throw new Error('DATABASE_URL is not set: Unite on Vercel needs Postgres (or UNITE_DEMO=1 for a demonstration).');
      console.warn(
        '[vercel] Demo mode with no DATABASE_URL: the store is in memory on this instance. The examples are seeded on start; anything added is lost when the instance stops and is not shared with other instances.',
      );
      config = { ...config, dataDir: 'memory' };
    }
    const started = Date.now();
    const [{ boot }, { createApp }] = await Promise.all([import('./boot.js'), import('./app.js')]);
    const app = createApp(await boot(config));
    console.log(`[vercel] ready in ${Date.now() - started} ms`);
    return app;
  };
  return async (req: IncomingMessage, res: ServerResponse) => {
    let app: express.Express;
    try {
      app = await (ready ??= start());
    } catch (err) {
      ready = undefined; // the next request tries again (the database may have been asleep)
      console.error('[vercel] could not start', err);
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      res.setHeader('retry-after', '5');
      return void res.end(JSON.stringify({ error: { code: 'starting', message: 'Unite is starting up. Please try again in a moment.' } }));
    }
    app(req as express.Request, res as express.Response);
  };
}
