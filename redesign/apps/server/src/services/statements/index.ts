import {
  classifyStatement,
  opinionGroups,
  statementSupport,
  stillNeeded,
  type Objection,
  type OpinionGroups,
  type Pledge,
  type Reaction,
  type Reason,
  type Role,
  type Statement,
} from '@unite/shared';
import type { Deps } from '../../deps.js';
import type { Store } from '../../store/types.js';
import type { GroupResult, ObjectionView, ReasonView, StatementResults, StatementSummary } from '@unite/shared';

/**
 * Statements (sections 5 and 7). Status is worked out by the shared pure functions from counted
 * reactions only; what a participant sees of others' answers is decided here (rule 5).
 */

/** Statements in these states are settled: a reaction never changes them. */
export const SETTLED: ReadonlySet<Statement['status']> = new Set(['decided', 'no_agreement', 'retired']);

/** The rule used when an assembly has no pledge (open listening): the usual level-2 values. */
export const DEFAULT_RULE: Pick<Pledge, 'groupThreshold' | 'minParticipants'> = { groupThreshold: 0.6, minParticipants: 10 };

export const ruleOf = (pledge: Pledge | null) => pledge ?? DEFAULT_RULE;

export interface Viewer {
  personId?: string;
  role: Role;
}

export interface ReactionData {
  statements: Statement[];
  reactions: Reaction[];
  objections: Objection[];
  /** Opinion groups from everyone's answers: used to show "people who answered like you". */
  shown: OpinionGroups;
  /** Opinion groups from counted answers only: used for the decision rule. */
  counted: OpinionGroups;
}

export async function loadReactionData(store: Store, assemblyId: string): Promise<ReactionData> {
  const [statements, reactions, objections] = await Promise.all([
    store.list('statements', { assemblyId }),
    store.list('reactions', { assemblyId }),
    store.list('objections', { assemblyId }),
  ]);
  const ids = statements.filter((s) => s.status !== 'retired').map((s) => s.id);
  const counted = reactions.filter((r) => r.counted);
  return { statements, reactions, objections, shown: groupsOf(reactions, ids), counted: groupsOf(counted, ids) };
}

/**
 * `opinionGroups`, except that when people have not split into two groups the one group is
 * everyone who answered. `opinionGroups` leaves out people with fewer than 3 answers, which is right
 * for telling two groups apart but would otherwise leave a single group empty, so that no statement
 * could reach common ground until everyone had answered three.
 */
export function groupsOf(reactions: Pick<Reaction, 'personId' | 'statementId' | 'value'>[], statementIds: string[]): OpinionGroups {
  const g = opinionGroups(reactions, statementIds);
  if (g.groups.length > 1) return g;
  const known = new Set(statementIds);
  const everyone = [...new Set(reactions.filter((r) => known.has(r.statementId)).map((r) => r.personId))].sort();
  return { groups: [{ key: 'a', personIds: everyone }] };
}

/** The status a statement should have now, from counted reactions. Settled statements and statements nobody has answered keep theirs. */
export function statusFor(statement: Statement, data: ReactionData, pledge: Pledge | null): Statement['status'] {
  if (SETTLED.has(statement.status)) return statement.status;
  const mine = data.reactions.filter((r) => r.statementId === statement.id);
  if (mine.length === 0) return statement.status;
  const counted = mine.filter((r) => r.counted);
  const support = statementSupport(statement, counted, data.counted);
  return classifyStatement(support, ruleOf(pledge), counted.length);
}

/**
 * Recomputes every unsettled statement in the assembly (a new answer can move the opinion groups,
 * and so any statement), storing only those whose status changed. Returns how many changed.
 */
export async function reclassify(deps: Pick<Deps, 'store' | 'clock'>, assemblyId: string): Promise<number> {
  const { store, clock } = deps;
  const assembly = await store.get('assemblies', assemblyId);
  if (!assembly) return 0;
  const data = await loadReactionData(store, assemblyId);
  let changed = 0;
  for (const s of data.statements) {
    const status = statusFor(s, data, assembly.pledge);
    if (status !== s.status) {
      await store.put('statements', { ...s, status, updatedAt: clock.iso() });
      changed++;
    }
  }
  return changed;
}

