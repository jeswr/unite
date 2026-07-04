// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S4 aggregation of the scope-C expression kinds (SCOPE-DIFFERENTIATION
// §4.2 + §5.1): visions/claims/values collect under the SAME fail-closed
// discipline as every kind — creator-owns-the-pod, in-deliberation match,
// per-member failure isolation — and, being EXPRESSION statements, feed the
// consent-gated `synthesizable` set so a scope-C candidate's lineage is
// checked identically to S1's (the pattern this extends). The claim adoption
// invariant holds cross-pod: a foreign pod cannot smuggle in an unadopted or
// forged-adoption claim.

import { describe, expect, it } from "vitest";
import { aggregateDeliberation, type StatementKind } from "./aggregate.js";
import { StubMembershipVerifier } from "./membership.js";
import { StaticRegistry } from "./registry.js";

const DELIB = "https://community.example/soc";
const ALICE = "https://alice.example/profile#me";
const MALLORY = "https://mallory.example/profile#me";
const ALICE_BASE = "https://alice.example/u/soc/";

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix prov: <http://www.w3.org/ns/prov#> .
  @prefix ldp: <http://www.w3.org/ns/ldp#> .
  @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

const meta = (creator: string) => `
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${creator}> ; fut:inDeliberation <${DELIB}> .`;

