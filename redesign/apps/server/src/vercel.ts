import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { loadConfig } from './config.js';

/**
 * Unite as a Vercel function (not deployed in this build). Every request reaches this handler. The
 * first request on an instance opens the database and builds the app. It needs Postgres: with no
 * DATABASE_URL each instance would have a PGlite of its own that vanishes, so it refuses instead.
 */
export function createHandler() {
  let ready: Promise<express.Express> | undefined;
  const start = async () => {
    const config = loadConfig();
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not set: Unite on Vercel needs Postgres.');
    const [{ boot }, { createApp }] = await Promise.all([import('./boot.js'), import('./app.js')]);
    return createApp(await boot(config));
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
