// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S1 demo spine end-to-end through the REAL pipeline (SCOPE-DIFFERENTIATION
// §6 S1: "end-to-end in demo mode"): seeded proposals/candidates/critiques are
// serialised by the production builders, listed as LDP containers, aggregated
// with the kinds seam, and the Convergence-Room outcomes are COMPUTED by
// lib/convergence over the real votes — the endorsed candidate and the
// disagreement map both demo honestly because the math says so, not because a
// fixture asserts it.

import { beforeEach, describe, expect, it } from "vitest";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { candidateReception, standingCritiques } from "../lib/convergence.js";
import { StubMembershipVerifier } from "../lib/membership.js";
import { StaticRegistry } from "../lib/registry.js";
import { DEMO_CANDIDATES, DEMO_CRITIQUES, DEMO_PROPOSALS, demoBase } from "./fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "./pods.js";

async function aggregateApps() {
  const demo = await getDemoDeliberation("apps");
  const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
  const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
  return {
    demo,
    result: await aggregateDeliberation({
      registry,
      verifier,
      fetch: demo.fetch,
      kinds: ["need", "app-proposal", "synthesis", "critique"],
    }),
  };
}

const candidateUrl = (slug: string): string => {
  const spec = DEMO_CANDIDATES.apps.find((c) => c.slug === slug);
  if (!spec) throw new Error(`no such candidate fixture: ${slug}`);
  return `${demoBase(spec.author, "apps")}syntheses/${slug}.ttl`;
};

beforeEach(() => {
  resetDemoInstances();
});

describe("the seeded S1 artifact spine through the REAL pipeline", () => {
  it("aggregates every seeded proposal, candidate and critique, error-free", async () => {
    const { result } = await aggregateApps();
    expect(result.proposals).toHaveLength(DEMO_PROPOSALS.apps.length);
    expect(result.candidates).toHaveLength(DEMO_CANDIDATES.apps.length);
    expect(result.critiques).toHaveLength(DEMO_CRITIQUES.apps.length);
    expect(result.errors).toEqual([]);
  });

  it("every seeded need + proposal is synthesizable (all carry DEFAULT_CONSENT)", async () => {
    const { result } = await aggregateApps();
    for (const n of result.needs) expect(result.synthesizable.has(n.id)).toBe(true);
    for (const p of result.proposals) expect(result.synthesizable.has(p.id)).toBe(true);
    // Candidates are process-layer artifacts — never in the derivable set.
    for (const c of result.candidates) expect(result.synthesizable.has(c.id)).toBe(false);
  });

  it("every proposal's needs trace resolves to seeded needs (satisfier → needs)", async () => {
    const { result } = await aggregateApps();
    const needIds = new Set(result.needs.map((n) => n.id));
    for (const p of result.proposals) {
      expect(p.motivatedBy.length).toBeGreaterThan(0);
      for (const n of p.motivatedBy) expect(needIds.has(n)).toBe(true);
    }
    // The portfolio framing has something to show: ≥2 proposals share a need.
    const counts = new Map<string, number>();
    for (const p of result.proposals) {
      for (const n of p.motivatedBy) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect([...counts.values()].some((c) => c >= 2)).toBe(true);
  });

  it("the broad candidate is ENDORSED by the computed bridging threshold", async () => {
    const { result } = await aggregateApps();
    const reception = candidateReception(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
      candidateUrl("spine-v1"),
    );
    expect(reception.outcome).toBe("endorsed");
    expect(reception.clusterCount).toBeGreaterThanOrEqual(2);
  });

  it("the protection-first candidate computes to a DISAGREEMENT map (never smoothed)", async () => {
    const { result } = await aggregateApps();
    const reception = candidateReception(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
      candidateUrl("lockdown-default"),
    );
    expect(reception.outcome).toBe("disagreement");
  });

  it("standing critiques attach to their candidate, newest first (dissent-annex material)", async () => {
    const { result } = await aggregateApps();
    const onLockdown = standingCritiques(result.critiques, candidateUrl("lockdown-default"));
    expect(onLockdown.map((c) => c.id.split("/").pop())).toEqual([
      "cr-lockdown-onboarding.ttl",
      "cr-lockdown-calendar.ttl",
    ]);
    const onSpine = standingCritiques(result.critiques, candidateUrl("spine-v1"));
    expect(onSpine).toHaveLength(1);
  });

  it("neither non-apps scope seeds the scope-A app-proposal layer", async () => {
    // Each non-apps scope grows its OWN room artifacts with its scope —
    // infrastructure's S2 artifacts are asserted in pods-s2.test.ts, society's
    // S4 expression + room artifacts in pods-society.test.ts. What stays empty
    // in BOTH is the scope-A proposal layer (parseProposals selects by
    // rdf:type, so an infra proposal in the shared proposals/ container is
    // skipped, not mis-collected as an app proposal).
    for (const scope of ["infrastructure", "society"] as const) {
      const demo = await getDemoDeliberation(scope);
      const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
      const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
      const result = await aggregateDeliberation({
        registry,
        verifier,
        fetch: demo.fetch,
        kinds: ["app-proposal"],
      });
      expect(result.proposals).toEqual([]);
      expect(result.errors).toEqual([]);
    }
  });
});
