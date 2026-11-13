import { Router, type Request } from 'express';
import { z } from 'zod';
import { countPeople, newId, type Assembly, type Point, type Statement } from '@unite/shared';
import { getMembership, requireHeard, requirePerson, requireRole } from '../auth.js';
import { draftStatements, MAX_STATEMENT_WORDS, reviseStatement } from '../ai/synthesis.js';
import type { Deps } from '../deps.js';
import { HttpError, notFound } from '../errors.js';
import { getAssemblyBySlug } from '../services/assemblies.js';
import { namesFor, quotesOf, reportView } from '../services/picture/view.js';
import {
  existingSources,
  loadReactionData,
  objectionView,
  reasonView,
  reclassify,
  summaryOf,
  themesOfPoints,
  type Viewer,
} from '../services/statements/index.js';
import type { DraftStatementsResponse, StatementDetail, StatementsResponse } from '@unite/shared';
import { bumpVersion } from '../version.js';
import { parseBody } from '../validate.js';
import { stewardName } from './picture.js';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const statementText = z
  .string()
  .trim()
  .min(1, 'Write the statement')
  .max(300)
  .refine((s) => words(s) <= MAX_STATEMENT_WORDS, `A statement is at most ${MAX_STATEMENT_WORDS} words`);

const ReactionBody = z.strictObject({ value: z.enum(['agree', 'disagree', 'unsure']) });
const RewordBody = z.strictObject({ text: statementText });
const ReasonBody = z.strictObject({
  side: z.enum(['for', 'against', 'question']),
  text: z.string().trim().min(1, 'Write your reason').max(280, 'A reason is at most 280 characters'),
});
const ObjectionBody = z.strictObject({ text: z.string().trim().min(1, 'An objection needs a reason').max(1000) });
const ObjectionReplyBody = z.strictObject({
  reply: z.string().trim().min(1, 'Write a reply').max(2000),
  status: z.enum(['answered', 'sustained', 'withdrawn']),
  name: z.string().trim().min(1).max(80).optional(),
});
const WriteBody = z.strictObject({ text: statementText, pointIds: z.array(z.string()).max(200) });

const viewerOf = (req: Request): Viewer => ({ personId: req.personId, role: req.role });
const isSteward = (req: Request) => req.role === 'steward';

/**
 * Statements (section 7). Rule 1 on every read and write of group content; rule 5 in
 * `summaryOf`; rule 3 on every statement written.
 */
