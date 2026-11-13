import type { Objection, Pledge, Point, Reaction, Statement } from './schemas.js';

/** Rule 4: the number of distinct people among approved points. */
export function countPeople(points: Pick<Point, 'personId' | 'status'>[]): number {
  return new Set(points.filter((p) => p.status === 'approved').map((p) => p.personId)).size;
}

/* ------------------------------------------------------------- opinion groups */

export type GroupKey = 'a' | 'b';
export interface OpinionGroups {
  groups: { key: GroupKey; personIds: string[] }[];
}

/** People need at least this many reactions to be placed in an opinion group. */
export const MIN_REACTIONS_FOR_GROUP = 3;
/** With fewer qualifying people than this there is one group. */
export const MIN_PEOPLE_FOR_TWO_GROUPS = 8;
/** Two centroids closer than this (mean absolute difference) are one group. */
export const MIN_CENTROID_GAP = 0.5;

const VALUE: Record<Reaction['value'], number> = { agree: 1, disagree: -1, unsure: 0 };

const sqDist = (a: number[], b: number[]) => a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0);
const mean = (rows: number[][], dims: number) =>
  Array.from({ length: dims }, (_, j) => rows.reduce((s, r) => s + r[j]!, 0) / (rows.length || 1));

/**
 * Splits people into at most two opinion groups by how they reacted to `statementIds`. Builds a
 * person by statement matrix (agree 1, disagree -1, unsure or missing 0) over people with at least
 * 3 reactions, then runs k-means with k=2, seeded with the farthest pair. Returns one group when
 * fewer than 8 people qualify or the two centroids differ by less than 0.5 mean absolute
 * difference. Deterministic: people are taken in id order, and group `a` is the larger group.
 */
export function opinionGroups(
  reactions: Pick<Reaction, 'personId' | 'statementId' | 'value'>[],
  statementIds: string[],
): OpinionGroups {
  const col = new Map(statementIds.map((id, i) => [id, i]));
  const byPerson = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of reactions) {
    const j = col.get(r.statementId);
    if (j === undefined) continue;
    let row = byPerson.get(r.personId);
    if (!row) byPerson.set(r.personId, (row = new Array(statementIds.length).fill(0)));
    row[j] = VALUE[r.value];
    counts.set(r.personId, (counts.get(r.personId) ?? 0) + 1);
  }
  const people = [...byPerson.keys()].filter((p) => (counts.get(p) ?? 0) >= MIN_REACTIONS_FOR_GROUP).sort();
  const one = (): OpinionGroups => ({ groups: [{ key: 'a', personIds: people }] });
  if (people.length < MIN_PEOPLE_FOR_TWO_GROUPS) return one();

  const rows = people.map((p) => byPerson.get(p)!);
  const dims = statementIds.length;
  // Farthest pair, first found wins ties.
  let seedA = 0;
  let seedB = 1;
  let best = -1;
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const d = sqDist(rows[i]!, rows[j]!);
      if (d > best) [best, seedA, seedB] = [d, i, j];
    }
  if (best <= 0) return one();

  let centroids = [rows[seedA]!, rows[seedB]!];
  let assign: number[] = [];
  for (let iter = 0; iter < 100; iter++) {
    const next = rows.map((r) => (sqDist(r, centroids[1]!) < sqDist(r, centroids[0]!) ? 1 : 0));
    const stable = next.every((g, i) => g === assign[i]);
    assign = next;
    const members = [0, 1].map((g) => rows.filter((_, i) => assign[i] === g));
    if (members.some((m) => m.length === 0)) return one();
    centroids = members.map((m) => mean(m, dims));
    if (stable) break;
  }
  const gap = centroids[0]!.reduce((s, x, j) => s + Math.abs(x - centroids[1]![j]!), 0) / (dims || 1);
  if (gap < MIN_CENTROID_GAP) return one();

  const sets = [0, 1].map((g) => people.filter((_, i) => assign[i] === g));
  // The larger group is `a`; equal sizes: the one holding the first person in id order.
  sets.sort((x, y) => y.length - x.length || (x[0]! < y[0]! ? -1 : 1));
  return {
    groups: [
      { key: 'a', personIds: sets[0]! },
      { key: 'b', personIds: sets[1]! },
    ],
  };
}

/* ------------------------------------------------------------- support */

export interface Tally {
  agree: number;
  disagree: number;
  unsure: number;
  total: number;
  /** agree / total, 0 when nobody has answered. */
  share: number;
}

