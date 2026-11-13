import {
  defaultReasonSide,
  newId,
  pickOtherSide,
  type Assembly,
  type Mediation,
  type MediationDraftsBody,
  type MediationTurn,
  type MediationTurnBody,
  type MediationView,
  type Reason,
  type Statement,
} from '@unite/shared';
import type { Deps } from '../../deps.js';
import { HttpError, notFound } from '../../errors.js';
import type { Safety } from '../../ai/interviewer.js';
import { extractMediation, mediatorTurn, type MediatorResult } from '../../ai/mediator.js';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, MEDIATOR_NO_OTHER_SIDE } from '../../ai/prompts.js';
import { addReason, addRewording, checkRewording } from '../../routes/statements.js';
import type { Store } from '../../store/types.js';
import { bumpVersion } from '../../version.js';
import { FIRST_STEP, mustAdvance, nextStep, OTHER_SIDE_STEP, personTurnsIn, shouldAdvance } from './machine.js';

/**
 * Talk it through (section 12.1): starting, turns, the move to the review, drafts and approval.
 * The routes in routes/mediations.ts check that the caller owns the mediation (rule 2) and call
 * these. Reasons, questions and rewordings made on approval go through the same functions as the
 * direct statement routes.
 */

/** Statements in these states cannot be talked through. */
export const CLOSED: ReadonlySet<Statement['status']> = new Set(['retired', 'decided']);

export async function statementOf(store: Store, m: Pick<Mediation, 'statementId'>): Promise<Statement> {
  const s = await store.get('statements', m.statementId);
  if (!s) throw notFound('That statement');
  return s;
}

/** Everything the owner sees of a mediation. */
export async function mediationView(deps: Pick<Deps, 'store'>, m: Mediation, safety?: Safety): Promise<MediationView> {
  const [statement, assembly] = await Promise.all([statementOf(deps.store, m), deps.store.get('assemblies', m.assemblyId)]);
  if (!assembly) throw notFound('That assembly');
  const shown = (await Promise.all(m.shownReasonIds.map((id) => deps.store.get('reasons', id)))).filter((r): r is Reason => !!r && r.side !== 'question');
  const last = m.turns[m.turns.length - 1];
  return {
    mediation: m,
    statement: { id: statement.id, text: statement.text, status: statement.status },
    assembly: { slug: assembly.slug, title: assembly.title, isExample: assembly.isExample },
    shownReasons: shown.map((r) => ({ id: r.id, side: r.side as 'for' | 'against', text: r.text })),
    pending: m.status === 'active' && last?.role === 'mediator' && last.text === DISTRESS_MESSAGE ? 'distress' : null,
    ...(safety ? { safety } : {}),
  };
}

function turn(deps: Pick<Deps, 'clock'>, t: Omit<MediationTurn, 'createdAt'>): MediationTurn {
  return { ...t, createdAt: deps.clock.iso() };
}

async function save(deps: Pick<Deps, 'store' | 'clock'>, m: Mediation): Promise<Mediation> {
  return deps.store.put('mediations', { ...m, updatedAt: deps.clock.iso() });
}

/* ------------------------------------------------------------------ starting */

/**
 * Starts a mediation, or returns the one the person already has on this statement. The caller has
 * already checked rule 1. The person must have answered the statement, and it must not be retired
 * or decided.
 */
export async function startMediation(
  deps: Deps,
  personId: string,
  statement: Statement,
  assembly: Assembly,
): Promise<{ mediation: Mediation; created: boolean }> {
  const [existing] = await deps.store.list('mediations', { statementId: statement.id, personId }, { limit: 1 });
  if (existing) return { mediation: existing, created: false };
  if (CLOSED.has(statement.status))
    throw new HttpError(409, 'statement_closed', 'This statement is settled, so it can no longer be talked through.');
  const [reaction] = await deps.store.list('reactions', { statementId: statement.id, personId }, { limit: 1 });
  if (!reaction) throw new HttpError(409, 'answer_first', 'Answer the statement first, then talk it through.');
  const now = deps.clock.iso();
  const fresh = await deps.store.transaction(async (tx) => {
    const [again] = await tx.list('mediations', { statementId: statement.id, personId }, { limit: 1 });
    if (again) return { mediation: again, created: false };
    const m = await tx.put('mediations', {
      id: newId('med'),
      assemblyId: assembly.id,
      statementId: statement.id,
      personId,
      status: 'active',
      step: FIRST_STEP,
      answer: reaction.value,
      turns: [],
      shownReasonIds: [],
      drafts: {},
      aiUsed: deps.ai.enabled,
      startedAt: now,
      updatedAt: now,
    });
    return { mediation: m, created: true };
  });
  if (!fresh.created) return fresh;
  return { mediation: (await ask(deps, fresh.mediation, statement)).mediation, created: true };
}

