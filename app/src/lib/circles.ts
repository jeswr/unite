// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Circle composition (design/v2/04-circles.md §2; build plan design/v2/07 §3
// V3 + §5 fixtures): the deterministic diverse-but-bridgeable partition of a
// community into 4–6-person circles, composed over the UNCHANGED engine —
// `cluster()` gives the opinion geometry, `needProfile()` the bridgeable
// (shared Max-Neef need-concept) overlap. No ML, no randomness, no clock:
// same inputs, same circles.
//
// Guarantees (04 §2), arithmetically consistent by construction:
//   • circles are size 4–6 (the floor is the pairs rule × two clusters);
//   • a DIVERSE circle spans ≥2 opinion clusters AND seats ≥2 members of
//     every represented cluster (the pairs rule — never a lone token
//     minority), with a NON-EMPTY shared need-concept overlap (bridgeable);
//   • clusters too small to pair community-wide (size < 2, or under the
//     `minClusterSize` floor) are FOLDED into their nearest surviving
//     cluster centre — nobody is ever seated as "the different one";
//   • greedy diverse-first, and when a full diverse partition is impossible
//     (the minority cluster exhausts) the leftovers form honest homogeneous
//     OVERFLOW circles — seeded at target size 4, capacity 6, the open
//     seats held for later-arriving diverse voices — and any tail below 4
//     joins the nearest existing circle with an open seat or waits on the
//     community WAITLIST (never a circle of 1–3);
//   • a community below 4 people gets ONE starter circle that claims
//     nothing; a community with people but NO opinion signal composes on
//     need-profile overlap alone (kind "cold-start") and likewise claims no
//     diversity — the vacuous-diversity guard: a circle's machine-readable
//     reason never claims a property the composer couldn't enforce.
//
// Every circle carries a machine-readable `reason` for the "why this
// circle?" seam (design/v2/03 §6) — diverse vs overflow vs cold-start vs
// starter, honestly labeled. Relational continuity (04 §2) is honoured by
// the CALLER: composition runs at circle creation and seat-filling only —
// this module never reshuffles standing circles.

import { needProfile } from "./gallery.js";
import type { Need, Resonance } from "./model.js";
import { buildMatrix, type ClusterResult, cluster } from "./ranking.js";

/** The diversity floor: the pairs rule (≥2 per cluster) × two clusters. */
export const CIRCLE_MIN_SIZE = 4;
/** New circles are seeded at this size, leaving open seats up to capacity. */
export const CIRCLE_TARGET_SIZE = 4;
/** The hard ceiling — beyond ~6 an async circle fragments (04 §1). */
export const CIRCLE_CAPACITY = 6;

/** The honest composition labels (04 §2). Only "diverse" claims diversity. */
export type CircleKind = "diverse" | "overflow" | "cold-start" | "starter";

/** The machine-readable "why this circle?" record the seam renders (03 §6). */
export type CircleReason =
  | {
      /** A cross-cluster, bridgeable circle — the composer's first choice. */
      readonly kind: "diverse";
      /** The effective opinion-cluster indices the circle spans (≥2). */
      readonly clustersSpanned: readonly number[];
      /** The non-empty need-concept overlap the members share. */
      readonly sharedNeedConcepts: readonly string[];
    }
  | {
      /** Honest fallback: like-minded leftovers after diverse pairing exhausted. */
      readonly kind: "overflow";
      /** The single effective cluster the circle draws from. */
      readonly cluster: number;
      /** Seats held open for later-arriving diverse voices (capacity − size). */
      readonly openSeats: number;
    }
  | {
      /** No opinion signal yet — composed on need-profile overlap alone. */
      readonly kind: "cold-start";
      /** The (possibly empty) need-concept overlap — never a diversity claim. */
      readonly sharedNeedConcepts: readonly string[];
    }
  | {
      /** "This circle is everyone so far" — a community below the floor. */
      readonly kind: "starter";
      readonly communitySize: number;
    };

