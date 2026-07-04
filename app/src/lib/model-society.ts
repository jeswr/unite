// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Typed round-trip for the scope-C expression layer (S4 —
// docs/SCOPE-DIFFERENTIATION.md §4.2; design/01 "Expression layer"):
//   • fut:VisionStatement — the whole narrative ("my ideal future")
//   • fut:Claim           — an atomic, voteable statement (≤ 500 chars),
//                           valid ONLY when explicitly adopted by its author
//   • fut:ValueStatement  — the author holds a value (Schwartz or foreign scheme)
//
// Same discipline as model.ts (whose guarded accessors this module REUSES —
// one reviewed hostile-input implementation, never a per-scope copy):
// serialise with n3.Writer only; parse via guarded typed accessors; a
// malformed required field drops the ITEM, a malformed optional field drops
// the FIELD; IRIs are http(s)-only; free text is capped.
//
// THE ADOPTION INVARIANT (design/03 §1; critique C6) is enforced HERE, in the
// round-trip itself, not just in UI: a Claim's `fut:adoptedBy` is REQUIRED and
// MUST equal its `dct:creator` — serialisation throws otherwise, and parsing
// DROPS a claim whose adoption assertion is missing or names someone else.
// Combined with aggregation's creator-must-own-the-pod gate, nothing enters
// deliberation attributed to a person without that person's explicit adoption.

import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory } from "n3";
import {
  AS_CONTENT,
  DCT_CREATED,
  DCT_CREATOR,
  DCT_TITLE,
  FUT_IN_DELIBERATION,
  NS,
  PROV_WAS_DERIVED_FROM,
  RDF_TYPE,
} from "./fut.js";
import { FUT_DECOMPOSED_BY } from "./fut-draft.js";
import {
  FUT_ADOPTED_BY,
  FUT_CLAIM,
  FUT_HORIZON,
  FUT_SCOPE,
  FUT_VALUE_CONCEPT,
  FUT_VALUE_STATEMENT,
  FUT_VISION_STATEMENT,
  isVisionScope,
  MAX_CLAIM_LENGTH,
} from "./fut-society.js";
import {
  assertStatementCore,
  isHttpIri,
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  readCoded,
  readDateTime,
  readIri,
  readString,
  serializeTurtle,
  typedSubjects,
} from "./model.js";

const { namedNode, literal, quad } = DataFactory;

const XSD_DATETIME = `${NS.xsd}dateTime`;
const XSD_GYEAR = `${NS.xsd}gYear`;

// Strict xsd:gYear lexical form for fut:horizon: exactly a (positive) 4-digit
// calendar year. The full gYear grammar admits 5+ digits and negative years —
// a vision's target horizon has no business there; anything else drops.
const GYEAR_RE = /^\d{4}$/;

/** True for the accepted `fut:horizon` lexical form (a 4-digit year). */
export function isValidHorizonYear(value: string): boolean {
  return GYEAR_RE.test(value);
}

