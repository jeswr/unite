// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// "Where you sit" — the P11 k-floor on the split percentage (design/v2 03 §4,
// 07 §5): the "% read it differently" line renders ONLY when BOTH the
// viewer's cluster AND its complement clear k. A sub-k cluster on either side
// deanonymizes the viewer, so the percentage is withheld (the count-free
// fallback then renders in the view).

import { describe, expect, it } from "vitest";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "../lib/fut.js";
import type { Need, Resonance } from "../lib/model.js";
import { whereYouSit } from "./where-you-sit.js";

const DELIB = "https://demo.unite.example/deliberations/society";
const P = (n: number) => `https://p.example/${n}#me`;
const N1 = "https://s.example/needs/n1";
const N2 = "https://s.example/needs/n2";

function need(id: string, creator: string, concept: string): Need {
  return {
    id,
    content: "x",
    needConcept: `https://w3id.org/jeswr/sectors/futures#maxneef-${concept}`,
    created: "2026-06-01T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

let seq = 0;
function vote(creator: string, on: string, stance: string): Resonance {
  seq += 1;
  return {
    id: `https://r.example/${seq}`,
    onStatement: on,
    stance: stance as Resonance["stance"],
    created: "2026-06-20T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
}

/** Two balanced clusters of `per` each over two opposed needs. */
function balanced(per: number): { participants: string[]; needs: Need[]; resonances: Resonance[] } {
  const participants: string[] = [];
  const resonances: Resonance[] = [];
  for (let i = 1; i <= per; i++) {
    participants.push(P(i));
    resonances.push(vote(P(i), N1, STANCE_RESONATES), vote(P(i), N2, STANCE_CONFLICTS));
  }
  for (let i = per + 1; i <= 2 * per; i++) {
    participants.push(P(i));
    resonances.push(vote(P(i), N1, STANCE_CONFLICTS), vote(P(i), N2, STANCE_RESONATES));
  }
  return {
    participants,
    needs: [need(N1, P(1), "protection"), need(N2, P(per + 1), "freedom")],
    resonances,
  };
}

describe("whereYouSit — the P11 k-floor on the split percentage", () => {
  it("shows the percentage when BOTH clusters clear k", () => {
    const { participants, needs, resonances } = balanced(5); // 5 vs 5
    const w = whereYouSit({ viewer: P(1), participants, needs, resonances });
    expect(w).not.toBeNull();
    expect(w?.fraction).toBe(50); // 5 of 10 read it differently
    expect(w?.top.length).toBeGreaterThan(0);
  });

  it("WITHHOLDS the percentage when the viewer's own cluster is sub-k", () => {
    // 2 vs 8: the viewer's cluster (2) is below k even though the community (10)
    // and the complement (8) are large — the old total-only check would leak it.
    const { participants, needs, resonances } = balanced(2);
    const extra: Resonance[] = [];
    for (let i = 5; i <= 10; i++) {
      participants.push(P(i));
      extra.push(vote(P(i), N1, STANCE_CONFLICTS), vote(P(i), N2, STANCE_RESONATES));
    }
    const w = whereYouSit({
      viewer: P(1), // in the 2-person cluster
      participants,
      needs,
      resonances: [...resonances, ...extra],
    });
    expect(w).not.toBeNull();
    expect(w?.fraction).toBeNull(); // withheld — the viewer's group is sub-k
  });

  it("WITHHOLDS the percentage when the complement is sub-k", () => {
    // 8 vs 2: the complement is below k.
    const participants: string[] = [];
    const resonances: Resonance[] = [];
    for (let i = 1; i <= 8; i++) {
      participants.push(P(i));
      resonances.push(vote(P(i), N1, STANCE_RESONATES), vote(P(i), N2, STANCE_CONFLICTS));
    }
    for (let i = 9; i <= 10; i++) {
      participants.push(P(i));
      resonances.push(vote(P(i), N1, STANCE_CONFLICTS), vote(P(i), N2, STANCE_RESONATES));
    }
    const w = whereYouSit({
      viewer: P(1), // in the 8-person cluster; the OTHER side is only 2
      participants,
      needs: [need(N1, P(1), "protection"), need(N2, P(9), "freedom")],
      resonances,
    });
    expect(w?.fraction).toBeNull();
  });

  it("returns null when the viewer is not on the map", () => {
    const { participants, needs, resonances } = balanced(5);
    expect(
      whereYouSit({ viewer: "https://nobody.example/#me", participants, needs, resonances }),
    ).toBeNull();
  });
});
