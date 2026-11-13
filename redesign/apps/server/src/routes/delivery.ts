import type { DecisionsResponse } from '@unite/shared';
import { Router, type Request } from 'express';
import { requirePerson, requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import {
  addDeliveryItem,
  addProposal,
  answerDecision,
  cardOf,
  decisionRecord,
  decisionsOf,
  patchDeliveryItem,
  patchProposal,
  recordCheck,
  type Viewer,
} from '../services/delivery/decisions.js';
import { exportAssembly } from '../services/delivery/export.js';

const viewerOf = (req: Request): Viewer => ({ role: req.role, ...(req.personId ? { personId: req.personId } : {}) });

/**
 * Delivering (section 7). Decisions are public: they can be read without having been heard.
 *
 *   GET /api/assemblies/:slug/decisions
 *   GET /api/decisions/:id — decision, statement, trail to themes and people, answer, proposals, delivery items, check
 *   POST /api/decisions/:id/answer — host, once
 *   POST /api/decisions/:id/proposals — anyone heard, or the host
 *   PATCH /api/proposals/:id — host: { status: 'chosen' }; steward: { faithful: true }
 *   POST /api/decisions/:id/delivery — host
 *   PATCH /api/delivery/:id — host: status, update, link
 *   POST /api/decisions/:id/check — steward or checker only; the only write of delivered_* or not_delivered (rule 7)
 *   GET /api/assemblies/:slug/export — the assembly's public record (replaces the stub in how.ts)
 */
export function deliveryRouter(deps: Deps): Router {
  const r = Router();
  const { store, clock } = deps;

  r.get('/assemblies/:slug/decisions', async (req, res) => {
    const a = await getAssemblyBySlug(store, String(req.params.slug));
    const now = clock.now();
    const decisions = (await decisionsOf(store, a.id)).map((d) => cardOf(d, now));
    const body: DecisionsResponse = {
      assembly: { slug: a.slug, title: a.title, question: a.question, hostName: a.hostName, hostSlug: a.hostSlug, isExample: a.isExample, stage: a.stage },
      decisions,
    };
    res.json(body);
  });

  r.get('/decisions/:id', async (req, res) => {
    res.json(await decisionRecord(deps, String(req.params.id), viewerOf(req)));
  });

  r.post('/decisions/:id/answer', requireRole('host'), async (req, res) => {
    res.json({ decision: await answerDecision(deps, String(req.params.id), req.body) });
  });

  r.post('/decisions/:id/proposals', requirePerson(deps), async (req, res) => {
    res.status(201).json({ proposal: await addProposal(deps, String(req.params.id), req.body, viewerOf(req)) });
  });

  r.patch('/proposals/:id', requireRole('host', 'steward'), async (req, res) => {
    res.json({ proposal: await patchProposal(deps, String(req.params.id), req.body, viewerOf(req)) });
  });

  r.post('/decisions/:id/delivery', requireRole('host'), async (req, res) => {
    res.status(201).json({ item: await addDeliveryItem(deps, String(req.params.id), req.body) });
  });

  r.patch('/delivery/:id', requireRole('host'), async (req, res) => {
    res.json(await patchDeliveryItem(deps, String(req.params.id), req.body));
  });

  r.post('/decisions/:id/check', async (req, res) => {
    res.status(201).json(await recordCheck(deps, String(req.params.id), req.body, viewerOf(req)));
  });

  r.get('/assemblies/:slug/export', async (req, res) => {
    const body = await exportAssembly(deps, String(req.params.slug), viewerOf(req));
    res.set('Content-Disposition', `attachment; filename="${body.assembly.slug}-export.json"`).json(body);
  });

  return r;
}
