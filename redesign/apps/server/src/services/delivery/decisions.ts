import { z } from 'zod';
import { type Assembly, type BuildProposal, type Check, countPeople, type Decision, type DecisionCard, type DecisionRecord, type DecisionStatus, type DeliveryItem, IsoDate, newId, type Role } from '@unite/shared';
import { getMembership, isHeard } from '../../auth.js';
import type { Deps } from '../../deps.js';
import { HttpError, notFound } from '../../errors.js';
import type { Store } from '../../store/types.js';
import { parseBody } from '../../validate.js';
import { bumpVersion } from '../../version.js';
import { daysPast } from './dates.js';

/**
 * Decisions, the host's answer, build proposals, delivery items and checks (section 7,
 * Delivering). Rule 7 lives here: no route a host can reach writes a `delivered_*` or
 * `not_delivered` status. Only `recordCheck` does, and only for a steward or a checker.
 */

/** The statuses only a check can set (rule 7). */
export const CHECK_ONLY_STATUSES: readonly DecisionStatus[] = [
  'delivered_as_decided',
  'delivered_minor_changes',
  'delivered_substantial_changes',
  'not_delivered',
];

/** Who is asking: the role cookie and the person, if any. */
export interface Viewer {
  role: Role;
  personId?: string;
}

export async function getDecision(store: Store, id: string): Promise<Decision> {
  const d = await store.get('decisions', id);
  if (!d) throw notFound('That decision');
  return d;
}

export async function getAssembly(store: Store, id: string): Promise<Assembly> {
  const a = await store.get('assemblies', id);
  if (!a) throw notFound('That assembly');
  return a;
}

/** The check body in words: the panel, or the independent body the pledge names. */
export function checkBodyName(a: Assembly): string {
  if (a.pledge?.checkBody === 'independent' && a.pledge.checkBodyName) return a.pledge.checkBodyName;
  return 'The check panel';
}

export function cardOf(d: Decision, now: Date): DecisionCard {
  return {
    id: d.id,
    number: d.number,
    title: d.title,
    status: d.status,
    dueDate: d.dueDate,
    daysLate: d.status === 'awaiting_answer' ? daysPast(d.dueDate, now) : 0,
    answer: d.answer ?? null,
  };
}

/** Decisions of one assembly, in number order. */
export async function decisionsOf(store: Store, assemblyId: string): Promise<Decision[]> {
  const all = await store.list('decisions', { assemblyId });
  return all.sort((a, b) => a.number - b.number);
}

/** A checker is a participant listed on the check panel: a membership with role `checker`. */
export async function isChecker(store: Store, personId: string | undefined, assemblyId: string): Promise<boolean> {
  const m = await getMembership(store, personId, assemblyId);
  return m?.role === 'checker';
}

export async function decisionRecord(deps: Pick<Deps, 'store' | 'clock'>, id: string, viewer: Viewer): Promise<DecisionRecord> {
  const { store, clock } = deps;
  const decision = await getDecision(store, id);
  const assembly = await getAssembly(store, decision.assemblyId);
  const [statement, proposals, items, checks, heard, checker] = await Promise.all([
    store.get('statements', decision.statementId),
    store.list('buildProposals', { decisionId: id }),
    store.list('deliveryItems', { decisionId: id }),
    store.list('checks', { decisionId: id }),
    isHeard(deps, assembly, viewer.personId, viewer.role),
    isChecker(store, viewer.personId, assembly.id),
  ]);
  const themes = statement ? (await Promise.all(statement.themeIds.map((t) => store.get('themes', t)))).filter((t) => !!t) : [];
  const points = statement ? (await Promise.all(statement.pointIds.map((p) => store.get('points', p)))).filter((p) => !!p) : [];
  const order = { chosen: 0, proposed: 1, not_chosen: 2 } as const;
  return {
    decision,
    daysLate: cardOf(decision, clock.now()).daysLate,
    assembly: {
      slug: assembly.slug,
      title: assembly.title,
      question: assembly.question,
      hostName: assembly.hostName,
      hostSlug: assembly.hostSlug,
      isExample: assembly.isExample,
      stage: assembly.stage,
      checkBody: checkBodyName(assembly),
    },
    statement: statement ? { id: statement.id, text: statement.text } : null,
    trail: { themes: themes.map((t) => ({ id: t.id, name: t.name })), people: countPeople(points) },
    // A stable sort keeps the order they came in within each status.
    proposals: [...proposals].sort((a, b) => order[a.status] - order[b.status]),
    deliveryItems: items,
    check: checks[0] ?? null,
    viewer: { role: viewer.role, heard, isChecker: checker },
  };
}

/* ------------------------------------------------------------- the host's answer */

