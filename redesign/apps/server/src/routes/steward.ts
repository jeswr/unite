import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Steward (feedback). Other steward actions live with their area. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/steward/feedback — list, counts, themes summary with sources
 *   PATCH /api/steward/feedback/:id — status and reason
 *   GET /api/steward/feedback/export — ?format=json|csv
 */
export function stewardRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/steward/feedback', notBuilt);
  r.patch('/steward/feedback/:id', notBuilt);
  r.get('/steward/feedback/export', notBuilt);
  return r;
}
