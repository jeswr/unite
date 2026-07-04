// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Legibility helpers over the ranking output (design/03 §6: the UI must show
// the actual per-cluster reception, never a bare rank — these classify what the
// distribution says so the Common-ground view can label it honestly).

import type { ClusterDistribution, RankedStatement } from "./ranking.js";

/** What a statement's per-cluster reception amounts to. */
export type ReceptionVerdict = "common-ground" | "divisive" | null;

/** Clusters that actually saw the statement (size > 0 and ≥ 1 vote). */
function seenClusters(perCluster: readonly ClusterDistribution[]): ClusterDistribution[] {
  return perCluster.filter((d) => d.size > 0 && d.seen > 0);
}

/**
 * Classify a statement's reception:
 *   • "common-ground" — ≥ 2 clusters saw it AND every one of them leans
 *     positive (resonates strictly outnumber conflicts, and at least half of
 *     the votes are resonates);
 *   • "divisive" — one cluster leans positive while another leans negative
 *     (conflicts strictly outnumber resonates);
 *   • null — anything else (thin data, lukewarm, one-sided exposure).
 */
export function characterizeReception(
  perCluster: readonly ClusterDistribution[],
): ReceptionVerdict {
  const seen = seenClusters(perCluster);
  if (seen.length < 2) return null;
  const positive = seen.filter((d) => d.resonates > d.conflicts && d.resonates * 2 >= d.seen);
  const negative = seen.filter((d) => d.conflicts > d.resonates);
  if (positive.length === seen.length) return "common-ground";
  if (positive.length > 0 && negative.length > 0) return "divisive";
  return null;
}

/**
 * The statement cluster `g` received best — highest Laplace-smoothed
 * P(resonate | g), requiring ≥ 1 vote in the cluster. Ties break on the
 * statement IRI (deterministic). Null when the cluster voted on nothing.
 */
export function topForCluster(
  ranked: readonly RankedStatement[],
  g: number,
): RankedStatement | null {
  let best: RankedStatement | null = null;
  let bestP = -1;
  for (const r of ranked) {
    const d = r.perCluster[g];
    if (!d || d.seen === 0) continue;
    const p = (d.resonates + 1) / (d.seen + 2);
    if (p > bestP || (p === bestP && best !== null && r.statement < best.statement)) {
      bestP = p;
      best = r;
    }
  }
  return best;
}
