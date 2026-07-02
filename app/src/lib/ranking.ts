// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The bridging math (design/03 §0 + §3): rank statements by cross-cluster
// reception, NOT engagement. This is the Pol.is / Community-Notes objective —
// a statement scores high only when it earns positive reception in EVERY
// opinion cluster, so common ground surfaces and divisive content sinks.
//
// Everything here is DETERMINISTIC and characterization-tested (see
// ranking.test.ts): k-means uses a deterministic farthest-first init, all
// tie-breaks are on participant / statement id, and the distribution is always
// returned alongside the score (design/03 §2 + §6 REQUIRE showing the actual
// per-cluster distribution, never a bare rank). No novel ML.
//
// INTEGRITY: the ranked statement UNIVERSE is passed in explicitly (the verified
// aggregate need ids), NOT harvested from resonances — otherwise a verified
// participant could inject arbitrary statement IRIs into the ranking by voting
// on ids that back no real Need. Resonances on statements outside the universe
// are ignored.

import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE } from "./fut.js";
import type { Resonance } from "./model.js";

/** A resonance-matrix cell: resonate (+1) / conflict (−1) / unsure (0) / unseen. */
export type CellValue = 1 | -1 | 0 | null;

/** Map a coded stance IRI to its numeric matrix value. */
export function stanceToValue(stance: string): 1 | -1 | 0 {
  if (stance === STANCE_RESONATES) return 1;
  if (stance === STANCE_CONFLICTS) return -1;
  if (stance === STANCE_UNSURE) return 0;
  // Unreachable for coded stances (model.ts only admits the three); default 0.
  return 0;
}

/** The participant × statement resonance matrix (canonical, sorted axes). */
export interface Matrix {
  /** Participant ids, sorted lexicographically (order-invariant clustering). */
  readonly participants: string[];
  /** Statement ids, sorted lexicographically. */
  readonly statements: string[];
  /** rows[i][j] = participant i's cell for statement j. */
  readonly rows: CellValue[][];
}

/**
 * Build the resonance matrix over an explicit participant set AND an explicit
 * statement universe (the verified need ids). Both axes are sorted
 * lexicographically so the result is invariant to input ordering. A resonance
 * counts ONLY if its creator is a listed participant AND its onStatement is in
 * the universe; votes on unknown statements/participants are ignored. Input
 * SHOULD be deduped (aggregate.dedupeResonances); if not, the last write wins.
 */
export function buildMatrix(
  participants: readonly string[],
  statements: readonly string[],
  resonances: readonly Resonance[],
): Matrix {
  const parts = [...new Set(participants)].sort();
  const stmts = [...new Set(statements)].sort();
  const partIndex = new Map(parts.map((p, i) => [p, i]));
  const stmtIndex = new Map(stmts.map((s, j) => [s, j]));

  const rows: CellValue[][] = parts.map(() => stmts.map(() => null as CellValue));
  for (const r of resonances) {
    const i = partIndex.get(r.creator);
    const j = stmtIndex.get(r.onStatement);
    if (i === undefined || j === undefined) continue;
    // biome-ignore lint/style/noNonNullAssertion: i,j come from the index maps → in-bounds.
    rows[i]![j] = stanceToValue(r.stance);
  }
  return { participants: parts, statements: stmts, rows };
}

/** The numeric vector for participant i (unseen → 0), for the geometry. */
function numericVector(matrix: Matrix, i: number): number[] {
  // biome-ignore lint/style/noNonNullAssertion: i < participants.length by construction.
  return matrix.rows[i]!.map((v) => v ?? 0);
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let j = 0; j < a.length; j++) {
    // biome-ignore lint/style/noNonNullAssertion: j < a.length; a and b share length.
    const d = a[j]! - b[j]!;
    sum += d * d;
  }
  return sum;
}

function squaredNorm(a: readonly number[]): number {
  let sum = 0;
  for (const x of a) sum += x * x;
  return sum;
}

/** The outcome of clustering: per-participant assignment + cluster geometry. */
export interface ClusterResult {
  /** Effective number of clusters (min of requested k and participant count). */
  readonly k: number;
  /** assignments[i] = the cluster index of participants[i]. */
  readonly assignments: number[];
  /** sizes[g] = number of participants in cluster g. */
  readonly sizes: number[];
  /** centres[g] = the final centroid vector of cluster g. */
  readonly centres: number[][];
}