/* ------------------------------------------------------------------ turns */

/** Asks the mediator for the next question in the current step and stores it. */
async function ask(deps: Deps, m: Mediation, statement: Statement, carried?: Safety, result?: MediatorResult): Promise<{ mediation: Mediation; safety: Safety }> {
  const r =
    result ??
    (await mediatorTurn(deps, {
      aiUsed: m.aiUsed,
      step: m.step,
      statement: statement.text,
      answer: m.answer,
      turns: m.turns,
      personTurnsInStep: personTurnsIn(m.turns, m.step),
      shownCount: m.shownReasonIds.length,
    }));
  let text = r.text;
  // A note about identifying details noticed in the answer that ended the last step is kept.
  if (carried === 'identifying' && r.safety === 'ok') text = `${text} ${IDENTIFYING_NOTE}`;
  const next: Mediation = {
    ...m,
    ...(r.unavailable ? { aiUsed: false } : {}),
    turns: [...m.turns, turn(deps, { role: 'mediator', step: m.step, text, ...(r.fallback ? { fallback: true } : {}) })],
  };
  return { mediation: await save(deps, next), safety: r.safety === 'ok' && carried ? carried : r.safety };
}

function requireActive(m: Mediation) {
  if (m.status !== 'active') throw new HttpError(409, 'not_active', 'This conversation has moved on to the review.');
}

/** One step in a mediation: an answer, "Skip this", or "Stop here and review". */
export async function takeTurn(deps: Deps, m: Mediation, body: MediationTurnBody): Promise<{ mediation: Mediation; safety?: Safety }> {
  requireActive(m);
  if ('stop' in body) return { mediation: await moveToReview(deps, m) };
  const statement = await statementOf(deps.store, m);
  if ('skip' in body) {
    const skipped = { ...m, turns: [...m.turns, turn(deps, { role: 'person', step: m.step, text: '', skipped: true })] };
    return advance(deps, skipped, statement);
  }
  const answered: Mediation = { ...m, turns: [...m.turns, turn(deps, { role: 'person', step: m.step, text: body.text })] };
  const count = personTurnsIn(answered.turns, answered.step);
  if (mustAdvance(answered.step, count)) return advance(deps, answered, statement);
  const r = await mediatorTurn(deps, {
    aiUsed: answered.aiUsed,
    step: answered.step,
    statement: statement.text,
    answer: answered.answer,
    turns: answered.turns,
    personTurnsInStep: count,
    shownCount: answered.shownReasonIds.length,
  });
  if (r.safety === 'distress') {
    const held = { ...answered, turns: [...answered.turns, turn(deps, { role: 'mediator', step: answered.step, text: r.text })] };
    return { mediation: await save(deps, held), safety: 'distress' };
  }
  if (shouldAdvance(answered.step, count, r.stepComplete)) {
    const base = r.unavailable ? { ...answered, aiUsed: false } : answered;
    return advance(deps, base, statement, r.safety === 'identifying' ? 'identifying' : undefined);
  }
  return ask(deps, answered, statement, undefined, r);
}

/**
 * Moves to the next step and asks its first question; after step 4, to the review. Step 2 shows
 * the other side's reasons chosen by code; when there are none, a fixed line says so and step 3
 * begins.
 */
