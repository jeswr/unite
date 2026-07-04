// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded S2 scope-B artifact spine through the REAL pipeline: the
// infrastructure demo IS the self-hosting first deliberation (§3.1, milestone
// B4 in sandbox form) — the futures-0.2.0 InfraProposal with its real
// formalising commit as running code, a breaking proposal carrying its
// migration story, a candidate recommendation whose lineage clears the
// consent gate, and sandboxed fedreg:StorageDescription documents the
// Adoption board observes: 0.1.0 meets the bar (computed Current), 0.2.0 —
// the recommended version — has NO advertisers yet (computed Proposed; the
// honest display). Apps + society seeds are untouched by S2.

import { describe, expect, it } from "vitest";
import { computeAdoption, GOVERNED_SYSTEMS, observeAdoption } from "../lib/adoption.js";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { KIND_DEPRECATION, KIND_SPEC_CHANGE } from "../lib/fut-draft.js";
import { StubMembershipVerifier } from "../lib/membership.js";
import { StaticRegistry } from "../lib/registry.js";
import { DEMO_ADOPTION_SOURCES, FUTURES_LINEAGE } from "./fixtures.js";
import { getDemoDeliberation } from "./pods.js";

async function aggregateInfraDemo() {
  const demo = await getDemoDeliberation("infrastructure");
  const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
  const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
  const result = await aggregateDeliberation({
    registry,
    verifier,
    fetch: demo.fetch,
    kinds: ["need", "infra-proposal", "synthesis", "critique"],
  });
  return { demo, result };
}

describe("the seeded S2 scope-B spine through the REAL pipeline", () => {
  it("aggregates the three infra proposals with no errors", async () => {
    const { result } = await aggregateInfraDemo();
    expect(result.errors).toEqual([]);
    expect(result.infraProposals).toHaveLength(3);
    // And they are NOT misread as app proposals (type selection).
    expect(result.proposals).toEqual([]);
  });

  it("seeds the SELF-HOSTING proposal: adopt futures 0.2.0, with real running code", async () => {
    const { result } = await aggregateInfraDemo();
    const p = result.infraProposals.find((x) => x.title === "Adopt futures sector 0.2.0");
    expect(p).toBeDefined();
    expect(p?.targetsSystem).toEqual([FUTURES_LINEAGE]);
    expect(p?.proposalKind).toBe(KIND_SPEC_CHANGE);
    expect(p?.breakingChange).toBe(false);
    expect(p?.referenceImplementation).toBe(
      "https://github.com/jeswr/solid-federation-vocab/commit/67b00beda1a05963842de75f72b9968ddca990e3",
    );
    expect(p?.motivatedBy.length).toBeGreaterThanOrEqual(1);
  });

  it("the breaking proposal carries its migration story (interop honesty survives the round-trip)", async () => {
    const { result } = await aggregateInfraDemo();
    const p = result.infraProposals.find((x) => x.breakingChange === true);
    expect(p).toBeDefined();
    expect(p?.proposalKind).toBe(KIND_DEPRECATION);
    expect(p?.migrationPath).toContain("dual-read");
  });

  it("the recommendation candidate clears the consent gate (its lineage is consented)", async () => {
    const { result } = await aggregateInfraDemo();
    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    expect(c?.title).toBe("Recommend futures 0.2.0 for adoption");
    for (const input of c?.derivedFrom ?? []) {
      expect(result.synthesizable.has(input)).toBe(true);
    }
    expect(result.critiques).toHaveLength(1);
    expect(result.critiques[0]?.onStatement).toBe(c?.id);
  });

  it("the apps demo is untouched by S2 (no infra proposals)", async () => {
    const demo = await getDemoDeliberation("apps");
    const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
    const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
    const result = await aggregateDeliberation({
      registry,
      verifier,
      fetch: demo.fetch,
      kinds: ["need", "app-proposal", "infra-proposal", "synthesis", "critique"],
    });
    expect(result.infraProposals).toEqual([]);
    expect(result.proposals).toHaveLength(3); // the S1 seeds, unchanged
  });
});

describe("the seeded adoption surface through the REAL fedreg pipeline", () => {
  it("observes the two demo storages; 0.1.0 meets the bar, 0.2.0 has NO advertisers (honest emptiness)", async () => {
    const demo = await getDemoDeliberation("infrastructure");
    const snap = await observeAdoption(DEMO_ADOPTION_SOURCES, { fetch: demo.fetch });
    expect(snap.errors).toEqual([]);
    const { matrices, undeclared } = computeAdoption(GOVERNED_SYSTEMS, snap.observations);
    expect(undeclared).toEqual([]);
    const futures = matrices.find((m) => m.system.id === FUTURES_LINEAGE);
    const [v1, v2] = futures?.versions ?? [];
    expect(v1?.parties).toHaveLength(2);
    expect(v1?.status).toBe("current");
    expect(v2?.parties).toEqual([]);
    expect(v2?.status).toBe("proposed"); // recommended by the room; NOT adopted — the wire hasn't voted
    // Every cell is re-checkable at its source.
    for (const o of snap.observations) {
      expect(DEMO_ADOPTION_SOURCES).toContain(o.source);
    }
  });

  it("the demo sandbox refuses an out-of-origin source (fail-closed sandbox boundary)", async () => {
    const demo = await getDemoDeliberation("infrastructure");
    const snap = await observeAdoption(["https://real.example/fedreg.ttl"], {
      fetch: demo.fetch,
    });
    expect(snap.observations).toEqual([]);
    expect(snap.errors).toHaveLength(1);
  });
});
