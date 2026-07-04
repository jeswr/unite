// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The demo deliberation must be REAL end-to-end: the seeded in-memory pods are
// read through the PRODUCTION pipeline (listContainer → parseNeeds/-Resonances →
// membership gate → dedupe → rankNeeds), and the demo write path goes through
// the PRODUCTION writeNeed/writeResonance (If-None-Match create, scope guard).
// If any of this were faked, these tests would fail.

import { parseRdf } from "@jeswr/fetch-rdf";
import { beforeEach, describe, expect, it } from "vitest";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { DEFAULT_CONSENT, parseConsent } from "../lib/consent.js";
import { STANCE_RESONATES } from "../lib/fut.js";
import { StubMembershipVerifier } from "../lib/membership.js";
import { writeNeed, writeResonance } from "../lib/pod.js";
import { rankNeeds } from "../lib/ranking.js";
import { StaticRegistry } from "../lib/registry.js";
import { DEMO_CANDIDATES, DEMO_NEEDS, DEMO_PEOPLE, DEMO_PROPOSALS, demoWebId } from "./fixtures.js";
import {
  demoForDeliberation,
  getDemoDeliberation,
  isDemoDeliberation,
  resetDemoInstances,
} from "./pods.js";

async function aggregate(scope: "apps" | "infrastructure" | "society") {
  const demo = await getDemoDeliberation(scope);
  const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
  const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
  return {
    demo,
    result: await aggregateDeliberation({ registry, verifier, fetch: demo.fetch }),
  };
}

beforeEach(() => {
  resetDemoInstances();
});

describe("the seeded demo deliberation through the REAL aggregation pipeline", () => {
  it("aggregates every seeded need + resonance, all participants verified, no errors", async () => {
    const { result } = await aggregate("apps");
    expect(result.needs).toHaveLength(DEMO_NEEDS.apps.length);
    // Votes are seeded on needs AND on the S1 artifacts (proposals + room
    // candidates) — all land in the same resonances/ containers.
    const countVotes = (specs: readonly { votes: Readonly<Record<string, unknown>> }[]) =>
      specs.reduce((n, s) => n + Object.keys(s.votes).length, 0);
    const expectedVotes =
      countVotes(DEMO_NEEDS.apps) +
      countVotes(DEMO_PROPOSALS.apps) +
      countVotes(DEMO_CANDIDATES.apps);
    expect(result.resonances).toHaveLength(expectedVotes); // dedupe keeps all (one vote per person/statement seeded)
    expect(result.verified).toHaveLength(DEMO_PEOPLE.length);
    expect(result.unverified).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("each scope has its own seeded deliberation", async () => {
    for (const scope of ["apps", "infrastructure", "society"] as const) {
      const { result, demo } = await aggregate(scope);
      expect(result.needs.length).toBe(DEMO_NEEDS[scope].length);
      expect(result.needs.every((n) => n.inDeliberation === demo.deliberation)).toBe(true);
    }
  });

  it("seeded needs carry a parseable ODRL consent policy (the Compose shape)", async () => {
    const demo = await getDemoDeliberation("apps");
    const first = DEMO_NEEDS.apps[0];
    if (!first) throw new Error("no fixtures");
    const url = `${demo.participants.find((p) => p.webId === demoWebId(first.author))?.base}needs/${first.slug}.ttl`;
    const res = await demo.fetch(url);
    expect(res.status).toBe(200);
    const ds = await parseRdf(await res.text(), "text/turtle", { baseIRI: url });
    expect(parseConsent(ds, url)).toEqual(DEFAULT_CONSENT);
  });

  it("the bridging ranking is meaningful: consensus outranks divisive", async () => {
    const { result } = await aggregate("apps");
    const ranking = rankNeeds(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
    );
    const rankOf = (slugPart: string) =>
      ranking.ranked.find((r) => r.statement.includes(slugPart))?.rank ?? Number.NaN;
    // The cross-cluster consensus statements must beat the cluster-split ones.
    expect(rankOf("offline-first")).toBeLessThan(rankOf("network-lockdown"));
    expect(rankOf("one-login")).toBeLessThan(rankOf("forever-session"));
    expect(ranking.clustering.k).toBe(2);
  });

  it("demo writes go through the REAL write path and appear in the next aggregate", async () => {
    const demo = await getDemoDeliberation("apps");
    const { url } = await writeNeed(demo.fetch, demo.you.base, {
      content: "A new demo need composed at runtime.",
      needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-creation",
      created: new Date().toISOString(),
      creator: demo.you.webId,
      inDeliberation: demo.deliberation,
    });
    await writeResonance(demo.fetch, demo.you.base, {
      onStatement: url,
      stance: STANCE_RESONATES,
      created: new Date().toISOString(),
      creator: demo.you.webId,
      inDeliberation: demo.deliberation,
    });
    const { result } = await aggregate("apps");
    const mine = result.needs.find((n) => n.id === url);
    expect(mine?.content).toBe("A new demo need composed at runtime.");
    expect(result.resonances.some((r) => r.onStatement === url)).toBe(true);
  });

  it("the pod fetch honours If-None-Match:* (create-only) and never leaves the sandbox", async () => {
    const demo = await getDemoDeliberation("apps");
    const url = `${demo.you.base}needs/clash.ttl`;
    const put = (body: string) =>
      demo.fetch(url, {
        method: "PUT",
        headers: { "content-type": "text/turtle", "if-none-match": "*" },
        body,
      });
    expect((await put("<a> <b> <c> .")).status).toBe(201);
    expect((await put("<a> <b> <d> .")).status).toBe(412);
  });

  it("refuses ANY out-of-sandbox origin — reads AND writes (403, never network)", async () => {
    const demo = await getDemoDeliberation("apps");
    expect((await demo.fetch("https://example.org/elsewhere")).status).toBe(403);
    // A hostile PUT cannot smuggle a foreign-origin resource into the store…
    const put = await demo.fetch("https://example.org/elsewhere", {
      method: "PUT",
      headers: { "content-type": "text/turtle" },
      body: "<a> <b> <c> .",
    });
    expect(put.status).toBe(403);
    // …so it can never be served back either.
    expect((await demo.fetch("https://example.org/elsewhere")).status).toBe(403);
  });
});

describe("demo IRI helpers", () => {
  it("recognises demo deliberations and resolves their scope", async () => {
    const demo = await getDemoDeliberation("society");
    expect(isDemoDeliberation(demo.deliberation)).toBe(true);
    expect(isDemoDeliberation("https://community.example/deliberations/x")).toBe(false);
    const resolved = await demoForDeliberation(demo.deliberation);
    expect(resolved?.scope).toBe("society");
    expect(demoForDeliberation("https://community.example/d")).toBeNull();
  });
});
