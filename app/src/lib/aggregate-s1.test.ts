// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S1 aggregation kinds seam (SCOPE-DIFFERENTIATION §5.1): which statement
// kinds are collected is CONFIGURATION — the default stays needs-only (the
// pre-S1 behaviour, byte-identical), scope A's room adds proposals/syntheses/
// critiques, and a kind whose machinery hasn't landed collects nothing —
// an honest no-op, never a crash. The gate/creator/dedupe discipline applies
// to every kind identically.

import { describe, expect, it } from "vitest";
import { aggregateDeliberation, DEFAULT_KINDS, type StatementKind } from "./aggregate.js";
import { consentQuads, DEFAULT_CONSENT, ODRL_NS } from "./consent.js";
import { StubMembershipVerifier } from "./membership.js";
import { buildNeedQuads, buildProposalQuads, serializeTurtle } from "./model.js";
import { StaticRegistry } from "./registry.js";

const DELIB = "https://community.example/d1";
const ALICE = "https://alice.example/profile#me";
const BOB = "https://bob.example/profile#me";
const ALICE_BASE = "https://alice.example/u/d1/";
const BOB_BASE = "https://bob.example/u/d1/";
const CONCEPT = "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence";

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix wf: <http://www.w3.org/2005/01/wf/flow#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix prov: <http://www.w3.org/ns/prov#> .
  @prefix ldp: <http://www.w3.org/ns/ldp#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

const meta = (creator: string, delib = DELIB) => `
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${creator}> ; fut:inDeliberation <${delib}> .`;

function needTtl(url: string, creator: string): string {
  return `${PREFIX} <${url}> a fut:Need ; as:content "n" ; fut:needConcept <${CONCEPT}> ; ${meta(creator)}`;
}
function proposalTtl(url: string, creator: string, delib = DELIB): string {
  return `${PREFIX} <${url}> a fut:AppProposal, wf:Task ; dct:title "p" ; as:content "p" ;
      fut:motivatedBy <${ALICE_BASE}needs/n1.ttl> ; ${meta(creator, delib)}`;
}
function candidateTtl(url: string, creator: string): string {
  return `${PREFIX} <${url}> a fut:SpecSynthesis ; as:content "s" ;
      prov:wasDerivedFrom <${ALICE_BASE}needs/n1.ttl> ; ${meta(creator)}`;
}
function critiqueTtl(url: string, creator: string): string {
  return `${PREFIX} <${url}> a fut:Critique ; as:content "c" ;
      fut:onStatement <${BOB_BASE}syntheses/s1.ttl> ; ${meta(creator)}`;
}
function containerTtl(url: string, members: string[]): string {
  const contains = members.map((m) => `<${m}>`).join(", ");
  return `${PREFIX}
    <${url}> a ldp:Container, ldp:BasicContainer ${members.length ? `; ldp:contains ${contains}` : ""} .`;
}

function podFetch(pod: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = pod[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  }) as unknown as typeof fetch;
}

/** Alice's pod, fully populated with one statement of every S1 kind. */
function alicePod(): Record<string, string> {
  const n1 = `${ALICE_BASE}needs/n1.ttl`;
  const p1 = `${ALICE_BASE}proposals/p1.ttl`;
  const s1 = `${ALICE_BASE}syntheses/s1.ttl`;
  const c1 = `${ALICE_BASE}critiques/c1.ttl`;
  return {
    [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [n1]),
    [n1]: needTtl(n1, ALICE),
    [`${ALICE_BASE}proposals/`]: containerTtl(`${ALICE_BASE}proposals/`, [p1]),
    [p1]: proposalTtl(p1, ALICE),
    [`${ALICE_BASE}syntheses/`]: containerTtl(`${ALICE_BASE}syntheses/`, [s1]),
    [s1]: candidateTtl(s1, ALICE),
    [`${ALICE_BASE}critiques/`]: containerTtl(`${ALICE_BASE}critiques/`, [c1]),
    [c1]: critiqueTtl(c1, ALICE),
    [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
  };
}

const registry = () => new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]);
const run = (pod: Record<string, string>, kinds?: readonly StatementKind[]) =>
  aggregateDeliberation({
    registry: registry(),
    verifier: new StubMembershipVerifier([ALICE]),
    fetch: podFetch(pod),
    ...(kinds ? { kinds } : {}),
  });

