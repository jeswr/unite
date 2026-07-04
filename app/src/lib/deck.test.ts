// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Deck routing (SCOPE-DIFFERENTIATION §4.4): deterministic, engagement-blind,
// cross-cluster. Characterize: already-reacted cards are excluded; cards the
// viewer's cluster hasn't assessed that the OTHER cluster resonated with come
// first; total order regardless of input ordering; sane cold-start fallback
// for an unclustered viewer.

import { describe, expect, it } from "vitest";
import { routeDeck } from "./deck.js";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE, type Stance } from "./fut.js";
import type { Resonance } from "./model.js";

const DELIB = "https://community.example/deliberations/society";
const P = [
  "https://p1.example/#me",
  "https://p2.example/#me",
  "https://p3.example/#me",
  "https://p4.example/#me",
];
const N = ["https://n.example/n1.ttl", "https://n.example/n2.ttl"];
const C = [
  "https://c.example/cA.ttl",
  "https://c.example/cB.ttl",
  "https://c.example/cC.ttl",
  "https://c.example/cD.ttl",
];

let seq = 0;
function vote(creator: string, onStatement: string, stance: Stance): Resonance {
  seq++;
  return {
    id: `https://r.example/r${seq}.ttl`,
    onStatement,
    stance,
    created: "2026-07-01T12:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

// Two clean opinion clusters over the NEEDS: {p1,p2} vs {p3,p4}.
const clusterVotes: Resonance[] = [
  vote(P[0] as string, N[0] as string, STANCE_RESONATES),
  vote(P[1] as string, N[0] as string, STANCE_RESONATES),
  vote(P[2] as string, N[0] as string, STANCE_CONFLICTS),
  vote(P[3] as string, N[0] as string, STANCE_CONFLICTS),
  vote(P[0] as string, N[1] as string, STANCE_CONFLICTS),
  vote(P[1] as string, N[1] as string, STANCE_CONFLICTS),
  vote(P[2] as string, N[1] as string, STANCE_RESONATES),
  vote(P[3] as string, N[1] as string, STANCE_RESONATES),
];

// Claims: cA — the viewer (p1) already reacted; cB — own cluster silent, the
// other cluster RESONATED; cC — own cluster already assessed it; cD — cold.
const claimVotes: Resonance[] = [
  vote(P[0] as string, C[0] as string, STANCE_UNSURE),
  vote(P[2] as string, C[1] as string, STANCE_RESONATES),
  vote(P[3] as string, C[1] as string, STANCE_RESONATES),
  vote(P[1] as string, C[2] as string, STANCE_RESONATES),
  vote(P[2] as string, C[2] as string, STANCE_RESONATES),
];

const options = {
  viewer: P[0] as string,
  participants: P,
  needStatements: N,
  deckStatements: C,
  resonances: [...clusterVotes, ...claimVotes],
};

describe("routeDeck", () => {
  it("excludes cards the viewer already reacted to", () => {
    const queue = routeDeck(options).map((e) => e.statement);
    expect(queue).not.toContain(C[0]);
  });

  it("deals own-cluster-unassessed + neighbour-resonated first, cold cards before own-assessed", () => {
    const queue = routeDeck(options).map((e) => e.statement);
    // cB: ownSeen 0, neighbours resonated → first.
    // cD: ownSeen 0, cold → second (same ownSeen, lower neighbour signal).
    // cC: own cluster already assessed (p2 voted) → last.
    expect(queue).toEqual([C[1], C[3], C[2]]);
  });

  it("reports the routing evidence on each entry", () => {
    const [top] = routeDeck(options);
    expect(top?.statement).toBe(C[1]);
    expect(top?.ownClusterSeen).toBe(0);
    expect(top?.neighbourResonance).toBeGreaterThan(0.5);
  });

  it("is invariant to input ordering (fully deterministic)", () => {
    const shuffled = {
      ...options,
      participants: [...options.participants].reverse(),
      deckStatements: [...options.deckStatements].reverse(),
      resonances: [...options.resonances].reverse(),
    };
    expect(routeDeck(shuffled)).toEqual(routeDeck(options));
  });

  it("an unclustered viewer (no need votes, not a participant) gets least-seen-first", () => {
    const queue = routeDeck({ ...options, viewer: "https://newcomer.example/#me" }).map(
      (e) => e.statement,
    );
    // All four claims (newcomer reacted to none), totalSeen asc then id asc:
    // cD (0) → cA (1) → cB/cC (2 each, id order).
    expect(queue).toEqual([C[3], C[0], C[1], C[2]]);
  });

  it("votes on statements outside the deck universe are ignored (integrity)", () => {
    const withJunk = {
      ...options,
      resonances: [
        ...options.resonances,
        vote(P[2] as string, "https://evil.example/injected.ttl", STANCE_RESONATES),
      ],
    };
    expect(routeDeck(withJunk).map((e) => e.statement)).toEqual(
      routeDeck(options).map((e) => e.statement),
    );
  });

  it("an empty deck routes to an empty queue", () => {
    expect(routeDeck({ ...options, deckStatements: [] })).toEqual([]);
  });
});
