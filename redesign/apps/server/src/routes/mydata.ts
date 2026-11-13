import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * My data. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/me/export — everything held about me
 *   DELETE /api/me — erases the person, conversations, turns, points, reactions, reasons, choices; recomputes themes
 *   GET /api/me/trace — each of my approved points with its theme, statements, decisions and current status
 */
export function myDataRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/me/export', notBuilt);
  r.delete('/me', notBuilt);
  r.get('/me/trace', notBuilt);
  return r;
}
