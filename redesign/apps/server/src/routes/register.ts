import { Router } from 'express';
import type { Deps } from '../deps.js';
import { hostRecord, register } from '../services/delivery/register.js';

const one = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * The public register (section 7).
 *
 *   GET /api/register — ?assembly=&host=&status=: every decision with its assembly and host, days late, registerSummary
 *   GET /api/hosts/:hostSlug — the host's record
 */
export function registerRouter(deps: Deps): Router {
  const r = Router();

  r.get('/register', async (req, res) => {
    res.json(await register(deps, { assembly: one(req.query.assembly), host: one(req.query.host), status: one(req.query.status) }));
  });

  r.get('/hosts/:hostSlug', async (req, res) => {
    res.json(await hostRecord(deps, String(req.params.hostSlug)));
  });

  return r;
}