async function advance(deps: Deps, m: Mediation, statement: Statement, carried?: Safety): Promise<{ mediation: Mediation; safety?: Safety }> {
  const step = nextStep(m.step);
  if (step === 'review') return { mediation: await moveToReview(deps, m) };
  let next: Mediation = { ...m, step };
  if (step === OTHER_SIDE_STEP) {
    const reasons = await deps.store.list('reasons', { statementId: m.statementId });
    const shown = pickOtherSide(reasons, m.answer, m.personId);
    next = { ...next, shownReasonIds: shown.map((r) => r.id) };
    if (shown.length === 0) {
      next = {
        ...next,
        step: 3,
        turns: [...next.turns, turn(deps, { role: 'mediator', step: OTHER_SIDE_STEP, text: MEDIATOR_NO_OTHER_SIDE, skipped: true })],
      };
    }
  }
  return ask(deps, next, statement, carried);
}

/* ------------------------------------------------------------------ review */

/** Ends the conversation part: drafts a reason, a wording and a question from the person's words, and moves to the review. */
export async function moveToReview(deps: Deps, m: Mediation): Promise<Mediation> {
  const statement = await statementOf(deps.store, m);
  const { drafts } = await extractMediation(deps, m.turns, { aiUsed: m.aiUsed });
  const side = defaultReasonSide(m.answer);
  // A wording that is the statement's own is not a rewording.
  const wording = drafts.wording && drafts.wording.trim() !== statement.text.trim() ? drafts.wording : null;
  return save(deps, {
    ...m,
    status: 'reviewing',
    drafts: {
      ...(drafts.reason ? { reason: drafts.reason } : {}),
      ...(drafts.reason && side ? { reasonSide: side } : {}),
      ...(wording ? { wording } : {}),
      ...(drafts.question ? { question: drafts.question } : {}),
    },
  });
}

function requireReviewing(m: Mediation) {
  if (m.status !== 'reviewing') throw new HttpError(409, 'not_reviewing', 'These can be changed while you review them, before you approve.');
}

/** Edits or scraps draft items. An empty string scraps the item. */
export async function updateDrafts(deps: Pick<Deps, 'store' | 'clock'>, m: Mediation, body: MediationDraftsBody): Promise<Mediation> {
  requireReviewing(m);
  const drafts: Mediation['drafts'] = { ...m.drafts };
  for (const key of ['reason', 'wording', 'question'] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (value === '') delete drafts[key];
    else drafts[key] = value;
  }
  if (body.reasonSide) drafts.reasonSide = body.reasonSide;
  if (drafts.wording) checkRewording(await statementOf(deps.store, m), drafts.wording);
  return save(deps, { ...m, drafts });
}

/**
 * "These are right": creates, through the same functions as the direct routes, a reason with the
 * chosen side, a reason with side `question`, and a rewording. Approving with everything scrapped
 * creates nothing.
 */
export async function approve(deps: Deps, m: Mediation): Promise<Mediation> {
  if (m.status === 'complete') return m;
  requireReviewing(m);
  const { reason, reasonSide, wording, question } = m.drafts;
  if (reason && !reasonSide) throw new HttpError(400, 'side_needed', 'Choose whether your reason is for or against the statement.');
  const statement = await statementOf(deps.store, m);
  if (wording) checkRewording(statement, wording);
  const assembly = await deps.store.get('assemblies', m.assemblyId);
  if (!assembly) throw notFound('That assembly');
  const now = deps.clock.iso();
  return deps.store.transaction(async (tx) => {
    const ctx = { store: tx, clock: deps.clock };
    const approved: NonNullable<Mediation['approved']> = {};
    if (reason && reasonSide) approved.reasonId = (await addReason(ctx, statement, m.personId, reasonSide, reason)).id;
    if (question) approved.questionId = (await addReason(ctx, statement, m.personId, 'question', question)).id;
    if (wording) approved.statementId = (await addRewording(ctx, assembly, statement, m.personId, wording)).id;
    const done = await tx.put('mediations', { ...m, status: 'complete', approved, completedAt: now, updatedAt: now });
    // The statement's count of people who finished one has changed.
    await bumpVersion(ctx, m.assemblyId);
    return done;
  });
}