function synthesizeConsentTtl(url: string): string {
  return `
    <${url}> odrl:hasPolicy <${url}#consent> .
    <${url}#consent> a odrl:Set ; odrl:permission <${url}#c-syn> .
    <${url}#c-syn> a odrl:Permission ; odrl:action fut:synthesize ; odrl:target <${url}> .`;
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

const V1 = `${ALICE_BASE}visions/v1.ttl`;
const C1 = `${ALICE_BASE}claims/c1.ttl`;
const C_FORGED = `${ALICE_BASE}claims/c-forged.ttl`;
const W1 = `${ALICE_BASE}values/w1.ttl`;
const S1 = `${ALICE_BASE}syntheses/s1.ttl`;

function alicePod(): Record<string, string> {
  return {
    [`${ALICE_BASE}visions/`]: containerTtl(`${ALICE_BASE}visions/`, [V1]),
    [V1]: `${PREFIX} <${V1}> a fut:VisionStatement ; as:content "v" ; ${meta(ALICE)}${synthesizeConsentTtl(V1)}`,
    [`${ALICE_BASE}claims/`]: containerTtl(`${ALICE_BASE}claims/`, [C1, C_FORGED]),
    [C1]: `${PREFIX} <${C1}> a fut:Claim ; as:content "c" ; fut:adoptedBy <${ALICE}> ;
        prov:wasDerivedFrom <${V1}> ; ${meta(ALICE)}${synthesizeConsentTtl(C1)}`,
    // Adoption forged to someone else — must NOT aggregate (dropped in parse).
    [C_FORGED]: `${PREFIX} <${C_FORGED}> a fut:Claim ; as:content "forged" ;
        fut:adoptedBy <${MALLORY}> ; ${meta(ALICE)}`,
    [`${ALICE_BASE}values/`]: containerTtl(`${ALICE_BASE}values/`, [W1]),
    // W1 carries NO consent policy → collected but NOT synthesizable.
    [W1]: `${PREFIX} <${W1}> a fut:ValueStatement ; as:content "w" ;
        fut:valueConcept <https://w3id.org/jeswr/sectors/futures#schwartz-universalism> ; ${meta(ALICE)}`,
    [`${ALICE_BASE}syntheses/`]: containerTtl(`${ALICE_BASE}syntheses/`, [S1]),
    // A scope-C candidate deriving from the consented claim — must clear the gate.
    [S1]: `${PREFIX} <${S1}> a fut:SpecSynthesis ; as:content "s" ;
        prov:wasDerivedFrom <${C1}> ; ${meta(ALICE)}`,
    [`${ALICE_BASE}critiques/`]: containerTtl(`${ALICE_BASE}critiques/`, []),
    [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, []),
  };
}

const C_KINDS: readonly StatementKind[] = [
  "need",
  "vision",
  "claim",
  "value",
  "synthesis",
  "critique",
];

const run = (pod: Record<string, string>, kinds: readonly StatementKind[] = C_KINDS) =>
  aggregateDeliberation({
    registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
    verifier: new StubMembershipVerifier([ALICE]),
    fetch: podFetch(pod),
    kinds,
  });

describe("scope-C expression-kind aggregation (S4)", () => {
  it("collects visions, claims and values; the forged-adoption claim never enters", async () => {
    const result = await run(alicePod());
    expect(result.visions.map((v) => v.id)).toEqual([V1]);
    expect(result.claims.map((c) => c.id)).toEqual([C1]); // C_FORGED dropped
    expect(result.values.map((w) => w.id)).toEqual([W1]);
    expect(result.errors).toEqual([]);
  });

  it("consented expression statements enter `synthesizable`; unconsented do not (fail-closed)", async () => {
    const result = await run(alicePod());
    expect(result.synthesizable.has(V1)).toBe(true);
    expect(result.synthesizable.has(C1)).toBe(true);
    expect(result.synthesizable.has(W1)).toBe(false); // no policy → no synthesize
  });

  it("a candidate deriving from a CONSENTED claim clears the lineage gate", async () => {
    const result = await run(alicePod());
    expect(result.candidates.map((c) => c.id)).toEqual([S1]);
  });

  it("a candidate deriving from the UNCONSENTED value is excluded, with a recorded error", async () => {
    const pod = alicePod();
    pod[S1] = `${PREFIX} <${S1}> a fut:SpecSynthesis ; as:content "s" ;
        prov:wasDerivedFrom <${W1}> ; ${meta(ALICE)}`;
    const result = await run(pod);
    expect(result.candidates).toEqual([]);
    expect(result.errors.some((e) => e.stage === "syntheses" && e.resource === S1)).toBe(true);
  });

  it("a claim attributed to the pod owner but for another deliberation is dropped", async () => {
    const pod = alicePod();
    pod[C1] = `${PREFIX} <${C1}> a fut:Claim ; as:content "c" ; fut:adoptedBy <${ALICE}> ;
        dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
        dct:creator <${ALICE}> ; fut:inDeliberation <https://other.example/d> .`;
    const result = await run(pod);
    expect(result.claims).toEqual([]);
  });

  it("a pod cannot attribute a claim to someone else (creator-owns-the-pod gate)", async () => {
    const pod = alicePod();
    pod[C1] = `${PREFIX} <${C1}> a fut:Claim ; as:content "c" ; fut:adoptedBy <${MALLORY}> ;
        dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
        dct:creator <${MALLORY}> ; fut:inDeliberation <${DELIB}> .`;
    const result = await run(pod);
    // Well-formed AND self-consistently adopted — but Mallory's statement in
    // ALICE's pod: the creator gate drops it.
    expect(result.claims).toEqual([]);
  });

  it("one broken member is isolated: siblings + other kinds still aggregate", async () => {
    const pod = alicePod();
    pod[C1] = "@prefix broken"; // unparseable claim resource
    const result = await run(pod);
    expect(result.visions).toHaveLength(1);
    expect(result.values).toHaveLength(1);
    expect(result.errors.some((e) => e.stage === "claims" && e.resource === C1)).toBe(true);
  });

  it("without the scope-C kinds nothing is fetched from their containers (byte-identical A/B behaviour)", async () => {
    const touched: string[] = [];
    const pod = alicePod();
    const trackingFetch: typeof fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      touched.push(url);
      const body = pod[url];
      if (body === undefined) return new Response("not found", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
    }) as unknown as typeof fetch;
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: trackingFetch,
      kinds: ["need"],
    });
    expect(result.visions).toEqual([]);
    expect(result.claims).toEqual([]);
    expect(result.values).toEqual([]);
    expect(
      touched.some(
        (u) => u.includes("/visions/") || u.includes("/claims/") || u.includes("/values/"),
      ),
    ).toBe(false);
  });
});
