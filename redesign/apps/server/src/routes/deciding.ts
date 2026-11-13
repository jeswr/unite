import { Router } from 'express';
import { z } from 'zod';
import { requireHeard, requirePerson, requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import { decide, prioritiesView, setChoices } from '../services/deciding/priorities.js';
import { parseBody } from '../validate.js';

const ChoicesBody = z.strictObject({
  statementIds: z.array(z.string()).max(3, 'can have at most 3 statements'),
});

const DecisionBody = z.strictObject({
  title: z.string().trim().min(1).max(300),
  why: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).max(10).default([]),
  dissent: z.string().trim().max(4000).default(''),
  tests: z.array(z.string().max(1000)).max(20).default([]),
  delivery: z.array(z.enum(['technology', 'social'])).max(2).default([]),
});

const DecideBody = z.strictObject({
  /** Keyed by statement id. */
  decisions: z.record(z.string(), DecisionBody),
});

/**
 * Deciding (section 7). POST /api/assemblies/:slug/stage is in assemblies.ts.
 * GET and PUT priorities are behind rule 1; decide is for stewards.
 */
export function decidingRouter(deps: Deps): Router {
  const r = Router();
  const { store } = deps;

  r.get('/assemblies/:slug/priorities', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    res.json(await prioritiesView(store, assembly, req.personId));
  });

  r.put('/assemblies/:slug/priorities', requirePerson(deps), async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    const { statementIds } = parseBody(ChoicesBody, req.body);
    await setChoices(deps, assembly, req.personId!, statementIds);
    res.json(await prioritiesView(store, assembly, req.personId));
  });

  r.post('/assemblies/:slug/decide', requireRole('steward'), async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const { decisions } = parseBody(DecideBody, req.body);
    const created = await decide(deps, assembly, decisions);
    res.status(201).json({ decisions: created });
  });

  return r;
}
