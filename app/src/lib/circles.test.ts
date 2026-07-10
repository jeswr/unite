// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Circle-composition fixtures (design/v2/07 §5 "Circles arithmetic +
// fallback"): every composed circle is size 4–6, spans ≥2 clusters when the
// community has ≥2 (with ≥2 members per represented cluster — the pairs
// rule), singleton clusters fold deterministically, the starter/cold-start
// paths never claim diversity (the vacuous-diversity guard), and the
// imbalanced-community fallback yields honestly-labeled overflow circles
// with open seats + a waitlist — never a lone token, never a circle of 1–3.

import { describe, expect, it } from "vitest";
import {
  CIRCLE_CAPACITY,
  CIRCLE_MIN_SIZE,
  type CircleComposition,
  composeCircles,
} from "./circles.js";
import { STANCE_CONFLICTS, STANCE_RESONATES, type Stance } from "./fut.js";
import type { Need, Resonance } from "./model.js";

const DELIB = "https://community.example/deliberations/society";
const FUT = "https://w3id.org/jeswr/sectors/futures#";
const PROTECTION = `${FUT}maxneef-protection`;
const PARTICIPATION = `${FUT}maxneef-participation`;
const IDENTITY = `${FUT}maxneef-identity`;

const wid = (name: string): string => `https://${name}.example/#me`;

