// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Pod writes + the fail-closed scope guard. The security property: a target
// outside the pod container is rejected BEFORE any request fires (a fetch spy
// proves no request went out). Slugs are crypto-random, so user input never
// reaches a URL path.

import { describe, expect, it, vi } from "vitest";
import { STANCE_RESONATES } from "./fut.js";
import type { Need, Resonance } from "./model.js";
import { assertWithinBase, listContainer, writeNeed, writeResonance } from "./pod.js";

const BASE = "https://alice.example/unite/d1/";
const DELIB = "https://community.example/deliberations/apps";
const WEBID = "https://alice.example/profile/card#me";
const CONCEPT = "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence";

const needBody: Omit<Need, "id"> = {
  content: "reliable transit",
  needConcept: CONCEPT,
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const resBody: Omit<Resonance, "id"> = {
  onStatement: `${BASE}needs/n1.ttl`,
  stance: STANCE_RESONATES,
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};

// These tests exercise assertWithinBase/isWithinBase as THIN WRAPPERS over
// @jeswr/guarded-fetch's assertWithinPodScope — they cover only the two extra
// protections unite layers on top (https-only base/target + fail-loud
// trailing-slash) and the void→string canonical-return contract. The generic
// same-origin / path-prefix / traversal / credential / encoded-delimiter cases
// are already covered exhaustively by guarded-fetch's own podScope suite and are
// NOT re-ported here (a representative smoke case is kept below for confidence).
describe("assertWithinBase", () => {
  it("accepts a target strictly within the container and returns its canonical URL", () => {
    const scoped = assertWithinBase(BASE, `${BASE}needs/x.ttl`);
    expect(scoped).toBe(`${BASE}needs/x.ttl`);
  });

  it("collapses a traversal-that-stays-in-scope and returns the canonical (resolved) URL", () => {
    // `needs/sub/../x.ttl` collapses to `needs/x.ttl` (in scope) — the RETURNED
    // value is the normalised URL that should be fetched, never the raw input.
    const scoped = assertWithinBase(BASE, `${BASE}needs/sub/../x.ttl`);
    expect(scoped).toBe(`${BASE}needs/x.ttl`);
  });

  // Representative smoke cases delegated to assertWithinPodScope (not the full suite).
  it.each([
    ["parent traversal", "https://alice.example/unite/d1/../secret.ttl"],
    ["encoded traversal", "https://alice.example/unite/d1/%2e%2e/secret.ttl"],
    ["foreign origin", "https://evil.example/unite/d1/needs/x.ttl"],
    ["scheme-relative", "//evil.example/needs/x.ttl"],
    ["sibling-prefix escape", "https://alice.example/unite/d1-evil/x.ttl"],
  ])("throws on %s", (_label, target) => {
    expect(() => assertWithinBase(BASE, target)).toThrow();
  });

  // unite's extra protection #1: https-only (assertWithinPodScope accepts either
  // scheme). A same-origin http downgrade of BOTH base and target must still throw.
  it("throws when the base is not https (no downgrade)", () => {
    expect(() =>
      assertWithinBase(
        "http://alice.example/unite/d1/",
        "http://alice.example/unite/d1/needs/x.ttl",
      ),
    ).toThrow(/base must be https/);
  });

  it("throws when the target downgrades scheme against an https base", () => {
    // Cross-scheme is caught by assertWithinPodScope's same-origin check first
    // (origin includes scheme), so this is refused before the redundant re-check.
    expect(() => assertWithinBase(BASE, "http://alice.example/unite/d1/needs/x.ttl")).toThrow();
  });

  // unite's extra protection #2: fail-loud on a slashless base (guarded-fetch would
  // SILENTLY append the slash instead).
  it("throws loudly when the base is not a container (no trailing slash)", () => {
    expect(() => assertWithinBase("https://alice.example/unite/d1", "https://x")).toThrow(
      /base must be a container ending in/,
    );
  });

  // Regression (roborev finding, security/podscope-consolidation): assertWithinBase
  // is exclusively a WRITE-TARGET guard, so it must pass `allowRoot: false` to
  // assertWithinPodScope. With `allowRoot: true` a TARGET equal to the base minus
  // its trailing slash (e.g. `${BASE}` without the trailing "/") is treated by
  // guarded-fetch as "the pod root" and accepted — silently widening the pod
  // boundary vs. the pre-consolidation guard, which required the target's pathname
  // to literally start with the base's (a shorter, slashless target never can).
  it("rejects the slashless base-form as a write target (regression: allowRoot must be false)", () => {
    const slashlessBase = BASE.slice(0, -1);
    expect(() => assertWithinBase(BASE, slashlessBase)).toThrow();
  });

  // The exact base (WITH its trailing slash) must also be refused as a write
  // target — writeNeed/writeResonance only ever target `<base><dir>/<slug>.ttl`,
  // never the container document itself.
  it("rejects the exact base itself as a write target", () => {
    expect(() => assertWithinBase(BASE, BASE)).toThrow();
  });
});

describe("writeNeed / writeResonance", () => {
  it("PUTs Turtle to <base>needs/<slug>.ttl with create-only headers", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    const { url, resource, response } = await writeNeed(
      fetchSpy as unknown as typeof fetch,
      BASE,
      needBody,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(url);
    expect(url.startsWith(`${BASE}needs/`)).toBe(true);
    expect(url.endsWith(".ttl")).toBe(true);
    expect(init.method).toBe("PUT");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("text/turtle");
    expect(headers["if-none-match"]).toBe("*");
    expect(resource.id).toBe(url);
    expect(resource.creator).toBe(WEBID);
    expect(response.status).toBe(201);
  });

  it("writes a resonance to <base>resonances/<slug>.ttl", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    const { url } = await writeResonance(fetchSpy as unknown as typeof fetch, BASE, resBody);
    expect(url.startsWith(`${BASE}resonances/`)).toBe(true);
  });

  it("assigns a unique slug each write (crypto-random, no collision)", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    const a = await writeNeed(fetchSpy as unknown as typeof fetch, BASE, needBody);
    const b = await writeNeed(fetchSpy as unknown as typeof fetch, BASE, needBody);
    expect(a.url).not.toBe(b.url);
  });

  it("does NOT fetch when the base is not a valid container (guard fires first)", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    await expect(
      writeNeed(fetchSpy as unknown as typeof fetch, "https://alice.example/unite/d1", needBody),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does NOT fetch when the base downgrades scheme (guard fires first)", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    await expect(
      writeNeed(fetchSpy as unknown as typeof fetch, "http://alice.example/unite/d1/", needBody),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates a non-2xx write as an error", async () => {
    const fetchSpy = vi.fn(async () => new Response("nope", { status: 412 }));
    await expect(writeNeed(fetchSpy as unknown as typeof fetch, BASE, needBody)).rejects.toThrow(
      /412/,
    );
  });

  it("inlines the ODRL consent policy (odrl:hasPolicy) when a consent is given", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    const { url } = await writeNeed(fetchSpy as unknown as typeof fetch, BASE, needBody, {
      aggregate: true,
      synthesize: true,
      quoteVerbatim: false,
      governmentUse: false,
      kThreshold: 5,
    });
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = init.body as string;
    // The need + its inline policy ship in ONE Turtle document.
    expect(body).toContain("odrl");
    expect(body).toContain(`${url}#consent`);
    expect(body).toContain("aggregate");
    expect(body).toContain("kThreshold");
  });

  it("omits any policy triples when no consent is given (unchanged default write)", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    await writeNeed(fetchSpy as unknown as typeof fetch, BASE, needBody);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body as string).not.toContain("hasPolicy");
  });
});

describe("listContainer", () => {
  const CONTAINER = `${BASE}needs/`;
  const containerTtl = `
    @prefix ldp: <http://www.w3.org/ns/ldp#> .
    <${CONTAINER}> a ldp:Container, ldp:BasicContainer ;
      ldp:contains <${CONTAINER}n1.ttl>, <${CONTAINER}n2.ttl> .`;

  it("returns the http(s) ldp:contains member IRIs", async () => {
    const fetchFn = (async () =>
      new Response(containerTtl, {
        status: 200,
        headers: { "content-type": "text/turtle" },
      })) as unknown as typeof fetch;
    const members = await listContainer(fetchFn, CONTAINER);
    expect(members.sort()).toEqual([`${CONTAINER}n1.ttl`, `${CONTAINER}n2.ttl`]);
  });

  it("returns [] on a 404 (container not yet created)", async () => {
    const fetchFn = (async () => new Response("gone", { status: 404 })) as unknown as typeof fetch;
    expect(await listContainer(fetchFn, CONTAINER)).toEqual([]);
  });
});
