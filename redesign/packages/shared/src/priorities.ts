import type { PriorityChoice } from './schemas.js';

export interface RankedPriority {
  statementId: string;
  /** The statement's score in the round it was placed. */
  score: number;
  /** 1 for the first placed. */
  round: number;
}

/**
 * Sequential proportional approval voting. Each round places the statement with the highest
 * score, where each person's choice is worth 1 / (1 + the number of already-placed statements that
 * person chose). So once a large group's first choice is placed, its other choices count for less.
 *
 * `statementIds` are the candidates in creation order, earliest first: ties go to the earlier one.
 * Every candidate is placed, so the result has one entry per candidate.
 */
export function rankPriorities(
  choices: Pick<PriorityChoice, 'personId' | 'statementIds'>[],
  statementIds: string[],
): RankedPriority[] {
  const candidates = new Set(statementIds);
  const ballots = choices.map((c) => [...new Set(c.statementIds.filter((id) => candidates.has(id)))]).filter((b) => b.length > 0);
  const placed = new Set<string>();
  const out: RankedPriority[] = [];
  while (out.length < statementIds.length) {
    const scores = new Map<string, number>(statementIds.filter((id) => !placed.has(id)).map((id) => [id, 0]));
    for (const b of ballots) {
      const weight = 1 / (1 + b.filter((id) => placed.has(id)).length);
      for (const id of b) if (scores.has(id)) scores.set(id, scores.get(id)! + weight);
    }
    let bestId = '';
    let best = -1;
    for (const id of statementIds) {
      const s = scores.get(id);
      if (s !== undefined && s > best + 1e-12) [best, bestId] = [s, id];
    }
    placed.add(bestId);
    out.push({ statementId: bestId, score: Math.round(best * 1000) / 1000, round: out.length + 1 });
  }
  return out;
}
