import { Router } from 'express';
import { z } from 'zod';
import {
  addDays,
  ASSEMBLY_STAGES,
  newId,
  stageChecklist,
  type Assembly,
  type AssemblySummary,
  type AssemblyView,
  type Membership,
} from '@unite/shared';
import { getMembership, isHeard, requirePerson, requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';
import { assemblyCounts, gatherStageFacts, getAssemblyBySlug, heardPersonIds } from '../services/assemblies.js';
import { bumpVersion } from '../version.js';
import { parseBody } from '../validate.js';

const JoinBody = z.strictObject({
  inviteCode: z.string().trim().max(100).optional(),
  lookAroundFirst: z.boolean().optional(),
});

/** How long a newly published pledge can be challenged when the host has not set an end. */
export const DEFAULT_CHALLENGE_DAYS = 14;

/**
 * GET /api/assemblies; GET /api/assemblies/:slug; POST /api/assemblies/:slug/join;
 * GET /api/assemblies/:slug/version; POST /api/assemblies/:slug/stage.
 */
export function assembliesRouter(deps: Deps): Router {
  const r = Router();
  const { store, clock } = deps;

  const checklistFor = async (a: Assembly) => stageChecklist(a, await gatherStageFacts(deps, a), clock.now());

  r.get('/assemblies', async (_req, res) => {
    const all = await store.list('assemblies');
    const order = new Map(ASSEMBLY_STAGES.map((s, i) => [s.key, i]));
    const assemblies: AssemblySummary[] = await Promise.all(
      all.map(async (a) => ({
        slug: a.slug,
        title: a.title,
        question: a.question,
        summary: a.summary,
        kind: a.kind,
        scale: a.scale,
        stage: a.stage,
        hostName: a.hostName,
        hostSlug: a.hostSlug,
        isExample: a.isExample,
        isOpenListening: a.isOpenListening,
        ...(a.pledge ? { replyBy: a.pledge.replyBy } : {}),
        heard: (await heardPersonIds(store, a.id)).length,
      })),
    );
    // Rule 8: by stage, then by time (the store's order), never by attention.
    assemblies.sort((x, y) => order.get(x.stage)! - order.get(y.stage)!);
    res.json({ assemblies });
  });

  r.get('/assemblies/:slug', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const [membership, heard, checklist, counts] = await Promise.all([
      getMembership(store, req.personId, assembly.id),
      isHeard(deps, assembly, req.personId, req.role),
      checklistFor(assembly),
      assemblyCounts(store, assembly),
    ]);
    const body: AssemblyView = { assembly, membership: membership ?? null, role: req.role, heard, checklist, counts };
    res.json(body);
  });

  r.get('/assemblies/:slug/version', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    res.set('Cache-Control', 'no-store').json({ version: assembly.version });
  });

  r.post('/assemblies/:slug/join', requirePerson(deps), async (req, res) => {
    const body = parseBody(JoinBody, req.body);
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    if (body.lookAroundFirst && !assembly.isExample)
      throw new HttpError(400, 'not_example', 'Looking around first is only possible in example assemblies. Have your own conversation first.');
    const person = req.person!;
    const membership = await store.transaction(async (tx) => {
      let invited = false;
      if (body.inviteCode) {
        const [invite] = await tx.list('invites', { assemblyId: assembly.id, code: body.inviteCode }, { limit: 1 });
        if (!invite) throw new HttpError(400, 'bad_invite', 'That invitation code is not right for this assembly.');
        await tx.put('invites', { ...invite, uses: invite.uses + 1 });
        invited = true;
      }
      const existing = await getMembership(tx, person.id, assembly.id);
      const next: Membership = existing
        ? { ...existing, invited: existing.invited || invited, lookedAroundFirst: existing.lookedAroundFirst || !!body.lookAroundFirst }
        : {
            id: newId('mem'),
            personId: person.id,
            assemblyId: assembly.id,
            role: 'participant',
            invited,
            lookedAroundFirst: !!body.lookAroundFirst,
            joinedAt: clock.iso(),
          };
      return tx.put('memberships', next);
    });
    await bumpVersion(deps, assembly.id);
    res.json({ membership });
  });

  r.post('/assemblies/:slug/stage', requireRole('host', 'steward'), async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const checklist = await checklistFor(assembly);
    if (!checklist.next) throw new HttpError(409, 'last_stage', 'This assembly is at its last stage.');
    if (!checklist.clear) {
      const unmet = checklist.items.filter((i) => !i.met);
      throw new HttpError(409, 'checklist_not_clear', `This assembly cannot move on yet: ${unmet.map((i) => i.text.toLowerCase()).join('; ')}.`, { unmet });
    }
    const now = clock.iso();
    let pledge = assembly.pledge;
    // Publishing: the pledge is dated and its challenge period starts.
    if (checklist.next === 'pledged' && pledge)
      pledge = { ...pledge, publishedAt: pledge.publishedAt ?? now, challengeEndsAt: pledge.challengeEndsAt ?? addDays(now, DEFAULT_CHALLENGE_DAYS) };
    await store.put('assemblies', { ...assembly, stage: checklist.next, pledge, updatedAt: now });
    await bumpVersion(deps, assembly.id);
    const moved = await getAssemblyBySlug(store, assembly.slug);
    res.json({ assembly: moved, checklist: await checklistFor(moved) });
  });

  return r;
}