let seq = 0;
function vote(creator: string, onStatement: string, stance: Stance): Resonance {
  seq++;
  return {
    id: `https://r.example/v${seq}.ttl`,
    onStatement,
    stance,
    created: "2026-07-01T12:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

function need(id: string, creator: string, concept: string): Need {
  return {
    id: `https://n.example/needs/${id}`,
    content: `need ${id}`,
    needConcept: concept,
    created: "2026-06-01T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

const N1 = "https://n.example/needs/n1";
const N2 = "https://n.example/needs/n2";
const N3 = "https://n.example/needs/n3";

/** The structural guarantees of 04 §2, asserted over any composition. */
function assertInvariants(comp: CircleComposition): void {
  const seated = comp.circles.flatMap((c) => [...c.members]);
  const all = [...seated, ...comp.waitlist];
  expect(new Set(all).size).toBe(all.length); // a person sits in ≤1 place
  for (const c of comp.circles) {
    expect(c.members.length).toBeLessThanOrEqual(CIRCLE_CAPACITY);
    expect(c.openSeats).toBe(Math.max(0, CIRCLE_CAPACITY - c.members.length));
    expect([...c.members]).toEqual([...c.members].sort());
    if (c.kind !== "starter") {
      expect(c.members.length).toBeGreaterThanOrEqual(CIRCLE_MIN_SIZE);
    }
    if (c.kind === "diverse") {
      // spans ≥2 clusters, bridgeable, and the pairs rule per represented cluster
      expect(c.clusters.length).toBeGreaterThanOrEqual(2);
      expect(c.sharedNeedConcepts.length).toBeGreaterThanOrEqual(1);
      const counts = new Map<number, number>();
      for (const m of c.members) {
        const g = comp.effectiveClusters.get(m);
        expect(g).toBeDefined();
        if (g === undefined) continue;
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      expect([...counts.keys()].sort((a, b) => a - b)).toEqual([...c.clusters]);
      for (const count of counts.values()) {
        expect(count).toBeGreaterThanOrEqual(2); // never a lone token minority
      }
    }
    if (c.kind === "overflow") {
      expect(c.clusters.length).toBe(1); // honest: homogeneous by construction
      for (const m of c.members) {
        expect(comp.effectiveClusters.get(m)).toBe(c.clusters[0]);
      }
    }
    if (c.kind === "cold-start" || c.kind === "starter") {
      expect(c.clusters).toEqual([]); // no clustering ran — no diversity claim
    }
  }
}

/** 6×A + 2×B, bridged by a shared `identity` concept on a1/a2/b1/b2. */
function imbalancedCommunity(): {
  participants: string[];
  needs: Need[];
  resonances: Resonance[];
} {
  const aIds = ["a1", "a2", "a3", "a4", "a5", "a6"].map(wid);
  const bIds = ["b1", "b2"].map(wid);
  const needs = [
    need("n1", wid("a1"), PROTECTION),
    need("n2", wid("b1"), PARTICIPATION),
    need("n3", wid("a1"), IDENTITY),
  ];
  const resonances: Resonance[] = [];
  for (const a of aIds) {
    resonances.push(vote(a, N1, STANCE_RESONATES), vote(a, N2, STANCE_CONFLICTS));
  }
  for (const b of bIds) {
    resonances.push(
      vote(b, N1, STANCE_CONFLICTS),
      vote(b, N2, STANCE_RESONATES),
      vote(b, N3, STANCE_RESONATES),
    );
  }
  // The bridge: a1/a2 share `identity` with b1/b2.
  resonances.push(vote(wid("a1"), N3, STANCE_RESONATES), vote(wid("a2"), N3, STANCE_RESONATES));
  return { participants: [...aIds, ...bIds], needs, resonances };
}

describe("composeCircles — the imbalanced-community fallback (04 §2, 07 §5)", () => {
  it("6A+2B → one diverse circle + one honestly-labeled overflow circle with open seats", () => {
    const { participants, needs, resonances } = imbalancedCommunity();
    const comp = composeCircles({ participants, needs, resonances });
    assertInvariants(comp);

    expect(comp.hasOpinionSignal).toBe(true);
    expect(comp.circles).toHaveLength(2);

    const diverse = comp.circles[0];
    expect(diverse?.kind).toBe("diverse");
    expect(diverse?.members).toEqual([wid("a1"), wid("a2"), wid("b1"), wid("b2")]);
    expect(diverse?.clusters).toEqual([0, 1]);
    expect(diverse?.sharedNeedConcepts).toEqual([IDENTITY]);
    expect(diverse?.reason).toEqual({
      kind: "diverse",
      clustersSpanned: [0, 1],
      sharedNeedConcepts: [IDENTITY],
    });

    const overflow = comp.circles[1];
    expect(overflow?.kind).toBe("overflow");
    expect(overflow?.members).toEqual([wid("a3"), wid("a4"), wid("a5"), wid("a6")]);
    expect(overflow?.openSeats).toBe(2); // target 4, capacity 6 — seats held open
    expect(overflow?.reason).toEqual({ kind: "overflow", cluster: 0, openSeats: 2 });

    expect(comp.waitlist).toEqual([]);
    expect(comp.foldedClusters).toEqual([]);
  });

  it("a bridgeless third minority member is WAITLISTED, never seated as a lone token", () => {
    const base = imbalancedCommunity();
    const b3 = wid("b3");
    const participants = [...base.participants, b3];
    const resonances = [
      ...base.resonances,
      vote(b3, N1, STANCE_CONFLICTS),
      vote(b3, N2, STANCE_RESONATES),
      // no N3 — b3 shares nothing with the diverse circle's overlap
    ];
    const comp = composeCircles({ participants, needs: base.needs, resonances });
    assertInvariants(comp);

    expect(comp.circles).toHaveLength(2);
    expect(comp.circles[0]?.kind).toBe("diverse");
    expect(comp.circles[1]?.kind).toBe("overflow");
    // b3 is in no circle: joining the A-only overflow would seat a lone token,
    // and the diverse circle's shared overlap would go empty.
    expect(comp.waitlist).toEqual([b3]);
  });

  it("no bridgeable overlap at all → everyone waits (never a sub-4 or token circle)", () => {
    const participants = [wid("a1"), wid("a2"), wid("b1"), wid("b2")];
    const needs = [need("n1", wid("a1"), PROTECTION), need("n2", wid("b1"), PARTICIPATION)];
    const resonances = [
      vote(wid("a1"), N1, STANCE_RESONATES),
      vote(wid("a2"), N1, STANCE_RESONATES),
      vote(wid("a1"), N2, STANCE_CONFLICTS),
      vote(wid("a2"), N2, STANCE_CONFLICTS),
      vote(wid("b1"), N1, STANCE_CONFLICTS),
      vote(wid("b2"), N1, STANCE_CONFLICTS),
      vote(wid("b1"), N2, STANCE_RESONATES),
      vote(wid("b2"), N2, STANCE_RESONATES),
    ];
    const comp = composeCircles({ participants, needs, resonances });
    assertInvariants(comp);
    expect(comp.circles).toEqual([]);
    expect(comp.waitlist).toEqual(participants);
  });
});

describe("composeCircles — singleton-cluster folding (04 §2)", () => {
  it("folds a singleton cluster into its nearest centre — nobody seated as 'the different one'", () => {
    const participants = [wid("a1"), wid("a2"), wid("a3"), wid("a4"), wid("c1")];
    const needs = [need("n1", wid("a1"), PROTECTION), need("n2", wid("c1"), PARTICIPATION)];
    const resonances: Resonance[] = [];
    for (const a of ["a1", "a2", "a3", "a4"].map(wid)) {
      resonances.push(vote(a, N1, STANCE_RESONATES), vote(a, N2, STANCE_CONFLICTS));
    }
    resonances.push(vote(wid("c1"), N1, STANCE_CONFLICTS), vote(wid("c1"), N2, STANCE_RESONATES));

    const comp = composeCircles({ participants, needs, resonances });
    assertInvariants(comp);

    expect(comp.foldedClusters).toEqual([{ from: 1, into: 0 }]);
    // One effective cluster → no diverse circle is claimable; the honest
    // outcome is a single overflow circle seating everyone (4 + the tail).
    expect(comp.circles).toHaveLength(1);
    const circle = comp.circles[0];
    expect(circle?.kind).toBe("overflow");
    expect(circle?.members).toEqual(participants);
    expect(circle?.openSeats).toBe(1);
    expect(comp.waitlist).toEqual([]);
    expect(comp.effectiveClusters.get(wid("c1"))).toBe(0);
  });
});

describe("composeCircles — the vacuous-diversity guard (04 §2/§6)", () => {
  it("a community below 4 gets ONE starter circle that claims nothing", () => {
    const participants = [wid("x1"), wid("x2"), wid("x3")];
    const needs = [need("n1", wid("x1"), PROTECTION)];
    const resonances = [
      vote(wid("x2"), N1, STANCE_RESONATES),
      vote(wid("x3"), N1, STANCE_RESONATES),
    ];
    const comp = composeCircles({ participants, needs, resonances });
    assertInvariants(comp);

    expect(comp.circles).toHaveLength(1);
    const starter = comp.circles[0];
    expect(starter?.kind).toBe("starter");
    expect(starter?.members).toEqual(participants);
    expect(starter?.reason).toEqual({ kind: "starter", communitySize: 3 });
    expect(comp.circles.some((c) => c.kind === "diverse")).toBe(false);
    expect(comp.waitlist).toEqual([]);
  });

  it("no opinion signal → cold-start circles on need overlap alone, never 'diverse' or 'overflow'", () => {
    const participants = ["p1", "p2", "p3", "p4", "p5"].map(wid);
    const needs = participants.map((p, i) => need(`n${i + 1}`, p, PROTECTION));
    const comp = composeCircles({ participants, needs, resonances: [] });
    assertInvariants(comp);

    expect(comp.hasOpinionSignal).toBe(false);
    expect(comp.circles).toHaveLength(1);
    const circle = comp.circles[0];
    expect(circle?.kind).toBe("cold-start");
    expect(circle?.members).toEqual(participants); // 4 seeded + the tail seated
    expect(circle?.sharedNeedConcepts).toEqual([PROTECTION]);
    expect(circle?.reason).toEqual({ kind: "cold-start", sharedNeedConcepts: [PROTECTION] });
    for (const c of comp.circles) {
      expect(c.kind).not.toBe("diverse");
      expect(c.kind).not.toBe("overflow");
    }
  });

  it("an empty community composes to nothing", () => {
    const comp = composeCircles({ participants: [], needs: [], resonances: [] });
    expect(comp.circles).toEqual([]);
    expect(comp.waitlist).toEqual([]);
    expect(comp.hasOpinionSignal).toBe(false);
  });
});

describe("composeCircles — balanced communities + the pairs rule", () => {
  function balanced12(): { participants: string[]; needs: Need[]; resonances: Resonance[] } {
    const aIds = ["a1", "a2", "a3", "a4", "a5", "a6"].map(wid);
    const bIds = ["b1", "b2", "b3", "b4", "b5", "b6"].map(wid);
    const needs = [
      need("n1", wid("a1"), PROTECTION),
      need("n2", wid("b1"), PARTICIPATION),
      need("n3", wid("a1"), IDENTITY),
    ];
    const resonances: Resonance[] = [];
    for (const a of aIds) {
      resonances.push(
        vote(a, N1, STANCE_RESONATES),
        vote(a, N2, STANCE_CONFLICTS),
        vote(a, N3, STANCE_RESONATES),
      );
    }
    for (const b of bIds) {
      resonances.push(
        vote(b, N1, STANCE_CONFLICTS),
        vote(b, N2, STANCE_RESONATES),
        vote(b, N3, STANCE_RESONATES),
      );
    }
    return { participants: [...aIds, ...bIds], needs, resonances };
  }

  it("6A+6B → three diverse circles, everyone seated, pairs rule everywhere", () => {
    const comp = composeCircles(balanced12());
    assertInvariants(comp);
    expect(comp.circles).toHaveLength(3);
    for (const c of comp.circles) expect(c.kind).toBe("diverse");
    expect(comp.waitlist).toEqual([]);
    expect(comp.circles[0]?.members).toEqual([wid("a1"), wid("a2"), wid("b1"), wid("b2")]);
    expect(comp.circles[1]?.members).toEqual([wid("a3"), wid("a4"), wid("b3"), wid("b4")]);
    expect(comp.circles[2]?.members).toEqual([wid("a5"), wid("a6"), wid("b5"), wid("b6")]);
  });
});

describe("composeCircles — determinism", () => {
  it("is invariant to input ordering (shuffled arrays → identical composition)", () => {
    const base = imbalancedCommunity();
    const b3 = wid("b3");
    const participants = [...base.participants, b3];
    const resonances = [
      ...base.resonances,
      vote(b3, N1, STANCE_CONFLICTS),
      vote(b3, N2, STANCE_RESONATES),
    ];
    const first = composeCircles({ participants, needs: base.needs, resonances });

    // A fixed, order-scrambling permutation (no randomness in tests either).
    const scramble = <T>(xs: readonly T[]): T[] => {
      const out: T[] = [];
      for (let i = xs.length - 1; i >= 0; i -= 2) {
        const x = xs[i];
        if (x !== undefined) out.push(x);
      }
      for (let i = xs.length % 2 === 0 ? 0 : 1; i < xs.length; i += 2) {
        const x = xs[i];
        if (x !== undefined) out.push(x);
      }
      return out;
    };
    const second = composeCircles({
      participants: scramble(participants),
      needs: scramble(base.needs),
      resonances: scramble(resonances),
    });
    expect(second).toEqual(first);
  });

  it("repeated invocation is stable (no clocks, no randomness)", () => {
    const input = imbalancedCommunity();
    const a = composeCircles(input);
    const b = composeCircles(input);
    expect(b).toEqual(a);
  });
});
