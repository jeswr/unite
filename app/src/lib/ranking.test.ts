// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The bridging-ranking characterization fixture (design/03 §0 + §3). The design
// gives no numeric worked example, so this constructs one and documents the
// arithmetic — it is the SEED of the design's conformance fixture set
// (design/05 §6): "second implementation" == "passes these". Assertions are on
// the EXACT cluster assignment, the EXACT hand-computed Laplace-smoothed scores,
// and the full deterministic ranking order.

import { describe, expect, it } from "vitest";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE } from "./fut.js";
import type { Resonance } from "./model.js";
import {
  bridgingScore,
  buildMatrix,
  type ClusterResult,
  cluster,
  type Matrix,
  rankNeeds,
  stanceToValue,
} from "./ranking.js";

const DELIB = "https://community.example/d";
type Cell = 1 | -1 | 0 | null;

// ── The fixture: 6 participants in two clean clusters, 5 statements ──
// Cluster A = {p1,p2,p3}, Cluster B = {p4,p5,p6}.
// Columns: consensus, polar, mixed, sparse, allconflict.
//
//        consensus  polar  mixed  sparse  allconflict
//  p1(A)   +1        +1     +1      +1        -1
//  p2(A)   +1        +1     +1     null       -1
//  p3(A)   +1        +1     +1     null       -1
//  p4(B)   +1        -1      0     null       -1
//  p5(B)   +1        -1      0     null       -1
//  p6(B)   +1        -1      0     null       -1
const P = (n: number) => `https://u.example/p${n}#me`;
const PARTICIPANTS = [P(1), P(2), P(3), P(4), P(5), P(6)];
const S = {
  consensus: "https://s.example/consensus",
  polar: "https://s.example/polar",
  mixed: "https://s.example/mixed",
  sparse: "https://s.example/sparse",
  allconflict: "https://s.example/allconflict",
};
const STMTS = Object.values(S);
const ROWS: Record<string, Record<string, Cell>> = {
  [P(1)]: { consensus: 1, polar: 1, mixed: 1, sparse: 1, allconflict: -1 },
  [P(2)]: { consensus: 1, polar: 1, mixed: 1, sparse: null, allconflict: -1 },
  [P(3)]: { consensus: 1, polar: 1, mixed: 1, sparse: null, allconflict: -1 },
  [P(4)]: { consensus: 1, polar: -1, mixed: 0, sparse: null, allconflict: -1 },
  [P(5)]: { consensus: 1, polar: -1, mixed: 0, sparse: null, allconflict: -1 },
  [P(6)]: { consensus: 1, polar: -1, mixed: 0, sparse: null, allconflict: -1 },
};

function stanceFor(v: Cell): string {
  return v === 1 ? STANCE_RESONATES : v === -1 ? STANCE_CONFLICTS : STANCE_UNSURE;
}

function fixtureResonances(): Resonance[] {
  const out: Resonance[] = [];
  for (const p of PARTICIPANTS) {
    const row = ROWS[p];
    if (!row) continue;
    for (const [name, iri] of Object.entries(S)) {
      const v = row[name];
      if (v === null || v === undefined) continue;
      out.push({
        id: `${p}/res/${name}`,
        onStatement: iri,
        stance: stanceFor(v) as Resonance["stance"],
        created: "2026-07-01T00:00:00.000Z",
        creator: p,
        inDeliberation: DELIB,
      });
    }
  }
  return out;
}

describe("stanceToValue", () => {
  it("maps the coded stances", () => {
    expect(stanceToValue(STANCE_RESONATES)).toBe(1);
    expect(stanceToValue(STANCE_CONFLICTS)).toBe(-1);
    expect(stanceToValue(STANCE_UNSURE)).toBe(0);
  });
});

