import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Statements. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/assemblies/:slug/statements — each with my reaction; totals, support by group and stillNeeded only if I have reacted or am host or steward (rule 5). Rule 1: requireHeard
 *   GET /api/statements/:id — with sources, reasons in two columns by time, objections, versions
 *   POST /api/statements/:id/reactions
 *   POST /api/statements/:id/rewordings — { text }: creates a reword candidate with the same sources
 *   POST /api/statements/:id/reasons
 *   POST /api/statements/:id/objections
 *   PATCH /api/objections/:id — steward: reply and status
 *   POST /api/assemblies/:slug/statements/draft — steward: run draftStatements
 *   POST /api/assemblies/:slug/statements — steward: write one, with source points
 *   POST /api/statements/:id/revise — steward
 */
export function statementsRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/assemblies/:slug/statements', notBuilt);
  r.get('/statements/:id', notBuilt);
  r.post('/statements/:id/reactions', notBuilt);
  r.post('/statements/:id/rewordings', notBuilt);
  r.post('/statements/:id/reasons', notBuilt);
  r.post('/statements/:id/objections', notBuilt);
  r.patch('/objections/:id', notBuilt);
  r.post('/assemblies/:slug/statements/draft', notBuilt);
  r.post('/assemblies/:slug/statements', notBuilt);
  r.post('/statements/:id/revise', notBuilt);
  return r;
}