/** Whether the viewer may see how others answered this statement (rule 5). */
export function maySeeResults(statementId: string, data: Pick<ReactionData, 'reactions'>, viewer: Viewer): boolean {
  if (viewer.role === 'host' || viewer.role === 'steward') return true;
  return !!viewer.personId && data.reactions.some((r) => r.statementId === statementId && r.personId === viewer.personId);
}

export function resultsFor(statement: Statement, data: ReactionData, pledge: Pledge | null, viewer: Viewer): StatementResults {
  const all = data.reactions.filter((r) => r.statementId === statement.id);
  const counted = all.filter((r) => r.counted);
  const shown = statementSupport(statement, all, data.shown);
  const forRule = statementSupport(statement, counted, data.counted);
  const myGroup = viewer.personId ? data.shown.groups.find((g) => g.personIds.includes(viewer.personId!))?.key : undefined;
  const groups: GroupResult[] = shown.groups.map((g) => ({ ...g, mine: data.shown.groups.length > 1 && g.key === myGroup }));
  return {
    overall: shown.overall,
    groups,
    counted: counted.length,
    stillNeeded: stillNeeded(statement, forRule, data.objections, ruleOf(pledge), counted.length),
  };
}

/**
 * Whether the viewer may see a statement's status (rule 5). The status says how others answered,
 * so a participant sees it only after answering, except that a decided statement is public.
 */
export function maySeeStatus(statement: Pick<Statement, 'id' | 'status'>, data: Pick<ReactionData, 'reactions'>, viewer: Viewer): boolean {
  return statement.status === 'decided' || maySeeResults(statement.id, data, viewer);
}

export function summaryOf(statement: Statement, data: ReactionData, pledge: Pledge | null, viewer: Viewer): StatementSummary {
  const my = viewer.personId ? data.reactions.find((r) => r.statementId === statement.id && r.personId === viewer.personId) : undefined;
  return {
    id: statement.id,
    text: statement.text,
    version: statement.version,
    ...(statement.previousId ? { previousId: statement.previousId } : {}),
    ...(maySeeStatus(statement, data, viewer) ? { status: statement.status } : {}),
    origin: statement.origin,
    mine: !!viewer.personId && statement.authorPersonId === viewer.personId,
    createdAt: statement.createdAt,
    myReaction: my?.value ?? null,
    ...(maySeeResults(statement.id, data, viewer) ? { results: resultsFor(statement, data, pledge, viewer) } : {}),
  };
}

export function reasonView(r: Reason, viewer: Viewer): ReasonView {
  return { id: r.id, side: r.side, text: r.text, createdAt: r.createdAt, mine: !!viewer.personId && r.personId === viewer.personId };
}

export function objectionView(o: Objection, viewer: Viewer): ObjectionView {
  return {
    id: o.id,
    text: o.text,
    status: o.status,
    ...(o.reply ? { reply: o.reply } : {}),
    ...(o.repliedBy ? { repliedBy: o.repliedBy } : {}),
    createdAt: o.createdAt,
    ...(o.resolvedAt ? { resolvedAt: o.resolvedAt } : {}),
    mine: !!viewer.personId && o.personId === viewer.personId,
  };
}

/** Rule 3: the ids among `pointIds` that are approved points of this assembly, in the order given. */
export async function existingSources(store: Store, assemblyId: string, pointIds: string[]): Promise<string[]> {
  const pts = await Promise.all([...new Set(pointIds)].map((id) => store.get('points', id)));
  return pts.filter((p) => p && p.assemblyId === assemblyId && p.status === 'approved').map((p) => p!.id);
}

/** The themes the given points are in. */
export async function themesOfPoints(store: Store, assemblyId: string, pointIds: string[]): Promise<string[]> {
  const themes = await store.list('themes', { assemblyId });
  const set = new Set(pointIds);
  return themes.filter((t) => t.pointIds.some((id) => set.has(id))).map((t) => t.id);
}
