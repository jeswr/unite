// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Typed round-trip for the two Stage-1 resource shapes (design/01):
//   • fut:Need      — a need felt by the author, Max-Neef-classified
//   • fut:Resonance — a tri-state reaction to a statement
//
// SERIALISE with n3.Writer ONLY (correct xsd datatypes; never string-concat
// RDF). PARSE via @jeswr/fetch-rdf `parseRdf` (which hands back an n3.Store),
// then read every field through a tryRead-guarded typed accessor.
//
// FOREIGN DATA IS HOSTILE INPUT. A malformed / missing / wrong-datatype field
// drops that FIELD if optional, or that ITEM if required — it never throws and
// never aborts the parse of sibling items. IRI fields accept http(s) only
// (javascript:/data:/file:/relative junk is rejected). as:content is capped.

import type { DatasetCore, Literal, NamedNode, Quad, Term } from "@rdfjs/types";
import { DataFactory, Writer } from "n3";
import {
  AS_CONTENT,
  DCT_CREATED,
  DCT_CREATOR,
  type Dimension,
  FUT_DIMENSION,
  FUT_IN_DELIBERATION,
  FUT_INTENSITY,
  FUT_NEED,
  FUT_NEED_CONCEPT,
  FUT_ON_STATEMENT,
  FUT_RESONANCE,
  FUT_STANCE,
  isDimension,
  isStance,
  NS,
  RDF_TYPE,
  type Stance,
} from "./fut.js";

const { namedNode, literal } = DataFactory;

/** Maximum accepted `as:content` length (design/01: bounded free-text). */
export const MAX_CONTENT_LENGTH = 2000;

const XSD_INTEGER = `${NS.xsd}integer`;
const XSD_DATETIME = `${NS.xsd}dateTime`;
const XSD_STRING = `${NS.xsd}string`;
const RDF_LANGSTRING = `${NS.rdf}langString`;

// Strict xsd:dateTime lexical form (ISO 8601): YYYY-MM-DDThh:mm:ss(.sss)?(Z|±hh:mm)?
// Date.parse is far too lax (accepts "2026-07-01", "July 1 2026", and silently
// normalises invalid calendar dates), so hostile RDF must clear BOTH this
// lexical guard AND a calendar round-trip before a dateTime is accepted.
const XSD_DATETIME_RE =
  /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** Days in `month` (1–12) of `year` (proleptic Gregorian; handles leap years). */
function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const table = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1] ?? 0;
}

/**
 * Validate a literal as a real xsd:dateTime. Checks the ISO-8601 lexical form
 * AND the calendar validity of the lexical Y-M-D directly (NOT via a Date UTC
 * round-trip, which would mis-handle offset timezones). Rejects the lax forms
 * Date.parse accepts (date-only, prose dates) and impossible dates (2026-02-31).
 */
function isValidXsdDateTime(value: string): boolean {
  const m = XSD_DATETIME_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  // Validate the timezone offset (XSD: −14:00 .. +14:00; minutes 00–59).
  const tz = m[8];
  if (tz && tz !== "Z") {
    const offHour = Number(tz.slice(1, 3));
    const offMin = Number(tz.slice(4, 6));
    if (offHour > 14 || offMin > 59) return false;
    if (offHour === 14 && offMin !== 0) return false;
  }
  return true;
}

