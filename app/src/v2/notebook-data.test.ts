// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The notebook's data layer + the DELETION-RECOMPUTE fixture (design/v2
// 07 §3 V2 acceptance): removal deletes the pod resource, and the next
// aggregate simply no longer contains it — propagation is architectural.

import { beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../demo/pods.js";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { DEFAULT_CONSENT } from "../lib/consent.js";
import { draftMirror } from "../lib/mirror-draft.js";
import { writeClaim } from "../lib/pod-society.js";
import { buildRegistry, deliberationTrust, demoConfig } from "../ui/state.js";
import { adoptMirrorAtoms } from "./adopt.js";
import { deleteOwnResource, isQuotable, readOwnStatements } from "./notebook-data.js";

async function aggregateClaims() {
  const config = demoConfig("society");
  const { gate } = await deliberationTrust(config);
  const demo = await getDemoDeliberation("society");
  const result = await aggregateDeliberation({
    registry: buildRegistry(config),
    verifier: gate,
    fetch: demo.fetch,
    kinds: ["need", "claim", "value"],
  });
  return result.claims;
}

beforeEach(() => {
  resetDemoInstances();
});

describe("readOwnStatements", () => {
  it("lists exactly what the person's own pod holds", async () => {
    const demo = await getDemoDeliberation("society");
    const before = await readOwnStatements(demo.fetch, demo.you.base);
    expect(before.claims).toEqual([]); // "you" starts having adopted nothing

    const draft = draftMirror("I want the crossing fixed before winter.");
    await adoptMirrorAtoms({
      fetchFn: demo.fetch,
      base: demo.you.base,
      creator: demo.you.webId,
      deliberation: demo.deliberation,
      atoms: draft.atoms,
      provenance: draft.provenance,
    });

    const after = await readOwnStatements(demo.fetch, demo.you.base);
    expect(after.claims).toHaveLength(1);
    expect(after.claims[0]?.content).toBe("I want the crossing fixed before winter.");
    expect(after.needs.length).toBeGreaterThanOrEqual(1); // the coded need rode along
  });
});

describe("deletion recompute (03 §7 — the V2 fixture row)", () => {
  it("deleting the pod resource removes it from the NEXT aggregate read", async () => {
    const demo = await getDemoDeliberation("society");
    const draft = draftMirror("I want the crossing fixed before winter.");
    const adopted = await adoptMirrorAtoms({
      fetchFn: demo.fetch,
      base: demo.you.base,
      creator: demo.you.webId,
      deliberation: demo.deliberation,
      atoms: draft.atoms.filter((a) => a.kind === "claim"),
      provenance: draft.provenance,
    });
    const claimUrl = adopted.written[0]?.url;
    if (claimUrl === undefined) throw new Error("nothing written");

    expect((await aggregateClaims()).some((c) => c.id === claimUrl)).toBe(true);

    await deleteOwnResource(demo.fetch, demo.you.base, claimUrl);

    // No tombstone machinery, no compliance workflow: the resource is gone,
    // so the recompute-on-read aggregate no longer contains it.
    expect((await aggregateClaims()).some((c) => c.id === claimUrl)).toBe(false);
    expect((await readOwnStatements(demo.fetch, demo.you.base)).claims).toEqual([]);
  });

  it("refuses to delete outside the person's own base (fail-closed)", async () => {
    const demo = await getDemoDeliberation("society");
    await expect(
      deleteOwnResource(
        demo.fetch,
        demo.you.base,
        "https://demo.unite.example/pods/farah/unite/society/claims/safe-crossing.ttl",
      ),
    ).rejects.toThrow();
  });
});

describe("isQuotable (the letter's consent gate)", () => {
  it("is FAIL-CLOSED: the conservative default consent is not quotable", async () => {
    const demo = await getDemoDeliberation("society");
    const claims = await aggregateClaims();
    const seeded = claims[0];
    if (seeded === undefined) throw new Error("no seeded claims");
    // Seeded statements carry DEFAULT_CONSENT (quoteVerbatim: false).
    expect(await isQuotable(demo.fetch, seeded.id)).toBe(false);
    // A missing resource is not quotable either.
    expect(await isQuotable(demo.fetch, `${demo.you.base}claims/nope.ttl`)).toBe(false);
  });

  it("answers true only under an explicit quoteVerbatim permission", async () => {
    const demo = await getDemoDeliberation("society");
    const { url } = await writeClaim(
      demo.fetch,
      demo.you.base,
      {
        content: "Quote me on this one.",
        adoptedBy: demo.you.webId,
        creator: demo.you.webId,
        created: "2026-07-01T10:00:00Z",
        inDeliberation: demo.deliberation,
      },
      { ...DEFAULT_CONSENT, quoteVerbatim: true },
    );
    expect(await isQuotable(demo.fetch, url)).toBe(true);
  });
});