export const MIN_REASONS = 40;

const reasons = z
  .string()
  .trim()
  .min(MIN_REASONS, `must give the reasons in at least ${MIN_REASONS} characters`)
  .max(4000);

export const AnswerBody = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('accepted'), reasons }),
  z.strictObject({ kind: z.literal('changed'), reasons, changedTo: z.string().trim().min(1, 'must say what it was changed to').max(2000) }),
  z.strictObject({ kind: z.literal('delayed'), reasons, delayedUntil: IsoDate }),
  z.strictObject({ kind: z.literal('refused'), reasons }),
]);

/** POST /api/decisions/:id/answer: the host's answer, once. Sets the status to the answer's kind. */
export async function answerDecision(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown): Promise<Decision> {
  const body = parseBody(AnswerBody, raw);
  const { store, clock } = deps;
  const updated = await store.transaction(async (tx) => {
    const d = await getDecision(tx, id);
    if (d.answer || d.status !== 'awaiting_answer')
      throw new HttpError(409, 'already_answered', 'This decision already has an answer. An answer can be given once.');
    const a = await getAssembly(tx, d.assemblyId);
    const now = clock.iso();
    const next: Decision = {
      ...d,
      status: body.kind,
      answer: {
        kind: body.kind,
        reasons: body.reasons,
        ...(body.kind === 'changed' ? { changedTo: body.changedTo } : {}),
        ...(body.kind === 'delayed' ? { delayedUntil: body.delayedUntil } : {}),
        answeredAt: now,
        answeredBy: a.hostName || 'The host',
      },
      updatedAt: now,
    };
    return tx.put('decisions', next);
  });
  await bumpVersion(deps, updated.assemblyId);
  return updated;
}

/* ------------------------------------------------------------- build proposals */

/** Proposals and delivery are only for decisions the host accepted or changed, and not yet checked. */
function requireAcceptedOrChanged(d: Decision, what: string) {
  const ok = (d.answer?.kind === 'accepted' || d.answer?.kind === 'changed') && ['accepted', 'changed', 'in_progress'].includes(d.status);
  if (!ok) throw new HttpError(409, 'not_accepted', `${what} can only be added to a decision the host has accepted or changed, before it is checked.`);
}

export const ProposalBody = z.strictObject({
  proposerName: z.string().trim().min(1, 'must give a name').max(120),
  proposerRole: z.string().trim().min(1, 'must say what the proposer does').max(200),
  summary: z.string().trim().min(1, 'must give a short summary').max(600),
  plan: z.string().trim().min(1, 'must describe the plan').max(6000),
  cost: z.string().trim().max(300).optional(),
  testCoverage: z.array(z.strictObject({ n: z.number().int().min(1), how: z.string().trim().max(2000) })).max(50),
});

/** The numbered tests a proposal does not say how it will meet. Empty means every test is covered. */
export function uncoveredTests(d: Pick<Decision, 'tests'>, coverage: { n: number; how: string }[]): number[] {
  const covered = new Set(coverage.filter((c) => c.how.trim().length > 0).map((c) => c.n));
  return d.tests.map((t) => t.n).filter((n) => !covered.has(n));
}

/** POST /api/decisions/:id/proposals: anyone heard in the assembly, or the host. */
export async function addProposal(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown, viewer: Viewer): Promise<BuildProposal> {
  const body = parseBody(ProposalBody, raw);
  const { store } = deps;
  const d = await getDecision(store, id);
  const a = await getAssembly(store, d.assemblyId);
  if (viewer.role !== 'host' && !(await isHeard(deps, a, viewer.personId, viewer.role)))
    throw new HttpError(403, 'not_heard', 'Only people who have taken part in this assembly, or the host, can propose how to build a decision.');
  requireAcceptedOrChanged(d, 'A proposal');
  const known = new Set(d.tests.map((t) => t.n));
  const unknown = body.testCoverage.filter((c) => !known.has(c.n)).map((c) => c.n);
  if (unknown.length) throw new HttpError(400, 'unknown_test', `This decision has no test numbered ${unknown.join(', ')}.`);
  const missing = uncoveredTests(d, body.testCoverage);
  if (missing.length)
    throw new HttpError(400, 'tests_not_covered', `Say how the plan will meet every numbered test. Missing: test ${missing.join(', test ')}.`, { missing });
  const proposal: BuildProposal = {
    id: newId('prop'),
    decisionId: d.id,
    assemblyId: d.assemblyId,
    proposerName: body.proposerName,
    proposerRole: body.proposerRole,
    summary: body.summary,
    plan: body.plan,
    ...(body.cost ? { cost: body.cost } : {}),
    testCoverage: d.tests.map((t) => ({ n: t.n, how: body.testCoverage.find((c) => c.n === t.n)!.how })),
    status: 'proposed',
  };
  const saved = await store.put('buildProposals', proposal);
  await bumpVersion(deps, d.assemblyId);
  return saved;
}

