import { newId, stageIndex, type Assembly, type Conversation, type Point, type PointType, type Turn } from '@unite/shared';
import type { Deps } from '../../deps.js';
import { HttpError, notFound } from '../../errors.js';
import { interviewerTurn, type InterviewerResult, type Safety } from '../../ai/interviewer.js';
import { extractPoints } from '../../ai/points.js';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, PROMPT_VERSION } from '../../ai/prompts.js';
import { scriptedQuestion, scriptedStageQuestions } from '../../ai/scripted.js';
import type { Store } from '../../store/types.js';
import { bumpVersion } from '../../version.js';
import { FIRST_STAGE, isAiStage, mayAdvance, mustAdvance, nextStage, probeForNextQuestion, REVIEW_STAGE } from './machine.js';
import type { ConversationAssembly, ConversationView } from './views.js';

/**
 * The conversation service: starting, consent, turns on each route, the move to review, points,
 * approval and the exit questions. Routes in routes/conversations.ts check who is asking and call
 * these.
 */

export type Route = Conversation['route'];
export type Visibility = Point['visibility'];

export const DEFAULT_VISIBILITY: Visibility = 'anonymous';

/** Conversations can be had in open listening, and in an assembly from listening until the host has answered. */
export function canTalkIn(a: Assembly): boolean {
  if (a.isOpenListening) return true;
  const at = stageIndex(a.stage);
  return at >= stageIndex('listening') && at < stageIndex('answered');
}

export function assemblyBrief(a: Assembly): ConversationAssembly {
  return { slug: a.slug, title: a.title, question: a.question, isExample: a.isExample, isOpenListening: a.isOpenListening };
}

async function turnsOf(store: Store, conversationId: string): Promise<Turn[]> {
  return store.list('turns', { conversationId }, { orderBy: 'created_at' });
}

async function pointsOf(store: Store, conversationId: string): Promise<Point[]> {
  return (await store.list('points', { conversationId }, { orderBy: 'created_at' })).filter((p) => p.status !== 'withdrawn');
}

export async function assemblyOf(store: Store, c: Conversation): Promise<Assembly> {
  const a = await store.get('assemblies', c.assemblyId);
  if (!a) throw notFound('That assembly');
  return a;
}

/** Everything the owner sees of a conversation. */
export async function conversationView(deps: Pick<Deps, 'store'>, c: Conversation, safety?: Safety): Promise<ConversationView> {
  const assembly = await assemblyOf(deps.store, c);
  const [turns, points] = await Promise.all([turnsOf(deps.store, c.id), pointsOf(deps.store, c.id)]);
  const last = turns[turns.length - 1];
  const questions = c.route === 'questions' && c.status === 'active' && isAiStage(c.stage) ? scriptedStageQuestions(c.stage, assembly.probes) : [];
  return {
    conversation: c,
    assembly: assemblyBrief(assembly),
    turns,
    points,
    questions,
    pending: c.status === 'active' && last?.role === 'interviewer' && last.text === DISTRESS_MESSAGE ? 'distress' : null,
    ...(safety ? { safety } : {}),
  };
}

/* ------------------------------------------------------------------ starting */

export async function startConversation(
  deps: Deps,
  personId: string,
  assembly: Assembly,
  route: Exclude<Route, 'host'>,
  language: string,
): Promise<Conversation> {
  if (!canTalkIn(assembly)) throw new HttpError(409, 'not_open', 'Conversations are not open in this assembly.');
  const now = deps.clock.iso();
  // Written questions are fixed by choice; the AI and free-writing routes use the AI when it is on.
  const mode: Conversation['mode'] = route !== 'questions' && deps.ai.enabled ? 'claude' : 'scripted';
  return deps.store.transaction(async (tx) => {
    // Starting again (for example on another route) leaves any unfinished conversation behind.
    for (const old of await tx.list('conversations', { personId, assemblyId: assembly.id })) {
      if (old.status === 'active' || old.status === 'reviewing') await tx.put('conversations', { ...old, status: 'abandoned' });
    }
    return tx.put('conversations', {
      id: newId('con'),
      personId,
      assemblyId: assembly.id,
      route,
      mode,
      ...(mode === 'claude' ? { modelId: deps.ai.model } : {}),
      promptVersion: PROMPT_VERSION,
      language,
      stage: 0,
      stageTurns: 0,
      status: 'active',
      consent: { conversation: false, at: now },
      startedAt: now,
    });
  });
}