/** One composed circle. */
export interface ComposedCircle {
  /** Position in the composition (stable, deterministic). */
  readonly index: number;
  readonly kind: CircleKind;
  /** Member WebIDs, sorted lexicographically. */
  readonly members: readonly string[];
  /** The effective cluster indices represented (empty when no clustering ran). */
  readonly clusters: readonly number[];
  /** The intersection of the members' need-concept profiles, sorted. */
  readonly sharedNeedConcepts: readonly string[];
  /** Capacity − size: seats a newcomer join may fill (the one recomposition). */
  readonly openSeats: number;
  readonly reason: CircleReason;
}

/** A cluster folded into a surviving neighbour (too small to pair). */
export interface FoldedCluster {
  readonly from: number;
  readonly into: number;
}

/** The total composition result — valid for ANY community shape. */
export interface CircleComposition {
  readonly circles: readonly ComposedCircle[];
  /** People not seatable under the guarantees (sorted) — never seated as 1–3. */
  readonly waitlist: readonly string[];
  /** True when at least one resonance landed in the matrix (votes exist). */
  readonly hasOpinionSignal: boolean;
  /** Participant → effective (post-fold) cluster index; empty off the votes path. */
  readonly effectiveClusters: ReadonlyMap<string, number>;
  /** The folds applied (deterministic, for the seam's honesty). */
  readonly foldedClusters: readonly FoldedCluster[];
}