/**
 * k-means over participant vectors (unseen → 0), with a DETERMINISTIC
 * farthest-first init and a bounded iteration count. Determinism:
 *   • centre 0 = the vector of maximum L2 norm; ties → least participant index
 *     (participants are sorted, so least index = lexicographically-least id);
 *   • each next centre = the point farthest from its nearest chosen centre,
 *     same tie-break;
 *   • assignment ties → lowest cluster index.
 * `k` is clamped to the participant count.
 */
export function cluster(matrix: Matrix, k = 2): ClusterResult {
  const n = matrix.participants.length;
  const effectiveK = Math.max(1, Math.min(k, n));
  if (n === 0) return { k: 0, assignments: [], sizes: [], centres: [] };

  const vectors = matrix.participants.map((_, i) => numericVector(matrix, i));
  const dim = matrix.statements.length;
  const vecAt = (i: number): number[] => {
    // biome-ignore lint/style/noNonNullAssertion: i indexes the participants array.
    return vectors[i]!;
  };

  // ── Deterministic farthest-first initialisation ──
  const centreIndices: number[] = [];
  let best0 = 0;
  let best0Norm = squaredNorm(vecAt(0));
  for (let i = 1; i < n; i++) {
    const norm = squaredNorm(vecAt(i));
    if (norm > best0Norm) {
      best0Norm = norm;
      best0 = i;
    }
  }
  centreIndices.push(best0);
  while (centreIndices.length < effectiveK) {
    let bestIdx = -1;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (centreIndices.includes(i)) continue;
      let nearest = Number.POSITIVE_INFINITY;
      for (const c of centreIndices) {
        const d = squaredDistance(vecAt(i), vecAt(c));
        if (d < nearest) nearest = d;
      }
      // strict > keeps the least index on ties (we scan i ascending)
      if (nearest > bestDist) {
        bestDist = nearest;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break; // all points are already centres
    centreIndices.push(bestIdx);
  }

  let centres = centreIndices.map((i) => [...vecAt(i)]);
  let assignments = new Array<number>(n).fill(0);

  const MAX_ITERS = 50;
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    // Assign.
    const next = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      let bestG = 0;
      // biome-ignore lint/style/noNonNullAssertion: centres is non-empty here.
      let bestD = squaredDistance(vecAt(i), centres[0]!);
      for (let g = 1; g < centres.length; g++) {
        // biome-ignore lint/style/noNonNullAssertion: g < centres.length.
        const d = squaredDistance(vecAt(i), centres[g]!);
        if (d < bestD) {
          bestD = d;
          bestG = g; // strict < keeps the lowest cluster index on ties
        }
      }
      next[i] = bestG;
    }
    const stable = next.every((g, i) => g === assignments[i]);
    assignments = next;

    // Recompute centroids; an empty cluster keeps its previous centre.
    const sums = centres.map(() => new Array<number>(dim).fill(0));
    const counts = new Array<number>(centres.length).fill(0);
    for (let i = 0; i < n; i++) {
      // biome-ignore lint/style/noNonNullAssertion: assignments has length n.
      const g = assignments[i]!;
      // biome-ignore lint/style/noNonNullAssertion: g is a valid cluster index.
      counts[g]!++;
      const v = vecAt(i);
      // biome-ignore lint/style/noNonNullAssertion: g is a valid cluster index.
      const sg = sums[g]!;
      for (let j = 0; j < dim; j++) {
        // biome-ignore lint/style/noNonNullAssertion: j < dim === vector length.
        sg[j]! += v[j]!;
      }
    }
    centres = centres.map((prev, g) => {
      // biome-ignore lint/style/noNonNullAssertion: g indexes counts/sums.
      const cnt = counts[g]!;
      // biome-ignore lint/style/noNonNullAssertion: g indexes sums.
      return cnt === 0 ? prev : sums[g]!.map((s) => s / cnt);
    });

    if (stable && iter > 0) break;
  }

  const sizes = new Array<number>(centres.length).fill(0);
  for (const g of assignments) {
    // biome-ignore lint/style/noNonNullAssertion: g is a valid cluster index.
    sizes[g]!++;
  }
  return { k: effectiveK, assignments, sizes, centres };
}