async function addTurn(
  deps: Pick<Deps, 'store' | 'clock'>,
  c: Conversation,
  role: Turn['role'],
  text: string,
  stage: number,
  meta?: Turn['meta'],
): Promise<Turn> {
  const turn: Turn = { id: newId('trn'), conversationId: c.id, role, text, stage, createdAt: deps.clock.iso(), ...(meta && Object.keys(meta).length ? { meta } : {}) };
  return deps.store.put('turns', turn);
}

/** Stage 0 to stage 1. In the AI route the first question is the scripted opener in every mode, so the conversation starts at once. */
export async function giveConsent(deps: Deps, c: Conversation): Promise<Conversation> {
  if (c.consent.conversation) return c;
  if (c.status !== 'active') throw new HttpError(409, 'not_active', 'This conversation has finished.');
  const next = await deps.store.put('conversations', { ...c, consent: { conversation: true, at: deps.clock.iso() }, stage: FIRST_STAGE, stageTurns: 0 });
  if (c.route === 'ai') await addTurn(deps, next, 'interviewer', scriptedQuestion(FIRST_STAGE, 0), FIRST_STAGE);
  return next;
}

/* ------------------------------------------------------------------ turns */

export type TurnBody = { text: string } | { skip: true } | { stop: true } | { resume: true } | { answers: string[] };

function requireActive(c: Conversation) {
  if (c.status !== 'active') throw new HttpError(409, 'not_active', 'This conversation has moved on to the review.');
  if (!c.consent.conversation) throw new HttpError(409, 'no_consent', 'Please read and accept how the conversation works first.');
}

/** One step in a conversation. Returns the conversation as it now stands and what the interviewer noticed. */
export async function takeTurn(deps: Deps, c: Conversation, body: TurnBody): Promise<{ conversation: Conversation; safety?: Safety }> {
  requireActive(c);
  if ('stop' in body) return { conversation: await moveToReview(deps, c) };
  const assembly = await assemblyOf(deps.store, c);
  switch (c.route) {
    case 'freetext':
      return { conversation: await freetextTurn(deps, c, body) };
    case 'questions':
      return { conversation: await questionsTurn(deps, c, assembly, body) };
    case 'ai':
      return aiTurn(deps, c, assembly, body);
    default:
      throw new HttpError(409, 'wrong_route', 'This conversation is approved through its link.');
  }
}

async function freetextTurn(deps: Deps, c: Conversation, body: TurnBody): Promise<Conversation> {
  if (!('text' in body)) throw new HttpError(400, 'invalid', 'Write what you want to say in the box, then send it.');
  await addTurn(deps, c, 'person', body.text, c.stage);
  return moveToReview(deps, c);
}

async function questionsTurn(deps: Deps, c: Conversation, assembly: Assembly, body: TurnBody): Promise<Conversation> {
  if ('answers' in body) {
    const questions = scriptedStageQuestions(c.stage, assembly.probes);
    for (const [i, q] of questions.entries()) {
      const answer = body.answers[i]?.trim();
      if (!answer) continue;
      await addTurn(deps, c, 'interviewer', q, c.stage);
      await addTurn(deps, c, 'person', answer, c.stage);
    }
  } else if (!('skip' in body)) {
    throw new HttpError(400, 'invalid', 'Answer the questions on this page, or skip them.');
  }
  return advance(deps, c, assembly);
}

