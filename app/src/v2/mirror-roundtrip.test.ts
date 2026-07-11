// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The V1 END-TO-END fixtures (design/v2 07 §3 V1 acceptance + §5 rows):
//
//   • MIRROR ROUND-TRIP — utterance → draft → adopt → the atom lands in the
//     aggregate AND the resonance matrix, carrying fut:decomposedBy (C6).
//   • DISCARD WRITES NOTHING — a discarded/ignored mirror leaves the engine
//     untouched.
//   • THE C4 GATE SPLIT (03 §2a) — a sensitive-tripping utterance SENDS; its
//     drafted adoption runs the boundary beat (keep/reword ONLY — corrected
//     02 §4.1 semantics: no machine reformulation exists to offer); NO
//     sensitive-tripping text reaches a pod-society write; and the chokepoint
//     itself still throws when driven directly — fail-closed regardless of UI.
//   • THE ADOPTION INVARIANT (chat path) — nothing is attributable without
//     adoption; a forged adoption is unwritable through this path too.
//
// All of it runs over the REAL demo pod federation + the REAL aggregation
// pipeline — nothing is short-circuited.

import { beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import { type AggregateResult, aggregateDeliberation } from "../lib/aggregate.js";
import { draftMirror } from "../lib/mirror-draft.js";
import { writeClaim } from "../lib/pod-society.js";
import { buildMatrix } from "../lib/ranking.js";
import { SensitiveDomainError, screenSensitiveDomain } from "../lib/sensitive.js";
import { buildRegistry, deliberationTrust, demoConfig } from "../ui/state.js";
import { adoptMirrorAtoms } from "./adopt.js";
import { writeCircleMessage } from "./circle-data.js";
import { DEMO_CIRCLE, ensureDemoCircleSeeded, resetDemoCircleSeed } from "./demo-circle.js";

const KINDS = ["need", "vision", "claim", "value", "synthesis", "critique"] as const;

async function aggregate(): Promise<AggregateResult> {
  const config = demoConfig("society");
  const { gate } = await deliberationTrust(config);
  const demo = await getDemoDeliberation("society");
  return aggregateDeliberation({
    registry: buildRegistry(config),
    verifier: gate,
    fetch: demo.fetch,
    kinds: [...KINDS],
  });
}

beforeEach(() => {
  resetDemoInstances();
  resetDemoCircleSeed();
});

describe("the mirror round-trip (utterance → draft → adopt → aggregate → matrix)", () => {
  it("an adopted atom enters the deliberation, with PROV, as the author's own", async () => {
    const demo = await getDemoDeliberation("society");
    await ensureDemoCircleSeeded(demo);
    const before = await aggregate();

    // 1. The utterance — a plain circle message in the visitor's own pod.
    const utterance = "I want to hear kids on bikes, not brakes, crossing safely to school.";
    const { url: utteranceUrl } = await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: utterance,
      circle: DEMO_CIRCLE.id,
      published: "2026-07-01T08:00:00Z",
    });

    // 2. The drafter (pure, deterministic).
    const draft = draftMirror(utterance);
    expect(draft.kind).toBe("draft");

    // 3. Adoption through the untouched pod-society chokepoints.
    const adopted = await adoptMirrorAtoms({
      fetchFn: demo.fetch,
      base: demo.you.base,
      creator: demo.you.webId,
      deliberation: demo.deliberation,
      atoms: draft.atoms,
      provenance: draft.provenance,
      derivedFrom: utteranceUrl,
      now: () => new Date("2026-07-01T08:01:00Z"),
    });
    const claimUrl = adopted.written.find((w) => w.kind === "claim")?.url;
    expect(claimUrl).toBeDefined();

    // 4. The REAL aggregation sees it — creator-verified, consent-gated.
    const after = await aggregate();
    const claim = after.claims.find((c) => c.id === claimUrl);
    expect(claim).toBeDefined();
    expect(claim?.creator).toBe(demo.you.webId);
    expect(claim?.adoptedBy).toBe(demo.you.webId); // the C6 invariant
    expect(claim?.decomposedBy).toBe(adopted.activity); // assistance never invisible
    expect(claim?.derivedFrom).toBe(utteranceUrl); // traceable to the utterance
    // The drafted need landed too (the Max-Neef coding rode inside it).
    expect(after.needs.length).toBe(before.needs.length + 1);

    // 5. …and the atom lands in the RESONANCE MATRIX (the deck's universe).
    const matrix = buildMatrix(
      after.verified.map((v) => v.webId),
      after.claims.map((c) => c.id),
      after.resonances,
    );
    expect(matrix.statements).toContain(claimUrl);
  });

  it("discard/ignore writes NOTHING — the engine never hears an unadopted draft", async () => {
    const demo = await getDemoDeliberation("society");
    await ensureDemoCircleSeeded(demo);
    const before = await aggregate();

    await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: "I wish the bins weren't out all week.",
      circle: DEMO_CIRCLE.id,
      published: "2026-07-01T08:10:00Z",
    });
    const draft = draftMirror("I wish the bins weren't out all week.");
    expect(draft.kind).toBe("draft");
    // …and the person taps "No, that's not it" (or just walks away): the UI
    // calls nothing. The aggregate is unchanged — no claim, no need, no value.
    const after = await aggregate();
    expect(after.claims.length).toBe(before.claims.length);
    expect(after.needs.length).toBe(before.needs.length);
    expect(after.values.length).toBe(before.values.length);
  });
});