describe("buildMatrix", () => {
  it("sorts axes and places every cell", () => {
    const m = buildMatrix(PARTICIPANTS, STMTS, fixtureResonances());
    expect(m.participants).toEqual([...PARTICIPANTS].sort());
    expect(m.statements).toEqual([S.allconflict, S.consensus, S.mixed, S.polar, S.sparse]);
    const jSparse = m.statements.indexOf(S.sparse);
    expect(m.rows[m.participants.indexOf(P(1))]?.[jSparse]).toBe(1);
    expect(m.rows[m.participants.indexOf(P(2))]?.[jSparse]).toBe(null);
  });

  it("INTEGRITY: ignores a resonance on a statement outside the universe", () => {
    const injected: Resonance = {
      id: "https://u.example/p1#me/res/fake",
      onStatement: "https://s.example/fake-not-a-need",
      stance: STANCE_RESONATES,
      created: "2026-07-01T00:00:00.000Z",
      creator: P(1),
      inDeliberation: DELIB,
    };
    const m = buildMatrix(PARTICIPANTS, [S.consensus], [...fixtureResonances(), injected]);
    expect(m.statements).toEqual([S.consensus]); // fake id never becomes a column
  });

  it("ignores resonances from non-listed participants", () => {
    const extra: Resonance = {
      id: "https://outsider.example/r",
      onStatement: S.consensus,
      stance: STANCE_RESONATES,
      created: "2026-07-01T00:00:00.000Z",
      creator: "https://outsider.example/#me",
      inDeliberation: DELIB,
    };
    const m = buildMatrix(PARTICIPANTS, STMTS, [...fixtureResonances(), extra]);
    expect(m.participants).not.toContain("https://outsider.example/#me");
  });
});

describe("cluster (deterministic k-means, farthest-first init)", () => {
  it("recovers the two hand-designed clusters", () => {
    const m = buildMatrix(PARTICIPANTS, STMTS, fixtureResonances());
    const c = cluster(m, 2);
    expect(c.k).toBe(2);
    const label = (p: string) => c.assignments[m.participants.indexOf(p)];
    expect(label(P(1))).toBe(label(P(2)));
    expect(label(P(2))).toBe(label(P(3)));
    expect(label(P(4))).toBe(label(P(5)));
    expect(label(P(5))).toBe(label(P(6)));
    expect(label(P(1))).not.toBe(label(P(4)));
    expect(c.sizes.slice().sort()).toEqual([3, 3]);
  });
});

describe("rankNeeds — the characterization fixture", () => {
  // Both clusters have size 3 (≥ minClusterSize 1), so both factor in.
  // P(resonate|g) = (resonates_g + 1) / (seen_g + 2)  [Laplace].
  //   consensus  : A 3/3 res → (3+1)/(3+2)=4/5=0.8 ; B same → 0.8² = 0.64
  //   sparse     : A 1/1 res → (1+1)/(1+2)=2/3     ; B 0 seen → (0+1)/(0+2)=0.5 → 1/3 ≈ 0.3333
  //   mixed      : A 3/3 res → 0.8 ; B 3 unsure → (0+1)/(3+2)=0.2 → 0.16
  //   polar      : A 3/3 res → 0.8 ; B 3 conflict → 0.2 → 0.16
  //   allconflict: A 0 res/3 seen → 0.2 ; B 0.2 → 0.04
  // Order: score desc, then totalSeen desc, then IRI asc. mixed<polar (m<p) on
  // the 0.16 tie (equal totalSeen 6) → mixed before polar.
  const result = rankNeeds(PARTICIPANTS, STMTS, fixtureResonances());
  const byId = new Map(result.ranked.map((r) => [r.statement, r]));

  it("produces the exact hand-computed scores", () => {
    expect(byId.get(S.consensus)?.score).toBeCloseTo(0.64, 10);
    expect(byId.get(S.sparse)?.score).toBeCloseTo(1 / 3, 10);
    expect(byId.get(S.mixed)?.score).toBeCloseTo(0.16, 10);
    expect(byId.get(S.polar)?.score).toBeCloseTo(0.16, 10);
    expect(byId.get(S.allconflict)?.score).toBeCloseTo(0.04, 10);
  });

  it("ranks cross-cluster consensus first and all-conflict last", () => {
    expect(result.ranked.map((r) => r.statement)).toEqual([
      S.consensus,
      S.sparse,
      S.mixed,
      S.polar,
      S.allconflict,
    ]);
    expect(result.ranked[0]?.rank).toBe(1);
    expect(result.ranked[4]?.rank).toBe(5);
  });

  it("always exposes the per-cluster distribution (never a bare rank)", () => {
    const consensus = byId.get(S.consensus);
    expect(consensus?.perCluster).toHaveLength(2);
    const totalRes = consensus?.perCluster.reduce((a, d) => a + d.resonates, 0);
    expect(totalRes).toBe(6);
    expect(consensus?.totalSeen).toBe(6);
    const polar = byId.get(S.polar);
    const resonatesByCluster = polar?.perCluster.map((d) => d.resonates).sort();
    expect(resonatesByCluster).toEqual([0, 3]);
  });
});

