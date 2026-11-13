import type { OpinionGroups } from '@unite/shared';

export const ROOM_SIZE = { min: 5, max: 8, default: 6 } as const;

/** A small seeded random number generator (mulberry32 on an FNV-1a hash of the seed). */
export function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let a = h;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Draws a room by lot. `participants` are the eligible people (invited, with a completed
 * conversation). People are drawn alternately from the opinion groups while both have people
 * left, so different views are present; once the groups run out, people who are in no group (too
 * few reactions to place) fill the remaining seats. Pure and deterministic for a given seed: the
 * input order does not matter.
 */
export function drawRoom(participants: string[], groups: OpinionGroups['groups'], size: number = ROOM_SIZE.default, seed: string): string[] {
  const want = Math.max(ROOM_SIZE.min, Math.min(ROOM_SIZE.max, Math.floor(size)));
  const rand = seededRandom(seed);
  const eligible = [...new Set(participants)].sort();
  const allowed = new Set(eligible);
  const grouped = new Set<string>();
  const pools = [...groups]
    .sort((x, y) => x.key.localeCompare(y.key))
    .map((g) => {
      const ids = [...new Set(g.personIds)].filter((id) => allowed.has(id) && !grouped.has(id)).sort();
      ids.forEach((id) => grouped.add(id));
      return shuffle(ids, rand);
    });
  const rest = shuffle(
    eligible.filter((id) => !grouped.has(id)),
    rand,
  );

  const out: string[] = [];
  let turn = 0;
  while (out.length < want && pools.some((p) => p.length > 0)) {
    const pool = pools[turn % pools.length]!;
    turn++;
    const next = pool.shift();
    if (next) out.push(next);
  }
  while (out.length < want && rest.length > 0) out.push(rest.shift()!);
  return out;
}
