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

import { ROLE_PARTICIPANT, type StakeholderRole } from "./fut-draft.js";
import { characterizeReception, type ReceptionVerdict } from "./insights.js";
import type { Resonance } from "./model.js";
import {
  bridgingScore,
  buildMatrix,
  type ClusterDistribution,
  type ClusterResult,
  cluster,
} from "./ranking.js";

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

// ── S3.2 — the role-cohort bridging lens (design/next-phases §1.3(b)) ─────────
// The infrastructure endorsement gate (SCOPE-DIFFERENTIATION §3.4;
// scopes.ts:189 `crossCohort: ["opinion","role"]`) runs the SAME shipped bridging
// math over a SECOND partition — the VERIFIED-role cohorts from lib/roles.ts —
// so a synthesis that opinion-clusters love but the implementer cohort DREADS
// cannot clear. This is an APPLICATION of `bridgingScore`, NOT new math: the only
// new code is a thin adapter that shapes the verified roles into a `ClusterResult`
// and feeds it to the existing function. Honesty flag (design's own, unchanged):
// role-cohort bridging is unvalidated in the literature; the failure mode is a
// tiny role cohort giving veto — mitigated by `minClusterSize` (a cohort below it
// is dropped from the product, never vetoes), and it only ever RAISES the bar, so
// it is fail-safe.

/**
 * Build a `ClusterResult`-shaped partition from the VERIFIED-role map, aligned by
 * index to the SORTED participant axis `buildMatrix` produces (so the assignments
 * line up with the candidate matrix `bridgingScore` reads). A WebID absent from
 * the map is the base fut:ParticipantRole (FAIL-CLOSED — an unverified/declared
 * role never silently upgrades a cohort). Cohorts are the distinct roles present,
 * in canonical (sorted-IRI) order; `centres` are placeholders (bridgingScore uses
 * only their COUNT as the cluster count) — this mints no geometry.
 */
export function roleClustering(
  participants: readonly string[],
  roleMap: ReadonlyMap<string, StakeholderRole>,
): ClusterResult {
  // The SAME dedupe+sort buildMatrix applies — indices must align exactly.
  const parts = [...new Set(participants)].sort();
  const roleOf = (p: string): StakeholderRole => roleMap.get(p) ?? ROLE_PARTICIPANT;
  const cohorts = [...new Set(parts.map(roleOf))].sort();
  const cohortIndex = new Map(cohorts.map((r, g) => [r, g]));
  const assignments = parts.map((p) => cohortIndex.get(roleOf(p)) ?? 0);
  const sizes = new Array<number>(cohorts.length).fill(0);
  for (const g of assignments) {
    // biome-ignore lint/style/noNonNullAssertion: g is a valid cohort index.
    sizes[g]!++;
  }
  return {
    k: cohorts.length,
    assignments,
    sizes,
    // Length is all bridgingScore reads from centres (its `kk`); the vector is a
    // placeholder — the role partition has no opinion-space geometry.
    centres: cohorts.map(() => []),
  };
}

/**
 * A candidate's reception over the VERIFIED-role partition — the same shape as
 * {@link candidateReception}, computed by feeding {@link roleClustering} to
 * `bridgingScore`. `clusterCount` is the number of role cohorts.
 */
export function roleCohortReception(
  participants: readonly string[],
  resonances: readonly Resonance[],
  candidate: string,
  roleMap: ReadonlyMap<string, StakeholderRole>,
  options: { minClusterSize?: number } = {},
): CandidateReception {
  const minClusterSize = options.minClusterSize ?? ROOM_MIN_CLUSTER_SIZE;
  const candidateMatrix = buildMatrix(participants, [candidate], resonances);
  const clustering = roleClustering(participants, roleMap);
  const bridging = bridgingScore(candidateMatrix, 0, clustering, { minClusterSize });
  // The tiny-cohort-veto mitigation (design's honesty flag): a role cohort BELOW
  // `minClusterSize` neither counts toward common-ground NOR vetoes — the OUTCOME
  // is characterised over the QUALIFYING cohorts only (unlike the opinion lens,
  // where every computed cluster counts). So a lone dissenting implementer cannot
  // flip an endorsement to a disagreement; it can only leave the role lens unable
  // to confirm ("open"). The full per-cohort distribution is still returned for
  // display, and the score already applies minClusterSize.
  const qualifying = bridging.perCluster.filter((d) => d.size >= minClusterSize);
  const outcome = outcomeOf(characterizeReception(qualifying));
  return {
    candidate,
    outcome,
    perCluster: bridging.perCluster,
    score: bridging.score,
    totalSeen: bridging.totalSeen,
    clusterCount: clustering.centres.length,
  };
}

/** A scope-B candidate's reception over BOTH required partitions (§3.4 gate). */
export interface InfraCandidateReception {
  readonly candidate: string;
  /**
   * The COMBINED room outcome:
   *  • "endorsed"     — BOTH the opinion partition AND the role partition cleared
   *    the bridging threshold (positive reception in every qualifying cohort of
   *    each). The §3.4 rule: an infrastructure recommendation is common ground
   *    only when it bridges opinion clusters AND stakeholder roles.
   *  • "disagreement" — EITHER partition is a disagreement map (a cohort leans
   *    positive while another leans negative) — the honest map IS the outcome.
   *  • "open"         — thin data / lukewarm in at least one partition.
   */
  readonly outcome: "endorsed" | "disagreement" | "open";
  /** The computed opinion-cluster partition (the always-on lens). */
  readonly opinion: CandidateReception;
  /** The verified-role partition (scope B's second required lens). */
  readonly role: CandidateReception;
  /** True IFF BOTH partitions independently reached "endorsed" — the gate. */
  readonly bothCleared: boolean;
}

/**
 * Compute a scope-B (infrastructure) candidate's reception over BOTH the computed
 * opinion partition AND the verified-role partition, and combine them: the gate is
 * met (`bothCleared` / outcome "endorsed") ONLY when EACH partition clears the
 * bridging threshold (SCOPE-DIFFERENTIATION §3.4). A disagreement in EITHER
 * partition surfaces as "disagreement" (honest), never silently endorsed. Reuses
 * {@link candidateReception} (opinion) + {@link roleCohortReception} (role) — no
 * new math, both partitions run the shipped `bridgingScore`.
 */
export function infraCandidateReception(
  participants: readonly string[],
  needStatements: readonly string[],
  resonances: readonly Resonance[],
  candidate: string,
  roleMap: ReadonlyMap<string, StakeholderRole>,
  options: { k?: number; minClusterSize?: number } = {},
): InfraCandidateReception {
  const opinion = candidateReception(participants, needStatements, resonances, candidate, options);
  const role = roleCohortReception(participants, resonances, candidate, roleMap, {
    ...(options.minClusterSize !== undefined ? { minClusterSize: options.minClusterSize } : {}),
  });
  const bothCleared = opinion.outcome === "endorsed" && role.outcome === "endorsed";
  const outcome: InfraCandidateReception["outcome"] =
    opinion.outcome === "disagreement" || role.outcome === "disagreement"
      ? "disagreement"
      : bothCleared
        ? "endorsed"
        : "open";
  return { candidate, outcome, opinion, role, bothCleared };
}
