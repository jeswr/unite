// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S4 pod writes (SCOPE-DIFFERENTIATION §4.3): writeVision / writeClaim /
// writeValueStatement. Same fail-closed discipline as every unite write — the
// scope guard fires BEFORE any request, slugs are crypto-random, create-only
// PUT — plus the two scope-C chokepoint guards: the C4 sensitive-domain
// screen REFUSES personal health/finance disclosure before serialisation, and
// the adoption invariant makes an unadopted claim unwritable.

import { describe, expect, it, vi } from "vitest";
import type { Critique, Need, SynthesisCandidate } from "./model.js";
import type { Claim, ValueStatement, VisionStatement } from "./model-society.js";
import {
  writeClaim,
  writeSocietyCandidate,
  writeSocietyCritique,
  writeSocietyNeed,
  writeValueStatement,
  writeVision,
} from "./pod-society.js";
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
const needBody: Omit<Need, "id"> = {
  content: "A safe crossing on the high street near the school.",
  needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-protection",
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

// ── The C4 gate at the Room's write boundary (scope C) ───────────────────────

const candidateBody: Omit<SynthesisCandidate, "id"> = {
  title: "The spine",
  content: "One text carrying both groups.",
  derivedFrom: ["https://a.example/needs/a.ttl"],
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const critiqueBody: Omit<Critique, "id"> = {
  content: "This candidate underweights rural voices.",
  onStatement: "https://h.example/syntheses/s1.ttl",
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};

describe("writeSocietyCandidate / writeSocietyCritique (the Room's C4 write boundary)", () => {
  it("REFUSES sensitive candidate content before any request", async () => {
    const fetchSpy = spy201();
    await expect(
      writeSocietyCandidate(fetchSpy as unknown as typeof fetch, BASE, {
        ...candidateBody,
        content: "Since my diagnosis this synthesis must cover clinic access.",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("REFUSES a sensitive candidate TITLE too (the screen covers title + content)", async () => {
    const fetchSpy = spy201();
    await expect(
      writeSocietyCandidate(fetchSpy as unknown as typeof fetch, BASE, {
        ...candidateBody,
        title: "my medication schedule",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("REFUSES sensitive critique text (dissent may publish verbatim under quoteVerbatim)", async () => {
    const fetchSpy = spy201();
    await expect(
      writeSocietyCritique(fetchSpy as unknown as typeof fetch, BASE, {
        ...critiqueBody,
        content: "Since my diagnosis this candidate ignores people like me.",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delegates CLEAN writes to the shared Room primitives (create-only PUT)", async () => {
    const candSpy = spy201();
    const { url: candUrl } = await writeSocietyCandidate(
      candSpy as unknown as typeof fetch,
      BASE,
      candidateBody,
    );
    expect(candUrl.startsWith(`${BASE}syntheses/`)).toBe(true);
    const [, candInit] = candSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((candInit.headers as Record<string, string>)["if-none-match"]).toBe("*");

    const critSpy = spy201();
    const { url: critUrl } = await writeSocietyCritique(
      critSpy as unknown as typeof fetch,
      BASE,
      critiqueBody,
    );
    expect(critUrl.startsWith(`${BASE}critiques/`)).toBe(true);
    const [, critInit] = critSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((critInit.headers as Record<string, string>)["if-none-match"]).toBe("*");
  });

  it("a society critique MAY carry its inline ODRL consent policy through", async () => {
    const fetchSpy = spy201();
    const { url } = await writeSocietyCritique(
      fetchSpy as unknown as typeof fetch,
      BASE,
      critiqueBody,
      CONSENT,
    );
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain(`${url}#consent`);
    expect(body).toContain("odrl");
  });
});

describe("writeSocietyNeed (the C4 write boundary for scope-C needs)", () => {
  it("REFUSES sensitive need content before any request (screened at the chokepoint, not just the UI)", async () => {
    const fetchSpy = spy201();
    await expect(
      writeSocietyNeed(fetchSpy as unknown as typeof fetch, BASE, {
        ...needBody,
        content: "Since my diagnosis I need a pharmacy within walking distance.",
      }),
    ).rejects.toThrowError(SensitiveDomainError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delegates a CLEAN need to the shared writeNeed (create-only PUT under needs/)", async () => {
    const fetchSpy = spy201();
    const { url } = await writeSocietyNeed(fetchSpy as unknown as typeof fetch, BASE, needBody);
    expect(url.startsWith(`${BASE}needs/`)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["if-none-match"]).toBe("*");
  });

  it("a clean society need MAY carry its inline ODRL consent policy through", async () => {
    const fetchSpy = spy201();
    const { url } = await writeSocietyNeed(
      fetchSpy as unknown as typeof fetch,
      BASE,
      needBody,
      CONSENT,
    );
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain(`${url}#consent`);
    expect(body).toContain("odrl");
  });
});
