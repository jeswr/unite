// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S4 scope-C expression shapes (SCOPE-DIFFERENTIATION §4.2; design/01):
// fut:VisionStatement / fut:Claim / fut:ValueStatement — round-trip identity,
// the ADOPTION INVARIANT enforced at BOTH ends (a claim unadopted or adopted
// by anyone but its creator is unwritable AND unreadable), claim atomicity
// (≤500), coded scope-ladder + strict gYear horizon, and untrusted-RDF
// resilience: malformed optional fields drop the field, malformed required
// fields drop the item, siblings always survive.

import { parseRdf } from "@jeswr/fetch-rdf";
import { describe, expect, it } from "vitest";
import {
  MAX_CLAIM_LENGTH,
  SCHWARTZ_CONCEPTS,
  SCOPE_COMMUNITY,
  VISION_SCOPES,
} from "./fut-society.js";
import {
  buildClaimQuads,
  type Claim,
  isValidHorizonYear,
  parseClaims,
  parseValueStatements,
  parseVisions,
  serializeClaim,
  serializeValue,
  serializeVision,
  type ValueStatement,
  type VisionStatement,
} from "./model-society.js";

const BASE = "https://alice.example/unite/soc/";
const DELIB = "https://community.example/deliberations/society";
const WEBID = "https://alice.example/profile/card#me";
const OTHER = "https://mallory.example/profile/card#me";
const VISION_IRI = `${BASE}visions/v1.ttl`;

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix prov: <http://www.w3.org/ns/prov#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

async function visions(turtle: string): Promise<VisionStatement[]> {
  return parseVisions(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}
async function claims(turtle: string): Promise<Claim[]> {
  return parseClaims(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}
async function values(turtle: string): Promise<ValueStatement[]> {
  return parseValueStatements(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}

// ── VisionStatement ───────────────────────────────────────────────────────────

describe("VisionStatement round-trip", () => {
  const full: VisionStatement = {
    id: VISION_IRI,
    title: "Streets my kids can cross",
    content: "I want my children to reach school on foot, safely.",
    scope: SCOPE_COMMUNITY,
    horizon: "2032",
    created: "2026-07-01T12:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("round-trips the full shape identically", async () => {
    const parsed = await visions(await serializeVision(full));
    expect(parsed).toEqual([full]);
  });

  it("round-trips the minimal shape (no title/scope/horizon)", async () => {
    const minimal: VisionStatement = {
      id: VISION_IRI,
      content: "A future.",
      created: "2026-07-01T12:00:00.000Z",
      creator: WEBID,
      inDeliberation: DELIB,
    };
    expect(await visions(await serializeVision(minimal))).toEqual([minimal]);
  });

  it("serialise rejects a non-coded scope, a bad horizon, and an empty narrative", async () => {
    await expect(
      serializeVision({ ...full, scope: "https://evil.example/not-a-scope" }),
    ).rejects.toThrow(/coded scope-ladder/);
    await expect(serializeVision({ ...full, horizon: "soon" })).rejects.toThrow(/4-digit year/);
    await expect(serializeVision({ ...full, horizon: "20320" })).rejects.toThrow(/4-digit year/);
    await expect(serializeVision({ ...full, content: "" })).rejects.toThrow(/narrative/);
  });

  it("drops a hostile non-coded scope and junk horizon as FIELDS, keeping the vision", async () => {
    const turtle = `${PREFIX}
      <${VISION_IRI}> a fut:VisionStatement ;
        as:content "A future." ;
        fut:scope <https://evil.example/everyone> ;
        fut:horizon "eventually"^^xsd:gYear ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    const parsed = await visions(turtle);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.scope).toBeUndefined();
    expect(parsed[0]?.horizon).toBeUndefined();
  });

  it("drops a vision missing its narrative, keeping siblings", async () => {
    const turtle = `${PREFIX}
      <${VISION_IRI}> a fut:VisionStatement ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .
      <${BASE}visions/v2.ttl> a fut:VisionStatement ;
        as:content "A well-formed sibling." ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    const parsed = await visions(turtle);
    expect(parsed.map((v) => v.id)).toEqual([`${BASE}visions/v2.ttl`]);
  });

  it("the horizon guard accepts exactly 4-digit years", () => {
    expect(isValidHorizonYear("2032")).toBe(true);
    expect(isValidHorizonYear("0999")).toBe(true);
    expect(isValidHorizonYear("32")).toBe(false);
    expect(isValidHorizonYear("20325")).toBe(false);
    expect(isValidHorizonYear("-2032")).toBe(false);
    expect(isValidHorizonYear("soon")).toBe(false);
  });

  it("the scope ladder has 5 rungs in self→humanity order", () => {
    expect(VISION_SCOPES.map((s) => s.name)).toEqual([
      "self",
      "household",
      "community",
      "nation",
      "humanity",
    ]);
  });
});

// ── Claim: the adoption invariant ─────────────────────────────────────────────

describe("Claim round-trip + the adoption invariant (C6)", () => {
  const full: Claim = {
    id: `${BASE}claims/c1.ttl`,
    content: "Every child should be able to cross the high street safely.",
    adoptedBy: WEBID,
    derivedFrom: VISION_IRI,
    created: "2026-07-01T12:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("round-trips the full shape identically", async () => {
    expect(await claims(await serializeClaim(full))).toEqual([full]);
  });

  it("round-trips a directly-authored claim (no derivedFrom)", async () => {
    const direct: Claim = {
      id: `${BASE}claims/c2.ttl`,
      content: "Buses should run past midnight.",
      adoptedBy: WEBID,
      created: "2026-07-01T12:00:00.000Z",
      creator: WEBID,
      inDeliberation: DELIB,
    };
    expect(await claims(await serializeClaim(direct))).toEqual([direct]);
  });

  it("an unadopted claim is UNWRITABLE (adoptedBy must equal creator)", () => {
    expect(() => buildClaimQuads({ ...full, adoptedBy: OTHER })).toThrow(/adoption invariant/);
  });

  it("a claim over the atomicity cap is unwritable", () => {
    expect(() => buildClaimQuads({ ...full, content: "x".repeat(MAX_CLAIM_LENGTH + 1) })).toThrow(
      /MAX_CLAIM_LENGTH/,
    );
    expect(() => buildClaimQuads({ ...full, content: "" })).toThrow(/carry text/);
  });

  it("a claim with NO fut:adoptedBy is dropped on read (not deliberation input)", async () => {
    const turtle = `${PREFIX}
      <${BASE}claims/c1.ttl> a fut:Claim ;
        as:content "Smuggled in without adoption." ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    expect(await claims(turtle)).toEqual([]);
  });

  it("a claim adopted by someone OTHER than its creator is dropped on read (forged adoption)", async () => {
    const turtle = `${PREFIX}
      <${BASE}claims/c1.ttl> a fut:Claim ;
        as:content "Attributed to Alice, adopted by Mallory." ;
        fut:adoptedBy <${OTHER}> ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    expect(await claims(turtle)).toEqual([]);
  });

  it("a claim over 500 chars is dropped on read (atomicity is a read guard too)", async () => {
    const turtle = `${PREFIX}
      <${BASE}claims/c1.ttl> a fut:Claim ;
        as:content "${"y".repeat(MAX_CLAIM_LENGTH + 1)}" ;
        fut:adoptedBy <${WEBID}> ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    expect(await claims(turtle)).toEqual([]);
  });

  it("a hostile non-IRI decomposedBy / derivedFrom drops the FIELD, not the claim", async () => {
    const turtle = `${PREFIX}
      <${BASE}claims/c1.ttl> a fut:Claim ;
        as:content "Well-formed core." ;
        fut:adoptedBy <${WEBID}> ;
        prov:wasDerivedFrom "not-an-iri" ;
        fut:decomposedBy "also-not-an-iri" ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    const parsed = await claims(turtle);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.derivedFrom).toBeUndefined();
    expect(parsed[0]?.decomposedBy).toBeUndefined();
  });
});