/** Inputs: the same typed engine inputs `rankNeeds`/`routeGallery` take. */
export interface ComposeCirclesOptions {
  /** The VERIFIED participant WebIDs (the aggregate's set). */
  readonly participants: readonly string[];
  /** The aggregated needs (statement universe + need profiles). */
  readonly needs: readonly Need[];
  /** ALL deduped resonances (aggregate.dedupeResonances output). */
  readonly resonances: readonly Resonance[];
  /** Requested opinion clusters (engine default 2). */
  readonly k?: number;
  /** Fold clusters below this size (min 2 — the pairs rule's floor). */
  readonly minClusterSize?: number;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

interface MutableCircle {
  kind: CircleKind;
  members: string[];
  clusters: ReadonlySet<number>;
  shared: ReadonlySet<string>;
}

function intersect(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

/** The intersection of every member's need profile (empty members → empty). */
function sharedOf(
  members: readonly string[],
  profiles: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlySet<string> {
  let out: Set<string> | null = null;
  for (const m of members) {
    const p = profiles.get(m) ?? EMPTY_SET;
    out = out === null ? new Set(p) : intersect(out, p);
  }
  return out ?? new Set();
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  const len = Math.max(a.length, b.length);
  let sum = 0;
  for (let j = 0; j < len; j++) {
    const d = (a[j] ?? 0) - (b[j] ?? 0);
    sum += d * d;
  }
  return sum;
}

/**
 * Fold clusters below `foldBelow` into their nearest SURVIVING cluster centre
 * (04 §2: a cluster too small to pair community-wide never seats a lone
 * token). Deterministic: nearest centre by squared distance, ties → lowest
 * surviving index; when EVERY cluster is below the floor, the largest (ties →
 * lowest index) survives and absorbs the rest.
 */
function foldClusters(
  clustering: ClusterResult,
  foldBelow: number,
): { readonly effective: readonly number[]; readonly folded: readonly FoldedCluster[] } {
  const kk = clustering.centres.length;
  const surviving: number[] = [];
  for (let g = 0; g < kk; g++) {
    if ((clustering.sizes[g] ?? 0) >= foldBelow) surviving.push(g);
  }
  if (surviving.length === 0) {
    let best = 0;
    let bestSize = -1;
    for (let g = 0; g < kk; g++) {
      const s = clustering.sizes[g] ?? 0;
      if (s > bestSize) {
        bestSize = s;
        best = g;
      }
    }
    surviving.push(best);
  }
  const survivingSet = new Set(surviving);
  const target = new Map<number, number>();
  const folded: FoldedCluster[] = [];
  for (let g = 0; g < kk; g++) {
    if (survivingSet.has(g)) {
      target.set(g, g);
      continue;
    }
    if ((clustering.sizes[g] ?? 0) === 0) continue; // empty cluster — nothing to fold
    const centre = clustering.centres[g] ?? [];
    let into = surviving[0] ?? 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (const s of surviving) {
      const d = squaredDistance(centre, clustering.centres[s] ?? []);
      if (d < bestD) {
        // strict < keeps the lowest surviving index on ties (ascending scan)
        bestD = d;
        into = s;
      }
    }
    target.set(g, into);
    folded.push({ from: g, into });
  }
  const effective = clustering.assignments.map((g) => target.get(g) ?? g);
  return { effective, folded };
}

/**
 * Take a greedy chunk of `size` from the (sorted, mutated) pool: seed with
 * the lexicographically-least member, then repeatedly add the member with the
 * largest overlap against the chunk's running shared-concept intersection
 * (ties → least id). A deterministic greedy approximation of "maximize
 * min-shared-need-concepts within circles" (04 §2).
 */
function takeGreedyChunk(
  pool: string[],
  profiles: ReadonlyMap<string, ReadonlySet<string>>,
  size: number,
): string[] {
  const seed = pool.shift();
  if (seed === undefined) return [];
  const chunk = [seed];
  let shared: ReadonlySet<string> = profiles.get(seed) ?? EMPTY_SET;
  while (chunk.length < size && pool.length > 0) {
    let bestI = 0;
    let bestOverlap = -1;
    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      if (cand === undefined) continue;
      const o = intersect(shared, profiles.get(cand) ?? EMPTY_SET).size;
      if (o > bestOverlap) {
        // strict > keeps the least id on ties (pool is sorted, scanned ascending)
        bestOverlap = o;
        bestI = i;
      }
    }
    const picked = pool.splice(bestI, 1)[0];
    if (picked === undefined) break;
    chunk.push(picked);
    shared = intersect(shared, profiles.get(picked) ?? EMPTY_SET);
  }
  return chunk.sort();
}

/** The best bridgeable 2+2 foursome pairing the minority cluster, or null. */
function bestFoursome(
  minorityPool: readonly string[],
  partners: readonly number[],
  pools: ReadonlyMap<number, readonly string[]>,
  profiles: ReadonlyMap<string, ReadonlySet<string>>,
): {
  readonly partner: number;
  readonly members: string[];
  readonly shared: ReadonlySet<string>;
} | null {
  let best: {
    partner: number;
    members: string[];
    shared: ReadonlySet<string>;
    key: string;
  } | null = null;
  for (const partner of partners) {
    const partnerPool = pools.get(partner) ?? [];
    for (let i = 0; i < minorityPool.length; i++) {
      for (let j = i + 1; j < minorityPool.length; j++) {
        const a1 = minorityPool[i];
        const a2 = minorityPool[j];
        if (a1 === undefined || a2 === undefined) continue;
        const sa = intersect(profiles.get(a1) ?? EMPTY_SET, profiles.get(a2) ?? EMPTY_SET);
        if (sa.size === 0) continue; // the intersection can only shrink from here
        for (let p = 0; p < partnerPool.length; p++) {
          for (let q = p + 1; q < partnerPool.length; q++) {
            const b1 = partnerPool[p];
            const b2 = partnerPool[q];
            if (b1 === undefined || b2 === undefined) continue;
            const sb = intersect(sa, profiles.get(b1) ?? EMPTY_SET);
            if (sb.size === 0) continue;
            const shared = intersect(sb, profiles.get(b2) ?? EMPTY_SET);
            if (shared.size === 0) continue; // not bridgeable — invalid diverse circle
            const members = [a1, a2, b1, b2].sort();
            const key = members.join(" ");
            if (
              best === null ||
              shared.size > best.shared.size ||
              (shared.size === best.shared.size && key < best.key)
            ) {
              best = { partner, members, shared, key };
            }
          }
        }
      }
    }
  }
  return best;
}

/** Seat leftover tail members (below the floor) into existing circles with an
 * open seat, or waitlist them — the mechanical step (4) of 04 §2. */
function seatTail(
  tail: readonly string[],
  circles: MutableCircle[],
  profiles: ReadonlyMap<string, ReadonlySet<string>>,
  clusterOf: (webId: string) => number | null,
): string[] {
  const waitlist: string[] = [];
  for (const m of tail) {
    const g = clusterOf(m);
    const pm = profiles.get(m) ?? EMPTY_SET;
    let bestIdx = -1;
    let bestOverlap = -1;
    for (let idx = 0; idx < circles.length; idx++) {
      const c = circles[idx];
      if (c === undefined) continue;
      if (c.members.length >= CIRCLE_CAPACITY) continue;
      // The pairs rule: only join a circle where your cluster is already
      // represented (≥2 by construction) — never seated as the lone token.
      // Cold-start circles carry no clusters, so the guard is vacuous there.
      if (c.clusters.size > 0 && (g === null || !c.clusters.has(g))) continue;
      const overlap = intersect(c.shared, pm);
      // A diverse circle must STAY bridgeable (non-empty shared concepts).
      if (c.kind === "diverse" && overlap.size === 0) continue;
      if (overlap.size > bestOverlap) {
        // strict > keeps the lowest circle index on ties (ascending scan)
        bestOverlap = overlap.size;
        bestIdx = idx;
      }
    }
    const c = bestIdx >= 0 ? circles[bestIdx] : undefined;
    if (c === undefined) {
      waitlist.push(m);
      continue;
    }
    c.members.push(m);
    c.members.sort();
    c.shared = intersect(c.shared, pm);
  }
  return waitlist.sort();
}

function finalize(
  circles: readonly MutableCircle[],
  waitlist: readonly string[],
  hasOpinionSignal: boolean,
  effectiveClusters: ReadonlyMap<string, number>,
  foldedClusters: readonly FoldedCluster[],
): CircleComposition {
  const out: ComposedCircle[] = [];
  for (let index = 0; index < circles.length; index++) {
    const c = circles[index];
    if (c === undefined) continue;
    const members = [...c.members].sort();
    const clusters = [...c.clusters].sort((a, b) => a - b);
    const sharedNeedConcepts = [...c.shared].sort();
    const openSeats = Math.max(0, CIRCLE_CAPACITY - members.length);
    let reason: CircleReason;
    switch (c.kind) {
      case "diverse":
        reason = { kind: "diverse", clustersSpanned: clusters, sharedNeedConcepts };
        break;
      case "overflow":
        reason = { kind: "overflow", cluster: clusters[0] ?? 0, openSeats };
        break;
      case "cold-start":
        reason = { kind: "cold-start", sharedNeedConcepts };
        break;
      case "starter":
        reason = { kind: "starter", communitySize: members.length };
        break;
    }
    out.push({ index, kind: c.kind, members, clusters, sharedNeedConcepts, openSeats, reason });
  }
  return { circles: out, waitlist, hasOpinionSignal, effectiveClusters, foldedClusters };
}

/**
 * Compose a community into circles (design/v2/04 §2). TOTAL — returns a valid,
 * honestly-labeled composition for any community shape — and deterministic:
 * invariant to the ordering of `participants`, `needs`, and (deduped)
 * `resonances`.
 */
export function composeCircles(options: ComposeCirclesOptions): CircleComposition {
  const participants = [...new Set(options.participants)].sort();
  const n = participants.length;
  if (n === 0) {
    return {
      circles: [],
      waitlist: [],
      hasOpinionSignal: false,
      effectiveClusters: new Map(),
      foldedClusters: [],
    };
  }

  const profiles = new Map<string, ReadonlySet<string>>();
  for (const p of participants) {
    profiles.set(p, needProfile(p, options.needs, options.resonances));
  }

  const statements = options.needs.map((nd) => nd.id);
  const matrix = buildMatrix(participants, statements, options.resonances);
  const hasOpinionSignal = matrix.rows.some((row) => row.some((v) => v !== null));

  // ── Starter: below the floor, one circle of everyone, claiming nothing ──
  if (n < CIRCLE_MIN_SIZE) {
    const starter: MutableCircle = {
      kind: "starter",
      members: [...participants],
      clusters: new Set(),
      shared: sharedOf(participants, profiles),
    };
    return finalize([starter], [], hasOpinionSignal, new Map(), []);
  }

  // ── Cold start: no votes yet — compose on need-profile overlap alone ──
  if (!hasOpinionSignal) {
    const pool = [...participants];
    const circles: MutableCircle[] = [];
    while (pool.length >= CIRCLE_TARGET_SIZE) {
      const members = takeGreedyChunk(pool, profiles, CIRCLE_TARGET_SIZE);
      circles.push({
        kind: "cold-start",
        members,
        clusters: new Set(),
        shared: sharedOf(members, profiles),
      });
    }
    const waitlist = seatTail([...pool].sort(), circles, profiles, () => null);
    return finalize(circles, waitlist, false, new Map(), []);
  }

  // ── The votes path: cluster, fold, then greedy diverse-first ──
  const clustering = cluster(matrix, options.k ?? 2);
  const foldBelow = Math.max(2, options.minClusterSize ?? 2);
  const { effective, folded } = foldClusters(clustering, foldBelow);

  const effectiveClusters = new Map<string, number>();
  for (let i = 0; i < matrix.participants.length; i++) {
    const p = matrix.participants[i];
    const g = effective[i];
    if (p !== undefined && g !== undefined) effectiveClusters.set(p, g);
  }

  // Per-cluster pools (participants are sorted, so pools are sorted).
  const pools = new Map<number, string[]>();
  for (const p of participants) {
    const g = effectiveClusters.get(p) ?? 0;
    const pool = pools.get(g);
    if (pool === undefined) pools.set(g, [p]);
    else pool.push(p);
  }

  const circles: MutableCircle[] = [];

  // (1)+(2) Greedy diverse-first: pair the smallest pairable cluster (ties →
  // lowest index) 2+2 with the partner maximizing the bridgeable overlap.
  const unpairable = new Set<number>();
  for (;;) {
    const pairable = [...pools.keys()]
      .filter((g) => (pools.get(g)?.length ?? 0) >= 2 && !unpairable.has(g))
      .sort((a, b) => a - b);
    if (pairable.length < 2) break;
    let minority = pairable[0] ?? 0;
    let minoritySize = pools.get(minority)?.length ?? 0;
    for (const g of pairable) {
      const size = pools.get(g)?.length ?? 0;
      if (size < minoritySize) {
        minority = g;
        minoritySize = size;
      }
    }
    const partners = pairable.filter((g) => g !== minority);
    const best = bestFoursome(pools.get(minority) ?? [], partners, pools, profiles);
    if (best === null) {
      // No bridgeable pairing exists for this cluster now — and pools only
      // shrink, so none will: its members flow to the overflow/tail path.
      unpairable.add(minority);
      continue;
    }
    const taken = new Set(best.members);
    for (const g of [minority, best.partner]) {
      pools.set(
        g,
        (pools.get(g) ?? []).filter((m) => !taken.has(m)),
      );
    }
    circles.push({
      kind: "diverse",
      members: best.members,
      clusters: new Set([minority, best.partner]),
      shared: best.shared,
    });
  }

  // (3) Honest homogeneous overflow circles from the leftovers, per cluster.
  for (const g of [...pools.keys()].sort((a, b) => a - b)) {
    const pool = pools.get(g) ?? [];
    while (pool.length >= CIRCLE_TARGET_SIZE) {
      const members = takeGreedyChunk(pool, profiles, CIRCLE_TARGET_SIZE);
      circles.push({
        kind: "overflow",
        members,
        clusters: new Set([g]),
        shared: sharedOf(members, profiles),
      });
    }
  }

  // (4) Tails below the floor join an open seat or wait on the waitlist.
  const tail = [...pools.values()].flat().sort();
  const waitlist = seatTail(
    tail,
    circles,
    profiles,
    (webId) => effectiveClusters.get(webId) ?? null,
  );

  return finalize(circles, waitlist, true, effectiveClusters, folded);
}