/** A `fut:VisionStatement` (design/01): the whole-narrative expression. */
export interface VisionStatement {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `dct:title` — optional short name, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title?: string;
  /** `as:content` — the narrative, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `fut:scope` — optional coded scope-ladder concept (self…humanity). */
  readonly scope?: string;
  /** `fut:horizon` — optional target year (xsd:gYear, 4 digits). */
  readonly horizon?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI (primary or pseudonymous — T0 admitted). */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/**
 * A `fut:Claim` (design/01): the atomic, voteable unit of deliberation.
 * Valid ONLY when `adoptedBy === creator` (the C6 adoption invariant).
 */
export interface Claim {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `as:content` — one idea, short, standalone; ≤ {@link MAX_CLAIM_LENGTH}. */
  readonly content: string;
  /** `fut:adoptedBy` — REQUIRED; must equal `creator` (the consent gate). */
  readonly adoptedBy: string;
  /** `prov:wasDerivedFrom` — the source VisionStatement (absent when authored directly). */
  readonly derivedFrom?: string;
  /** `fut:decomposedBy` — the decomposition prov:Activity IRI (assistant seam; absent for manual). */
  readonly decomposedBy?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/** A `fut:ValueStatement` (design/01): the author holds a value. */
export interface ValueStatement {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `as:content` free-text, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `fut:valueConcept` → a value-scheme concept IRI (foreign schemes accepted). */
  readonly valueConcept: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

// ── VisionStatement ───────────────────────────────────────────────────────────

/** Validate a {@link VisionStatement} and build its quads. Throws on invalid. */
export function buildVisionQuads(vision: VisionStatement): Quad[] {
  assertStatementCore("serializeVision", vision);
  if (vision.content.length === 0) {
    throw new Error("serializeVision: a vision must carry its narrative");
  }
  if (vision.title !== undefined && vision.title.length > MAX_TITLE_LENGTH) {
    throw new Error("serializeVision: title exceeds MAX_TITLE_LENGTH");
  }
  if (vision.scope !== undefined && !isVisionScope(vision.scope)) {
    throw new Error(`serializeVision: not a coded scope-ladder concept: ${vision.scope}`);
  }
  if (vision.horizon !== undefined && !isValidHorizonYear(vision.horizon)) {
    throw new Error(`serializeVision: horizon is not a 4-digit year: ${vision.horizon}`);
  }
  const s = namedNode(vision.id);
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_VISION_STATEMENT)),
    quad(s, namedNode(AS_CONTENT), literal(vision.content)),
    quad(s, namedNode(DCT_CREATED), literal(vision.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(vision.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(vision.inDeliberation)),
  ];
  if (vision.title !== undefined && vision.title.length > 0) {
    quads.push(quad(s, namedNode(DCT_TITLE), literal(vision.title)));
  }
  if (vision.scope !== undefined) {
    quads.push(quad(s, namedNode(FUT_SCOPE), namedNode(vision.scope)));
  }
  if (vision.horizon !== undefined) {
    quads.push(quad(s, namedNode(FUT_HORIZON), literal(vision.horizon, namedNode(XSD_GYEAR))));
  }
  return quads;
}

/** Serialise a {@link VisionStatement} to Turtle. Throws on an invalid field. */
export async function serializeVision(vision: VisionStatement): Promise<string> {
  return serializeTurtle(buildVisionQuads(vision));
}

/** Parse every well-formed {@link VisionStatement}; malformed items drop. */
export function parseVisions(ds: DatasetCore): VisionStatement[] {
  const out: VisionStatement[] = [];
  for (const s of typedSubjects(ds, FUT_VISION_STATEMENT)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      content === undefined ||
      content.length === 0 || // mirrors buildVisionQuads: a vision carries its narrative
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined
    ) {
      continue; // a required field is malformed → drop this item, keep siblings
    }
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    // Optional coded/typed fields drop on junk, never abort the item.
    const scope = readCoded(ds, s, FUT_SCOPE, isVisionScope);
    const horizon = readHorizon(ds, s);
    out.push({
      id: s.value,
      content,
      created,
      creator,
      inDeliberation,
      ...(title !== undefined ? { title } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(horizon !== undefined ? { horizon } : {}),
    });
  }
  return out;
}

/** A single xsd:gYear literal that is a real 4-digit year, else undefined. */
function readHorizon(ds: DatasetCore, s: Term): string | undefined {
  const matched = ds.match(s, namedNode(FUT_HORIZON), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) {
    if (q.object.termType !== "Literal") return undefined;
    if (q.object.datatype.value !== XSD_GYEAR) return undefined;
    return isValidHorizonYear(q.object.value) ? q.object.value : undefined;
  }
  return undefined;
}

// ── Claim ─────────────────────────────────────────────────────────────────────

/**
 * Validate a {@link Claim} and build its quads. Throws on an invalid field —
 * including an adoption violation (`adoptedBy !== creator`): the write path
 * must be UNABLE to mint a claim its author has not adopted.
 */
export function buildClaimQuads(claim: Claim): Quad[] {
  assertStatementCore("serializeClaim", claim);
  if (claim.content.length === 0) {
    throw new Error("serializeClaim: a claim must carry text");
  }
  if (claim.content.length > MAX_CLAIM_LENGTH) {
    throw new Error(`serializeClaim: content exceeds MAX_CLAIM_LENGTH (${MAX_CLAIM_LENGTH})`);
  }
  if (!isHttpIri(claim.adoptedBy)) {
    throw new Error(`serializeClaim: not an http(s) IRI: ${claim.adoptedBy}`);
  }
  if (claim.adoptedBy !== claim.creator) {
    throw new Error(
      "serializeClaim: the adoption invariant — a claim is adopted by its own author (fut:adoptedBy must equal dct:creator)",
    );
  }
  if (claim.derivedFrom !== undefined && !isHttpIri(claim.derivedFrom)) {
    throw new Error(`serializeClaim: not an http(s) IRI: ${claim.derivedFrom}`);
  }
  if (claim.decomposedBy !== undefined && !isHttpIri(claim.decomposedBy)) {
    throw new Error(`serializeClaim: not an http(s) IRI: ${claim.decomposedBy}`);
  }
  const s = namedNode(claim.id);
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_CLAIM)),
    quad(s, namedNode(AS_CONTENT), literal(claim.content)),
    quad(s, namedNode(FUT_ADOPTED_BY), namedNode(claim.adoptedBy)),
    quad(s, namedNode(DCT_CREATED), literal(claim.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(claim.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(claim.inDeliberation)),
  ];
  if (claim.derivedFrom !== undefined) {
    quads.push(quad(s, namedNode(PROV_WAS_DERIVED_FROM), namedNode(claim.derivedFrom)));
  }
  if (claim.decomposedBy !== undefined) {
    quads.push(quad(s, namedNode(FUT_DECOMPOSED_BY), namedNode(claim.decomposedBy)));
  }
  return quads;
}

/** Serialise a {@link Claim} to Turtle. Throws on an invalid field. */
export async function serializeClaim(claim: Claim): Promise<string> {
  return serializeTurtle(buildClaimQuads(claim), { prov: NS.prov });
}

/**
 * Parse every well-formed {@link Claim}; malformed items drop — INCLUDING any
 * claim whose `fut:adoptedBy` is missing or names anyone other than its
 * `dct:creator`. An unadopted claim is not deliberation input (design/03 §1);
 * a hostile pod cannot smuggle one in by omitting or forging the adoption.
 */
export function parseClaims(ds: DatasetCore): Claim[] {
  const out: Claim[] = [];
  for (const s of typedSubjects(ds, FUT_CLAIM)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CLAIM_LENGTH);
    const adoptedBy = readIri(ds, s, FUT_ADOPTED_BY);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      content === undefined ||
      content.length === 0 ||
      adoptedBy === undefined || // no explicit adoption → not deliberation input
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      adoptedBy !== creator // the adoption invariant, enforced on READ too
    ) {
      continue;
    }
    const derivedFrom = readIri(ds, s, PROV_WAS_DERIVED_FROM);
    const decomposedBy = readIri(ds, s, FUT_DECOMPOSED_BY);
    out.push({
      id: s.value,
      content,
      adoptedBy,
      created,
      creator,
      inDeliberation,
      ...(derivedFrom !== undefined ? { derivedFrom } : {}),
      ...(decomposedBy !== undefined ? { decomposedBy } : {}),
    });
  }
  return out;
}

