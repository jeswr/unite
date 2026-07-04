// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S4 pod writes (SCOPE-DIFFERENTIATION §4.3): writeVision / writeClaim /
// writeValueStatement. Same fail-closed discipline as every unite write — the
// scope guard fires BEFORE any request, slugs are crypto-random, create-only
// PUT — plus the two scope-C chokepoint guards: the C4 sensitive-domain
// screen REFUSES personal health/finance disclosure before serialisation, and
// the adoption invariant makes an unadopted claim unwritable.

import { describe, expect, it, vi } from "vitest";
import type { Claim, ValueStatement, VisionStatement } from "./model-society.js";
import { writeClaim, writeValueStatement, writeVision } from "./pod-society.js";
import { SensitiveDomainError } from "./sensitive.js";

const BASE = "https://alice.example/unite/soc/";
const DELIB = "https://community.example/deliberations/society";
const WEBID = "https://alice.example/profile/card#me";
const OTHER = "https://mallory.example/profile/card#me";

const visionBody: Omit<VisionStatement, "id"> = {
  title: "Streets my kids can cross",
  content: "I want my children to reach school on foot, safely.",
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const claimBody: Omit<Claim, "id"> = {
  content: "Every child should be able to cross the high street safely.",
  adoptedBy: WEBID,
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const valueBody: Omit<ValueStatement, "id"> = {
  content: "Judge streets by their most vulnerable user.",
  valueConcept: "https://w3id.org/jeswr/sectors/futures#schwartz-universalism",
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};

const CONSENT = {
  aggregate: true,
  synthesize: true,
  quoteVerbatim: false,
  governmentUse: false,
  kThreshold: 5,
} as const;

function spy201() {
  return vi.fn(async () => new Response(null, { status: 201 }));
}

describe("writeVision / writeClaim / writeValueStatement", () => {
  it.each([
    ["visions", (f: typeof fetch) => writeVision(f, BASE, visionBody)],
    ["claims", (f: typeof fetch) => writeClaim(f, BASE, claimBody)],
    ["values", (f: typeof fetch) => writeValueStatement(f, BASE, valueBody)],
  ] as const)("PUTs Turtle to <base>%s/<slug>.ttl with create-only headers", async (dir, write) => {
    const fetchSpy = spy201();
    const { url, resource, response } = await write(fetchSpy as unknown as typeof fetch);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(url);
    expect(url.startsWith(`${BASE}${dir}/`)).toBe(true);
    expect(url.endsWith(".ttl")).toBe(true);
    expect(init.method).toBe("PUT");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("text/turtle");
    expect(headers["if-none-match"]).toBe("*");
    expect(resource.id).toBe(url);
    expect(response.status).toBe(201);
  });

  it.each([
    ["writeVision", (f: typeof fetch, b: string) => writeVision(f, b, visionBody)],
    ["writeClaim", (f: typeof fetch, b: string) => writeClaim(f, b, claimBody)],
    ["writeValueStatement", (f: typeof fetch, b: string) => writeValueStatement(f, b, valueBody)],
  ] as const)("%s: the scope guard fires BEFORE any request", async (_name, write) => {
    const fetchSpy = spy201();
    await expect(
      write(fetchSpy as unknown as typeof fetch, "http://alice.example/unite/soc/"),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the C4 screen REFUSES personal health disclosure before any request", async () => {
    const fetchSpy = spy201();
    await expect(
      writeVision(fetchSpy as unknown as typeof fetch, BASE, {
        ...visionBody,
        content: "Since my diagnosis I want a bus stop closer to home.",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the C4 screen covers a vision's TITLE, claims, and values too", async () => {
    const fetchSpy = spy201();
    await expect(
      writeVision(fetchSpy as unknown as typeof fetch, BASE, {
        ...visionBody,
        title: "my medication schedule",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    await expect(
      writeClaim(fetchSpy as unknown as typeof fetch, BASE, {
        ...claimBody,
        content: "my salary should be higher",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    await expect(
      writeValueStatement(fetchSpy as unknown as typeof fetch, BASE, {
        ...valueBody,
        content: "my debt defines my politics",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("an UNADOPTED claim is unwritable (the C6 invariant at the chokepoint)", async () => {
    const fetchSpy = spy201();
    await expect(
      writeClaim(fetchSpy as unknown as typeof fetch, BASE, { ...claimBody, adoptedBy: OTHER }),
    ).rejects.toThrow(/adoption invariant/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("expression-layer resources MAY inline an ODRL consent policy", async () => {
    for (const write of [
      (f: typeof fetch) => writeVision(f, BASE, visionBody, CONSENT),
      (f: typeof fetch) => writeClaim(f, BASE, claimBody, CONSENT),
      (f: typeof fetch) => writeValueStatement(f, BASE, valueBody, CONSENT),
    ]) {
      const fetchSpy = spy201();
      const { url } = await write(fetchSpy as unknown as typeof fetch);
      const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      const body = init.body as string;
      expect(body).toContain(`${url}#consent`);
      expect(body).toContain("odrl");
    }
  });

  it("propagates a non-2xx write as an error (412 create-only conflict)", async () => {
    const fetchSpy = vi.fn(async () => new Response("nope", { status: 412 }));
    await expect(
      writeVision(fetchSpy as unknown as typeof fetch, BASE, visionBody),
    ).rejects.toThrow(/412/);
  });
});
