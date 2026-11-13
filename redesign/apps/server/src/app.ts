import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Request, type RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sessionMiddleware } from './auth.js';
import type { Deps } from './deps.js';
import { errorHandler, HttpError } from './errors.js';
import { assembliesRouter } from './routes/assemblies.js';
import { conversationsRouter } from './routes/conversations.js';
import { decidingRouter } from './routes/deciding.js';
import { deliveryRouter } from './routes/delivery.js';
import { feedbackRouter } from './routes/feedback.js';
import { hostRouter } from './routes/host.js';
import { howRouter } from './routes/how.js';
import { listeningRouter } from './routes/listening.js';
import { mediationsRouter } from './routes/mediations.js';
import { myDataRouter } from './routes/mydata.js';
import { pictureRouter } from './routes/picture.js';
import { registerRouter } from './routes/register.js';
import { roomsRouter } from './routes/rooms.js';
import { sessionRouter } from './routes/session.js';
import { statementsRouter } from './routes/statements.js';
import { stewardRouter } from './routes/steward.js';
import { testOnlyRouter } from './routes/testOnly.js';

const isWrite = (req: Request) => !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
const addressKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');
const sessionKey = (req: Request) => req.personId ?? `ip:${addressKey(req)}`;

function limiter(limit: number, key: (req: Request) => string, skip: (req: Request) => boolean): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key,
    skip,
    handler: (_req, res) =>
      void res.status(429).json({ error: { code: 'too_many', message: 'That was a lot of requests in a short time. Please wait a minute and try again.' } }),
  });
}

/** Conversation, feedback and intake turns: 20 a minute. */
const TURN_PATHS = /^\/api\/(conversations\/[^/]+\/turns|feedback\/[^/]+\/turns|host\/intake\/[^/]+\/turns)$/;

/** Builds the app from its dependencies, so tests can use an in-memory store and a fake AI runner. */
export function createApp(deps: Deps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
  app.use(cookieParser(deps.config.secret));
  app.use(sessionMiddleware());
  app.use('/api', express.json({ limit: '1mb' }));

  if (deps.config.rateLimits) {
    // Section 7: 60 writes a minute per session and per address; turns 20 a minute.
    app.use('/api', limiter(60, sessionKey, (req) => !isWrite(req)));
    app.use('/api', limiter(60, addressKey, (req) => !isWrite(req)));
    app.use(limiter(20, sessionKey, (req) => !(isWrite(req) && TURN_PATHS.test(req.path))));
  }

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  for (const router of [
    sessionRouter,
    myDataRouter,
    assembliesRouter,
    howRouter,
    conversationsRouter,
    pictureRouter,
    statementsRouter,
    mediationsRouter,
    listeningRouter,
    roomsRouter,
    decidingRouter,
    deliveryRouter,
    registerRouter,
    hostRouter,
    stewardRouter,
    feedbackRouter,
  ])
    app.use('/api', router(deps));
  if (deps.config.testRoutes) app.use('/api', testOnlyRouter(deps));

  app.use('/api', (req) => {
    throw new HttpError(404, 'not_found', `There is nothing at ${req.method} /api${req.path}.`);
  });

  // The built web app, with client-side routing.
  if (fs.existsSync(path.join(deps.config.webDist, 'index.html'))) {
    app.use(express.static(deps.config.webDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/(api|healthz)\b).*/, (_req, res) => res.sendFile(path.join(deps.config.webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
