import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Picture (section 6.3). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/assemblies/:slug/picture — themes with people counts, sentences with sources, quotes (anonymous or named points only), who is missing, totals, my own points marked. Rule 1: requireHeard
 *   GET /api/themes/:id/points — Rule 1: requireHeard
 *   POST /api/assemblies/:slug/picture/update — steward or host
 *   POST /api/assemblies/:slug/picture/confirm — steward
 *   POST /api/reports
 *   GET /api/assemblies/:slug/reports
 *   PATCH /api/reports/:id — steward
 */
export function pictureRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/assemblies/:slug/picture', notBuilt);
  r.get('/themes/:id/points', notBuilt);
  r.post('/assemblies/:slug/picture/update', notBuilt);
  r.post('/assemblies/:slug/picture/confirm', notBuilt);
  r.post('/reports', notBuilt);
  r.get('/assemblies/:slug/reports', notBuilt);
  r.patch('/reports/:id', notBuilt);
  return r;
}