/** A `fut:Need` (design/01 expression layer). */
export interface Need {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `as:content` free-text, ≤ {@link MAX_CONTENT_LENGTH} chars. */
  readonly content: string;
  /** `fut:needConcept` → a scheme concept IRI (foreign concepts accepted). */
  readonly needConcept: string;
  /** `fut:intensity` optional 1–5. */
  readonly intensity?: number;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/** A `fut:Resonance` (design/01 reaction layer). */
export interface Resonance {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `fut:onStatement` → the statement reacted to. */
  readonly onStatement: string;
  /** `fut:stance` — one of the three coded stances. */
  readonly stance: Stance;
  /** `fut:dimension` — optional coded qualifier. */
  readonly dimension?: Dimension;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

// ── IRI validation ───────────────────────────────────────────────────────────

/** True only for absolute http(s) IRIs — the sole accepted IRI shape. */
export function isHttpIri(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

// ── Serialisation (n3.Writer only) ────────────────────────────────────────────

const WRITER_PREFIXES = {
  fut: NS.fut,
  as: NS.as,
  dct: NS.dct,
  xsd: NS.xsd,
} as const;

function writeTurtle(quads: Quad[]): Promise<string> {
  const writer = new Writer({ prefixes: WRITER_PREFIXES });
  writer.addQuads(quads);
  return new Promise((resolve, reject) => {
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** Serialise a {@link Need} to Turtle. Throws on an invalid required IRI. */
export async function serializeNeed(need: Need): Promise<string> {
  for (const iri of [need.id, need.needConcept, need.creator, need.inDeliberation]) {
    if (!isHttpIri(iri)) throw new Error(`serializeNeed: not an http(s) IRI: ${iri}`);
  }
  if (need.content.length > MAX_CONTENT_LENGTH) {
    throw new Error("serializeNeed: content exceeds MAX_CONTENT_LENGTH");
  }
  if (
    need.intensity !== undefined &&
    (!Number.isInteger(need.intensity) || need.intensity < 1 || need.intensity > 5)
  ) {
    throw new Error(`serializeNeed: intensity must be an integer 1–5: ${need.intensity}`);
  }
  if (!isValidXsdDateTime(need.created)) {
    throw new Error(`serializeNeed: created is not a valid xsd:dateTime: ${need.created}`);
  }
  const s = namedNode(need.id);
  const { quad } = DataFactory;
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_NEED)),
    quad(s, namedNode(AS_CONTENT), literal(need.content)),
    quad(s, namedNode(FUT_NEED_CONCEPT), namedNode(need.needConcept)),
    quad(s, namedNode(DCT_CREATED), literal(need.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(need.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(need.inDeliberation)),
  ];
  if (need.intensity !== undefined) {
    quads.push(
      quad(s, namedNode(FUT_INTENSITY), literal(String(need.intensity), namedNode(XSD_INTEGER))),
    );
  }
  return writeTurtle(quads);
}

/** Serialise a {@link Resonance} to Turtle. Throws on an invalid required IRI. */
export async function serializeResonance(res: Resonance): Promise<string> {
  for (const iri of [res.id, res.onStatement, res.creator, res.inDeliberation]) {
    if (!isHttpIri(iri)) throw new Error(`serializeResonance: not an http(s) IRI: ${iri}`);
  }
  if (!isValidXsdDateTime(res.created)) {
    throw new Error(`serializeResonance: created is not a valid xsd:dateTime: ${res.created}`);
  }
  const s = namedNode(res.id);
  const { quad } = DataFactory;
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_RESONANCE)),
    quad(s, namedNode(FUT_ON_STATEMENT), namedNode(res.onStatement)),
    quad(s, namedNode(FUT_STANCE), namedNode(res.stance)),
    quad(s, namedNode(DCT_CREATED), literal(res.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(res.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(res.inDeliberation)),
  ];
  if (res.dimension !== undefined) {
    quads.push(quad(s, namedNode(FUT_DIMENSION), namedNode(res.dimension)));
  }
  return writeTurtle(quads);
}

// ── Guarded typed accessors over an RDF/JS DatasetCore ────────────────────────
// Reads go through DatasetCore.match() (works on both an n3.Store and any
// RDF/JS dataset — @jeswr/fetch-rdf hands back a DatasetCore). Never hand-parsed.

/** The single object term for (s,p), or undefined unless there is exactly one. */
function single(ds: DatasetCore, s: Term, p: string): Term | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) return q.object;
  return undefined;
}

/** A single http(s)-IRI object, else undefined. */
function readIri(ds: DatasetCore, s: Term, p: string): string | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "NamedNode") return undefined;
  return isHttpIri(t.value) ? t.value : undefined;
}