describe("the C4 gate split (03 §2a — fixture row 07 §5)", () => {
  const sensitive = "My disability makes this crossing terrifying.";

  it("the utterance SENDS; the drafted adoption redirects; nothing sensitive is written", async () => {
    const demo = await getDemoDeliberation("society");
    await ensureDemoCircleSeeded(demo);

    // SENDS — no refusal on the person's own speech (asserted in detail in
    // circle-data.test.ts; re-run here so this fixture is self-contained).
    await expect(
      writeCircleMessage(demo.fetch, demo.you.base, {
        author: demo.you.webId,
        content: sensitive,
        circle: DEMO_CIRCLE.id,
        published: "2026-07-01T08:20:00Z",
      }),
    ).resolves.toBeDefined();

    // The drafter pre-screen: nothing survives → the boundary beat, which
    // offers ONLY keep-it-here / reword-it-yourself (no atoms to adopt, no
    // machine reformulation — the corrected 02 §4.1 semantics).
    const draft = draftMirror(sensitive);
    expect(draft.kind).toBe("boundary");
    expect(draft.atoms).toEqual([]);

    // No pod-society write carries sensitive-tripping text.
    const after = await aggregate();
    for (const stmt of [
      ...after.claims.map((c) => c.content),
      ...after.needs.map((n) => n.content),
      ...after.values.map((v) => v.content),
    ]) {
      expect(screenSensitiveDomain(stmt)).toBeNull();
    }
  });

  it("the chokepoint still throws when driven directly — fail-closed regardless of UI", async () => {
    const demo = await getDemoDeliberation("society");
    await expect(
      writeClaim(demo.fetch, demo.you.base, {
        content: sensitive,
        adoptedBy: demo.you.webId,
        creator: demo.you.webId,
        created: "2026-07-01T08:21:00Z",
        inDeliberation: demo.deliberation,
      }),
    ).rejects.toThrow(SensitiveDomainError);
  });

  it("an EDIT that re-introduces sensitive text is refused at the same chokepoint", async () => {
    const demo = await getDemoDeliberation("society");
    const draft = draftMirror("The crossing needs to be safe for everyone.");
    expect(draft.kind).toBe("draft");
    // The person edits the mirror ("close — let me fix it") into a disclosure:
    const edited = draft.atoms.map((a) => (a.kind === "claim" ? { ...a, content: sensitive } : a));
    await expect(
      adoptMirrorAtoms({
        fetchFn: demo.fetch,
        base: demo.you.base,
        creator: demo.you.webId,
        deliberation: demo.deliberation,
        atoms: edited,
        provenance: draft.provenance,
      }),
    ).rejects.toThrow(SensitiveDomainError);
  });
});

describe("the adoption invariant, chat path", () => {
  it("a forged adoption is unwritable (adoptedBy must equal creator)", async () => {
    const demo = await getDemoDeliberation("society");
    await expect(
      writeClaim(demo.fetch, demo.you.base, {
        content: "a claim pinned on someone else",
        adoptedBy: "https://demo.unite.example/people/farah/profile#me",
        creator: demo.you.webId,
        created: "2026-07-01T08:30:00Z",
        inDeliberation: demo.deliberation,
      }),
    ).rejects.toThrow(/adoption invariant/);
  });
});
