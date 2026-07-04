// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Typed round-trip for the Stage-1 resource shapes (design/01):
//   • fut:Need          — a need felt by the author, Max-Neef-classified
//   • fut:Resonance     — a tri-state reaction to a statement
//   • fut:AppProposal   — a proposed app (⊑ wf:Task), ≥1 fut:motivatedBy (S1)
//   • fut:SpecSynthesis — a Convergence-Room candidate, ≥1 prov:wasDerivedFrom (S1)
//   • fut:Critique      — a critique on a candidate (0.2.0 draft; S1)
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
  DCT_TITLE,
  type Dimension,
  FUT_APP_PROPOSAL,
  FUT_DIMENSION,
  FUT_IN_DELIBERATION,
  FUT_INTENSITY,
  FUT_MOTIVATED_BY,
  FUT_NEED,
  FUT_NEED_CONCEPT,
  FUT_ON_STATEMENT,
  FUT_RESONANCE,
  FUT_SPEC_SYNTHESIS,
  FUT_STANCE,
  isDimension,
  isStance,
  NS,
  PROV_WAS_DERIVED_FROM,
  PROV_WAS_REVISION_OF,
  RDF_TYPE,
  type Stance,
  WF_TASK,
} from "./fut.js";
import { FUT_CRITIQUE, FUT_INDIRECT_STAKEHOLDERS } from "./fut-draft.js";

const { namedNode, literal } = DataFactory;

/** Maximum accepted `as:content` length (design/01: bounded free-text). */
export const MAX_CONTENT_LENGTH = 2000;

/** Maximum accepted `dct:title` length (what task trackers render). */
export const MAX_TITLE_LENGTH = 200;

/** Cap on multi-valued link properties read from foreign RDF (bounded fan-out). */
export const MAX_LINKS = 50;

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

/**
 * A `fut:AppProposal` ⊑ `wf:Task` (design/01 Stage-1 layer; S1 of the scope
 * build). A proposal is a SATISFIER — `motivatedBy` names the shared needs it
 * serves (≥1, the SHACL MUST that keeps co-design value-centric).
 */
