import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Conversations (section 6.1, 6.2). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   POST /api/conversations — { assemblySlug, route, language }
 *   GET /api/conversations/:id — owner only: conversation, turns, points
 *   POST /api/conversations/:id/consent
 *   POST /api/conversations/:id/turns — { text } or { skip: true }: returns the next interviewer turn or the move to review (limited to 20 a minute in app.ts)
 *   POST /api/conversations/:id/points — add a point
 *   PATCH /api/points/:id — text, visibility, status
 *   POST /api/conversations/:id/approve
 *   POST /api/conversations/:id/exit — the two exit questions
 */
export function conversationsRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.post('/conversations', notBuilt);
  r.get('/conversations/:id', notBuilt);
  r.post('/conversations/:id/consent', notBuilt);
  r.post('/conversations/:id/turns', notBuilt);
  r.post('/conversations/:id/points', notBuilt);
  r.patch('/points/:id', notBuilt);
  r.post('/conversations/:id/approve', notBuilt);
  r.post('/conversations/:id/exit', notBuilt);
  return r;
}
