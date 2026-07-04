// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S1 artifact shapes (SCOPE-DIFFERENTIATION §2): fut:AppProposal,
// fut:SpecSynthesis candidates and fut:Critique — round-trip identity, the
// SHACL-MUST invariants enforced at both ends (≥1 motivatedBy / ≥1
// derivedFrom), and untrusted-RDF resilience: a malformed field drops the
// field (optional) or the item (required), never throws, never sinks siblings.

import { parseRdf } from "@jeswr/fetch-rdf";
import { describe, expect, it } from "vitest";
import { FUT_CRITIQUE } from "./fut-draft.js";
import {
  type AppProposal,
  buildProposalQuads,
  type Critique,
  MAX_LINKS,
  MAX_TITLE_LENGTH,
  parseCandidates,
  parseCritiques,
  parseProposals,
  type SynthesisCandidate,
  serializeCandidate,
  serializeCritique,
  serializeProposal,
} from "./model.js";

const BASE = "https://alice.example/unite/d1/";
const DELIB = "https://community.example/deliberations/apps";
const WEBID = "https://alice.example/profile/card#me";
const NEED_1 = "https://bob.example/unite/d1/needs/n1.ttl";
const NEED_2 = "https://cara.example/unite/d1/needs/n2.ttl";

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix wf: <http://www.w3.org/2005/01/wf/flow#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix prov: <http://www.w3.org/ns/prov#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

async function roundTripProposals(turtle: string): Promise<AppProposal[]> {
  return parseProposals(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}
async function roundTripCandidates(turtle: string): Promise<SynthesisCandidate[]> {
  return parseCandidates(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}
async function roundTripCritiques(turtle: string): Promise<Critique[]> {
  return parseCritiques(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}

// ── AppProposal ───────────────────────────────────────────────────────────────

describe("AppProposal round-trip", () => {
  const full: AppProposal = {
    id: `${BASE}proposals/p1.ttl`,
    title: "Offline-first notes",
    content: "A notes app that keeps working in a train tunnel.",
    motivatedBy: [NEED_1, NEED_2],
    indirectStakeholders: "Carers who manage a relative's notes.",
    created: "2026-07-01T12:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("serialise → parse is identity (motivatedBy sorted, deterministic)", async () => {
    const [got] = await roundTripProposals(await serializeProposal(full));
    expect(got).toEqual({ ...full, motivatedBy: [...full.motivatedBy].sort() });
  });

  it("round-trips WITHOUT the optional indirectStakeholders", async () => {
    const { indirectStakeholders: _omit, ...minimal } = full;
    const [got] = await roundTripProposals(await serializeProposal(minimal as AppProposal));
    expect(got).not.toHaveProperty("indirectStakeholders");
    expect(got?.motivatedBy).toEqual([...minimal.motivatedBy].sort());
  });

  it("asserts BOTH fut:AppProposal and wf:Task types (plain task readers federate)", () => {
    const types = buildProposalQuads(full)
      .filter((q) => q.predicate.value.endsWith("#type"))
      .map((q) => q.object.value)
      .sort();
    expect(types).toEqual([
      "http://www.w3.org/2005/01/wf/flow#Task",
      "https://w3id.org/jeswr/sectors/futures#AppProposal",
    ]);
  });

  it("REFUSES to serialise without a needs trace (the SHACL MUST)", async () => {
    await expect(serializeProposal({ ...full, motivatedBy: [] })).rejects.toThrow(/≥1 need/);
  });

  it("REFUSES a non-http motivatedBy / oversized title / overlong fan-out", async () => {
    await expect(serializeProposal({ ...full, motivatedBy: ["javascript:x"] })).rejects.toThrow();
    await expect(
      serializeProposal({ ...full, title: "x".repeat(MAX_TITLE_LENGTH + 1) }),
    ).rejects.toThrow(/title/);
    await expect(
      serializeProposal({
        ...full,
        motivatedBy: Array.from({ length: MAX_LINKS + 1 }, (_, i) => `https://n.example/${i}`),
      }),
    ).rejects.toThrow(/MAX_LINKS/);
  });

  it("DROPS a parsed proposal whose needs trace is missing or non-http (keeps siblings)", async () => {
    const good = `<${BASE}proposals/g.ttl> a fut:AppProposal, wf:Task ;
      dct:title "ok" ; as:content "ok" ; fut:motivatedBy <${NEED_1}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const noTrace = `<${BASE}proposals/b1.ttl> a fut:AppProposal ;
      dct:title "no trace" ; as:content "x" ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const badTrace = `<${BASE}proposals/b2.ttl> a fut:AppProposal ;
      dct:title "bad trace" ; as:content "x" ; fut:motivatedBy <javascript:x> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const got = await roundTripProposals(`${PREFIX} ${good} ${noTrace} ${badTrace}`);
    expect(got.map((p) => p.id)).toEqual([`${BASE}proposals/g.ttl`]);
  });

  it("caps a hostile motivatedBy fan-out at MAX_LINKS on read", async () => {
    const links = Array.from({ length: MAX_LINKS + 25 }, (_, i) => `<https://n.example/${i}>`);
    const ttl = `${PREFIX} <${BASE}proposals/p.ttl> a fut:AppProposal ;
      dct:title "fanout" ; as:content "x" ; fut:motivatedBy ${links.join(", ")} ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const [got] = await roundTripProposals(ttl);
    expect(got?.motivatedBy).toHaveLength(MAX_LINKS);
    // Sorted + deduped: deterministic regardless of dataset iteration order.
    expect(got?.motivatedBy).toEqual([...(got?.motivatedBy ?? [])].sort());
  });

  it("drops a proposal with an EMPTY title (read mirrors the write-side 1–200 rule)", async () => {
    const blank = `<${BASE}proposals/blank.ttl> a fut:AppProposal ;
      dct:title "" ; as:content "x" ; fut:motivatedBy <${NEED_1}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripProposals(`${PREFIX} ${blank}`)).toEqual([]);
  });

  it("drops a proposal with a missing/oversized title (required field)", async () => {
    const noTitle = `<${BASE}proposals/t.ttl> a fut:AppProposal ;
      as:content "x" ; fut:motivatedBy <${NEED_1}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripProposals(`${PREFIX} ${noTitle}`)).toEqual([]);
    const bigTitle = `<${BASE}proposals/t2.ttl> a fut:AppProposal ;
      dct:title "${"x".repeat(MAX_TITLE_LENGTH + 1)}" ; as:content "x" ;
      fut:motivatedBy <${NEED_1}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripProposals(`${PREFIX} ${bigTitle}`)).toEqual([]);
  });
});