export interface AppProposal {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `dct:title` — the short name task trackers render, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title: string;
  /** `as:content` — the idea, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `fut:motivatedBy` — the Need/ValueStatement IRIs served (≥1). */
  readonly motivatedBy: readonly string[];
  /** `fut:indirectStakeholders` — the VSD prompt (optional free text; 0.2.0 draft). */
  readonly indirectStakeholders?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/**
 * A Convergence-Room candidate: a `fut:SpecSynthesis` draft (design/01;
 * SCOPE-DIFFERENTIATION §2). Its endorsement state is COMPUTED live from the
 * resonances cast on it against the bridging threshold — never asserted as a
 * property (the same computed-not-asserted posture as scope B's adoption).
 */
export interface SynthesisCandidate {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `dct:title` — optional short name, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title?: string;
  /** `as:content` — the synthesis text, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `prov:wasDerivedFrom` — every input statement IRI (≥1). */
  readonly derivedFrom: readonly string[];
  /** `prov:wasRevisionOf` — the candidate this revises (bounded revision rounds). */
  readonly revisionOf?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/**
 * A `fut:Critique` (0.2.0 draft; design/03 §4 step 2): one critique on a
 * candidate synthesis — the only threaded surface. Standing critiques at
 * endorsement time are the raw material of the mandatory dissent annex.
 */
export interface Critique {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `as:content` — the critique text, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `fut:onStatement` — the candidate critiqued. */
  readonly onStatement: string;
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

function writeTurtle(quads: Quad[], extraPrefixes?: Record<string, string>): Promise<string> {
  const writer = new Writer({ prefixes: { ...WRITER_PREFIXES, ...extraPrefixes } });
  writer.addQuads(quads);
  return new Promise((resolve, reject) => {
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

/**
 * Serialise an arbitrary quad graph to Turtle with the model prefixes (+ any
 * extras, e.g. `odrl`). Used to write a Need together with its inline consent
 * policy in ONE resource. Callers own quad validation.
 */
export function serializeTurtle(
  quads: Quad[],
  extraPrefixes?: Record<string, string>,
): Promise<string> {
  return writeTurtle(quads, extraPrefixes);
}

/** Validate a {@link Need} and build its quads. Throws on an invalid field. */
export function buildNeedQuads(need: Need): Quad[] {
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
  return quads;
}

/** Serialise a {@link Need} to Turtle. Rejects on an invalid required IRI. */
export async function serializeNeed(need: Need): Promise<string> {
  return writeTurtle(buildNeedQuads(need));
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
// The readers are EXPORTED for the scope-specific model modules (infra — S2;
// society — S4) so every foreign-RDF read in the codebase shares this ONE
// reviewed hostile-input discipline, never a per-module reimplementation.

/** The single object term for (s,p), or undefined unless there is exactly one. */
function single(ds: DatasetCore, s: Term, p: string): Term | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) return q.object;
  return undefined;
}

/** A single http(s)-IRI object, else undefined. */
export function readIri(ds: DatasetCore, s: Term, p: string): string | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "NamedNode") return undefined;
  return isHttpIri(t.value) ? t.value : undefined;
}

/**
 * EVERY http(s)-IRI object of (s,p): non-IRI/malformed values drop (field-level
 * hostility isolation), duplicates collapse, output is sorted (deterministic
 * regardless of dataset iteration order) and capped at `max` — a hostile pod
 * cannot fan a link property out unboundedly.
 */
export function readIris(ds: DatasetCore, s: Term, p: string, max: number = MAX_LINKS): string[] {
  const out = new Set<string>();
  for (const q of ds.match(s, namedNode(p), null, null)) {
    if (q.object.termType === "NamedNode" && isHttpIri(q.object.value)) out.add(q.object.value);
  }
  return [...out].sort().slice(0, max);
}

/**
 * A single string-typed literal capped at `max`, else undefined. Accepts ONLY
 * a plain/`xsd:string` literal or a language-tagged `rdf:langString` — a
 * hostile pod publishing e.g. `as:content "123"^^xsd:integer` is rejected
 * (the field is not textual content).
 */
export function readString(ds: DatasetCore, s: Term, p: string, max: number): string | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "Literal") return undefined;
  const lit = t as Literal;
  if (lit.datatype.value !== XSD_STRING && lit.datatype.value !== RDF_LANGSTRING) return undefined;
  const value = lit.value;
  if (value.length > max) return undefined;
  return value;
}

/** A single xsd:dateTime literal whose value is a real date, else undefined. */
export function readDateTime(ds: DatasetCore, s: Term, p: string): string | undefined {
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

/**
 * A single xsd:boolean literal, else undefined (drops the field). Accepts the
 * four XSD lexical forms only ("true"/"false"/"1"/"0") — anything else from a
 * hostile pod drops the field, never coerces.
 */
export function readBoolean(ds: DatasetCore, s: Term, p: string): boolean | undefined {
  const t = single(ds, s, p);
  if (t?.termType !== "Literal") return undefined;
  const lit = t as Literal;
  if (lit.datatype.value !== `${NS.xsd}boolean`) return undefined;
  if (lit.value === "true" || lit.value === "1") return true;
  if (lit.value === "false" || lit.value === "0") return false;
  return undefined;
}

/** A single coded object IRI accepted by `ok`, else undefined (drops the field). */
export function readCoded<T extends string>(
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
export function typedSubjects(ds: DatasetCore, cls: string): NamedNode[] {
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

// ── AppProposal (S1 — the scope-A proposal layer) ─────────────────────────────

/** Shared validation for the common statement fields. Throws on invalid.
 * Exported for the scope-specific model modules (infra — S2; society — S4). */
export function assertStatementCore(
  kind: string,
  fields: { id: string; creator: string; inDeliberation: string; created: string; content: string },
): void {
  for (const iri of [fields.id, fields.creator, fields.inDeliberation]) {
    if (!isHttpIri(iri)) throw new Error(`${kind}: not an http(s) IRI: ${iri}`);
  }
  if (fields.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`${kind}: content exceeds MAX_CONTENT_LENGTH`);
  }
  if (!isValidXsdDateTime(fields.created)) {
    throw new Error(`${kind}: created is not a valid xsd:dateTime: ${fields.created}`);
  }
}

/** Validate an {@link AppProposal} and build its quads. Throws on an invalid field. */
export function buildProposalQuads(proposal: AppProposal): Quad[] {
  assertStatementCore("serializeProposal", proposal);
  if (proposal.motivatedBy.length === 0) {
    throw new Error("serializeProposal: a proposal must trace to ≥1 need (fut:motivatedBy)");
  }
  if (proposal.motivatedBy.length > MAX_LINKS) {
    throw new Error(`serializeProposal: motivatedBy exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const iri of proposal.motivatedBy) {
    if (!isHttpIri(iri)) throw new Error(`serializeProposal: not an http(s) IRI: ${iri}`);
  }
  if (proposal.title.length === 0 || proposal.title.length > MAX_TITLE_LENGTH) {
    throw new Error("serializeProposal: title must be 1–200 characters");
  }
  if (
    proposal.indirectStakeholders !== undefined &&
    proposal.indirectStakeholders.length > MAX_CONTENT_LENGTH
  ) {
    throw new Error("serializeProposal: indirectStakeholders exceeds MAX_CONTENT_LENGTH");
  }
  const s = namedNode(proposal.id);
  const { quad } = DataFactory;
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_APP_PROPOSAL)),
    // Asserted explicitly (not left to OWL subclass reasoning) so plain
    // wf:Task readers — solid-issues, Pod Manager — federate proposals as-is.
    quad(s, namedNode(RDF_TYPE), namedNode(WF_TASK)),
    quad(s, namedNode(DCT_TITLE), literal(proposal.title)),
    quad(s, namedNode(AS_CONTENT), literal(proposal.content)),
    quad(s, namedNode(DCT_CREATED), literal(proposal.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(proposal.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(proposal.inDeliberation)),
    ...proposal.motivatedBy.map((n) => quad(s, namedNode(FUT_MOTIVATED_BY), namedNode(n))),
  ];
  if (proposal.indirectStakeholders !== undefined && proposal.indirectStakeholders.length > 0) {
    quads.push(
      quad(s, namedNode(FUT_INDIRECT_STAKEHOLDERS), literal(proposal.indirectStakeholders)),
    );
  }
  return quads;
}

/** Serialise an {@link AppProposal} to Turtle. Throws on an invalid field. */
export async function serializeProposal(proposal: AppProposal): Promise<string> {
  return writeTurtle(buildProposalQuads(proposal), { wf: NS.wf });
}

/** Parse every well-formed {@link AppProposal} in the dataset; malformed items drop. */
export function parseProposals(ds: DatasetCore): AppProposal[] {
  const out: AppProposal[] = [];
  for (const s of typedSubjects(ds, FUT_APP_PROPOSAL)) {
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    const motivatedBy = readIris(ds, s, FUT_MOTIVATED_BY);
    if (
      title === undefined ||
      title.length === 0 || // mirrors buildProposalQuads: a title is 1–200 chars
      content === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      motivatedBy.length === 0 // the SHACL MUST: no needs-trace → not a proposal
    ) {
      continue; // a required field is malformed → drop this item, keep siblings
    }
    const indirectStakeholders = readString(ds, s, FUT_INDIRECT_STAKEHOLDERS, MAX_CONTENT_LENGTH);
    out.push({
      id: s.value,
      title,
      content,
      motivatedBy,
      created,
      creator,
      inDeliberation,
      ...(indirectStakeholders !== undefined ? { indirectStakeholders } : {}),
    });
  }
  return out;
}

// ── SynthesisCandidate + Critique (S1 — the Convergence Room) ─────────────────

/** Validate a {@link SynthesisCandidate} and build its quads. Throws on invalid. */
export function buildCandidateQuads(candidate: SynthesisCandidate): Quad[] {
  assertStatementCore("serializeCandidate", candidate);
  if (candidate.derivedFrom.length === 0) {
    throw new Error(
      "serializeCandidate: a candidate must derive from ≥1 input (prov:wasDerivedFrom)",
    );
  }
  if (candidate.derivedFrom.length > MAX_LINKS) {
    throw new Error(`serializeCandidate: derivedFrom exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const iri of candidate.derivedFrom) {
    if (!isHttpIri(iri)) throw new Error(`serializeCandidate: not an http(s) IRI: ${iri}`);
  }
  if (candidate.revisionOf !== undefined && !isHttpIri(candidate.revisionOf)) {
    throw new Error(`serializeCandidate: not an http(s) IRI: ${candidate.revisionOf}`);
  }
  if (candidate.title !== undefined && candidate.title.length > MAX_TITLE_LENGTH) {
    throw new Error("serializeCandidate: title exceeds MAX_TITLE_LENGTH");
  }
  const s = namedNode(candidate.id);
  const { quad } = DataFactory;
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_SPEC_SYNTHESIS)),
    quad(s, namedNode(AS_CONTENT), literal(candidate.content)),
    quad(s, namedNode(DCT_CREATED), literal(candidate.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(candidate.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(candidate.inDeliberation)),
    ...candidate.derivedFrom.map((n) => quad(s, namedNode(PROV_WAS_DERIVED_FROM), namedNode(n))),
  ];
  if (candidate.title !== undefined && candidate.title.length > 0) {
    quads.push(quad(s, namedNode(DCT_TITLE), literal(candidate.title)));
  }
  if (candidate.revisionOf !== undefined) {
    quads.push(quad(s, namedNode(PROV_WAS_REVISION_OF), namedNode(candidate.revisionOf)));
  }
  return quads;
}

/** Serialise a {@link SynthesisCandidate} to Turtle. Throws on an invalid field. */
export async function serializeCandidate(candidate: SynthesisCandidate): Promise<string> {
  return writeTurtle(buildCandidateQuads(candidate), { prov: NS.prov });
}

/** Parse every well-formed {@link SynthesisCandidate}; malformed items drop. */
export function parseCandidates(ds: DatasetCore): SynthesisCandidate[] {
  const out: SynthesisCandidate[] = [];
  for (const s of typedSubjects(ds, FUT_SPEC_SYNTHESIS)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    const derivedFrom = readIris(ds, s, PROV_WAS_DERIVED_FROM);
    if (
      content === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      derivedFrom.length === 0 // SHACL: a SharedFuture MUST have ≥1 wasDerivedFrom
    ) {
      continue;
    }
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    const revisionOf = readIri(ds, s, PROV_WAS_REVISION_OF);
    out.push({
      id: s.value,
      content,
      derivedFrom,
      created,
      creator,
      inDeliberation,
      ...(title !== undefined ? { title } : {}),
      ...(revisionOf !== undefined ? { revisionOf } : {}),
    });
  }
  return out;
}

/** Validate a {@link Critique} and build its quads. Throws on an invalid field. */
export function buildCritiqueQuads(critique: Critique): Quad[] {
  assertStatementCore("serializeCritique", critique);
  if (!isHttpIri(critique.onStatement)) {
    throw new Error(`serializeCritique: not an http(s) IRI: ${critique.onStatement}`);
  }
  if (critique.content.length === 0) {
    throw new Error("serializeCritique: a critique must carry text");
  }
  const s = namedNode(critique.id);
  const { quad } = DataFactory;
  return [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_CRITIQUE)),
    quad(s, namedNode(AS_CONTENT), literal(critique.content)),
    quad(s, namedNode(FUT_ON_STATEMENT), namedNode(critique.onStatement)),
    quad(s, namedNode(DCT_CREATED), literal(critique.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(critique.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(critique.inDeliberation)),
  ];
}

/** Serialise a {@link Critique} to Turtle. Throws on an invalid field. */
export async function serializeCritique(critique: Critique): Promise<string> {
  return writeTurtle(buildCritiqueQuads(critique));
}

/** Parse every well-formed {@link Critique}; malformed items drop. */
export function parseCritiques(ds: DatasetCore): Critique[] {
  const out: Critique[] = [];
  for (const s of typedSubjects(ds, FUT_CRITIQUE)) {
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const onStatement = readIri(ds, s, FUT_ON_STATEMENT);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (
      content === undefined ||
      content.length === 0 || // mirrors buildCritiqueQuads: a critique carries text
      onStatement === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined
    ) {
      continue;
    }
    out.push({ id: s.value, content, onStatement, created, creator, inDeliberation });
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
