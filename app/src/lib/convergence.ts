// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Convergence-Room v1 state (SCOPE-DIFFERENTIATION §2; design/03 §4): a
// candidate synthesis is ENDORSED only when its endorsement votes clear the
// bridging threshold — positive reception in EVERY qualifying opinion cluster
// (Community-Notes-style cross-polarity approval, never a majority count).
// Everything is COMPUTED from the votes, never asserted as a property: the
// same posture as scope B's measured adoption — a captured room could write a
// status triple; it cannot fake the distribution this module recomputes.
//
// Maximal substrate reuse, no new math: clusters come from the deliberation's
// NEEDS matrix (lib/ranking.cluster — the shared opinion space), the
// candidate's votes are ordinary fut:Resonances (design/01: fut:endorsedBy →
// post-synthesis Resonance records) distributed over those clusters by
// lib/ranking.bridgingScore, and the verdict is lib/insights'
// characterizeReception. Deterministic and scope-blind throughout.

import { characterizeReception, type ReceptionVerdict } from "./insights.js";
import type { Resonance } from "./model.js";
import { bridgingScore, buildMatrix, type ClusterDistribution, cluster } from "./ranking.js";

/**
 * The v1 room quorum (design/03 §4 (4): "minimum resonance in every cluster
 * above minimum size, with quorum rules per community" — community-configured
 * thresholds arrive with the Phase-5 registry wiring; these are the floors).
 */
export const ROOM_K = 2;
export const ROOM_MIN_CLUSTER_SIZE = 2;

/** A candidate's computed convergence state. */
export interface CandidateReception {
  readonly candidate: string;
  /**
   * The room outcome, computed live:
   *  • "endorsed"      — the bridging threshold is met (positive reception in
   *    every opinion cluster that saw it, ≥2 clusters seen);
   *  • "disagreement"  — at least one cluster leans positive while another
   *    leans negative: the honest disagreement map IS the outcome;
   *  • "open"          — thin data / lukewarm: the round is still running.
   */
  readonly outcome: "endorsed" | "disagreement" | "open";
  /** The per-cluster endorsement distribution (fut:bridgingEvidence shape). */
  readonly perCluster: readonly ClusterDistribution[];
  /** The candidate's bridging score over the qualifying clusters. */
  readonly score: number;
  /** Total endorsement votes cast on the candidate. */
  readonly totalSeen: number;
  /** Effective cluster count of the deliberation's opinion space. */
  readonly clusterCount: number;
}

/** Map the insight verdict onto the room outcome. */
function outcomeOf(verdict: ReceptionVerdict): CandidateReception["outcome"] {
  if (verdict === "common-ground") return "endorsed";
  if (verdict === "divisive") return "disagreement";
  return "open";
}

/**
 * Compute a candidate's reception against the deliberation's opinion space.
 *
 * @param participants the VERIFIED participant WebIDs (the aggregate's set)
 * @param needStatements the need IRIs — the opinion-space universe the
 *   clustering runs on (proposals/candidates are deliberately NOT in the
 *   clustering universe; see the doc's Build decisions)
 * @param resonances ALL deduped resonances (need votes shape the clusters;
 *   votes on `candidate` are the endorsement round)
 * @param candidate the candidate synthesis IRI
 */
export function candidateReception(
  participants: readonly string[],
  needStatements: readonly string[],
  resonances: readonly Resonance[],
  candidate: string,
  options: { k?: number; minClusterSize?: number } = {},
): CandidateReception {
  const k = options.k ?? ROOM_K;
  const minClusterSize = options.minClusterSize ?? ROOM_MIN_CLUSTER_SIZE;

  // 1. The shared opinion space: cluster participants by their NEED votes.
  const needsMatrix = buildMatrix(participants, needStatements, resonances);
  const clustering = cluster(needsMatrix, k);

  // 2. The endorsement round: the SAME participants (buildMatrix sorts the
  //    axis, so indices align with the clustering), universe = the candidate.
  const candidateMatrix = buildMatrix(participants, [candidate], resonances);
  const bridging = bridgingScore(candidateMatrix, 0, clustering, { minClusterSize });

  // 3. The verdict — characterizeReception's common-ground test IS the
  //    threshold: ≥2 clusters saw it and every one of them leans positive.
  const outcome = outcomeOf(characterizeReception(bridging.perCluster));

  return {
    candidate,
    outcome,
    perCluster: bridging.perCluster,
    score: bridging.score,
    totalSeen: bridging.totalSeen,
    clusterCount: clustering.centres.length,
  };
}

/** Newest-first, deterministic tie-break on id; a malformed date sorts oldest. */
function newestFirst<T extends { created: string; id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const at = Date.parse(a.created);
    const bt = Date.parse(b.created);
    const aMs = Number.isNaN(at) ? 0 : at;
    const bMs = Number.isNaN(bt) ? 0 : bt;
    if (bMs !== aMs) return bMs - aMs;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The critiques standing on a candidate (the live dissent-annex material):
 * critiques whose `onStatement` is the candidate, newest first. (Withdrawal =
 * the critic deletes the critique from their pod — pod-sovereign, no
 * tombstone machinery in v1.)
 */
export function standingCritiques<T extends { onStatement: string; created: string; id: string }>(
  critiques: readonly T[],
  candidate: string,
): T[] {
  return newestFirst(critiques.filter((c) => c.onStatement === candidate));
}

/**
 * Order candidates for the room: newest first. (Revision lineage is rendered
 * via `revisionOf`; the newest candidate in a lineage is the active round.)
 */
export function orderCandidates<T extends { created: string; id: string }>(
  candidates: readonly T[],
): T[] {
  return newestFirst(candidates);
}