export function statementsRouter(deps: Deps): Router {
  const r = Router();
  const { store, clock } = deps;

  /** The statement and its assembly, after rule 1. */
  async function load(req: Request): Promise<{ statement: Statement; assembly: Assembly }> {
    const statement = await store.get('statements', String(req.params.id));
    if (!statement) throw notFound('That statement');
    const assembly = await store.get('assemblies', statement.assemblyId);
    if (!assembly) throw notFound('That statement');
    await requireHeard(deps, req, assembly);
    return { statement, assembly };
  }

  async function summary(statementId: string, assembly: Assembly, req: Request) {
    const data = await loadReactionData(store, assembly.id);
    const s = data.statements.find((x) => x.id === statementId)!;
    return summaryOf(s, data, assembly.pledge, viewerOf(req));
  }

  /** Writes a new candidate statement (rule 3: refused unless at least one source point exists). */
  async function createStatement(
    assembly: Assembly,
    fields: { text: string; pointIds: string[]; origin: Statement['origin']; authorPersonId?: string; previous?: Statement },
  ): Promise<Statement> {
    const pointIds = await existingSources(store, assembly.id, fields.pointIds);
    if (pointIds.length === 0)
      throw new HttpError(422, 'no_sources', 'A statement must rest on at least one point people approved. Choose its source points.');
    const now = clock.iso();
    const s: Statement = {
      id: newId('st'),
      assemblyId: assembly.id,
      text: fields.text,
      version: fields.previous ? fields.previous.version + 1 : 1,
      ...(fields.previous ? { previousId: fields.previous.id } : {}),
      themeIds: await themesOfPoints(store, assembly.id, pointIds),
      pointIds,
      origin: fields.origin,
      ...(fields.authorPersonId ? { authorPersonId: fields.authorPersonId } : {}),
      status: 'candidate',
      createdAt: now,
      updatedAt: now,
    };
    return store.put('statements', s);
  }

  r.get('/assemblies/:slug/statements', async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    await requireHeard(deps, req, assembly);
    const data = await loadReactionData(store, assembly.id);
    const viewer = viewerOf(req);
    const body: StatementsResponse = {
      statements: data.statements.filter((s) => s.status !== 'retired').map((s) => summaryOf(s, data, assembly.pledge, viewer)),
      canSteward: isSteward(req),
    };
    res.json(body);
  });

  r.get('/statements/:id', async (req, res) => {
    const { statement, assembly } = await load(req);
    const viewer = viewerOf(req);
    const data = await loadReactionData(store, assembly.id);
    const [reasons, objections, reports, themes] = await Promise.all([
      store.list('reasons', { statementId: statement.id }),
      store.list('objections', { statementId: statement.id }),
      store.list('reports', { targetType: 'statement', targetId: statement.id }),
      store.list('themes', { assemblyId: assembly.id }),
    ]);
    const earlier: StatementDetail['earlier'] = [];
    const seen = new Set([statement.id]);
    for (let prev = statement.previousId; prev && !seen.has(prev); ) {
      seen.add(prev);
      const p = data.statements.find((s) => s.id === prev) ?? (await store.get('statements', prev));
      if (!p) break;
      earlier.unshift({ id: p.id, text: p.text, version: p.version, origin: p.origin });
      prev = p.previousId;
    }
    const points = (await Promise.all(statement.pointIds.map((id) => store.get('points', id)))).filter((p): p is Point => p?.status === 'approved');
    const body: StatementDetail = {
      statement: summaryOf(statement, data, assembly.pledge, viewer),
      assembly: { slug: assembly.slug, title: assembly.title, isExample: assembly.isExample },
      earlier,
      later: data.statements
        .filter((s) => s.previousId === statement.id && s.status !== 'retired')
        .map((s) => ({ id: s.id, text: s.text, version: s.version, origin: s.origin })),
      sources: {
        people: countPeople(points),
        quotes: quotesOf(points, await namesFor(store, points), viewer),
        themes: themes.filter((t) => statement.themeIds.includes(t.id)).map((t) => ({ id: t.id, name: t.name })),
      },
      reasons: {
        for: reasons.filter((x) => x.side === 'for').map((x) => reasonView(x, viewer)),
        against: reasons.filter((x) => x.side === 'against').map((x) => reasonView(x, viewer)),
        questions: reasons.filter((x) => x.side === 'question').map((x) => reasonView(x, viewer)),
      },
      objections: objections.map((o) => objectionView(o, viewer)),
      reports: reports.map((x) => reportView(x, viewer)),
      canSteward: isSteward(req),
    };
    res.json(body);
  });

  r.post('/statements/:id/reactions', requirePerson(deps), async (req, res) => {
    const body = parseBody(ReactionBody, req.body);
    const { statement, assembly } = await load(req);
    if (statement.status === 'retired') throw new HttpError(409, 'retired', 'This statement has been retired and is no longer open for answers.');
    const person = req.person!;
    const membership = await getMembership(store, person.id, assembly.id);
    const counted = membership?.invited === true;
    await store.transaction(async (tx) => {
      const [existing] = await tx.list('reactions', { statementId: statement.id, personId: person.id }, { limit: 1 });
      await tx.put(
        'reactions',
        existing
          ? { ...existing, value: body.value, counted }
          : { id: newId('rx'), statementId: statement.id, assemblyId: assembly.id, personId: person.id, value: body.value, counted, createdAt: clock.iso() },
      );
    });
    await reclassify(deps, assembly.id);
    await bumpVersion(deps, assembly.id);
    res.json({ statement: await summary(statement.id, assembly, req) });
  });

  r.post('/statements/:id/rewordings', requirePerson(deps), async (req, res) => {
    const body = parseBody(RewordBody, req.body);
    const { statement, assembly } = await load(req);
    if (body.text === statement.text.trim()) throw new HttpError(400, 'same_wording', 'That is the same wording as the statement. Change some words first.');
    const created = await createStatement(assembly, {
      text: body.text,
      pointIds: statement.pointIds,
      origin: 'reword',
      authorPersonId: req.person!.id,
      previous: statement,
    });
    await bumpVersion(deps, assembly.id);
    res.status(201).json({ statement: await summary(created.id, assembly, req) });
  });

  r.post('/statements/:id/reasons', requirePerson(deps), async (req, res) => {
    const body = parseBody(ReasonBody, req.body);
    const { statement, assembly } = await load(req);
    const reason = await store.put('reasons', {
      id: newId('rsn'),
      statementId: statement.id,
      assemblyId: assembly.id,
      personId: req.person!.id,
      side: body.side,
      text: body.text,
      createdAt: clock.iso(),
    });
    await bumpVersion(deps, assembly.id);
    res.status(201).json({ reason: reasonView(reason, viewerOf(req)) });
  });

  r.post('/statements/:id/objections', requirePerson(deps), async (req, res) => {
    const body = parseBody(ObjectionBody, req.body);
    const { statement, assembly } = await load(req);
    const objection = await store.put('objections', {
      id: newId('obj'),
      statementId: statement.id,
      assemblyId: assembly.id,
      personId: req.person!.id,
      text: body.text,
      status: 'open',
      createdAt: clock.iso(),
    });
    await bumpVersion(deps, assembly.id);
    res.status(201).json({ objection: objectionView(objection, viewerOf(req)) });
  });

  r.patch('/objections/:id', requireRole('steward'), async (req, res) => {
    const body = parseBody(ObjectionReplyBody, req.body);
    const objection = await store.get('objections', String(req.params.id));
    if (!objection) throw notFound('That objection');
    if (req.personId && !req.person) req.person = await store.get('persons', req.personId);
    const next = await store.put('objections', {
      ...objection,
      reply: body.reply,
      repliedBy: stewardName(req, body.name),
      status: body.status,
      resolvedAt: clock.iso(),
    });
    await bumpVersion(deps, objection.assemblyId);
    res.json({ objection: objectionView(next, viewerOf(req)) });
  });

  r.post('/assemblies/:slug/statements/draft', requireRole('steward'), async (req, res) => {
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const [themes, points] = await Promise.all([store.list('themes', { assemblyId: assembly.id }), store.list('points', { assemblyId: assembly.id, status: 'approved' })]);
    const byId = new Map(points.map((p) => [p.id, p]));
    const { statements: drafts, fallback } = await draftStatements(deps, {
      question: assembly.question,
      offTable: assembly.pledge?.offTable,
      themes: themes.map((t) => ({
        id: t.id,
        kind: t.kind,
        name: t.name,
        people: countPeople(t.pointIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))),
        pointIds: t.pointIds.filter((id) => byId.has(id)),
      })),
      points,
    });
    const created: Statement[] = [];
    for (const d of drafts) created.push(await createStatement(assembly, { text: d.text, pointIds: d.pointIds, origin: 'ai' }));
    if (created.length) await bumpVersion(deps, assembly.id);
    const data = await loadReactionData(store, assembly.id);
    const body: DraftStatementsResponse = {
      created: created.map((s) => summaryOf(data.statements.find((x) => x.id === s.id)!, data, assembly.pledge, viewerOf(req))),
      fallback,
      message: fallback
        ? 'The AI is not switched on, so no statements were drafted. Write them by hand, each with its source points.'
        : `${created.length} statement${created.length === 1 ? '' : 's'} drafted.`,
    };
    res.json(body);
  });

  r.post('/assemblies/:slug/statements', requireRole('steward'), async (req, res) => {
    const body = parseBody(WriteBody, req.body);
    const assembly = await getAssemblyBySlug(store, String(req.params.slug));
    const created = await createStatement(assembly, { text: body.text, pointIds: body.pointIds, origin: 'steward' });
    await bumpVersion(deps, assembly.id);
    res.status(201).json({ statement: await summary(created.id, assembly, req) });
  });

  r.post('/statements/:id/revise', requireRole('steward'), async (req, res) => {
    const { statement, assembly } = await load(req);
    const [all, reasons] = await Promise.all([store.list('statements', { assemblyId: assembly.id }), store.list('reasons', { statementId: statement.id })]);
    const rewordings = all.filter((s) => s.previousId === statement.id && s.origin === 'reword').map((s) => s.text);
    const revision = await reviseStatement(
      deps,
      statement,
      rewordings,
      reasons.map((x) => ({ side: x.side, text: x.text })),
    );
    if (!revision.changed) return void res.json({ statement: null, note: revision.note, fallback: revision.fallback });
    const created = await createStatement(assembly, { text: revision.text, pointIds: statement.pointIds, origin: 'ai', previous: statement });
    await bumpVersion(deps, assembly.id);
    res.status(201).json({ statement: await summary(created.id, assembly, req), note: revision.note, fallback: revision.fallback });
  });

  return r;
}
