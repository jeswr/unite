import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Register. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/register — ?assembly=&host=&status=: all decisions with assembly and host, days late, registerSummary
 *   GET /api/hosts/:hostSlug — the host record
 */
export function registerRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/register', notBuilt);
  r.get('/hosts/:hostSlug', notBuilt);
  return r;
}
