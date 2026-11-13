import { Router } from 'express';
import { z } from 'zod';
import { setSession } from '../auth.js';
import type { Deps } from '../deps.js';
import { notFound } from '../errors.js';
import { parseBody } from '../validate.js';

const SignInBody = z.strictObject({ personId: z.string().regex(/^per_[A-Za-z0-9_-]{12}$/) });

/**
 * Routes for end-to-end tests only. `createApp` mounts this router only when `config.testRoutes`
 * is set, which happens only when NODE_ENV is "test"; the routes check it again, so they can never
 * answer in development or production.
 *
 *   POST /api/test/sign-in — { personId }: the session becomes that existing (seeded) person
 */
export function testOnlyRouter(deps: Deps): Router {
  const r = Router();
  r.post('/test/sign-in', async (req, res, next) => {
    if (!deps.config.testRoutes) return next();
    const { personId } = parseBody(SignInBody, req.body);
    const person = await deps.store.get('persons', personId);
    if (!person) throw notFound('That person');
    setSession(deps, res, person.id);
    res.json({ personId: person.id });
  });
  return r;
}
