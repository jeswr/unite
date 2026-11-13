import { Router, type Request } from 'express';
import { z } from 'zod';
import { PointType, type Conversation } from '@unite/shared';
import { CONSENT_TEXT } from '../ai/prompts.js';
import { requirePerson } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError, notFound } from '../errors.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import { approvePath, findByToken } from '../services/conversation/approveLink.js';
import {
  addOwnPoint,
  approve,
  approveByLink,
  assemblyBrief,
  assemblyOf,
  conversationView,
  giveConsent,
  MAX_POINT_CHARS,
  MAX_TURN_CHARS,
  saveExit,
  startConversation,
  startHostConversation,
  takeTurn,
  updatePoint,
  type TurnBody,
} from '../services/conversation/service.js';
import type { ApproveLinkView, ConsentInfo, HostConversationCreated, MyConversation } from '../services/conversation/views.js';
import type { Store } from '../store/types.js';
import { parseBody } from '../validate.js';

const Visibility = z.enum(['count', 'anonymous', 'named']);
const PointText = z.string().trim().min(1, 'cannot be empty').max(MAX_POINT_CHARS);
const Language = z.string().trim().min(2).max(35);

const StartBody = z.strictObject({
  /** Left out: the open-listening conversation. */
  assemblySlug: z.string().min(1).max(100).optional(),
  route: z.enum(['ai', 'questions', 'freetext', 'host']).default('ai'),
  language: Language.default('en-GB'),
  /** Host route only: the points the host or steward wrote down for the person. */
  points: z.array(z.strictObject({ type: PointType, text: PointText })).min(1).max(7).optional(),
});

const TurnText = z.string().trim().min(1, 'cannot be empty').max(MAX_TURN_CHARS);
const TurnSchema = z.union([
  z.strictObject({ text: TurnText }),
  z.strictObject({ skip: z.literal(true) }),
  z.strictObject({ stop: z.literal(true) }),
  z.strictObject({ resume: z.literal(true) }),
  z.strictObject({ answers: z.array(z.string().max(MAX_TURN_CHARS)).max(5) }),
]);

const AddPointBody = z.strictObject({ type: PointType, text: PointText, visibility: Visibility.optional() });
const PatchPointBody = z.strictObject({
  text: PointText.optional(),
  visibility: Visibility.optional(),
  status: z.enum(['draft', 'approved', 'scrapped', 'withdrawn']).optional(),
});
const ExitBody = z.strictObject({
  soundsLikeMe: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  pushed: z.enum(['no', 'a_little', 'yes']),
  note: z.string().trim().max(1000).optional(),
});
const ApproveLinkBody = z.strictObject({
  points: z
    .array(z.strictObject({ id: z.string(), text: PointText.optional(), visibility: Visibility.optional(), status: z.enum(['draft', 'scrapped']).optional() }))
    .max(20)
    .default([]),
  added: z.array(AddPointBody).max(7).default([]),
});

async function openListening(store: Store) {
  const [a] = await store.list('assemblies', { isOpenListening: true }, { limit: 1 });
  if (!a) throw notFound('The open conversation');
  return a;
}

/**
 * Rule 2: only the owner can read or change a conversation, its turns or its draft points. Hosts
 * and stewards are refused like anyone else.
 */
async function owned(deps: Pick<Deps, 'store'>, req: Request): Promise<Conversation> {
  const c = await deps.store.get('conversations', String(req.params.id));
  if (!c) throw notFound('That conversation');
  if (!req.personId || c.personId !== req.personId)
    throw new HttpError(403, 'not_yours', 'Only the person who had this conversation can see it or change it.');
  return c;
}

/**
 * Conversations (sections 6.1 and 6.2). Mounted under /api.
 *
 *   GET  /api/talk/consent — the consent lines and whether the AI interviewer is on
 *   GET  /api/conversations — my conversations
 *   POST /api/conversations — { assemblySlug?, route, language } (host route: also { points }, host or steward only)
 *   GET  /api/conversations/:id — owner only: conversation, turns, points
 *   POST /api/conversations/:id/consent
 *   POST /api/conversations/:id/turns — { text } | { skip: true } | { stop: true } | { resume: true } | { answers } (written questions)
 *   POST /api/conversations/:id/points — add a point of my own
 *   PATCH /api/points/:id — text, visibility, status
 *   POST /api/conversations/:id/approve
 *   POST /api/conversations/:id/exit — the two exit questions
 *   GET  /api/approve/:token, POST /api/approve/:token — the host route's one-time link
 */