/**
 * A single string-typed literal capped at `max`, else undefined. Accepts ONLY
 * a plain/`xsd:string` literal or a language-tagged `rdf:langString` — a
 * hostile pod publishing e.g. `as:content "123"^^xsd:integer` is rejected
 * (the field is not textual content).
 */
function readString(ds: DatasetCore, s: Term, p: string, max: number): string | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "Literal") return undefined;
  const lit = t as Literal;
  if (lit.datatype.value !== XSD_STRING && lit.datatype.value !== RDF_LANGSTRING) return undefined;
  const value = lit.value;
  if (value.length > max) return undefined;
  return value;
}

/** A single xsd:dateTime literal whose value is a real date, else undefined. */
function readDateTime(ds: DatasetCore, s: Term, p: string): string | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "Literal") return undefined;
  const lit = t as Literal;
  if (lit.datatype.value !== XSD_DATETIME) return undefined;
  return isValidXsdDateTime(lit.value) ? lit.value : undefined;
}

/** A single xsd:integer literal in [min,max], else undefined (drops the field). */
function readIntInRange(
  ds: DatasetCore,
  s: Term,
  p: string,
  min: number,
  max: number,
): number | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "Literal") return undefined;
  const lit = t as Literal;
  if (lit.datatype.value !== XSD_INTEGER) return undefined;
  if (!/^[+-]?\d+$/.test(lit.value)) return undefined;
  const n = Number.parseInt(lit.value, 10);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

/** A single coded object IRI accepted by `ok`, else undefined (drops the field). */
function readCoded<T extends string>(
  ds: DatasetCore,
  s: Term,
  p: string,
  ok: (v: string) => v is T,
): T | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "NamedNode") return undefined;
  return ok(t.value) ? t.value : undefined;
}

/** The http(s)-IRI subjects typed as `cls` (blank/relative subjects dropped). */
function typedSubjects(ds: DatasetCore, cls: string): NamedNode[] {
  const out: NamedNode[] = [];
  for (const q of ds.match(null, namedNode(RDF_TYPE), namedNode(cls), null)) {
    if (q.subject.termType === "NamedNode" && isHttpIri(q.subject.value)) out.push(q.subject);
  }
  return out;
}

/** Parse every well-formed {@link Need} in the dataset; malformed items drop. */
export function parseNeeds(ds: DatasetCore): Need[] {
  const out: Need[] = [];
  for (const s of typedSubjects(ds, FUT_NEED)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const needConcept = readIri(ds, s, FUT_NEED_CONCEPT);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      content === undefined ||
      needConcept === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined
    ) {
      continue; // a required field is malformed → drop this item, keep siblings
    }
    const intensity = readIntInRange(ds, s, FUT_INTENSITY, 1, 5);
    out.push({
      id: s.value,
      content,
      needConcept,
      created,
      creator,
      inDeliberation,
      ...(intensity !== undefined ? { intensity } : {}),
    });
  }
  return out;
}

/** Parse every well-formed {@link Resonance} in the dataset; malformed items drop. */
export function parseResonances(ds: DatasetCore): Resonance[] {
  const out: Resonance[] = [];
  for (const s of typedSubjects(ds, FUT_RESONANCE)) {
    const onStatement = readIri(ds, s, FUT_ON_STATEMENT);
    const stance = readCoded(ds, s, FUT_STANCE, isStance);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      onStatement === undefined ||
      stance === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined
    ) {
      continue; // required field malformed → drop item
    }
    const dimension = readCoded(ds, s, FUT_DIMENSION, isDimension);
    out.push({
      id: s.value,
      onStatement,
      stance,
      created,
      creator,
      inDeliberation,
      ...(dimension !== undefined ? { dimension } : {}),
    });
  }
  return out;
}
