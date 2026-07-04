// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The reception classifier + per-cluster best-received helper: the labels the
// Common-ground view shows must be honest about the distribution.

import { describe, expect, it } from "vitest";
import { characterizeReception, topForCluster } from "./insights.js";
import type { ClusterDistribution, RankedStatement } from "./ranking.js";

const d = (
  resonates: number,
  conflicts: number,
  unsure: number,
  size?: number,
): ClusterDistribution => ({
  resonates,
  conflicts,
  unsure,
  seen: resonates + conflicts + unsure,
  size: size ?? resonates + conflicts + unsure,
});

describe("characterizeReception", () => {
  it("labels cross-group positive reception as common ground", () => {
    expect(characterizeReception([d(3, 0, 1), d(4, 1, 0)])).toBe("common-ground");
  });

  it("labels one-group-for / one-group-against as divisive", () => {
    expect(characterizeReception([d(4, 0, 0), d(0, 4, 0)])).toBe("divisive");
  });

  it("returns null when only one group has seen it (no cross-group claim)", () => {
    expect(characterizeReception([d(4, 0, 0), d(0, 0, 0)])).toBeNull();
  });

  it("returns null for lukewarm reception (no majority resonance anywhere)", () => {
    expect(characterizeReception([d(1, 0, 3), d(1, 0, 4)])).toBeNull();
  });

  it("a cluster with members but no votes does not qualify the statement", () => {
    expect(characterizeReception([d(3, 0, 0), { ...d(0, 0, 0), size: 5 }])).toBeNull();
  });
});

describe("topForCluster", () => {
  const ranked: RankedStatement[] = [
    {
      statement: "https://s/1",
      score: 0.5,
      rank: 1,
      totalSeen: 6,
      perCluster: [d(3, 0, 0), d(1, 2, 0)],
    },
    {
      statement: "https://s/2",
      score: 0.4,
      rank: 2,
      totalSeen: 6,
      perCluster: [d(1, 2, 0), d(3, 0, 0)],
    },
  ];

  it("returns the statement each cluster received best", () => {
    expect(topForCluster(ranked, 0)?.statement).toBe("https://s/1");
    expect(topForCluster(ranked, 1)?.statement).toBe("https://s/2");
  });

  it("returns null when the cluster voted on nothing", () => {
    const noVotes: RankedStatement[] = [
      { statement: "https://s/1", score: 0, rank: 1, totalSeen: 0, perCluster: [d(0, 0, 0)] },
    ];
    expect(topForCluster(noVotes, 0)).toBeNull();
    expect(topForCluster(ranked, 7)).toBeNull(); // out-of-range cluster
  });
});
