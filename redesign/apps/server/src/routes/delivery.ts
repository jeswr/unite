import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Delivering. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/assemblies/:slug/decisions
 *   GET /api/decisions/:id — decision, statement, trace to themes and point counts, answer, proposals, delivery items, check
 *   POST /api/decisions/:id/answer — host
 *   POST /api/decisions/:id/proposals
 *   PATCH /api/proposals/:id — host: choose; steward: confirm faithful
 *   POST /api/decisions/:id/delivery
 *   PATCH /api/delivery/:id — host: status, update
 *   POST /api/decisions/:id/check — steward or checker only; sets delivered_* or not_delivered (rule 7)
 */
export function deliveryRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/assemblies/:slug/decisions', notBuilt);
  r.get('/decisions/:id', notBuilt);
  r.post('/decisions/:id/answer', notBuilt);
  r.post('/decisions/:id/proposals', notBuilt);
  r.patch('/proposals/:id', notBuilt);
  r.post('/decisions/:id/delivery', notBuilt);
  r.patch('/delivery/:id', notBuilt);
  r.post('/decisions/:id/check', notBuilt);
  return r;
}