// ── ValueStatement ────────────────────────────────────────────────────────────

describe("ValueStatement round-trip", () => {
  const schwartz = SCHWARTZ_CONCEPTS[9]?.iri ?? "";
  const full: ValueStatement = {
    id: `${BASE}values/w1.ttl`,
    content: "Streets should be judged by their most vulnerable user.",
    valueConcept: schwartz,
    created: "2026-07-01T12:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("round-trips identically (Schwartz seed concept)", async () => {
    expect(await values(await serializeValue(full))).toEqual([full]);
  });

  it("accepts a FOREIGN value-scheme concept (schemes are open, like needs)", async () => {
    const foreign = { ...full, valueConcept: "https://community.example/values#care" };
    expect(await values(await serializeValue(foreign))).toEqual([foreign]);
  });

  it("serialise rejects a non-http(s) concept and empty content", async () => {
    await expect(serializeValue({ ...full, valueConcept: "javascript:alert(1)" })).rejects.toThrow(
      /http\(s\)/,
    );
    await expect(serializeValue({ ...full, content: "" })).rejects.toThrow(/carry text/);
  });

  it("drops a value statement whose concept is missing or malformed", async () => {
    const turtle = `${PREFIX}
      <${BASE}values/w1.ttl> a fut:ValueStatement ;
        as:content "No concept here." ;
        dct:created "2026-07-01T12:00:00Z"^^xsd:dateTime ;
        dct:creator <${WEBID}> ;
        fut:inDeliberation <${DELIB}> .`;
    expect(await values(turtle)).toEqual([]);
  });

  it("there are exactly ten Schwartz seed values", () => {
    expect(SCHWARTZ_CONCEPTS).toHaveLength(10);
    expect(new Set(SCHWARTZ_CONCEPTS.map((c) => c.iri)).size).toBe(10);
  });
});
