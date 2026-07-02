// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Round-trip + untrusted-RDF resilience. Foreign pods are HOSTILE input: a
// malformed field must drop that field (if optional) or that item (if
// required), never throw, never take sibling items down with it.

import { parseRdf } from "@jeswr/fetch-rdf";
import { describe, expect, it } from "vitest";
import { DIM_ASPIRE, FUT_NEED_CONCEPT, STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import {
  isHttpIri,
  MAX_CONTENT_LENGTH,
  type Need,
  parseNeeds,
  parseResonances,
  type Resonance,
  serializeNeed,
  serializeResonance,
} from "./model.js";

const BASE = "https://alice.example/unite/d1/";
const DELIB = "https://community.example/deliberations/apps";
const WEBID = "https://alice.example/profile/card#me";
const CONCEPT = "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence";

async function roundTripNeeds(turtle: string): Promise<Need[]> {
  return parseNeeds(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}
async function roundTripResonances(turtle: string): Promise<Resonance[]> {
  return parseResonances(await parseRdf(turtle, "text/turtle", { baseIRI: BASE }));
}

describe("isHttpIri", () => {
  it("accepts http(s), rejects everything else", () => {
    expect(isHttpIri("https://a.example/x")).toBe(true);
    expect(isHttpIri("http://a.example/x")).toBe(true);
    expect(isHttpIri("javascript:alert(1)")).toBe(false);
    expect(isHttpIri("data:text/plain,hi")).toBe(false);
    expect(isHttpIri("file:///etc/passwd")).toBe(false);
    expect(isHttpIri("/relative/path")).toBe(false);
    expect(isHttpIri("not a url")).toBe(false);
  });
});

describe("Need round-trip", () => {
  const full: Need = {
    id: `${BASE}needs/n1.ttl`,
    content: "I need reliable transit to reach work.",
    needConcept: CONCEPT,
    intensity: 4,
    created: "2026-07-01T12:00:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("serialise → parse is identity WITH intensity", async () => {
    const [got] = await roundTripNeeds(await serializeNeed(full));
    expect(got).toEqual(full);
  });

  it("serialise → parse is identity WITHOUT intensity", async () => {
    const { intensity: _omit, ...noIntensity } = full;
    const [got] = await roundTripNeeds(await serializeNeed(noIntensity as Need));
    expect(got).toEqual(noIntensity);
    expect(got).not.toHaveProperty("intensity");
  });

  it("accepts a foreign (non-Max-Neef) concept IRI", async () => {
    const foreign: Need = { ...full, needConcept: "https://other.example/scheme#care" };
    const [got] = await roundTripNeeds(await serializeNeed(foreign));
    expect(got?.needConcept).toBe("https://other.example/scheme#care");
  });

  it("emits a typed xsd:dateTime and xsd:integer", async () => {
    const ttl = await serializeNeed(full);
    expect(ttl).toContain("^^xsd:dateTime");
    // n3 writes xsd:integer in Turtle shorthand (bare number). The datatype is
    // nonetheless xsd:integer — the round-trip reads it back as intensity 4,
    // and readIntInRange only accepts xsd:integer, so the type is verified there.
    expect(ttl).toMatch(/fut:intensity 4\b/);
  });

  it("serialisation rejects a non-http creator IRI", async () => {
    await expect(serializeNeed({ ...full, creator: "javascript:x" })).rejects.toThrow();
  });

  it.each([
    0, 6, 2.5, -1,
  ])("serialisation rejects out-of-range/non-integer intensity %s", async (i) => {
    await expect(serializeNeed({ ...full, intensity: i })).rejects.toThrow(/intensity/);
  });
});

describe("strict xsd:dateTime validation (hostile input)", () => {
  const mk = (dt: string) => `
    @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <${BASE}needs/n.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "${dt}"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;

  it("accepts a Z-terminated dateTime", async () => {
    const got = await roundTripNeeds(mk("2026-07-01T12:00:00Z"));
    expect(got).toHaveLength(1);
  });

  it("accepts an offset-timezone dateTime (no false calendar reject)", async () => {
    const got = await roundTripNeeds(mk("2026-07-01T02:00:00+05:00"));
    expect(got).toHaveLength(1);
    expect(got[0]?.created).toBe("2026-07-01T02:00:00+05:00");
  });

  it("rejects a date-only value Date.parse would accept", async () => {
    expect(await roundTripNeeds(mk("2026-07-01"))).toEqual([]);
  });

  it("rejects an impossible calendar date (2026-02-31)", async () => {
    expect(await roundTripNeeds(mk("2026-02-31T00:00:00Z"))).toEqual([]);
  });

  it("accepts a leap day and rejects a non-leap Feb 29", async () => {
    expect(await roundTripNeeds(mk("2024-02-29T00:00:00Z"))).toHaveLength(1);
    expect(await roundTripNeeds(mk("2026-02-29T00:00:00Z"))).toEqual([]);
  });

  it("rejects an out-of-range timezone offset (+99:99)", async () => {
    expect(await roundTripNeeds(mk("2026-07-01T00:00:00+99:99"))).toEqual([]);
  });

  it("rejects a >+14:00 offset but accepts +14:00", async () => {
    expect(await roundTripNeeds(mk("2026-07-01T00:00:00+14:30"))).toEqual([]);
    expect(await roundTripNeeds(mk("2026-07-01T00:00:00+14:00"))).toHaveLength(1);
  });
});

describe("serializer validates created symmetrically with the reader", () => {
  const need: Need = {
    id: `${BASE}needs/n.ttl`,
    content: "x",
    needConcept: CONCEPT,
    created: "not-a-date",
    creator: WEBID,
    inDeliberation: DELIB,
  };
  it("serializeNeed rejects a malformed created", async () => {
    await expect(serializeNeed(need)).rejects.toThrow(/created/);
  });
  it("serializeResonance rejects a malformed created", async () => {
    await expect(
      serializeResonance({
        id: `${BASE}resonances/r.ttl`,
        onStatement: `${BASE}needs/n.ttl`,
        stance: STANCE_RESONATES,
        created: "2026-13-01T00:00:00Z", // month 13
        creator: WEBID,
        inDeliberation: DELIB,
      }),
    ).rejects.toThrow(/created/);
  });
});

describe("Resonance round-trip", () => {
  const full: Resonance = {
    id: `${BASE}resonances/r1.ttl`,
    onStatement: `${BASE}needs/n1.ttl`,
    stance: STANCE_RESONATES,
    dimension: DIM_ASPIRE,
    created: "2026-07-01T12:30:00.000Z",
    creator: WEBID,
    inDeliberation: DELIB,
  };

  it("serialise → parse is identity WITH dimension", async () => {
    const [got] = await roundTripResonances(await serializeResonance(full));
    expect(got).toEqual(full);
  });

  it("serialise → parse is identity WITHOUT dimension", async () => {
    const { dimension: _omit, ...noDim } = full;
    const [got] = await roundTripResonances(await serializeResonance(noDim as Resonance));
    expect(got).toEqual(noDim);
    expect(got).not.toHaveProperty("dimension");
  });
});

describe("untrusted RDF resilience (needs)", () => {
  const good = (id: string) => `
    <${BASE}needs/${id}.ttl> a fut:Need ;
      as:content "ok" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ;
      fut:inDeliberation <${DELIB}> .`;
  const PREFIX = `
    @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

  it("drops an item missing a required field but keeps siblings", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "no creator" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      fut:inDeliberation <${DELIB}> .`;
    const got = await roundTripNeeds(`${PREFIX} ${good("g1")} ${bad}`);
    expect(got.map((n) => n.id)).toEqual([`${BASE}needs/g1.ttl`]);
  });

  it("drops a need whose needConcept is a javascript: IRI", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <javascript:alert(1)> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a need whose creator is a data: IRI", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <data:text/plain,evil> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a need whose creator is a literal, not an IRI", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator "https://alice.example/#me" ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a need whose content exceeds the cap", async () => {
    const huge = "z".repeat(MAX_CONTENT_LENGTH + 1);
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "${huge}" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a need with a garbage dateTime", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "not-a-date"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops the intensity FIELD (keeps the need) when it is a string, not xsd:integer", async () => {
    const bad = `<${BASE}needs/n.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ; fut:intensity "high" ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const [got] = await roundTripNeeds(`${PREFIX} ${bad}`);
    expect(got).toBeDefined();
    expect(got).not.toHaveProperty("intensity");
  });

  it("drops the intensity FIELD when out of the 1–5 range", async () => {
    const bad = `<${BASE}needs/n.ttl> a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ; fut:intensity "9"^^xsd:integer ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const [got] = await roundTripNeeds(`${PREFIX} ${bad}`);
    expect(got).not.toHaveProperty("intensity");
  });

  it("drops a need with two content values (ambiguous)", async () => {
    const bad = `<${BASE}needs/n.ttl> a fut:Need ; as:content "a", "b" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a blank-node subject typed fut:Need", async () => {
    const bad = `[ a fut:Need ; as:content "x" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> ] .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops a need whose as:content is a non-string datatype (xsd:integer)", async () => {
    const bad = `<${BASE}needs/bad.ttl> a fut:Need ; as:content "123"^^xsd:integer ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripNeeds(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("accepts a language-tagged as:content (rdf:langString)", async () => {
    const ok = `<${BASE}needs/n.ttl> a fut:Need ; as:content "bonjour"@fr ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const [got] = await roundTripNeeds(`${PREFIX} ${ok}`);
    expect(got?.content).toBe("bonjour");
  });
});

describe("untrusted RDF resilience (resonances)", () => {
  const PREFIX = `
    @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

  it("drops a resonance whose stance is not a coded IRI", async () => {
    const bad = `<${BASE}resonances/r.ttl> a fut:Resonance ;
      fut:onStatement <${BASE}needs/n1.ttl> ;
      fut:stance <https://w3id.org/jeswr/sectors/futures#Maybe> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripResonances(`${PREFIX} ${bad}`)).toEqual([]);
  });

  it("drops the dimension FIELD (keeps the resonance) when non-coded", async () => {
    const bad = `<${BASE}resonances/r.ttl> a fut:Resonance ;
      fut:onStatement <${BASE}needs/n1.ttl> ;
      fut:stance <${STANCE_CONFLICTS}> ;
      fut:dimension <https://w3id.org/jeswr/sectors/futures#Whatever> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    const [got] = await roundTripResonances(`${PREFIX} ${bad}`);
    expect(got).toBeDefined();
    expect(got?.stance).toBe(STANCE_CONFLICTS);
    expect(got).not.toHaveProperty("dimension");
  });

  it("drops a resonance with a non-http onStatement", async () => {
    const bad = `<${BASE}resonances/r.ttl> a fut:Resonance ;
      fut:onStatement <javascript:x> ;
      fut:stance <${STANCE_RESONATES}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${WEBID}> ; fut:inDeliberation <${DELIB}> .`;
    expect(await roundTripResonances(`${PREFIX} ${bad}`)).toEqual([]);
  });
});

describe("needConcept vocabulary", () => {
  it("the fut:needConcept IRI is stable", () => {
    expect(FUT_NEED_CONCEPT).toBe("https://w3id.org/jeswr/sectors/futures#needConcept");
  });
});
