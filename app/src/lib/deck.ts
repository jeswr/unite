// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Resonance-deck routing (S4 — docs/SCOPE-DIFFERENTIATION.md §4.4): the
// card-at-a-time reaction surface's DETERMINISTIC statement ordering. The
// design intent (design/03 §3's active-learning shape, simplified — flagged
// honest-speculative in §9): prefer statements the viewer's own opinion group
// has NOT yet assessed that NEIGHBOURING groups resonated with — surfacing
// potential common ground across the divide instead of feeding each group its
// own favourites. NO novel ML: this reuses the shared clustering + the same
// Laplace smoothing as lib/ranking, with total, documented tie-breaks.
//
// Integrity posture inherited from ranking.ts: the routable statement
// UNIVERSE is passed in explicitly (the verified aggregate's claim/need ids),
// never harvested from resonances — votes on ids outside it are ignored by
// buildMatrix. Clusters come from the NEEDS matrix only (the S1 build
// decision: statement authorship cannot reshape the cohorts that judge it).

import type { Resonance } from "./model.js";
import { buildMatrix, cluster } from "./ranking.js";

/** One routed deck entry (the card order + why it routed where it did). */
export interface DeckEntry {
  readonly statement: string;
  /** Votes the viewer's own cluster has cast on it (0 = unassessed by "us"). */
  readonly ownClusterSeen: number;
  /** Best Laplace-smoothed P(resonate) among OTHER clusters that saw it. */
  readonly neighbourResonance: number;
  /** Total votes across all clusters (exposure spreading on cold cards). */
  readonly totalSeen: number;
}

/** Options for {@link routeDeck}. */
export interface RouteDeckOptions {
  /** The session identity (whose queue this is). */
  readonly viewer: string;
  /** The VERIFIED participant WebIDs (the aggregate's set). */
  readonly participants: readonly string[];
  /** The need IRIs — the clustering universe (needs only; S1 build decision 3). */
  readonly needStatements: readonly string[];
  /** The routable universe: the statements the deck deals (claim ids). */
  readonly deckStatements: readonly string[];
  /** ALL deduped resonances (need votes shape clusters; deck votes filter seen). */
  readonly resonances: readonly Resonance[];
  /** Cluster count (default 2 — the room's shared opinion space). */
  readonly k?: number;
}

/**
 * Order the deck for a viewer. Pure + fully deterministic:
 *
 *  1. Cards the viewer already reacted to are EXCLUDED (one voice per person —
 *     re-reacting happens on the board, not the deck).
 *  2. Remaining cards sort by:
 *       a. own-cluster votes ASC — statements "your group hasn't assessed" first;
 *       b. neighbour resonance DESC — what other groups resonated with;
 *       c. total votes ASC — spread exposure over cold cards;
 *       d. statement IRI ASC — the total tie-break.
 *  3. A viewer outside the clustering (no need votes / not a participant)
 *     falls back to (c)+(d): least-seen-first exposure spreading — a T0
 *     newcomer still gets a deterministic, engagement-blind queue.
 */
export function routeDeck(options: RouteDeckOptions): DeckEntry[] {
  const k = options.k ?? 2;
  const { viewer, participants, needStatements, deckStatements, resonances } = options;

  // The shared opinion space (needs only).
  const needsMatrix = buildMatrix(participants, needStatements, resonances);
  const clustering = cluster(needsMatrix, k);
  const viewerIndex = needsMatrix.participants.indexOf(viewer);
  const viewerCluster = viewerIndex >= 0 ? (clustering.assignments[viewerIndex] ?? null) : null;

  // The deck matrix: same participant axis (buildMatrix sorts it, so indices
  // align with the clustering), universe = the deck statements.
  const deckMatrix = buildMatrix(participants, deckStatements, resonances);

  // What the viewer already reacted to (their row of the deck matrix — only
  // counts votes on statements in the universe, like everything here).
  const viewerRow = viewerIndex >= 0 ? deckMatrix.rows[viewerIndex] : undefined;

  const entries: DeckEntry[] = [];
  for (let j = 0; j < deckMatrix.statements.length; j++) {
    const statement = deckMatrix.statements[j];
    if (statement === undefined) continue;
    if (viewerRow && viewerRow[j] !== null && viewerRow[j] !== undefined) continue; // already reacted

    // Per-cluster tallies for this statement.
    let ownClusterSeen = 0;
    let neighbourResonance = 0;
    let totalSeen = 0;
    const perCluster = new Map<number, { resonates: number; seen: number }>();
    for (let i = 0; i < deckMatrix.participants.length; i++) {
      const row = deckMatrix.rows[i];
      const v = row ? row[j] : null;
      if (v === null || v === undefined) continue;
      totalSeen++;
      const g = clustering.assignments[i];
      if (g === undefined) continue;
      let d = perCluster.get(g);
      if (!d) {
        d = { resonates: 0, seen: 0 };
        perCluster.set(g, d);
      }
      d.seen++;
      if (v === 1) d.resonates++;
    }
    for (const [g, d] of perCluster) {
      if (viewerCluster !== null && g === viewerCluster) {
        ownClusterSeen = d.seen;
        continue;
      }
      // Laplace-smoothed P(resonate | g) — the same smoothing as bridgingScore.
      const p = (d.resonates + 1) / (d.seen + 2);
      if (p > neighbourResonance) neighbourResonance = p;
    }
    entries.push({ statement, ownClusterSeen, neighbourResonance, totalSeen });
  }

  entries.sort((a, b) => {
    if (viewerCluster !== null) {
      if (a.ownClusterSeen !== b.ownClusterSeen) return a.ownClusterSeen - b.ownClusterSeen;
      if (b.neighbourResonance !== a.neighbourResonance) {
        return b.neighbourResonance - a.neighbourResonance;
      }
    }
    if (a.totalSeen !== b.totalSeen) return a.totalSeen - b.totalSeen;
    return a.statement < b.statement ? -1 : a.statement > b.statement ? 1 : 0;
  });
  return entries;
}
