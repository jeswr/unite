// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S4 society demo end-to-end through the REAL pipeline
// (SCOPE-DIFFERENTIATION §6 S4): seeded visions/claims/values are serialised
// by the production builders, aggregated with the scope-C kinds seam, the
// deck routes deterministically for the T0 "you", the gallery leads with
// shared needs, and BOTH room outcomes — an endorsed shared-future candidate
// and the co-equal disagreement map — are COMPUTED by lib/convergence over
// real votes, never asserted by a fixture.

import { beforeEach, describe, expect, it } from "vitest";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { candidateReception, standingCritiques } from "../lib/convergence.js";
import { routeDeck } from "../lib/deck.js";
import { routeGallery } from "../lib/gallery.js";
import { StubMembershipVerifier } from "../lib/membership.js";
import { StaticRegistry } from "../lib/registry.js";
import { DEMO_CANDIDATES, DEMO_CLAIMS, DEMO_VALUES, DEMO_VISIONS, demoBase } from "./fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "./pods.js";

async function aggregateSociety() {
  const demo = await getDemoDeliberation("society");
  const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
  const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
  return {
    demo,
    result: await aggregateDeliberation({
      registry,
      verifier,
      fetch: demo.fetch,
      kinds: ["need", "vision", "claim", "value", "synthesis", "critique"],
    }),
  };
}

const candidateUrl = (slug: string): string => {
  const spec = DEMO_CANDIDATES.society.find((c) => c.slug === slug);
  if (!spec) throw new Error(`no such candidate fixture: ${slug}`);
  return `${demoBase(spec.author, "society")}syntheses/${slug}.ttl`;
};

beforeEach(() => {
  resetDemoInstances();
});

describe("the seeded scope-C voice layer through the REAL pipeline", () => {
  it("aggregates every seeded vision, claim, value and candidate, error-free", async () => {
    const { result } = await aggregateSociety();
    expect(result.visions).toHaveLength(DEMO_VISIONS.society.length);
    expect(result.claims).toHaveLength(DEMO_CLAIMS.society.length);
    expect(result.values).toHaveLength(DEMO_VALUES.society.length);
    expect(result.candidates).toHaveLength(DEMO_CANDIDATES.society.length);
    expect(result.errors).toEqual([]);
  });

  it("every seeded claim is ADOPTED by its author and traces to its vision", async () => {
    const { result } = await aggregateSociety();
    const visionIds = new Set(result.visions.map((v) => v.id));
    for (const c of result.claims) {
      expect(c.adoptedBy).toBe(c.creator);
      if (c.derivedFrom !== undefined) expect(visionIds.has(c.derivedFrom)).toBe(true);
    }
  });

  it("claims and visions are synthesizable (DEFAULT_CONSENT) — candidates never are", async () => {
    const { result } = await aggregateSociety();
    for (const c of result.claims) expect(result.synthesizable.has(c.id)).toBe(true);
    for (const v of result.visions) expect(result.synthesizable.has(v.id)).toBe(true);
    for (const s of result.candidates) expect(result.synthesizable.has(s.id)).toBe(false);
  });

  it("the broad candidate is ENDORSED; the absolutist one computes to a DISAGREEMENT map", async () => {
    const { result } = await aggregateSociety();
    const receptionOf = (slug: string) =>
      candidateReception(
        result.verified.map((v) => v.webId),
        result.needs.map((n) => n.id),
        result.resonances,
        candidateUrl(slug),
      );
    expect(receptionOf("streets-for-people").outcome).toBe("endorsed");
    expect(receptionOf("car-free-everything").outcome).toBe("disagreement");
  });

  it("standing critiques attach to the divisive candidate (the dissent-annex material)", async () => {
    const { result } = await aggregateSociety();
    const onCarFree = standingCritiques(result.critiques, candidateUrl("car-free-everything"));
    expect(onCarFree.length).toBeGreaterThanOrEqual(2);
    const onSpine = standingCritiques(result.critiques, candidateUrl("streets-for-people"));
    expect(onSpine).toHaveLength(1);
  });

  it("the T0 demo 'you' gets a FULL deterministic deck (reacted to nothing yet)", async () => {
    const { result, demo } = await aggregateSociety();
    const queue = routeDeck({
      viewer: demo.you.webId,
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      deckStatements: result.claims.map((c) => c.id),
      resonances: result.resonances,
    });
    expect(queue).toHaveLength(DEMO_CLAIMS.society.length);
    // Deterministic: re-routing yields the identical queue.
    expect(
      routeDeck({
        viewer: demo.you.webId,
        participants: result.verified.map((v) => v.webId),
        needStatements: result.needs.map((n) => n.id),
        deckStatements: result.claims.map((c) => c.id),
        resonances: result.resonances,
      }),
    ).toEqual(queue);
  });

  it("the gallery routes every seeded vision for 'you' (none are yours)", async () => {
    const { result, demo } = await aggregateSociety();
    const entries = routeGallery({
      viewer: demo.you.webId,
      participants: result.verified.map((v) => v.webId),
      needs: result.needs,
      visions: result.visions,
      resonances: result.resonances,
    });
    expect(entries).toHaveLength(DEMO_VISIONS.society.length);
  });

  it("society admits the T0 'you' at floor 0 — verified with the honest T0 label", async () => {
    const demo = await getDemoDeliberation("society");
    const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
    // The REAL demo trust gate (floor 0), not the stub: 'you' hold no
    // membership credential in society, yet participate as pseudonymous voice.
    const { TierParticipationGate } = await import("../lib/trust.js");
    const gate = new TierParticipationGate(demo.trust.resolver, 0);
    const result = await aggregateDeliberation({
      registry,
      verifier: gate,
      fetch: demo.fetch,
      kinds: ["need", "vision", "claim", "value"],
    });
    const you = result.verified.find((v) => v.webId === demo.you.webId);
    expect(you?.tier).toBe("T0");
  });
});
