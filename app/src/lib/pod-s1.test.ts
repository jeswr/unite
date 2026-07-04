// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S1 pod writes (SCOPE-DIFFERENTIATION §2): writeProposal / writeCandidate /
// writeCritique. Same fail-closed discipline as writeNeed — the scope guard
// fires BEFORE any request, slugs are crypto-random, create-only PUT — plus
// the consent rules: proposals/critiques are expression-layer (MAY carry an
// inline ODRL policy); a candidate is a derived process-layer artifact
// (no policy of its own).

import { describe, expect, it, vi } from "vitest";
import type { AppProposal, Critique, SynthesisCandidate } from "./model.js";
import { writeCandidate, writeCritique, writeProposal } from "./pod.js";

const BASE = "https://alice.example/unite/d1/";
const DELIB = "https://community.example/deliberations/apps";
const WEBID = "https://alice.example/profile/card#me";
const NEED = "https://bob.example/unite/d1/needs/n1.ttl";

const proposalBody: Omit<AppProposal, "id"> = {
  title: "Offline-first notes",
  content: "Notes that survive a train tunnel.",
  motivatedBy: [NEED],
  created: "2026-07-01T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const candidateBody: Omit<SynthesisCandidate, "id"> = {
  content: "The common spine across both clusters.",
  derivedFrom: [NEED],
  created: "2026-07-02T00:00:00.000Z",
  creator: WEBID,
  inDeliberation: DELIB,
};
const critiqueBody: Omit<Critique, "id"> = {
  content: "This drops the lockdown need.",
  onStatement: "https://drafter.example/u/syntheses/s1.ttl",
  created: "2026-07-03T00:00:00.000Z",
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

describe("writeProposal / writeCandidate / writeCritique", () => {
  it.each([
    ["proposals", (f: typeof fetch) => writeProposal(f, BASE, proposalBody)],
    ["syntheses", (f: typeof fetch) => writeCandidate(f, BASE, candidateBody)],
    ["critiques", (f: typeof fetch) => writeCritique(f, BASE, critiqueBody)],
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
    ["writeProposal", (f: typeof fetch, b: string) => writeProposal(f, b, proposalBody)],
    ["writeCandidate", (f: typeof fetch, b: string) => writeCandidate(f, b, candidateBody)],
    ["writeCritique", (f: typeof fetch, b: string) => writeCritique(f, b, critiqueBody)],
  ] as const)("%s: the scope guard fires BEFORE any request", async (_name, write) => {
    const fetchSpy = spy201();
    await expect(
      write(fetchSpy as unknown as typeof fetch, "http://alice.example/unite/d1/"),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("REFUSES an invalid proposal before any request (no needs trace)", async () => {
    const fetchSpy = spy201();
    await expect(
      writeProposal(fetchSpy as unknown as typeof fetch, BASE, {
        ...proposalBody,
        motivatedBy: [],
      }),
    ).rejects.toThrow(/≥1 need/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("proposal/critique MAY inline an ODRL consent policy", async () => {
    for (const write of [
      (f: typeof fetch) => writeProposal(f, BASE, proposalBody, CONSENT),
      (f: typeof fetch) => writeCritique(f, BASE, critiqueBody, CONSENT),
    ]) {
      const fetchSpy = spy201();
      const { url } = await write(fetchSpy as unknown as typeof fetch);
      const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      const body = init.body as string;
      expect(body).toContain(`${url}#consent`);
      expect(body).toContain("odrl");
    }
  });

  it("a candidate NEVER carries a policy of its own (derived artifact)", async () => {
    const fetchSpy = spy201();
    await writeCandidate(fetchSpy as unknown as typeof fetch, BASE, candidateBody);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body as string).not.toContain("hasPolicy");
  });

  it("propagates a non-2xx write as an error (412 create-only conflict)", async () => {
    const fetchSpy = vi.fn(async () => new Response("nope", { status: 412 }));
    await expect(
      writeProposal(fetchSpy as unknown as typeof fetch, BASE, proposalBody),
    ).rejects.toThrow(/412/);
  });
});
