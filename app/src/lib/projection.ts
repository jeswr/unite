// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The 2-D opinion-space projection behind the Common-ground map (design/03 §2:
// the Pol.is-style opinion map — participants positioned by HOW THEY VOTED, so
// the cluster structure the ranking uses becomes visible and legible).
//
// Deterministic PCA via power iteration (no novel ML, no randomness):
//   • participant vectors = matrix rows (unseen → 0), mean-centred;
//   • PC1/PC2 by power iteration with a FIXED starting vector (1/(j+1) —
//     strictly non-zero, deterministic) and Hotelling deflation;
//   • output normalised to [-1, 1] per axis; coincident points are spread on a
//     tiny deterministic ring so no participant is hidden under another.
// Everything is a pure function of the matrix — same votes, same map.

import type { ClusterResult, Matrix } from "./ranking.js";

/** A projected participant. */
export interface OpinionPoint {
  readonly participant: string;
  /** Position in [-1, 1] (post-normalisation, pre-spread may exceed slightly). */
  readonly x: number;
  readonly y: number;
  /** The cluster index from the shared clustering (colour key). */
  readonly cluster: number;
}

const POWER_ITERATIONS = 80;

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

function norm(a: readonly number[]): number {
  return Math.sqrt(dot(a, a));
}

/**
 * The dominant principal direction of the (already centred) row vectors,
 * with any previously found components deflated out. Returns null when the
 * data has no variance in the remaining subspace.
 */
function principalDirection(
  rows: readonly number[][],
  deflate: readonly number[][],
): number[] | null {
  const dim = rows[0]?.length ?? 0;
  if (dim === 0) return null;
  // Fixed, deterministic, non-zero start vector.
  let v = Array.from({ length: dim }, (_, j) => 1 / (j + 1));
  // Project out already-found components from the start vector too.
  for (const d of deflate) {
    const c = dot(v, d);
    v = v.map((x, j) => x - c * (d[j] ?? 0));
  }
  for (let iter = 0; iter < POWER_ITERATIONS; iter++) {
    // w = Σ_i (u_i · v) u_i  — apply the covariance without forming it.
    const w = new Array<number>(dim).fill(0);
    for (const u of rows) {
      const c = dot(u, v);
      if (c === 0) continue;
      for (let j = 0; j < dim; j++) w[j] = (w[j] ?? 0) + c * (u[j] ?? 0);
    }
    // Deflate previous components (keep the iteration in the orthogonal subspace).
    for (const d of deflate) {
      const c = dot(w, d);
      for (let j = 0; j < dim; j++) w[j] = (w[j] ?? 0) - c * (d[j] ?? 0);
    }
    const n = norm(w);
    if (n < 1e-12) return null; // no variance left
    v = w.map((x) => x / n);
  }
  return v;
}

/** Normalise one axis of values into [-1, 1] (max-abs scaling; 0-safe). */
function normalise(values: readonly number[]): number[] {
  let maxAbs = 0;
  for (const v of values) maxAbs = Math.max(maxAbs, Math.abs(v));
  if (maxAbs < 1e-12) return values.map(() => 0);
  return values.map((v) => v / maxAbs);
}

/** Spread exactly-coincident points on a tiny deterministic ring (visibility). */
function spreadCoincident(points: OpinionPoint[]): OpinionPoint[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.x.toFixed(3)}|${p.y.toFixed(3)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0) return p;
    const angle = (n * 2 * Math.PI) / 6;
    const r = 0.06 * Math.ceil(n / 6);
    return { ...p, x: p.x + r * Math.cos(angle), y: p.y + r * Math.sin(angle) };
  });
}

/**
 * Project every participant of `matrix` into 2-D opinion space, tagged with
 * their cluster from `clustering` (the SAME clustering the ranking used, so the
 * map explains the ranking). Deterministic; [] for an empty matrix.
 */
export function projectParticipants(matrix: Matrix, clustering: ClusterResult): OpinionPoint[] {
  const n = matrix.participants.length;
  if (n === 0) return [];
  const dim = matrix.statements.length;
  const raw = matrix.rows.map((row) => row.map((v) => v ?? 0));

  // Mean-centre.
  const mean = new Array<number>(dim).fill(0);
  for (const r of raw) for (let j = 0; j < dim; j++) mean[j] = (mean[j] ?? 0) + (r[j] ?? 0) / n;
  const centred = raw.map((r) => r.map((v, j) => v - (mean[j] ?? 0)));

  const pc1 = principalDirection(centred, []);
  const pc2 = pc1 ? principalDirection(centred, [pc1]) : null;

  const xs = normalise(centred.map((u) => (pc1 ? dot(u, pc1) : 0)));
  const ys = normalise(centred.map((u) => (pc2 ? dot(u, pc2) : 0)));

  const points = matrix.participants.map((participant, i) => ({
    participant,
    x: xs[i] ?? 0,
    y: ys[i] ?? 0,
    cluster: clustering.assignments[i] ?? 0,
  }));
  return spreadCoincident(points);
}
