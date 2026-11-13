import { Router } from 'express';
import { z } from 'zod';
import type { MeResponse } from '@unite/shared';
import { clearRole, currentPerson, requirePerson, setRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { parseBody } from '../validate.js';

const PatchMe = z.strictObject({
  displayName: z.string().trim().min(1).max(80).optional(),
  about: z.record(z.string().max(60), z.string().max(200)).optional(),
  locale: z.string().min(2).max(35).optional(),
});

const RoleBody = z.strictObject({ role: z.enum(['host', 'steward']), code: z.string().max(200) });

/**
 * GET /api/me, PATCH /api/me, POST /api/role, DELETE /api/role.
 * (GET /api/me/export, DELETE /api/me and GET /api/me/trace live in mydata.ts.)
 */
export function sessionRouter(deps: Deps): Router {
  const r = Router();

  r.get('/me', async (req, res) => {
    const person = (await currentPerson(deps, req)) ?? null;
    const memberships = person ? await deps.store.list('memberships', { personId: person.id }) : [];
    const body: MeResponse = { person, memberships, role: req.role, demo: deps.config.demo };
    res.json(body);
  });

  r.patch('/me', requirePerson(deps), async (req, res) => {
    const patch = parseBody(PatchMe, req.body);
    const person = await deps.store.put('persons', {
      ...req.person!,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.about ? { about: { ...req.person!.about, ...patch.about } } : {}),
      ...(patch.locale ? { locale: patch.locale } : {}),
    });
    res.json({ person });
  });

  r.post('/role', (req, res) => {
    const { role, code } = parseBody(RoleBody, req.body);
    setRole(deps, res, role, code);
    res.json({ role });
  });

  r.delete('/role', (_req, res) => {
    clearRole(deps, res);
    res.json({ role: 'participant' });
  });

  return r;
}
