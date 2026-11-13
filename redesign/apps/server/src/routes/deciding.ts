import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Deciding (POST /api/assemblies/:slug/stage is in assemblies.ts). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/assemblies/:slug/priorities — ranked list with each round's score, my choices, how many people have chosen
 *   PUT /api/assemblies/:slug/priorities — { statementIds }
 *   POST /api/assemblies/:slug/decide — steward: top pledge.capacity ranked common_ground statements become decisions, awaiting_answer, due on pledge.replyBy
 */
export function decidingRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/assemblies/:slug/priorities', notBuilt);
  r.put('/assemblies/:slug/priorities', notBuilt);
  r.post('/assemblies/:slug/decide', notBuilt);
  return r;
}