describe("aggregation kinds seam (S1)", () => {
  it("DEFAULT collects needs + resonances ONLY — proposals/syntheses/critiques stay empty and unfetched", async () => {
    expect(DEFAULT_KINDS).toEqual(["need"]);
    const pod = alicePod();
    const fetched: string[] = [];
    const spyFetch: typeof fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetched.push(url);
      return podFetch(pod)(input);
    }) as unknown as typeof fetch;
    const result = await aggregateDeliberation({
      registry: registry(),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: spyFetch,
    });
    expect(result.needs).toHaveLength(1);
    expect(result.proposals).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.critiques).toEqual([]);
    // The pre-S1 request surface exactly: no proposals/syntheses/critiques URL touched.
    expect(fetched.some((u) => u.includes("/proposals/"))).toBe(false);
    expect(fetched.some((u) => u.includes("/syntheses/"))).toBe(false);
    expect(fetched.some((u) => u.includes("/critiques/"))).toBe(false);
  });

  it("collects every requested kind (the scope-A room set)", async () => {
    const result = await run(alicePod(), ["need", "app-proposal", "synthesis", "critique"]);
    expect(result.needs).toHaveLength(1);
    expect(result.proposals).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.critiques).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.proposals[0]?.motivatedBy).toEqual([`${ALICE_BASE}needs/n1.ttl`]);
  });

  it("a not-yet-landed kind is an honest no-op (accepted, collects nothing, no error)", async () => {
    const result = await run(alicePod(), ["need", "infra-proposal", "vision", "claim", "value"]);
    expect(result.needs).toHaveLength(1);
    expect(result.proposals).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("cross-pod authorship is verified for the new kinds too (no statement stuffing)", async () => {
    const pod = alicePod();
    const forged = `${ALICE_BASE}proposals/forged.ttl`;
    pod[`${ALICE_BASE}proposals/`] = containerTtl(`${ALICE_BASE}proposals/`, [
      `${ALICE_BASE}proposals/p1.ttl`,
      forged,
    ]);
    pod[forged] = proposalTtl(forged, BOB); // claims BOB authored it, served from ALICE's pod
    const result = await run(pod, ["app-proposal"]);
    expect(result.proposals.map((p) => p.id)).toEqual([`${ALICE_BASE}proposals/p1.ttl`]);
  });

  it("an out-of-deliberation item of a new kind is excluded", async () => {
    const pod = alicePod();
    pod[`${ALICE_BASE}proposals/p1.ttl`] = proposalTtl(
      `${ALICE_BASE}proposals/p1.ttl`,
      ALICE,
      "https://community.example/OTHER",
    );
    const result = await run(pod, ["app-proposal"]);
    expect(result.proposals).toEqual([]);
  });

  it("a broken container of one kind degrades THAT stage alone (fail-isolated)", async () => {
    const pod = alicePod();
    delete pod[`${ALICE_BASE}syntheses/`];
    pod[`${ALICE_BASE}syntheses/`] = "@prefix broken"; // unparseable listing
    const result = await run(pod, ["need", "app-proposal", "synthesis", "critique"]);
    expect(result.needs).toHaveLength(1);
    expect(result.proposals).toHaveLength(1);
    expect(result.critiques).toHaveLength(1);
    expect(result.candidates).toEqual([]);
    expect(result.errors.map((e) => e.stage)).toEqual(["syntheses"]);
  });
});

// ── The synthesize-consent gate (roborev High on ff18a63) ─────────────────────
// The room may only derive a candidate from statements whose author's inline
// ODRL policy PERMITS fut:synthesize. The aggregate computes that set here,
// FAIL-CLOSED: an explicit prohibition OR a missing policy both exclude.
// Docs are produced by the PRODUCTION builders (buildNeedQuads + consentQuads),
// so the gate is tested against exactly what Compose writes.

describe("synthesizable (the fut:synthesize consent gate)", () => {
  const needDoc = async (url: string, consent?: typeof DEFAULT_CONSENT): Promise<string> => {
    const quads = buildNeedQuads({
      id: url,
      content: "n",
      needConcept: CONCEPT,
      created: "2026-07-01T00:00:00.000Z",
      creator: ALICE,
      inDeliberation: DELIB,
    });
    if (consent) quads.push(...consentQuads(url, consent, ALICE));
    return serializeTurtle(quads, consent ? { odrl: ODRL_NS } : undefined);
  };

  it("includes consented, excludes synthesize-prohibited AND policy-less (fail-closed)", async () => {
    const nOk = `${ALICE_BASE}needs/n-ok.ttl`;
    const nDenied = `${ALICE_BASE}needs/n-denied.ttl`;
    const nBare = `${ALICE_BASE}needs/n-bare.ttl`;
    const pOk = `${ALICE_BASE}proposals/p-ok.ttl`;
    const proposalQuads = buildProposalQuads({
      id: pOk,
      title: "p",
      content: "p",
      motivatedBy: [nOk],
      created: "2026-07-01T00:00:00.000Z",
      creator: ALICE,
      inDeliberation: DELIB,
    });
    proposalQuads.push(...consentQuads(pOk, DEFAULT_CONSENT, ALICE));
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [nOk, nDenied, nBare]),
      [nOk]: await needDoc(nOk, DEFAULT_CONSENT),
      [nDenied]: await needDoc(nDenied, { ...DEFAULT_CONSENT, synthesize: false }),
      [nBare]: await needDoc(nBare), // NO policy at all → fail-closed excluded
      [`${ALICE_BASE}proposals/`]: containerTtl(`${ALICE_BASE}proposals/`, [pOk]),
      [pOk]: await serializeTurtle(proposalQuads, { odrl: ODRL_NS }),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await run(pod, ["need", "app-proposal"]);
    // Collection is NOT consent-gated (consent governs DERIVATION, not reading):
    expect(result.needs).toHaveLength(3);
    expect(result.proposals).toHaveLength(1);
    // …but the derivable set is, fail-closed:
    expect([...result.synthesizable].sort()).toEqual([nOk, pOk].sort());
  });

  it("is empty for the default needs-only aggregation over policy-less docs", async () => {
    const result = await run(alicePod()); // fixture docs carry no ODRL policy
    expect(result.synthesizable.size).toBe(0);
  });
});
