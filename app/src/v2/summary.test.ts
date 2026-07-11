// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The living summary — the TWO-SCALE k rule made structural + the P3
// coverage property (design/v2 03 §4, 07 §5):
//   • verdicts are COMMUNITY-scale (a circle-unanimous statement still lands
//     in "differ" when the community divides on it — reception is never a
//     disguised circle headcount);
//   • the output carries NO tallies, NO splits (type-level, asserted);
//   • every statement lands in EXACTLY ONE bucket — which is what makes
//     "every adopted atom is reachable from at least one surface" (P3) a
//     structural check, run here against the REAL demo aggregate.

import { beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "../lib/fut.js";
import type { Resonance } from "../lib/model.js";
import { buildRegistry, deliberationTrust, demoConfig } from "../ui/state.js";
import { livingSummary } from "./summary.js";

const DELIB = "https://demo.unite.example/deliberations/society";
const P = (n: number) => `https://p.example/${n}#me`;
const PARTICIPANTS = [1, 2, 3, 4, 5, 6, 7, 8].map(P);
const N1 = "https://s.example/needs/n1";
const N2 = "https://s.example/needs/n2";
const S_DIVISIVE = "https://s.example/claims/divisive";

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

function communityResonances(): Resonance[] {
  const out: Resonance[] = [];
  for (const i of [1, 2, 3, 4]) {
    out.push(vote(P(i), N1, STANCE_RESONATES), vote(P(i), N2, STANCE_CONFLICTS));
  }
  for (const i of [5, 6, 7, 8]) {
    out.push(vote(P(i), N1, STANCE_CONFLICTS), vote(P(i), N2, STANCE_RESONATES));
  }
  // The community DIVIDES on the statement — even though the "circle"
  // (p1 + p2, same cluster) is unanimous about it.
  for (const i of [1, 2, 3]) out.push(vote(P(i), S_DIVISIVE, STANCE_RESONATES));
  for (const i of [5, 6, 7]) out.push(vote(P(i), S_DIVISIVE, STANCE_CONFLICTS));
  return out;
}

beforeEach(() => {
  resetDemoInstances();
});

describe("livingSummary — the two-scale rule", () => {
  it("a circle-unanimous statement still reads DIVISIVE at community scale", () => {
    const summary = livingSummary({
      circleStatements: [{ id: S_DIVISIVE, content: "Ban through-traffic.", creator: P(1) }],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: communityResonances(),
      viewer: P(2),
    });
    // p1 authored it, p2 resonated: inside the 2-person room it is agreement.
    // The verdict comes from the COMMUNITY matrix — where it divides.
    expect(summary.differ.map((l) => l.statement)).toEqual([S_DIVISIVE]);
    expect(summary.circling).toEqual([]);
  });

  it("carries NO tallies, NO splits, NO counts in any line (the P11 inversion)", () => {
    const summary = livingSummary({
      circleStatements: [{ id: S_DIVISIVE, content: "Ban through-traffic.", creator: P(1) }],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: communityResonances(),
      viewer: P(2),
    });
    for (const line of [...summary.circling, ...summary.differ, ...summary.forming]) {
      // The line's whole shape: attributed words + viewer marker. Nothing else.
      expect(Object.keys(line).sort()).toEqual(["author", "heardFromViewer", "statement", "words"]);
    }
  });

  it("a sub-k DIVISIVE result never renders an anonymous verdict (P11 floor)", () => {
    const S = "https://s.example/claims/thin-divisive";
    const out = communityResonances().filter((r) => r.onStatement !== S_DIVISIVE);
    // Only 4 community votes on S — a 2-vs-2 cross-cluster split, BELOW k=5.
    out.push(vote(P(1), S, STANCE_RESONATES), vote(P(2), S, STANCE_RESONATES));
    out.push(vote(P(5), S, STANCE_CONFLICTS), vote(P(6), S, STANCE_CONFLICTS));
    const summary = livingSummary({
      circleStatements: [{ id: S, content: "Ban through-traffic.", creator: P(1) }],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: out,
      viewer: P(2),
    });
    // NOT characterized: it stays "still forming", never differ.
    expect(summary.differ).toEqual([]);
    expect(summary.forming.map((l) => l.statement)).toEqual([S]);
  });

  it("a sub-k COMMON-GROUND result never renders an anonymous verdict (P11 floor)", () => {
    const S = "https://s.example/claims/thin-common";
    const out = communityResonances().filter((r) => r.onStatement !== S_DIVISIVE);
    // Only 3 community votes, both clusters positive — common ground, BELOW k=5.
    out.push(vote(P(1), S, STANCE_RESONATES), vote(P(2), S, STANCE_RESONATES));
    out.push(vote(P(5), S, STANCE_RESONATES));
    const summary = livingSummary({
      circleStatements: [{ id: S, content: "A bench.", creator: P(1) }],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: out,
      viewer: P(3),
    });
    expect(summary.circling).toEqual([]);
    expect(summary.forming.map((l) => l.statement)).toEqual([S]);
  });

  it("the k floor is configurable (a lower floor lets the same result characterize)", () => {
    const S = "https://s.example/claims/thin-common";
    const out = communityResonances().filter((r) => r.onStatement !== S_DIVISIVE);
    out.push(vote(P(1), S, STANCE_RESONATES), vote(P(2), S, STANCE_RESONATES));
    out.push(vote(P(5), S, STANCE_RESONATES));
    const summary = livingSummary({
      circleStatements: [{ id: S, content: "A bench.", creator: P(1) }],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: out,
      viewer: P(3),
      k: 3,
    });
    expect(summary.circling.map((l) => l.statement)).toEqual([S]);
  });

  it("marks what the viewer hasn't spoken to (pressure-free, viewer-relative)", () => {
    const summary = livingSummary({
      circleStatements: [
        { id: S_DIVISIVE, content: "Ban through-traffic.", creator: P(1) },
        { id: "https://s.example/claims/unspoken", content: "A bench.", creator: P(3) },
      ],
      participants: PARTICIPANTS,
      needStatements: [N1, N2],
      resonances: communityResonances(),
      viewer: P(1),
    });
    const byId = new Map(
      [...summary.circling, ...summary.differ, ...summary.forming].map((l) => [l.statement, l]),
    );
    expect(byId.get(S_DIVISIVE)?.heardFromViewer).toBe(true); // authored it
    expect(byId.get("https://s.example/claims/unspoken")?.heardFromViewer).toBe(false);
  });
});

describe("P3 coverage over the REAL demo aggregate", () => {
  it("every adopted claim lands in exactly one summary bucket", async () => {
    const config = demoConfig("society");
    const { gate } = await deliberationTrust(config);
    const demo = await getDemoDeliberation("society");
    const result = await aggregateDeliberation({
      registry: buildRegistry(config),
      verifier: gate,
      fetch: demo.fetch,
      kinds: ["need", "vision", "claim", "value"],
    });
    expect(result.claims.length).toBeGreaterThan(0);
    const summary = livingSummary({
      circleStatements: result.claims.map((c) => ({
        id: c.id,
        content: c.content,
        creator: c.creator,
      })),
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      resonances: result.resonances,
      viewer: demo.you.webId,
    });
    const buckets = [summary.circling, summary.differ, summary.forming];
    const total = buckets.reduce((n, b) => n + b.length, 0);
    expect(total).toBe(result.claims.length); // every atom reachable (P3)
    const ids = new Set(buckets.flat().map((l) => l.statement));
    expect(ids.size).toBe(result.claims.length); // …in exactly one bucket
  });
});
