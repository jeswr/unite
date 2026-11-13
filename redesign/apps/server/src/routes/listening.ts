import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Open listening. Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/listening — the open-listening picture, themes with no hosted assembly, good ordinary days
 */
export function listeningRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.get('/listening', notBuilt);
  return r;
}