export const ProposalPatch = z.union([z.strictObject({ status: z.literal('chosen') }), z.strictObject({ faithful: z.literal(true) })]);

/**
 * PATCH /api/proposals/:id. The host chooses one (`{ status: 'chosen' }`, the others become
 * `not_chosen`); a steward confirms the chosen one is faithful to the decision (`{ faithful: true }`).
 */
export async function patchProposal(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown, viewer: Viewer): Promise<BuildProposal> {
  const body = parseBody(ProposalPatch, raw);
  const { store, clock } = deps;
  const saved = await store.transaction(async (tx) => {
    const p = await tx.get('buildProposals', id);
    if (!p) throw notFound('That proposal');
    const d = await getDecision(tx, p.decisionId);
    requireAcceptedOrChanged(d, 'A choice of plan');
    const siblings = await tx.list('buildProposals', { decisionId: d.id });
    if ('status' in body) {
      if (viewer.role !== 'host') throw new HttpError(403, 'role_required', 'Only the host can choose which plan to build.');
      if (siblings.some((s) => s.status === 'chosen' && s.faithfulConfirmedAt && s.id !== p.id))
        throw new HttpError(409, 'already_confirmed', 'A plan has already been chosen and confirmed as faithful to the decision.');
      for (const s of siblings) if (s.id !== p.id && s.status !== 'not_chosen') await tx.put('buildProposals', { ...s, status: 'not_chosen' });
      return tx.put('buildProposals', { ...p, status: 'chosen' });
    }
    if (viewer.role !== 'steward') throw new HttpError(403, 'role_required', 'Only a steward can confirm that a plan is faithful to the decision.');
    if (p.status !== 'chosen') throw new HttpError(409, 'not_chosen', 'Only the plan the host has chosen can be confirmed.');
    if (p.faithfulConfirmedAt) return p;
    return tx.put('buildProposals', { ...p, faithfulConfirmedAt: clock.iso() });
  });
  await bumpVersion(deps, saved.assemblyId);
  return saved;
}

/* ------------------------------------------------------------- delivery items */

export const DeliveryBody = z.strictObject({
  title: z.string().trim().min(1, 'must give a title').max(300),
  kind: z.enum(['technology', 'social']),
  owner: z.string().trim().min(1, 'must name the person who owns it').max(200),
  dueDate: IsoDate,
  link: z.url().max(1000).optional(),
});

/** POST /api/decisions/:id/delivery (host). Always starts as planned. */
export async function addDeliveryItem(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown): Promise<DeliveryItem> {
  const body = parseBody(DeliveryBody, raw);
  const d = await getDecision(deps.store, id);
  requireAcceptedOrChanged(d, 'Delivery work');
  const item: DeliveryItem = {
    id: newId('dlv'),
    decisionId: d.id,
    assemblyId: d.assemblyId,
    title: body.title,
    kind: body.kind,
    owner: body.owner,
    dueDate: body.dueDate,
    status: 'planned',
    ...(body.link ? { link: body.link } : {}),
    updates: [],
  };
  const saved = await deps.store.put('deliveryItems', item);
  await bumpVersion(deps, d.assemblyId);
  return saved;
}

/** Item statuses only: a delivery item can never carry a decision status (rule 7). */
export const DeliveryPatch = z
  .strictObject({
    status: z.enum(['planned', 'in_progress', 'done']).optional(),
    update: z.string().trim().min(1).max(2000).optional(),
    link: z.url().max(1000).optional(),
  })
  .refine((b) => b.status || b.update || b.link, 'must change the status, add an update or add a link');

/**
 * PATCH /api/delivery/:id (host): status, an update, a link. The first item to move to
 * `in_progress` moves an accepted or changed decision to `in_progress`. Nothing here can set a
 * delivered or not-delivered status.
 */
export async function patchDeliveryItem(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown): Promise<{ item: DeliveryItem; decision: Decision }> {
  const body = parseBody(DeliveryPatch, raw);
  const { store, clock } = deps;
  const out = await store.transaction(async (tx) => {
    const item = await tx.get('deliveryItems', id);
    if (!item) throw notFound('That delivery item');
    let d = await getDecision(tx, item.decisionId);
    requireAcceptedOrChanged(d, 'A delivery update');
    const now = clock.iso();
    const next: DeliveryItem = {
      ...item,
      ...(body.status ? { status: body.status } : {}),
      ...(body.link ? { link: body.link } : {}),
      updates: body.update ? [...item.updates, { at: now, text: body.update }] : item.updates,
    };
    const saved = await tx.put('deliveryItems', next);
    if (body.status === 'in_progress' && (d.status === 'accepted' || d.status === 'changed'))
      d = await tx.put('decisions', { ...d, status: 'in_progress', updatedAt: now });
    return { item: saved, decision: d };
  });
  await bumpVersion(deps, out.item.assemblyId);
  return out;
}

