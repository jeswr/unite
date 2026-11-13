import { addDays, newId, rankPriorities, type Assembly, type Decision, type PriorityChoice, type Statement } from '@unite/shared';
import type { Deps } from '../../deps.js';
import { HttpError } from '../../errors.js';
import type { Store } from '../../store/types.js';
import { bumpVersion } from '../../version.js';

/** Statuses a person may choose as a priority. */
export const CHOOSABLE: readonly Statement['status'][] = ['common_ground', 'decided'];
export const MAX_CHOICES = 3;

export interface RankedItem {
  statementId: string;
  text: string;
  status: Statement['status'];
  round: number;
  /** The statement's score in the round it was placed. Shown as a bar, never as a number. */
  score: number;
}

export interface PrioritiesView {
  statements: { id: string; text: string; status: Statement['status'] }[];
  ranked: RankedItem[];
  myChoices: string[];
  /** Whether my choices count in the ranking (my membership is invited). */
  myChoicesCount: boolean;
  /** Invited people who have chosen at least one statement. */
  chosen: number;
  invited: number;
  /** People who are not invited but have chosen: stored, reported, not counted. */
  uninvitedChosen: number;
  capacity: number | null;
  replyBy: string | null;
  /** True once decisions have been made from the list. */
  closed: boolean;
}

/** Choosable statements in creation order, earliest first (rankPriorities breaks ties by it). */
async function choosable(store: Store, assemblyId: string): Promise<Statement[]> {
  const all = await store.list('statements', { assemblyId }, { orderBy: 'created_at' });
  return all
    .map((s, i) => ({ s, i }))
    .sort((x, y) => x.s.createdAt.localeCompare(y.s.createdAt) || x.i - y.i)
    .map(({ s }) => s)
    .filter((s) => CHOOSABLE.includes(s.status));
}

/** The invited people's choices (the ones counted) and how many others chose. */
async function splitChoices(store: Store, assemblyId: string) {
  const [choices, invitedMembers] = await Promise.all([
    store.list('priorityChoices', { assemblyId }),
    store.list('memberships', { assemblyId, invited: true }),
  ]);
  const invited = new Set(invitedMembers.map((m) => m.personId));
  const nonEmpty = choices.filter((c) => c.statementIds.length > 0);
  return {
    counted: nonEmpty.filter((c) => invited.has(c.personId)),
    uncounted: nonEmpty.filter((c) => !invited.has(c.personId)),
    choices,
    invited,
  };
}

/** The proportional ranking of the given statements from the counted choices. */
export function rankStatements(statements: Statement[], counted: Pick<PriorityChoice, 'personId' | 'statementIds'>[]): RankedItem[] {
  const byId = new Map(statements.map((s) => [s.id, s]));
  return rankPriorities(
    counted,
    statements.map((s) => s.id),
  ).map((r) => {
    const s = byId.get(r.statementId)!;
    return { statementId: r.statementId, text: s.text, status: s.status, round: r.round, score: r.score };
  });
}

export async function prioritiesView(store: Store, assembly: Assembly, personId: string | undefined): Promise<PrioritiesView> {
  const [statements, split, decisions] = await Promise.all([
    choosable(store, assembly.id),
    splitChoices(store, assembly.id),
    store.count('decisions', { assemblyId: assembly.id }),
  ]);
  const mine = personId ? split.choices.find((c) => c.personId === personId) : undefined;
  return {
    statements: statements.map((s) => ({ id: s.id, text: s.text, status: s.status })),
    ranked: rankStatements(statements, split.counted),
    myChoices: mine?.statementIds ?? [],
    myChoicesCount: !!personId && split.invited.has(personId),
    chosen: new Set(split.counted.map((c) => c.personId)).size,
    invited: split.invited.size,
    uninvitedChosen: new Set(split.uncounted.map((c) => c.personId)).size,
    capacity: assembly.pledge?.capacity ?? null,
    replyBy: assembly.pledge?.replyBy ?? null,
    closed: decisions > 0,
  };
}

