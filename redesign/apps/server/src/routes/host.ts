import type { LeadingCheckResponse } from '@unite/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { createAssembly, createInvite, listInvites, patchAssembly } from '../services/host/assemblies.js';
import { checkLeading } from '../ai/synthesis.js';
import { intakeAnswer, startIntake } from '../services/host/intake.js';
import { parseBody } from '../validate.js';

const CheckLeadingBody = z.strictObject({ text: z.string().trim().min(1, 'must not be empty').max(1000) });

/**
 * Hosts (sections 6.5 and 7). Every endpoint needs the host role, except the leading-wording
 * check, which stewards can use too.
 *
 *   POST /api/host/intake — start the intake interview
 *   POST /api/host/intake/:id/turns — answer; returns the next question, or the draft pledge and question
 *   POST /api/host/assemblies — create in proposed (accepts fromThemeId and intakeId)
 *   PATCH /api/host/assemblies/:slug — question, summary, probes, about questions, affected groups, pledge; only while proposed
 *   POST /api/host/assemblies/:slug/invites — a new invitation code
 *   GET /api/host/assemblies/:slug/invites — the codes made so far (for the console)
 *   POST /api/check-leading — { text }: { leading, why, suggestion } (the AI check, or the phrase list without it)
 */
export function hostRouter(deps: Deps): Router {
  const r = Router();
  const host = requireRole('host');

  r.post('/host/intake', host, async (_req, res) => {
    res.status(201).json(await startIntake(deps));
  });

  r.post('/host/intake/:id/turns', host, async (req, res) => {
    res.json(await intakeAnswer(deps, String(req.params.id), req.body));
  });

  r.post('/host/assemblies', host, async (req, res) => {
    res.status(201).json({ assembly: await createAssembly(deps, req.body) });
  });

  r.patch('/host/assemblies/:slug', host, async (req, res) => {
    res.json({ assembly: await patchAssembly(deps, String(req.params.slug), req.body) });
  });

  r.post('/host/assemblies/:slug/invites', host, async (req, res) => {
    res.status(201).json({ invite: await createInvite(deps, String(req.params.slug), req.body) });
  });

  r.get('/host/assemblies/:slug/invites', host, async (req, res) => {
    res.json({ invites: await listInvites(deps.store, String(req.params.slug)) });
  });

  r.post('/check-leading', requireRole('host', 'steward'), async (req, res) => {
    const { text } = parseBody(CheckLeadingBody, req.body);
    const { fallback, ...check } = await checkLeading(deps, text);
    const body: LeadingCheckResponse = { ...check, source: fallback ? 'fallback' : 'ai' };
    res.json(body);
  });

  return r;
}