// ── SynthesisCandidate ────────────────────────────────────────────────────────

describe("SynthesisCandidate round-trip", () => {
  const full: SynthesisCandidate = {
    id: `${BASE}syntheses/s1.ttl`,
    title: "Draft synthesis",
    content: "Offline-first, one login, plain-language access — the common spine.",
    derivedFrom: [NEED_1, NEED_2],
    revisionOf: `${BASE}syntheses/s0.ttl`,
    created: "2026-07-02T09:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("serialise → parse is identity (derivedFrom sorted)", async () => {
    const [got] = await roundTripCandidates(await serializeCandidate(full));
    expect(got).toEqual({ ...full, derivedFrom: [...full.derivedFrom].sort() });
  });

  it("round-trips WITHOUT the optional title/revisionOf", async () => {
    const { title: _t, revisionOf: _r, ...minimal } = full;
    const [got] = await roundTripCandidates(
      await serializeCandidate(minimal as SynthesisCandidate),
    );
    expect(got).not.toHaveProperty("title");
    expect(got).not.toHaveProperty("revisionOf");
  });

  it("REFUSES to serialise without inputs (a synthesis must derive from ≥1 statement)", async () => {
    await expect(serializeCandidate({ ...full, derivedFrom: [] })).rejects.toThrow(/≥1 input/);
    await expect(serializeCandidate({ ...full, derivedFrom: ["ftp://x"] })).rejects.toThrow();
    await expect(serializeCandidate({ ...full, revisionOf: "javascript:x" })).rejects.toThrow();
  });

  it("DROPS a parsed candidate without derivedFrom; keeps siblings; drops a bad revisionOf FIELD", async () => {
    const good = `<${BASE}syntheses/g.ttl> a fut:SpecSynthesis ;
      as:content "ok" ; prov:wasDerivedFrom <${NEED_1}> ;
      prov:wasRevisionOf <ftp://not-http.example/x> ;
      dct:created "2026-07-02T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const orphan = `<${BASE}syntheses/b.ttl> a fut:SpecSynthesis ;
      as:content "no inputs" ;
      dct:created "2026-07-02T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const got = await roundTripCandidates(`${PREFIX} ${good} ${orphan}`);
    expect(got.map((c) => c.id)).toEqual([`${BASE}syntheses/g.ttl`]);
    expect(got[0]).not.toHaveProperty("revisionOf"); // malformed optional → field drops
  });
});

// ── Critique ──────────────────────────────────────────────────────────────────

describe("Critique round-trip", () => {
  const full: Critique = {
    id: `${BASE}critiques/c1.ttl`,
    content: "The synthesis drops the network-lockdown need entirely.",
    onStatement: `${BASE}syntheses/s1.ttl`,
    created: "2026-07-03T10:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("serialise → parse is identity", async () => {
    const [got] = await roundTripCritiques(await serializeCritique(full));
    expect(got).toEqual(full);
  });

  it("types the resource fut:Critique (the 0.2.0 draft class)", async () => {
    const ttl = await serializeCritique(full);
    const ds = await parseRdf(ttl, "text/turtle", { baseIRI: BASE });
    const typed = [...ds.match(null, null, null, null)].some(
      (q) => q.predicate.value.endsWith("#type") && q.object.value === FUT_CRITIQUE,
    );
    expect(typed).toBe(true);
  });

  it("REFUSES an empty critique or a non-http target", async () => {
    await expect(serializeCritique({ ...full, content: "" })).rejects.toThrow(/carry text/);
    await expect(serializeCritique({ ...full, onStatement: "data:x" })).rejects.toThrow();
  });

  it("DROPS a critique with EMPTY content (read mirrors the write-side carry-text rule)", async () => {
    const blank = `<${BASE}critiques/blank.ttl> a fut:Critique ;
      as:content "" ; fut:onStatement <${BASE}syntheses/s1.ttl> ;
      dct:created "2026-07-03T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripCritiques(`${PREFIX} ${blank}`)).toEqual([]);
  });

  it("DROPS a critique with a missing/non-http onStatement; keeps siblings", async () => {
    const good = `<${BASE}critiques/g.ttl> a fut:Critique ;
      as:content "ok" ; fut:onStatement <${BASE}syntheses/s1.ttl> ;
      dct:created "2026-07-03T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const bad = `<${BASE}critiques/b.ttl> a fut:Critique ;
      as:content "dangling" ;
      dct:created "2026-07-03T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const got = await roundTripCritiques(`${PREFIX} ${good} ${bad}`);
    expect(got.map((c) => c.id)).toEqual([`${BASE}critiques/g.ttl`]);
  });
});