/** Sets my choices: at most three, each a common-ground or decided statement in this assembly. */
export async function setChoices(deps: Pick<Deps, 'store' | 'clock'>, assembly: Assembly, personId: string, statementIds: string[]): Promise<PriorityChoice> {
  const { store, clock } = deps;
  const ids = [...new Set(statementIds)];
  if (ids.length > MAX_CHOICES) throw new HttpError(400, 'too_many', `You can choose at most ${MAX_CHOICES}.`);
  if ((await store.count('decisions', { assemblyId: assembly.id })) > 0)
    throw new HttpError(409, 'list_closed', 'The list has closed: the top priorities have gone to the host for an answer.');
  for (const id of ids) {
    const s = await store.get('statements', id);
    if (!s || s.assemblyId !== assembly.id) throw new HttpError(400, 'bad_statement', 'One of those statements is not in this assembly.');
    if (!CHOOSABLE.includes(s.status)) throw new HttpError(400, 'not_common_ground', 'You can only choose statements that have reached common ground.');
  }
  const [existing] = await store.list('priorityChoices', { assemblyId: assembly.id, personId }, { limit: 1 });
  const choice = await store.put('priorityChoices', {
    id: existing?.id ?? newId('pc'),
    assemblyId: assembly.id,
    personId,
    statementIds: ids,
    updatedAt: clock.iso(),
  });
  await bumpVersion(deps, assembly.id);
  return choice;
}

export interface DecisionInput {
  title: string;
  why: string;
  options: string[];
  dissent: string;
  tests: string[];
  delivery: ('technology' | 'social')[];
}

/**
 * Turns the top `pledge.capacity` ranked common-ground statements into decisions, numbered from 1
 * in rank order, awaiting the host's answer by the pledge's reply date, and marks those statements
 * decided. Statements nobody chose are not priorities and are left out. Refuses when decisions
 * already exist, or when any top statement has no entry with at least one test.
 */
export async function decide(deps: Pick<Deps, 'store' | 'clock'>, assembly: Assembly, inputs: Record<string, DecisionInput>): Promise<Decision[]> {
  const { store, clock } = deps;
  const pledge = assembly.pledge;
  if (!pledge) throw new HttpError(409, 'no_pledge', 'This assembly has no pledge, so there is nothing to decide against.');
  if ((await store.count('decisions', { assemblyId: assembly.id })) > 0)
    throw new HttpError(409, 'already_decided', 'Decisions have already been made for this assembly.');
  const statements = (await choosable(store, assembly.id)).filter((s) => s.status === 'common_ground');
  const { counted } = await splitChoices(store, assembly.id);
  const top = rankStatements(statements, counted)
    .filter((r) => r.score > 0)
    .slice(0, pledge.capacity);
  if (top.length === 0) throw new HttpError(409, 'no_priorities', 'Nobody has chosen any priorities yet.');

  const missing = top.filter((t) => !inputs[t.statementId]);
  if (missing.length)
    throw new HttpError(400, 'missing_decision', `Write up every top priority first. Missing: ${missing.map((m) => `“${m.text}”`).join('; ')}.`, {
      statementIds: missing.map((m) => m.statementId),
    });
  const untested = top.filter((t) => !inputs[t.statementId]!.tests.some((x) => x.trim()));
  if (untested.length)
    throw new HttpError(400, 'missing_tests', `Every decision needs at least one test. Missing for: ${untested.map((m) => `“${m.text}”`).join('; ')}.`, {
      statementIds: untested.map((m) => m.statementId),
    });

  const now = clock.iso();
  const created = await store.transaction(async (tx) => {
    if ((await tx.count('decisions', { assemblyId: assembly.id })) > 0)
      throw new HttpError(409, 'already_decided', 'Decisions have already been made for this assembly.');
    const out: Decision[] = [];
    for (const [i, t] of top.entries()) {
      const input = inputs[t.statementId]!;
      out.push(
        await tx.put('decisions', {
          id: newId('dec'),
          assemblyId: assembly.id,
          statementId: t.statementId,
          number: i + 1,
          title: input.title,
          why: input.why,
          options: input.options,
          dissent: input.dissent,
          tests: input.tests
            .map((x) => x.trim())
            .filter(Boolean)
            .map((text, n) => ({ n: n + 1, text })),
          delivery: input.delivery,
          rank: t.round,
          dueDate: pledge.replyBy,
          reviewDate: addDays(now, pledge.reviewAfterDays),
          status: 'awaiting_answer',
          createdAt: now,
          updatedAt: now,
        }),
      );
      const s = await tx.get('statements', t.statementId);
      if (s) await tx.put('statements', { ...s, status: 'decided', updatedAt: now });
    }
    return out;
  });
  await bumpVersion(deps, assembly.id);
  return created;
}
