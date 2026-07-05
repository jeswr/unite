// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C (society) expression-layer vocabulary constants (S4 —
// docs/SCOPE-DIFFERENTIATION.md §4; design/01 "Expression layer"). Every term
// here is in the LANDED futures sector (solid-federation-vocab
// sectors/futures/futures.ttl, 0.1.0 classes + the 0.2.0 delta) — nothing is
// minted by this module, and nothing here builds RDF strings by hand: these
// are IRI constants consumed by model-society.ts (n3.Writer serialise,
// guarded parse).

import { fut } from "./fut.js";

// ── Classes (design/01 expression layer; landed 0.1.0 sector) ────────────────

/** `fut:VisionStatement` — "my ideal future": a whole narrative, decomposed
 * into atomic claims via the compose-inversion wizard (§4.3). */
export const FUT_VISION_STATEMENT = fut("VisionStatement");
/** `fut:Claim` — an ATOMIC, voteable statement (the Pol.is unit); as:content
 * ≤ 500 chars (SHACL atomicity). Enters deliberation ONLY when adopted. */
export const FUT_CLAIM = fut("Claim");
/** `fut:ValueStatement` — the author HOLDS a value (fut:valueConcept →
 * a Schwartz seed or any community scheme concept). */
export const FUT_VALUE_STATEMENT = fut("ValueStatement");

// ── Properties ───────────────────────────────────────────────────────────────

/** `fut:adoptedBy` — the C6 consent invariant: nothing enters deliberation
 * attributed to a person without this explicit assertion (design/03 §1). */
export const FUT_ADOPTED_BY = fut("adoptedBy");
/** `fut:scope` — WHOM the envisioned future is for (the scope ladder). */
export const FUT_SCOPE = fut("scope");
/** `fut:horizon` — the optional target YEAR (xsd:gYear) of a vision. */
export const FUT_HORIZON = fut("horizon");
/** `fut:valueConcept` — ValueStatement → a value-scheme concept (open to
 * foreign schemes, like fut:needConcept). */
export const FUT_VALUE_CONCEPT = fut("valueConcept");

/** Max accepted `as:content` on a `fut:Claim` (SHACL atomicity — design/01). */
export const MAX_CLAIM_LENGTH = 500;

// ── The scope ladder (fut:scopeScheme — 5 coded concepts) ────────────────────
// Coded like fedreg:status: a non-coded value on read DROPS the field (the
// ladder matters for convergence — design/03 §2 — so junk must not enter it).

export const SCOPE_SELF = fut("self");
export const SCOPE_HOUSEHOLD = fut("household");
export const SCOPE_COMMUNITY = fut("community");
export const SCOPE_NATION = fut("nation");
export const SCOPE_HUMANITY = fut("humanity");

/** One rung of the vision scope ladder. */
export interface VisionScopeConcept {
  readonly iri: string;
  readonly name: string;
  readonly label: string;
}

/** The five scope-ladder concepts, in ladder order (self → humanity). */
export const VISION_SCOPES: ReadonlyArray<VisionScopeConcept> = [
  { iri: SCOPE_SELF, name: "self", label: "Myself" },
  { iri: SCOPE_HOUSEHOLD, name: "household", label: "My household" },
  { iri: SCOPE_COMMUNITY, name: "community", label: "My community" },
  { iri: SCOPE_NATION, name: "nation", label: "My nation" },
  { iri: SCOPE_HUMANITY, name: "humanity", label: "Humanity" },
] as const;

const VISION_SCOPE_SET: ReadonlySet<string> = new Set(VISION_SCOPES.map((s) => s.iri));
/** Type guard for a coded vision-scope IRI. */
export const isVisionScope = (v: string): v is string => VISION_SCOPE_SET.has(v);

/** Fast IRI → concept lookup over the scope ladder. */
export const VISION_SCOPE_BY_IRI: ReadonlyMap<string, VisionScopeConcept> = new Map(
  VISION_SCOPES.map((s) => [s.iri, s]),
);

// ── The Schwartz value scheme (fut:valueScheme — 10 seeded concepts) ─────────
// Schwartz (1992) basic values: a stable circumplex replicated across dozens
// of cultures (design/01 "value scheme"). Like the Max-Neef seeds, this list
// is the default PICKER, never a closed set — model-society ACCEPTS foreign
// value-concept IRIs (communities publish and cross-map their own schemes).

/** A Schwartz basic-value concept. */
export interface ValueConcept {
  /** The concept IRI, `fut:schwartz-<name>`. */
  readonly iri: string;
  readonly name: string;
  readonly label: string;
}

const SCHWARTZ_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["self-direction", "Self-direction"],
  ["stimulation", "Stimulation"],
  ["hedonism", "Hedonism"],
  ["achievement", "Achievement"],
  ["power", "Power"],
  ["security", "Security"],
  ["conformity", "Conformity"],
  ["tradition", "Tradition"],
  ["benevolence", "Benevolence"],
  ["universalism", "Universalism"],
];

/** The ten seeded Schwartz value concepts, in circumplex order. */
export const SCHWARTZ_CONCEPTS: ReadonlyArray<ValueConcept> = SCHWARTZ_NAMES.map(
  ([name, label]) => ({ iri: fut(`schwartz-${name}`), name, label }),
);

/** Fast IRI → concept lookup over the Schwartz seeds. */
export const SCHWARTZ_BY_IRI: ReadonlyMap<string, ValueConcept> = new Map(
  SCHWARTZ_CONCEPTS.map((c) => [c.iri, c]),
);

// ── Deliberation methods (fut:methodScheme) ──────────────────────────────────
// The method-provenance label a scope-C output carries (design/03 §5: anything
// forwarded to governance names the method that produced it). S4 presents the
// label; S5 serialises it onto the signed SharedFuture via fut:methodProvenance.

export const METHOD_RESONANCE_MAPPING = fut("resonanceMapping");
export const METHOD_MEDIATED_SYNTHESIS = fut("mediatedSynthesis");
export const METHOD_MINI_PUBLIC = fut("miniPublic");

/** The three coded deliberation-method concepts. A non-coded value on read drops
 * the field; S5's `fut:methodProvenance` MUST be one of these (design/03 §5). */
export const METHODS = [
  METHOD_RESONANCE_MAPPING,
  METHOD_MEDIATED_SYNTHESIS,
  METHOD_MINI_PUBLIC,
] as const;
export type Method = (typeof METHODS)[number];
const METHOD_SET: ReadonlySet<string> = new Set(METHODS);
/** Type guard for a coded deliberation-method concept IRI. */
export const isMethod = (v: string): v is Method => METHOD_SET.has(v);
