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

describe("assertWithinBase", () => {
  it("accepts a target strictly within the container", () => {
    expect(() => assertWithinBase(BASE, `${BASE}needs/x.ttl`)).not.toThrow();
  });

  it.each([
    ["parent traversal", "https://alice.example/unite/d1/../secret.ttl"],
    ["encoded traversal", "https://alice.example/unite/d1/%2e%2e/secret.ttl"],
    ["foreign origin", "https://evil.example/unite/d1/needs/x.ttl"],
    ["scheme downgrade", "http://alice.example/unite/d1/needs/x.ttl"],
    ["scheme-relative", "//evil.example/needs/x.ttl"],
    ["sibling-prefix escape", "https://alice.example/unite/d1-evil/x.ttl"],
  ])("throws on %s", (_label, target) => {
    expect(() => assertWithinBase(BASE, target)).toThrow();
  });

  it("throws when the base is not a container (no trailing slash)", () => {
    expect(() => assertWithinBase("https://alice.example/unite/d1", "https://x")).toThrow();
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
