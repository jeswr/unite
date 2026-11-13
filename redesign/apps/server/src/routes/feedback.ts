import { Router } from 'express';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/**
 * Feedback (section 6.5). Not built yet: every endpoint answers 501 until its part of the build fills it in.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   POST /api/feedback — { path, mode, sinceVersion? }: returns token and first question
 *   POST /api/feedback/:token/turns — (limited to 20 a minute in app.ts)
 *   PATCH /api/feedback/:token — answers, name, contact, screenshot, publicIssue
 *   POST /api/feedback/:token/submit — allowed with any number of answers
 *   GET /api/feedback/:token — your feedback and its status
 *   GET /api/releases — RELEASES.json
 */
export function feedbackRouter(deps: Deps): Router {
  void deps;
  const r = Router();
  r.post('/feedback', notBuilt);
  r.post('/feedback/:token/turns', notBuilt);
  r.patch('/feedback/:token', notBuilt);
  r.post('/feedback/:token/submit', notBuilt);
  r.get('/feedback/:token', notBuilt);
  r.get('/releases', notBuilt);
  return r;
}
