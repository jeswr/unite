import { Router, type Request } from 'express';
import { MediationDraftsBody, MediationTurnBody, type Mediation } from '@unite/shared';
import { requireHeard, requirePerson } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError, notFound } from '../errors.js';
import { approve, mediationView, startMediation, takeTurn, updateDrafts } from '../services/mediation/service.js';
import { parseBody } from '../validate.js';

/**
 * Rule 2, widened in section 12: only the owner can read or change a mediation, its turns or its
 * drafts. Hosts and stewards are refused like anyone else.
 */
async function owned(deps: Pick<Deps, 'store'>, req: Request): Promise<Mediation> {
  const m = await deps.store.get('mediations', String(req.params.id));
  if (!m) throw notFound('That conversation');
  if (!req.personId || m.personId !== req.personId)
    throw new HttpError(403, 'not_yours', 'Only the person who is talking this through can see it or change it.');
  return m;
}

/**
 * Talk it through (section 12.1). Mounted under /api.
 *
 *   POST  /api/statements/:id/mediations — starts mine, or returns it
 *   GET   /api/mediations/:id — owner only
 *   POST  /api/mediations/:id/turns — { text } | { skip: true } | { stop: true }
 *   PATCH /api/mediations/:id/drafts — any of reason, reasonSide, wording, question ('' scraps)
 *   POST  /api/mediations/:id/approve
 */
export function mediationsRouter(deps: Deps): Router {
  const r = Router();
  const { store } = deps;

  r.post('/statements/:id/mediations', requirePerson(deps), async (req, res) => {
    const statement = await store.get('statements', String(req.params.id));
    if (!statement) throw notFound('That statement');
    const assembly = await store.get('assemblies', statement.assemblyId);
    if (!assembly) throw notFound('That statement');
    await requireHeard(deps, req, assembly);
    const { mediation, created } = await startMediation(deps, req.person!.id, statement, assembly);
    res.status(created ? 201 : 200).json(await mediationView(deps, mediation));
  });

  r.get('/mediations/:id', async (req, res) => {
    res.json(await mediationView(deps, await owned(deps, req)));
  });

  r.post('/mediations/:id/turns', async (req, res) => {
    const m = await owned(deps, req);
    const body = parseBody(MediationTurnBody, req.body);
    const { mediation, safety } = await takeTurn(deps, m, body);
    res.json(await mediationView(deps, mediation, safety));
  });

  r.patch('/mediations/:id/drafts', async (req, res) => {
    const m = await owned(deps, req);
    const body = parseBody(MediationDraftsBody, req.body);
    res.json(await mediationView(deps, await updateDrafts(deps, m, body)));
  });

  r.post('/mediations/:id/approve', async (req, res) => {
    const m = await owned(deps, req);
    res.json(await mediationView(deps, await approve(deps, m)));
  });

  return r;
}