export function conversationsRouter(deps: Deps): Router {
  const r = Router();
  const { store } = deps;

  r.get('/talk/consent', (_req, res) => {
    const body: ConsentInfo = { lines: [...CONSENT_TEXT], aiEnabled: deps.ai.enabled };
    res.json(body);
  });

  r.get('/conversations', async (req, res) => {
    if (!req.personId) return void res.json({ conversations: [] });
    const mine = await store.list('conversations', { personId: req.personId }, { orderBy: 'created_at', dir: 'desc' });
    const conversations: MyConversation[] = [];
    for (const c of mine) {
      const a = await store.get('assemblies', c.assemblyId);
      if (!a) continue;
      conversations.push({
        id: c.id,
        route: c.route,
        status: c.status,
        stage: c.stage,
        startedAt: c.startedAt,
        ...(c.completedAt ? { completedAt: c.completedAt } : {}),
        assembly: { slug: a.slug, title: a.title, isOpenListening: a.isOpenListening },
      });
    }
    res.json({ conversations });
  });

  r.post('/conversations', requirePerson(deps), async (req, res) => {
    const body = parseBody(StartBody, req.body);
    const assembly = body.assemblySlug ? await getAssemblyBySlug(store, body.assemblySlug) : await openListening(store);
    if (body.route === 'host') {
      if (req.role !== 'host' && req.role !== 'steward')
        throw new HttpError(403, 'role_required', 'Only hosts and stewards can write down points for someone else.');
      if (!body.points?.length) throw new HttpError(400, 'invalid', 'Write down at least one point for the person to check.');
      const c = await startHostConversation(deps, assembly, body.language, body.points);
      const out: HostConversationCreated = { conversationId: c.id, approvePath: approvePath(deps, c.id) };
      return void res.status(201).json(out);
    }
    if (body.points) throw new HttpError(400, 'invalid', 'Points are added after the conversation, when you review them.');
    const c = await startConversation(deps, req.person!.id, assembly, body.route, body.language);
    res.status(201).json(await conversationView(deps, c));
  });

  r.get('/conversations/:id', async (req, res) => {
    const c = await owned(deps, req);
    res.json(await conversationView(deps, c));
  });

  r.post('/conversations/:id/consent', async (req, res) => {
    const c = await owned(deps, req);
    res.json(await conversationView(deps, await giveConsent(deps, c)));
  });

  r.post('/conversations/:id/turns', async (req, res) => {
    const c = await owned(deps, req);
    const body = parseBody(TurnSchema, req.body) as TurnBody;
    const { conversation, safety } = await takeTurn(deps, c, body);
    res.json(await conversationView(deps, conversation, safety));
  });

  r.post('/conversations/:id/points', async (req, res) => {
    const c = await owned(deps, req);
    const body = parseBody(AddPointBody, req.body);
    const point = await addOwnPoint(deps, c, body);
    res.status(201).json({ point });
  });

  r.patch('/points/:id', async (req, res) => {
    const point = await store.get('points', String(req.params.id));
    if (!point) throw notFound('That point');
    if (!req.personId || point.personId !== req.personId)
      throw new HttpError(403, 'not_yours', 'Only the person who made this point can change it.');
    const patch = parseBody(PatchPointBody, req.body);
    res.json({ point: await updatePoint(deps, point, patch) });
  });

  r.post('/conversations/:id/approve', async (req, res) => {
    const c = await owned(deps, req);
    res.json(await conversationView(deps, await approve(deps, c)));
  });

  r.post('/conversations/:id/exit', async (req, res) => {
    const c = await owned(deps, req);
    const body = parseBody(ExitBody, req.body);
    res.json(await conversationView(deps, await saveExit(deps, c, body)));
  });

  const linkConversation = async (req: Request) => {
    const c = await findByToken(deps, String(req.params.token));
    if (!c) throw new HttpError(404, 'link_used', 'This link has already been used, or it is not right. Ask the host for a new one.');
    return c;
  };

  r.get('/approve/:token', async (req, res) => {
    const c = await linkConversation(req);
    const assembly = await assemblyOf(store, c);
    const points = (await store.list('points', { conversationId: c.id }, { orderBy: 'created_at' })).filter((p) => p.status !== 'withdrawn');
    const body: ApproveLinkView = { assembly: assemblyBrief(assembly), language: c.language, points };
    res.json(body);
  });

  r.post('/approve/:token', requirePerson(deps), async (req, res) => {
    const c = await linkConversation(req);
    const body = parseBody(ApproveLinkBody, req.body);
    const done = await approveByLink(deps, c, req.person!.id, body);
    res.json(await conversationView(deps, done));
  });

  return r;
}