/** Moves to the next stage; after stage 8, to the review. In the AI route, asks the new stage's first question. */
async function advance(deps: Deps, c: Conversation, assembly: Assembly, carried?: Safety): Promise<Conversation> {
  const stage = nextStage(c.stage);
  if (stage === REVIEW_STAGE) return moveToReview(deps, c);
  let next = await deps.store.put('conversations', { ...c, stage, stageTurns: 0 });
  if (c.route === 'ai') next = (await ask(deps, next, assembly, carried)).conversation;
  return next;
}

/** Asks the interviewer for the next question in the current stage and stores it. */
async function ask(deps: Deps, c: Conversation, assembly: Assembly, carried?: Safety, result?: InterviewerResult): Promise<{ conversation: Conversation; safety: Safety }> {
  const r = result ?? (await interviewerTurn(deps, await interviewerInput(deps, c, assembly)));
  let conversation = c;
  if (r.unavailable && c.mode === 'claude') conversation = await deps.store.put('conversations', { ...c, mode: 'scripted' });
  let text = r.text;
  // A note about identifying details noticed in the turn that ended the last stage is kept.
  if (carried === 'identifying' && r.safety === 'ok') text = `${text} ${IDENTIFYING_NOTE}`;
  await addTurn(deps, conversation, 'interviewer', text, conversation.stage, r.meta);
  return { conversation, safety: r.safety === 'ok' && carried ? carried : r.safety };
}

async function interviewerInput(deps: Pick<Deps, 'store'>, c: Conversation, assembly: Assembly) {
  return {
    mode: c.mode,
    stage: c.stage,
    turns: await turnsOf(deps.store, c.id),
    personTurnsInStage: c.stageTurns,
    ...(assembly.isOpenListening ? {} : { assemblyQuestion: assembly.question }),
    probe: probeForNextQuestion(c.stage, c.stageTurns, assembly.probes),
  };
}

async function aiTurn(deps: Deps, c: Conversation, assembly: Assembly, body: TurnBody): Promise<{ conversation: Conversation; safety?: Safety }> {
  if ('skip' in body) return { conversation: await advance(deps, c, assembly) };
  if ('answers' in body) throw new HttpError(400, 'invalid', 'Write your answer in the box, then send it.');

  let conv = c;
  if ('text' in body) {
    await addTurn(deps, c, 'person', body.text, c.stage);
    conv = await deps.store.put('conversations', { ...c, stageTurns: c.stageTurns + 1 });
  }
  // 'resume' (carrying on after the distress message) goes on from here without a new answer.
  const state = { stage: conv.stage, personTurnsInStage: conv.stageTurns, probes: assembly.probes };
  if (conv.stageTurns > 0 && mustAdvance(state)) {
    const next = await advance(deps, conv, assembly);
    return { conversation: next, safety: await lastSafety(deps, next) };
  }
  const r = await interviewerTurn(deps, await interviewerInput(deps, conv, assembly));
  if (r.safety === 'distress') {
    await addTurn(deps, conv, 'interviewer', r.text, conv.stage);
    return { conversation: conv, safety: 'distress' };
  }
  if ('text' in body && r.stageComplete && mayAdvance(state)) {
    if (r.unavailable && conv.mode === 'claude') conv = await deps.store.put('conversations', { ...conv, mode: 'scripted' });
    const next = await advance(deps, conv, assembly, r.safety === 'identifying' ? 'identifying' : undefined);
    return { conversation: next, safety: (await lastSafety(deps, next)) ?? r.safety };
  }
  return ask(deps, conv, assembly, undefined, r);
}

/** After an advance, whether the new question was the distress message (so the page can offer to stop). */
async function lastSafety(deps: Pick<Deps, 'store'>, c: Conversation): Promise<Safety | undefined> {
  if (c.status !== 'active') return undefined;
  const turns = await turnsOf(deps.store, c.id);
  return turns[turns.length - 1]?.text === DISTRESS_MESSAGE ? 'distress' : undefined;
}

