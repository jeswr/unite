import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Hosts (section 6.5). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   POST /api/host/intake — start the intake interview
 *   POST /api/host/intake/:id/turns — (limited to 20 a minute in app.ts)
 *   POST /api/host/assemblies — create in proposed
 *   PATCH /api/host/assemblies/:slug — question, probes, groups, pledge
 *   POST /api/host/assemblies/:slug/invites
 *   POST /api/check-leading
 */
export function hostRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.post('/host/intake', notBuilt);
  r.post('/host/intake/:id/turns', notBuilt);
  r.post('/host/assemblies', notBuilt);
  r.patch('/host/assemblies/:slug', notBuilt);
  r.post('/host/assemblies/:slug/invites', notBuilt);
  r.post('/check-leading', notBuilt);
  return r;
}