/* ------------------------------------------------------------- checks */

export const CheckBody = z.strictObject({
  results: z.array(z.strictObject({ n: z.number().int().min(1), met: z.boolean(), note: z.string().trim().max(2000) })).min(1),
  classification: z.enum(['as_decided', 'minor_changes', 'substantial_changes', 'not_delivered']),
  summary: z.string().trim().min(1, 'must give the panel’s summary').max(4000),
  panel: z.array(z.string().trim().min(1).max(120)).min(1, 'must name the people on the panel').max(50),
});

const STATUS_OF: Record<Check['classification'], DecisionStatus> = {
  as_decided: 'delivered_as_decided',
  minor_changes: 'delivered_minor_changes',
  substantial_changes: 'delivered_substantial_changes',
  not_delivered: 'not_delivered',
};

/** Why a classification contradicts the results, or undefined when it does not. */
export function classificationProblem(classification: Check['classification'], results: { met: boolean }[]): string | undefined {
  const met = results.filter((r) => r.met).length;
  if (classification === 'as_decided' && met < results.length)
    return '“Delivered as decided” needs every numbered test to be met. Choose “with changes” or “not delivered”, or mark the tests again.';
  if (classification === 'not_delivered' && met === results.length)
    return 'Every numbered test is marked as met, so it cannot be “not delivered”.';
  if ((classification === 'minor_changes' || classification === 'substantial_changes') && met === 0)
    return 'No numbered test is marked as met, so it cannot be “delivered with changes”. Choose “not delivered”.';
  return undefined;
}

/**
 * POST /api/decisions/:id/check: a steward or a checker. The only write that sets a delivered or
 * not-delivered status (rule 7). Refused unless the work is in progress, or the decision is
 * accepted or changed with every delivery item done.
 */
export async function recordCheck(deps: Pick<Deps, 'store' | 'clock'>, id: string, raw: unknown, viewer: Viewer): Promise<{ check: Check; decision: Decision }> {
  const { store, clock } = deps;
  const d0 = await getDecision(store, id);
  if (viewer.role !== 'steward' && !(await isChecker(store, viewer.personId, d0.assemblyId)))
    throw new HttpError(403, 'role_required', 'Only the check panel, the independent body named in the pledge, or a steward can record a check. The host cannot mark its own work done.');
  const body = parseBody(CheckBody, raw);
  const out = await store.transaction(async (tx) => {
    const d = await getDecision(tx, id);
    if ((await tx.count('checks', { decisionId: d.id })) > 0) throw new HttpError(409, 'already_checked', 'This decision has already been checked.');
    const items = await tx.list('deliveryItems', { decisionId: d.id });
    const allDone = items.length > 0 && items.every((i) => i.status === 'done');
    const ready = d.status === 'in_progress' || ((d.status === 'accepted' || d.status === 'changed') && allDone);
    if (!ready)
      throw new HttpError(409, 'not_ready', 'A decision can be checked only once work on it is in progress, or every delivery item is done.');
    const known = d.tests.map((t) => t.n);
    const given = body.results.map((r) => r.n);
    const missing = known.filter((n) => !given.includes(n));
    const extra = given.filter((n) => !known.includes(n));
    if (missing.length || extra.length || new Set(given).size !== given.length)
      throw new HttpError(400, 'results_incomplete', `Give one result for each numbered test${missing.length ? ` (missing: test ${missing.join(', test ')})` : ''}.`);
    const problem = classificationProblem(body.classification, body.results);
    if (problem) throw new HttpError(400, 'classification_contradicts', problem);
    const a = await getAssembly(tx, d.assemblyId);
    const now = clock.iso();
    const check: Check = {
      id: newId('chk'),
      decisionId: d.id,
      assemblyId: d.assemblyId,
      checkBody: checkBodyName(a),
      panel: body.panel,
      results: known.map((n) => body.results.find((r) => r.n === n)!),
      classification: body.classification,
      summary: body.summary,
      checkedAt: now,
    };
    const savedCheck = await tx.put('checks', check);
    const decision = await tx.put('decisions', { ...d, status: STATUS_OF[body.classification], updatedAt: now });
    return { check: savedCheck, decision };
  });
  await bumpVersion(deps, out.decision.assemblyId);
  return out;
}
