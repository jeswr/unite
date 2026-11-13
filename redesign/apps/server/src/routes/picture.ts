import { Router, type Request } from 'express';
import { z } from 'zod';
import { countPeople, newId, type Point, type Report } from '@unite/shared';
import { requireHeard, requirePerson, requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError, notFound } from '../errors.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import type { PictureConfirmResponse, PictureResponse, PictureUpdateResponse, ReportsResponse, ThemePointsResponse } from '@unite/shared';
import { isUpdating, LAZY_UPDATE_THRESHOLD, unthemedPoints, updatePicture } from '../services/picture/update.js';
import { hardChoices, loadPictureData, namesFor, quotesOf, reportView, sections, whoIsMissing, type Viewer } from '../services/picture/view.js';
import { bumpVersion } from '../version.js';
import { parseBody } from '../validate.js';

const ReportBody = z.strictObject({
  targetType: z.enum(['theme', 'statement', 'decision']),
  targetId: z.string().min(1).max(40),
  kind: z.enum(['missing', 'added', 'emphasis', 'count', 'other']),
  text: z.string().trim().min(1, 'Say briefly what is wrong').max(1000),
});

const ResolveBody = z.strictObject({
  status: z.enum(['upheld', 'not_upheld']),
  outcomeNote: z.string().trim().min(1, 'Write a short note on the outcome').max(1000),
});

const ConfirmBody = z.strictObject({ name: z.string().trim().min(1).max(80).optional() });

const viewerOf = (req: Request): Viewer => ({ personId: req.personId, role: req.role });

/** The name shown for a steward's action: the name they gave, their display name, or "A steward". */
export const stewardName = (req: Request, given?: string) => given ?? req.person?.displayName ?? 'A steward';

/**
 * Picture (sections 6.3 and 7): GET /api/assemblies/:slug/picture; GET /api/themes/:id/points;
 * POST /api/assemblies/:slug/picture/update; POST /api/assemblies/:slug/picture/confirm;
 * POST /api/reports; GET /api/assemblies/:slug/reports; PATCH /api/reports/:id.
 */
export function pictureRouter(deps: Deps): Router {
  const r = Router();
  const { store, clock } = deps;

  r.get('/assemblies/:slug/picture', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    const data = await loadPictureData(store, assembly.id);
    const waiting = unthemedPoints(data.points, data.themes);
    const unthemed = waiting.length;
    // Updates by itself when enough points are waiting; the page refreshes when the version moves.
    if (unthemed >= LAZY_UPDATE_THRESHOLD && !isUpdating(assembly.id))
      updatePicture(deps, assembly.id).catch((err) => console.warn(`[picture] update failed: ${(err as Error)?.message ?? err}`));
    const viewer = viewerOf(req);
    const body: PictureResponse = {
      totals: { people: countPeople(data.points), points: data.points.length },
      sections: sections(data, viewer),
      hardChoices: hardChoices(data, viewer),
      missing: await whoIsMissing(deps, assembly),
      confirmed: assembly.pictureConfirmedAt ? { at: assembly.pictureConfirmedAt, by: assembly.pictureConfirmedBy ?? 'A steward' } : null,
      unthemed,
      myUnthemed: req.personId ? waiting.filter((p) => p.personId === req.personId).map((p) => ({ id: p.id, text: p.text })) : [],
      updating: isUpdating(assembly.id),
      canUpdate: req.role === 'steward' || req.role === 'host',
      canConfirm: req.role === 'steward',
    };
    res.json(body);
  });

  r.get('/themes/:id/points', async (req, res) => {
    const theme = await store.get('themes', String(req.params.id));
    if (!theme) throw notFound('That theme');
    const assembly = await store.get('assemblies', theme.assemblyId);
    if (!assembly) throw notFound('That theme');
    await requireHeard(deps, req, assembly);
    const points = (await Promise.all(theme.pointIds.map((id) => store.get('points', id)))).filter((p): p is Point => p?.status === 'approved');
    const viewer = viewerOf(req);
    const body: ThemePointsResponse = {
      theme: { id: theme.id, kind: theme.kind, name: theme.name },
      people: countPeople(points),
      quotes: quotesOf(points, await namesFor(store, points), viewer),
      mine: req.personId ? points.filter((p) => p.personId === req.personId).map((p) => ({ id: p.id, text: p.text })) : [],
    };
    res.json(body);
  });

  r.post('/assemblies/:slug/picture/update', requireRole('steward', 'host'), async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const result = await updatePicture(deps, assembly.id);
    const body: PictureUpdateResponse = { result };
    res.json(body);
  });

  r.post('/assemblies/:slug/picture/confirm', requireRole('steward'), async (req, res) => {
    const body = parseBody(ConfirmBody, req.body);
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    if (req.personId && !req.person) req.person = await store.get('persons', req.personId);
    const at = clock.iso();
    const by = stewardName(req, body.name);
    await store.transaction(async (tx) => {
      const a = await tx.get('assemblies', assembly.id);
      if (a) await tx.put('assemblies', { ...a, pictureConfirmedAt: at, pictureConfirmedBy: by, updatedAt: at });
    });
    await bumpVersion(deps, assembly.id);
    const out: PictureConfirmResponse = { confirmed: { at, by } };
    res.json(out);
  });

  r.post('/reports', requirePerson(deps), async (req, res) => {
    const body = parseBody(ReportBody, req.body);
    const assemblyId = await assemblyOfTarget(deps, body.targetType, body.targetId);
    const assembly = await store.get('assemblies', assemblyId);
    if (!assembly) throw notFound('That');
    await requireHeard(deps, req, assembly);
    const report: Report = {
      id: newId('rpt'),
      assemblyId,
      targetType: body.targetType,
      targetId: body.targetId,
      kind: body.kind,
      text: body.text,
      personId: req.person!.id,
      status: 'open',
      createdAt: clock.iso(),
    };
    await store.put('reports', report);
    await bumpVersion(deps, assemblyId);
    res.status(201).json({ report: reportView(report, viewerOf(req)) });
  });

  r.get('/assemblies/:slug/reports', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    const reports = await store.list('reports', { assemblyId: assembly.id });
    const viewer = viewerOf(req);
    const body: ReportsResponse = { reports: reports.map((x) => ({ ...reportView(x, viewer), targetType: x.targetType, targetId: x.targetId })) };
    res.json(body);
  });

  r.patch('/reports/:id', requireRole('steward'), async (req, res) => {
    const body = parseBody(ResolveBody, req.body);
    const report = await store.get('reports', String(req.params.id));
    if (!report) throw notFound('That report');
    const next: Report = { ...report, status: body.status, outcomeNote: body.outcomeNote, resolvedAt: clock.iso() };
    await store.put('reports', next);
    await bumpVersion(deps, report.assemblyId);
    res.json({ report: { ...reportView(next, viewerOf(req)), targetType: next.targetType, targetId: next.targetId } });
  });

  return r;
}

/** The assembly a reported theme, statement or decision belongs to, or a 404. */
async function assemblyOfTarget(deps: Pick<Deps, 'store'>, type: Report['targetType'], id: string): Promise<string> {
  const doc =
    type === 'theme' ? await deps.store.get('themes', id) : type === 'statement' ? await deps.store.get('statements', id) : await deps.store.get('decisions', id);
  if (!doc) throw new HttpError(404, 'not_found', `That ${type} could not be found.`);
  return doc.assemblyId;
}