/* ------------------------------------------------------------------ review and points */

/** Ends the conversation part: draws draft points from the person's turns and moves to the review. */
export async function moveToReview(deps: Deps, c: Conversation): Promise<Conversation> {
  const existing = await pointsOf(deps.store, c.id);
  if (existing.length === 0) {
    const turns = await turnsOf(deps.store, c.id);
    const { points } = await extractPoints(deps, turns, { mode: c.mode, freetext: c.route === 'freetext' });
    for (const p of points) {
      await deps.store.put('points', {
        id: newId('pt'),
        conversationId: c.id,
        personId: c.personId,
        assemblyId: c.assemblyId,
        type: p.type,
        text: p.text,
        draftText: p.text,
        sourceTurnIds: p.sourceTurnIds,
        status: 'draft',
        visibility: DEFAULT_VISIBILITY,
      });
    }
  }
  return deps.store.put('conversations', { ...c, stage: REVIEW_STAGE, stageTurns: 0, status: 'reviewing' });
}

export async function addOwnPoint(
  deps: Pick<Deps, 'store'>,
  c: Conversation,
  body: { type: PointType; text: string; visibility?: Visibility },
): Promise<Point> {
  if (c.status !== 'reviewing') throw new HttpError(409, 'not_reviewing', 'Points can be added while you review them, before you approve.');
  return deps.store.put('points', {
    id: newId('pt'),
    conversationId: c.id,
    personId: c.personId,
    assemblyId: c.assemblyId,
    type: body.type,
    text: body.text,
    draftText: body.text,
    sourceTurnIds: [],
    status: 'draft',
    visibility: body.visibility ?? DEFAULT_VISIBILITY,
  });
}

export async function updatePoint(
  deps: Pick<Deps, 'store' | 'clock'>,
  point: Point,
  patch: { text?: string; visibility?: Visibility; status?: Point['status'] },
): Promise<Point> {
  const approved = point.status === 'approved';
  if (point.status === 'withdrawn') throw new HttpError(409, 'withdrawn', 'This point has been withdrawn.');
  if (approved) {
    if (patch.text !== undefined && patch.text !== point.text)
      throw new HttpError(409, 'approved', 'This point is already shared, so its words cannot change. You can withdraw it.');
    if (patch.status && patch.status !== 'approved' && patch.status !== 'withdrawn')
      throw new HttpError(409, 'approved', 'This point is already shared. You can change how it is shown, or withdraw it.');
  } else if (patch.status && patch.status !== 'draft' && patch.status !== 'scrapped') {
    throw new HttpError(409, 'not_approved', 'Approve your points with "These are right".');
  }
  const next = await deps.store.put('points', {
    ...point,
    ...(patch.text !== undefined ? { text: patch.text } : {}),
    ...(patch.visibility ? { visibility: patch.visibility } : {}),
    ...(patch.status ? { status: patch.status } : {}),
  });
  if (approved) await bumpVersion(deps, point.assemblyId);
  return next;
}

/**
 * "These are right": kept points become approved, the conversation complete, the person a member
 * of the assembly if they were not already, and the assembly's version moves on.
 */
export async function approve(deps: Deps, c: Conversation): Promise<Conversation> {
  if (c.status === 'complete') return c;
  if (c.status !== 'reviewing') throw new HttpError(409, 'not_reviewing', 'Finish or stop the conversation first, then check your points.');
  const now = deps.clock.iso();
  return deps.store.transaction(async (tx) => {
    for (const p of await tx.list('points', { conversationId: c.id })) {
      if (p.status === 'draft') await tx.put('points', { ...p, personId: c.personId, status: 'approved', approvedAt: now });
      else if (p.personId !== c.personId) await tx.put('points', { ...p, personId: c.personId });
    }
    const done = await tx.put('conversations', { ...c, status: 'complete', stage: REVIEW_STAGE, completedAt: now });
    const [member] = await tx.list('memberships', { personId: c.personId, assemblyId: c.assemblyId }, { limit: 1 });
    if (!member)
      await tx.put('memberships', {
        id: newId('mem'),
        personId: c.personId,
        assemblyId: c.assemblyId,
        role: 'participant',
        invited: false,
        lookedAroundFirst: false,
        joinedAt: now,
      });
    await bumpVersion({ store: tx, clock: deps.clock }, c.assemblyId);
    return done;
  });
}

