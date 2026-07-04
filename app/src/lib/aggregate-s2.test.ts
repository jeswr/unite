// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S2 aggregation extension: the "infra-proposal" kind collects
// fut:InfraProposal statements through the SAME creator-verified,
// deliberation-scoped, fail-isolated pipeline as every other kind — and,
// security-critically, through the SAME fail-closed fut:synthesize consent
// hook: an infra proposal enters the synthesizable set ONLY when its author's
// inline ODRL policy permits synthesis, and a Convergence-Room candidate whose
// lineage includes a non-consented (or uncollected) infra proposal is EXCLUDED
// in aggregation (a pod-authored candidate cannot bypass the gate).

import { describe, expect, it } from "vitest";
import { aggregateDeliberation, type StatementKind } from "./aggregate.js";
import { StubMembershipVerifier } from "./membership.js";
import { StaticRegistry } from "./registry.js";

const DELIB = "https://community.example/infra-d1";
const ALICE = "https://alice.example/profile#me";
const BOB = "https://bob.example/profile#me";
const ALICE_BASE = "https://alice.example/u/infra/";
const CONCEPT = "https://w3id.org/jeswr/sectors/futures#maxneef-protection";
const LINEAGE = "https://w3id.org/jeswr/sectors/futures";

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix wf: <http://www.w3.org/2005/01/wf/flow#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix prov: <http://www.w3.org/ns/prov#> .
  @prefix ldp: <http://www.w3.org/ns/ldp#> .
  @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

const meta = (creator: string, delib = DELIB) => `
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${creator}> ; fut:inDeliberation <${delib}> .`;

function synthesizeConsentTtl(url: string): string {
  return `
    <${url}> odrl:hasPolicy <${url}#consent> .
    <${url}#consent> a odrl:Set ; odrl:permission <${url}#c-syn> .
    <${url}#c-syn> a odrl:Permission ; odrl:action fut:synthesize ; odrl:target <${url}> .`;
}

function needTtl(url: string, creator: string): string {
  return `${PREFIX} <${url}> a fut:Need ; as:content "n" ; fut:needConcept <${CONCEPT}> ; ${meta(creator)}`;
}

function infraTtl(url: string, creator: string, delib = DELIB): string {
  return `${PREFIX} <${url}> a fut:InfraProposal, wf:Task ; dct:title "ip" ; as:content "ip" ;
      fut:targetsSystem <${LINEAGE}> ;
      fut:affectsRole fut:ImplementerRole ;
      fut:motivatedBy <${ALICE_BASE}needs/n1.ttl> ; ${meta(creator, delib)}`;
}

function appProposalTtl(url: string, creator: string): string {
  return `${PREFIX} <${url}> a fut:AppProposal, wf:Task ; dct:title "ap" ; as:content "ap" ;
      fut:motivatedBy <${ALICE_BASE}needs/n1.ttl> ; ${meta(creator)}`;
}