/** Per-cluster vote distribution for one statement. */
export interface ClusterDistribution {
  readonly resonates: number;
  readonly conflicts: number;
  readonly unsure: number;
  /** Non-null votes in this cluster (resonates + conflicts + unsure). */
  readonly seen: number;
  /** Participants assigned to this cluster (whether or not they voted). */
  readonly size: number;
}

/** A statement's bridging score + the distribution the design requires shown. */
export interface StatementBridging {
  readonly statement: string;
  /** Product over qualifying clusters of Laplace-smoothed P(resonate|cluster). */
  readonly score: number;
  /** Distribution for EVERY cluster (0..k-1), for display. */
  readonly perCluster: ClusterDistribution[];
  /** Total non-null votes across all clusters. */
  readonly totalSeen: number;
}

/**
 * The bridging score of one statement (Pol.is group-informed-consensus style):
 * per cluster g, `P(resonate|g) = (resonates_g + 1) / (seen_g + 2)`
 * (Laplace-smoothed); the score is the PRODUCT over clusters whose SIZE ≥
 * `minClusterSize` (default 1). The product — not the mean — is what forces
 * positive reception in every cluster. With no qualifying cluster the score is 0.
 */
export function bridgingScore(
  matrix: Matrix,
  statementIndex: number,
  clustering: ClusterResult,
  options: { minClusterSize?: number } = {},
): StatementBridging {
  const minClusterSize = options.minClusterSize ?? 1;
  const kk = clustering.centres.length;
  const acc: {
    resonates: number;
    conflicts: number;
    unsure: number;
    seen: number;
    size: number;
  }[] = [];
  for (let g = 0; g < kk; g++) {
    acc.push({ resonates: 0, conflicts: 0, unsure: 0, seen: 0, size: clustering.sizes[g] ?? 0 });
  }

  for (let i = 0; i < matrix.participants.length; i++) {
    const g = clustering.assignments[i];
    if (g === undefined) continue;
    const row = matrix.rows[i];
    const v = row ? row[statementIndex] : null;
    if (v === null || v === undefined) continue;
    const d = acc[g];
    if (!d) continue;
    if (v === 1) d.resonates++;
    else if (v === -1) d.conflicts++;
    else d.unsure++;
    d.seen++;
  }

  let score = 1;
  let qualifying = 0;
  let totalSeen = 0;
  for (const d of acc) {
    totalSeen += d.seen;
    if (d.size >= minClusterSize) {
      qualifying++;
      score *= (d.resonates + 1) / (d.seen + 2);
    }
  }
  if (qualifying === 0) score = 0;

  return {
    statement: matrix.statements[statementIndex] ?? "",
    score,
    perCluster: acc,
    totalSeen,
  };
}

/** A ranked statement (bridging result + its 1-based rank). */
export interface RankedStatement extends StatementBridging {
  readonly rank: number;
}

/** The full ranking output — the ranked list plus the geometry that produced it. */
export interface RankingResult {
  readonly ranked: RankedStatement[];
  readonly matrix: Matrix;
  readonly clustering: ClusterResult;
}

/**
 * Rank statements by bridging (design/03). Composes {@link buildMatrix} →
 * {@link cluster} → {@link bridgingScore}. The statement universe is EXPLICIT
 * (the verified need ids). Fully deterministic ordering: score desc → total
 * seen desc → statement IRI ascending.
 */
export function rankNeeds(
  participants: readonly string[],
  statements: readonly string[],
  resonances: readonly Resonance[],
  options: { k?: number; minClusterSize?: number } = {},
): RankingResult {
  const matrix = buildMatrix(participants, statements, resonances);
  const clustering = cluster(matrix, options.k ?? 2);
  const scored = matrix.statements.map((_, j) =>
    bridgingScore(matrix, j, clustering, { minClusterSize: options.minClusterSize ?? 1 }),
  );
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.totalSeen !== a.totalSeen) return b.totalSeen - a.totalSeen;
    return a.statement < b.statement ? -1 : a.statement > b.statement ? 1 : 0;
  });
  const ranked: RankedStatement[] = scored.map((s, i) => ({ ...s, rank: i + 1 }));
  return { ranked, matrix, clustering };
}
