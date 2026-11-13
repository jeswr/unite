import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Rooms (section 6.4). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/assemblies/:slug/rooms
 *   POST /api/assemblies/:slug/rooms — steward or host: topic, statement, minutes; members drawn by lot (drawRoom is deterministic given a seed)
 *   GET /api/rooms/:id
 *   POST /api/rooms/:id/open
 *   GET /api/rooms/:id/messages — ?after=<id>; polled every 1.5 seconds
 *   POST /api/rooms/:id/messages
 *   POST /api/rooms/:id/answer
 *   POST /api/rooms/:id/outcome — members add to the outcome
 *   POST /api/rooms/:id/close
 *   GET /api/assemblies/:slug/evidence
 */
export function roomsRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/assemblies/:slug/rooms', notBuilt);
  r.post('/assemblies/:slug/rooms', notBuilt);
  r.get('/rooms/:id', notBuilt);
  r.post('/rooms/:id/open', notBuilt);
  r.get('/rooms/:id/messages', notBuilt);
  r.post('/rooms/:id/messages', notBuilt);
  r.post('/rooms/:id/answer', notBuilt);
  r.post('/rooms/:id/outcome', notBuilt);
  r.post('/rooms/:id/close', notBuilt);
  r.get('/assemblies/:slug/evidence', notBuilt);
  return r;
}
