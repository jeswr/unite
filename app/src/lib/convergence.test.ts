// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Convergence Room v1 (SCOPE-DIFFERENTIATION §2; design/03 §4): the endorsement
// outcome is COMPUTED live from resonances against the bridging threshold —
// positive reception in EVERY qualifying opinion cluster — never asserted.
// The opinion space clusters on NEED votes only; votes on the candidate itself
// are the endorsement round.

import { describe, expect, it } from "vitest";
import { candidateReception, orderCandidates, standingCritiques } from "./convergence.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import type { Resonance } from "./model.js";

const DELIB = "https://community.example/d1";
const CAND = "https://drafter.example/u/syntheses/s1.ttl";
const NEED_A = "https://a.example/needs/a.ttl";
const NEED_B = "https://b.example/needs/b.ttl";

// Two clean opinion clusters: X = {p1,p2} (pro-A, anti-B); Y = {p3,p4} (anti-A, pro-B).
const P = [1, 2, 3, 4].map((n) => `https://p${n}.example/profile#me`);
const [P1, P2, P3, P4] = P as [string, string, string, string];

let seq = 0;
function vote(creator: string, on: string, stance: string): Resonance {
  seq += 1;
  return {
    id: `${creator}-r${seq}`,
    onStatement: on,
    stance,
    created: "2026-07-01T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

/** The need votes that shape the two clusters. */
const clusterVotes: Resonance[] = [
  vote(P1, NEED_A, STANCE_RESONATES),
  vote(P2, NEED_A, STANCE_RESONATES),
  vote(P3, NEED_A, STANCE_CONFLICTS),
  vote(P4, NEED_A, STANCE_CONFLICTS),
  vote(P1, NEED_B, STANCE_CONFLICTS),
  vote(P2, NEED_B, STANCE_CONFLICTS),
  vote(P3, NEED_B, STANCE_RESONATES),
  vote(P4, NEED_B, STANCE_RESONATES),
];

describe("candidateReception", () => {
  it("ENDORSED when every opinion cluster leans positive (cross-polarity approval)", () => {
    const votes = [
      ...clusterVotes,
      vote(P1, CAND, STANCE_RESONATES),
      vote(P2, CAND, STANCE_RESONATES),
      vote(P3, CAND, STANCE_RESONATES),
      vote(P4, CAND, STANCE_RESONATES),
    ];
    const r = candidateReception(P, [NEED_A, NEED_B], votes, CAND);
    expect(r.outcome).toBe("endorsed");
    expect(r.clusterCount).toBe(2);
    expect(r.totalSeen).toBe(4);
    expect(r.score).toBeGreaterThan(0);
  });

  it("DISAGREEMENT when one cluster leans positive and another negative — the honest map", () => {
    const votes = [
      ...clusterVotes,
      vote(P1, CAND, STANCE_RESONATES),
      vote(P2, CAND, STANCE_RESONATES),
      vote(P3, CAND, STANCE_CONFLICTS),
      vote(P4, CAND, STANCE_CONFLICTS),
    ];
    const r = candidateReception(P, [NEED_A, NEED_B], votes, CAND);
    expect(r.outcome).toBe("disagreement");
  });

  it("OPEN on thin data (one cluster seen) — a majority in one camp is NOT endorsement", () => {
    const votes = [...clusterVotes, vote(P1, CAND, STANCE_RESONATES)];
    const r = candidateReception(P, [NEED_A, NEED_B], votes, CAND);
    expect(r.outcome).toBe("open");
  });

  it("OPEN with no votes at all (a fresh candidate)", () => {
    const r = candidateReception(P, [NEED_A, NEED_B], clusterVotes, CAND);
    expect(r.outcome).toBe("open");
    expect(r.totalSeen).toBe(0);
  });

  it("votes on the CANDIDATE do not shape the opinion clusters (needs-only universe)", () => {
    // P3/P4 vote on the candidate exactly like P1/P2 — if the candidate leaked
    // into the clustering universe this could merge the clusters. It must not.
    const votes = [
      ...clusterVotes,
      vote(P1, CAND, STANCE_RESONATES),
      vote(P2, CAND, STANCE_RESONATES),
      vote(P3, CAND, STANCE_RESONATES),
      vote(P4, CAND, STANCE_RESONATES),
    ];
    const r = candidateReception(P, [NEED_A, NEED_B], votes, CAND);
    expect(r.clusterCount).toBe(2);
    // Each cluster's distribution saw exactly its two members' endorsement votes.
    expect(r.perCluster.map((d) => d.seen).sort()).toEqual([2, 2]);
  });

  it("is deterministic regardless of participant input order", () => {
    const votes = [
      ...clusterVotes,
      vote(P4, CAND, STANCE_CONFLICTS),
      vote(P3, CAND, STANCE_CONFLICTS),
      vote(P2, CAND, STANCE_RESONATES),
      vote(P1, CAND, STANCE_RESONATES),
    ];
    const a = candidateReception(P, [NEED_A, NEED_B], votes, CAND);
    const b = candidateReception([...P].reverse(), [NEED_B, NEED_A], [...votes].reverse(), CAND);
    expect(b.outcome).toBe(a.outcome);
    expect(b.score).toBe(a.score);
    expect(b.totalSeen).toBe(a.totalSeen);
  });

  it("handles an empty deliberation (no participants) without throwing", () => {
    const r = candidateReception([], [], [], CAND);
    expect(r.outcome).toBe("open");
    expect(r.clusterCount).toBe(0);
    expect(r.score).toBe(0);
  });
});

describe("standingCritiques / orderCandidates", () => {
  const c = (id: string, on: string, created: string) => ({ id, onStatement: on, created });

  it("filters to the candidate and orders newest first", () => {
    const critiques = [
      c("c-old", CAND, "2026-07-01T00:00:00Z"),
      c("c-new", CAND, "2026-07-03T00:00:00Z"),
      c("c-other", "https://x.example/other", "2026-07-04T00:00:00Z"),
      c("c-mid", CAND, "2026-07-02T00:00:00Z"),
    ];
    expect(standingCritiques(critiques, CAND).map((x) => x.id)).toEqual([
      "c-new",
      "c-mid",
      "c-old",
    ]);
  });

  it("a malformed date sorts oldest; equal dates tie-break on id (deterministic)", () => {
    const critiques = [
      c("b", CAND, "2026-07-01T00:00:00Z"),
      c("a", CAND, "2026-07-01T00:00:00Z"),
      c("z-broken", CAND, "not-a-date"),
    ];
    expect(standingCritiques(critiques, CAND).map((x) => x.id)).toEqual(["a", "b", "z-broken"]);
  });

  it("orderCandidates: newest first (the active round on top)", () => {
    const cands = [
      { id: "s0", created: "2026-07-01T00:00:00Z" },
      { id: "s1", created: "2026-07-02T00:00:00Z" },
    ];
    expect(orderCandidates(cands).map((x) => x.id)).toEqual(["s1", "s0"]);
  });
});