describe("determinism", () => {
  it("is invariant to input ordering (participants + resonances shuffled)", () => {
    const a = rankNeeds(PARTICIPANTS, STMTS, fixtureResonances());
    const shuffledParts = [...PARTICIPANTS].reverse();
    const shuffledStmts = [...STMTS].reverse();
    const shuffledRes = [...fixtureResonances()].reverse();
    const b = rankNeeds(shuffledParts, shuffledStmts, shuffledRes);
    expect(b.ranked.map((r) => r.statement)).toEqual(a.ranked.map((r) => r.statement));
    expect(b.ranked.map((r) => r.score)).toEqual(a.ranked.map((r) => r.score));
    expect(b.clustering.assignments).toEqual(a.clustering.assignments);
  });

  it("is stable across repeated runs", () => {
    const a = rankNeeds(PARTICIPANTS, STMTS, fixtureResonances());
    const b = rankNeeds(PARTICIPANTS, STMTS, fixtureResonances());
    expect(b).toEqual(a);
  });
});

describe("edge cases", () => {
  it("empty input → empty ranking, no crash", () => {
    const r = rankNeeds([], [], []);
    expect(r.ranked).toEqual([]);
    expect(r.clustering.k).toBe(0);
  });

  it("k greater than participant count is clamped", () => {
    const parts = [P(1), P(2)];
    const res: Resonance[] = [
      {
        id: "https://x/1",
        onStatement: S.consensus,
        stance: STANCE_RESONATES,
        created: "2026-07-01T00:00:00.000Z",
        creator: P(1),
        inDeliberation: DELIB,
      },
    ];
    const r = rankNeeds(parts, [S.consensus], res, { k: 5 });
    expect(r.clustering.k).toBe(2);
    expect(r.ranked).toHaveLength(1);
  });

  it("a need with no resonances still ranks (at the neutral prior)", () => {
    // statement universe includes an unvoted need → column of all-null.
    const r = rankNeeds(PARTICIPANTS, [...STMTS, "https://s.example/unvoted"], fixtureResonances());
    const unvoted = r.ranked.find((x) => x.statement === "https://s.example/unvoted");
    expect(unvoted).toBeDefined();
    expect(unvoted?.totalSeen).toBe(0);
  });

  it("k=1 yields a single-cluster (single-factor) score", () => {
    const m = buildMatrix(PARTICIPANTS, STMTS, fixtureResonances());
    const c = cluster(m, 1);
    expect(c.k).toBe(1);
    const jConsensus = m.statements.indexOf(S.consensus);
    // one cluster, 6/6 resonate → (6+1)/(6+2) = 7/8 = 0.875
    const b = bridgingScore(m, jConsensus, c);
    expect(b.score).toBeCloseTo(7 / 8, 10);
  });

  it("minClusterSize excludes an undersized cluster from the product", () => {
    // Hand-built: 1 statement, cluster 0 size 3 (all resonate), cluster 1 size 1.
    const matrix: Matrix = {
      participants: [P(1), P(2), P(3), P(4)],
      statements: [S.consensus],
      rows: [[1], [1], [1], [-1]],
    };
    const clustering: ClusterResult = {
      k: 2,
      assignments: [0, 0, 0, 1],
      sizes: [3, 1],
      centres: [[1], [-1]],
    };
    // minClusterSize 2 drops cluster 1 → score is cluster 0 only: (3+1)/(3+2)=0.8
    const excluded = bridgingScore(matrix, 0, clustering, { minClusterSize: 2 });
    expect(excluded.score).toBeCloseTo(0.8, 10);
    // minClusterSize 1 keeps both → 0.8 * (0+1)/(1+2) = 0.8 * 1/3
    const included = bridgingScore(matrix, 0, clustering, { minClusterSize: 1 });
    expect(included.score).toBeCloseTo(0.8 / 3, 10);
    expect(excluded.perCluster).toHaveLength(2);
  });
});