// ── ValueStatement ────────────────────────────────────────────────────────────

/** Validate a {@link ValueStatement} and build its quads. Throws on invalid. */
export function buildValueQuads(value: ValueStatement): Quad[] {
  assertStatementCore("serializeValue", value);
  if (value.content.length === 0) {
    throw new Error("serializeValue: a value statement must carry text");
  }
  if (!isHttpIri(value.valueConcept)) {
    throw new Error(`serializeValue: not an http(s) IRI: ${value.valueConcept}`);
  }
  const s = namedNode(value.id);
  return [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_VALUE_STATEMENT)),
    quad(s, namedNode(AS_CONTENT), literal(value.content)),
    quad(s, namedNode(FUT_VALUE_CONCEPT), namedNode(value.valueConcept)),
    quad(s, namedNode(DCT_CREATED), literal(value.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(value.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(value.inDeliberation)),
  ];
}

/** Serialise a {@link ValueStatement} to Turtle. Throws on an invalid field. */
export async function serializeValue(value: ValueStatement): Promise<string> {
  return serializeTurtle(buildValueQuads(value));
}

/** Parse every well-formed {@link ValueStatement}; malformed items drop. */
export function parseValueStatements(ds: DatasetCore): ValueStatement[] {
  const out: ValueStatement[] = [];
  for (const s of typedSubjects(ds, FUT_VALUE_STATEMENT)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const valueConcept = readIri(ds, s, FUT_VALUE_CONCEPT);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      content === undefined ||
      content.length === 0 ||
      valueConcept === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined
    ) {
      continue;
    }
    out.push({ id: s.value, content, valueConcept, created, creator, inDeliberation });
  }
  return out;
}