export interface Support {
  overall: Tally;
  groups: ({ key: GroupKey } & Tally)[];
}

function tally(values: Reaction['value'][]): Tally {
  const t = { agree: 0, disagree: 0, unsure: 0, total: values.length, share: 0 };
  for (const v of values) t[v]++;
  t.share = t.total ? t.agree / t.total : 0;
  return t;
}

/**
 * How people answered one statement, overall and in each opinion group. Counts every reaction it is
 * given; pass only `counted` reactions when the result feeds a decision.
 */
export function statementSupport(
  statement: Pick<Statement, 'id'>,
  reactions: Pick<Reaction, 'statementId' | 'personId' | 'value'>[],
  groups: OpinionGroups,
): Support {
  const mine = reactions.filter((r) => r.statementId === statement.id);
  return {
    overall: tally(mine.map((r) => r.value)),
    groups: groups.groups.map((g) => {
      const members = new Set(g.personIds);
      return { key: g.key, ...tally(mine.filter((r) => members.has(r.personId)).map((r) => r.value)) };
    }),
  };
}

/* ------------------------------------------------------------- the decision rule */

/** Each opinion group needs this many reactions before a statement can be common ground. */
export const MIN_GROUP_REACTIONS = 3;
/** The share below which a group is counted as disagreeing in a split. */
export const DIFFER_BELOW = 0.4;

export const requiredCounted = (pledge: Pick<Pledge, 'minParticipants'>) => Math.min(pledge.minParticipants, 10);

/**
 * `common_ground` when every group's agree share is at least `pledge.groupThreshold`, each group has
 * at least 3 reactions, and overall counted reactions are at least min(minParticipants, 10).
 * `differ` when a group's agree share is below 0.4 while another's is at least the threshold
 * (a group nobody in has answered takes no part in that comparison). Otherwise `not_enough`.
 */
export function classifyStatement(
  support: Support,
  pledge: Pick<Pledge, 'groupThreshold' | 'minParticipants'>,
  counted: number,
): 'common_ground' | 'differ' | 'not_enough' {
  const gs = support.groups;
  if (
    gs.length > 0 &&
    gs.every((g) => g.total >= MIN_GROUP_REACTIONS && g.share >= pledge.groupThreshold) &&
    counted >= requiredCounted(pledge)
  )
    return 'common_ground';
  const answered = gs.filter((g) => g.total > 0);
  if (answered.some((g) => g.share < DIFFER_BELOW) && answered.some((g) => g.share >= pledge.groupThreshold))
    return 'differ';
  return 'not_enough';
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const morePeople = (n: number) => (n === 1 ? '1 more person' : `${n} more people`);

/**
 * What a statement still needs before it passes, as an ordered list of plain-English sentences.
 * An empty list means the rule is met. `counted` defaults to everyone who has answered.
 */
export function stillNeeded(
  statement: Pick<Statement, 'id'>,
  support: Support,
  objections: Pick<Objection, 'statementId' | 'status'>[],
  pledge: Pick<Pledge, 'groupThreshold' | 'minParticipants'>,
  counted: number = support.overall.total,
): string[] {
  const out: string[] = [];
  const two = support.groups.length > 1;
  let need = requiredCounted(pledge) - counted;
  // With one group, its own minimum folds into the overall number so only one count is shown.
  if (!two) need = Math.max(need, MIN_GROUP_REACTIONS - (support.groups[0]?.total ?? 0));
  if (need > 0) out.push(`${morePeople(need)} need${need === 1 ? 's' : ''} to answer`);
  const name = (k: GroupKey) =>
    !two ? 'People who have answered' : k === 'a' ? 'People who answered like the majority' : 'People who answered differently from the majority';
  for (const g of support.groups) {
    if (g.total < MIN_GROUP_REACTIONS) {
      if (!two) continue;
      const more = MIN_GROUP_REACTIONS - g.total;
      out.push(`${morePeople(more)} ${g.key === 'a' ? 'who answered like the majority' : 'who answered differently from the majority'} need${more === 1 ? 's' : ''} to answer`);
    } else if (g.share < pledge.groupThreshold) {
      out.push(`${name(g.key)} are below the level the pledge set (${pct(g.share)} agree, ${pct(pledge.groupThreshold)} needed)`);
    }
  }
  const open = objections.filter((o) => o.statementId === statement.id && o.status === 'open').length;
  if (open > 0) out.push(open === 1 ? '1 objection is waiting for a reply' : `${open} objections are waiting for a reply`);
  return out;
}