export async function saveExit(deps: Pick<Deps, 'store'>, c: Conversation, exit: NonNullable<Conversation['exit']>): Promise<Conversation> {
  if (c.status !== 'complete') throw new HttpError(409, 'not_complete', 'These questions come after you approve your points.');
  return deps.store.put('conversations', { ...c, exit: { soundsLikeMe: exit.soundsLikeMe, pushed: exit.pushed, ...(exit.note ? { note: exit.note } : {}) } });
}

/* ------------------------------------------------------------------ host route */

/** A host or steward enters points for someone. They stay draft until that person approves them through the one-time link. */
export async function startHostConversation(
  deps: Deps,
  assembly: Assembly,
  language: string,
  points: { type: PointType; text: string }[],
): Promise<Conversation> {
  if (!canTalkIn(assembly)) throw new HttpError(409, 'not_open', 'Conversations are not open in this assembly.');
  const now = deps.clock.iso();
  return deps.store.transaction(async (tx) => {
    // The points belong to a person record of their own until someone approves them and takes them over.
    const holder = await tx.put('persons', { id: newId('per'), createdAt: now, isExample: false, about: {}, locale: language });
    const c = await tx.put('conversations', {
      id: newId('con'),
      personId: holder.id,
      assemblyId: assembly.id,
      route: 'host',
      mode: 'scripted',
      promptVersion: PROMPT_VERSION,
      language,
      stage: REVIEW_STAGE,
      stageTurns: 0,
      status: 'reviewing',
      consent: { conversation: false, at: now },
      startedAt: now,
    });
    for (const p of points)
      await tx.put('points', {
        id: newId('pt'),
        conversationId: c.id,
        personId: holder.id,
        assemblyId: assembly.id,
        type: p.type,
        text: p.text,
        draftText: p.text,
        sourceTurnIds: [],
        status: 'draft',
        visibility: DEFAULT_VISIBILITY,
      });
    return c;
  });
}

/**
 * The person opening the one-time link approves the host's draft points, with their own changes.
 * The conversation and its points become theirs; the holding person record is removed.
 */
export async function approveByLink(
  deps: Deps,
  c: Conversation,
  personId: string,
  body: {
    points: { id: string; text?: string; visibility?: Visibility; status?: 'draft' | 'scrapped' }[];
    added: { type: PointType; text: string; visibility?: Visibility }[];
  },
): Promise<Conversation> {
  const now = deps.clock.iso();
  const holderId = c.personId;
  const owned = await deps.store.transaction(async (tx) => {
    const points = await tx.list('points', { conversationId: c.id });
    for (const p of points) {
      const change = body.points.find((x) => x.id === p.id);
      await tx.put('points', {
        ...p,
        personId,
        ...(change?.text !== undefined ? { text: change.text } : {}),
        ...(change?.visibility ? { visibility: change.visibility } : {}),
        ...(change?.status ? { status: change.status } : {}),
      });
    }
    const mine = await tx.put('conversations', { ...c, personId, consent: { conversation: true, at: now } });
    for (const a of body.added) await addOwnPoint({ store: tx }, mine, a);
    if (holderId !== personId) await tx.delete('persons', holderId);
    return mine;
  });
  return approve(deps, owned);
}

/** Limits on what a person can send. */
export const MAX_TURN_CHARS = 4000;
export const MAX_POINT_CHARS = 400;