function candidateTtl(url: string, creator: string, derivedFrom: string): string {
  return `${PREFIX} <${url}> a fut:SpecSynthesis ; as:content "s" ;
      prov:wasDerivedFrom <${derivedFrom}> ; ${meta(creator)}`;
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

const N1 = `${ALICE_BASE}needs/n1.ttl`;
const IP1 = `${ALICE_BASE}proposals/ip1.ttl`;
const S1 = `${ALICE_BASE}syntheses/s1.ttl`;

/** Alice's infra pod: a need, an infra proposal, a candidate deriving from it. */
function pod(options: { consentOnInfra: boolean; derivedFrom?: string }): Record<string, string> {
  const derived = options.derivedFrom ?? IP1;
  return {
    [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [N1]),
    [N1]: needTtl(N1, ALICE) + synthesizeConsentTtl(N1),
    [`${ALICE_BASE}proposals/`]: containerTtl(`${ALICE_BASE}proposals/`, [IP1]),
    [IP1]: infraTtl(IP1, ALICE) + (options.consentOnInfra ? synthesizeConsentTtl(IP1) : ""),
    [`${ALICE_BASE}syntheses/`]: containerTtl(`${ALICE_BASE}syntheses/`, [S1]),
    [S1]: candidateTtl(S1, ALICE, derived),
    [`${ALICE_BASE}critiques/`]: containerTtl(`${ALICE_BASE}critiques/`, []),
    [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
  };
}

const INFRA_KINDS: readonly StatementKind[] = ["need", "infra-proposal", "synthesis", "critique"];

const run = (podDocs: Record<string, string>, kinds: readonly StatementKind[] = INFRA_KINDS) =>
  aggregateDeliberation({
    registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
    verifier: new StubMembershipVerifier([ALICE]),
    fetch: podFetch(podDocs),
    kinds,
  });

describe("aggregation: the infra-proposal kind (S2)", () => {
  it("collects infra proposals when the kind is enabled", async () => {
    const result = await run(pod({ consentOnInfra: true }));
    expect(result.infraProposals).toHaveLength(1);
    expect(result.infraProposals[0]?.id).toBe(IP1);
    expect(result.infraProposals[0]?.targetsSystem).toEqual([LINEAGE]);
  });

  it("collects NOTHING for the kind when it is not enabled (and the default stays needs-only)", async () => {
    const result = await run(pod({ consentOnInfra: true }), ["need"]);
    expect(result.infraProposals).toEqual([]);
    expect(result.needs).toHaveLength(1);
  });

  it("selects by rdf:type: an AppProposal in the shared proposals/ container is NOT an infra proposal (and vice versa)", async () => {
    const ap = `${ALICE_BASE}proposals/ap1.ttl`;
    const docs = pod({ consentOnInfra: true });
    docs[`${ALICE_BASE}proposals/`] = containerTtl(`${ALICE_BASE}proposals/`, [IP1, ap]);
    docs[ap] = appProposalTtl(ap, ALICE);
    const both = await run(docs, ["need", "app-proposal", "infra-proposal"]);
    expect(both.infraProposals.map((p) => p.id)).toEqual([IP1]);
    expect(both.proposals.map((p) => p.id)).toEqual([ap]);
  });

  it("drops a creator-spoofed infra proposal (pod says Alice, doc says Bob)", async () => {
    const docs = pod({ consentOnInfra: true });
    docs[IP1] = infraTtl(IP1, BOB) + synthesizeConsentTtl(IP1);
    const result = await run(docs);
    expect(result.infraProposals).toEqual([]);
  });

  it("drops an infra proposal from a DIFFERENT deliberation", async () => {
    const docs = pod({ consentOnInfra: true });
    docs[IP1] = infraTtl(IP1, ALICE, "https://other.example/d2") + synthesizeConsentTtl(IP1);
    const result = await run(docs);
    expect(result.infraProposals).toEqual([]);
  });
});

describe("aggregation: the fail-closed synthesize-consent gate over infra proposals (S2)", () => {
  it("an infra proposal WITH fut:synthesize consent is synthesizable; a candidate deriving from it survives", async () => {
    const result = await run(pod({ consentOnInfra: true }));
    expect(result.synthesizable.has(IP1)).toBe(true);
    expect(result.candidates.map((c) => c.id)).toEqual([S1]);
    expect(result.errors).toEqual([]);
  });

  it("an infra proposal WITHOUT consent is NOT synthesizable; the candidate is EXCLUDED with a recorded error", async () => {
    const result = await run(pod({ consentOnInfra: false }));
    // The proposal itself is still on the board — consent gates DERIVATION,
    // not collection.
    expect(result.infraProposals).toHaveLength(1);
    expect(result.synthesizable.has(IP1)).toBe(false);
    expect(result.candidates).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.stage).toBe("syntheses");
    expect(result.errors[0]?.resource).toBe(S1);
  });

  it("a candidate deriving from an UNCOLLECTED infra proposal is excluded (writing straight to the pod cannot bypass the gate)", async () => {
    // Same pod, but the aggregation does not collect infra proposals — so the
    // candidate's lineage points outside the aggregate. Fail-closed: excluded.
    const result = await run(pod({ consentOnInfra: true }), ["need", "synthesis"]);
    expect(result.candidates).toEqual([]);
    expect(result.errors.some((e) => e.resource === S1)).toBe(true);
  });

  it("a candidate deriving from a consented NEED still survives when infra proposals are collected too", async () => {
    const result = await run(pod({ consentOnInfra: false, derivedFrom: N1 }));
    expect(result.candidates.map((c) => c.id)).toEqual([S1]);
  });
});
