// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The `fut:` (futures) sector constants + the Max-Neef need scheme — the
// vocabulary the Stage-1 data model reads and writes. Design source:
// design/01-data-model.md (class inventory, the needs/satisfiers split) and
// design/03-convergence.md §2 (why Max-Neef is the convergence substrate).
//
// Nothing here mints RDF strings by hand; these are IRI constants consumed by
// model.ts (which serialises via n3.Writer and parses via @jeswr/fetch-rdf).

/** Namespace IRIs. */
export const NS = {
  fut: "https://w3id.org/jeswr/sectors/futures#",
  as: "https://www.w3.org/ns/activitystreams#",
  dct: "http://purl.org/dc/terms/",
  skos: "http://www.w3.org/2004/02/skos/core#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  /** W3C SolidOS workflow ontology (the @jeswr/solid-task-model shared model). */
  wf: "http://www.w3.org/2005/01/wf/flow#",
  /** W3C PROV-O — derivation/revision provenance on syntheses. */
  prov: "http://www.w3.org/ns/prov#",
} as const;

/** `fut:` term builder. */
export const fut = (local: string): string => `${NS.fut}${local}`;
/** `as:` term builder. */
export const as = (local: string): string => `${NS.as}${local}`;
/** `dct:` term builder. */
export const dct = (local: string): string => `${NS.dct}${local}`;
/** `skos:` term builder. */
export const skos = (local: string): string => `${NS.skos}${local}`;

// ── Classes (design/01; all landed in the 0.1.0 sector vocabulary) ──────────
export const FUT_NEED = fut("Need");
export const FUT_RESONANCE = fut("Resonance");
/** `fut:AppProposal` ⊑ `wf:Task` — scope A's proposal artifact (design/01 Stage-1 layer). */
export const FUT_APP_PROPOSAL = fut("AppProposal");
/** `fut:SpecSynthesis` ⊑ `fut:SharedFuture` — the converged app spec (design/01). */
export const FUT_SPEC_SYNTHESIS = fut("SpecSynthesis");
/** `wf:Task` — asserted alongside fut:AppProposal so plain wf:Task readers
 * (solid-issues, Pod Manager) federate proposals without OWL reasoning. */
export const WF_TASK = `${NS.wf}Task`;

// ── Properties ──────────────────────────────────────────────────────────────
export const RDF_TYPE = `${NS.rdf}type`;
export const AS_CONTENT = as("content");
export const FUT_NEED_CONCEPT = fut("needConcept");
export const FUT_INTENSITY = fut("intensity");
export const DCT_CREATED = dct("created");
export const DCT_CREATOR = dct("creator");
export const DCT_TITLE = dct("title");
export const FUT_IN_DELIBERATION = fut("inDeliberation");
export const FUT_ON_STATEMENT = fut("onStatement");
export const FUT_STANCE = fut("stance");
export const FUT_DIMENSION = fut("dimension");
/** `fut:motivatedBy` — AppProposal → the Need(s)/ValueStatement(s) it serves (≥1, SHACL MUST). */
export const FUT_MOTIVATED_BY = fut("motivatedBy");
/** `prov:wasDerivedFrom` — a synthesis candidate → every input statement. */
export const PROV_WAS_DERIVED_FROM = `${NS.prov}wasDerivedFrom`;
/** `prov:wasRevisionOf` — a revised candidate → the candidate it revises (bounded rounds). */
export const PROV_WAS_REVISION_OF = `${NS.prov}wasRevisionOf`;

// ── The Max-Neef need scheme (design/01 "needs/satisfiers split") ────────────
// The nine fundamental human needs, few and universal per Max-Neef, Elizalde &
// Hopenhayn, *Human Scale Development* (1991). Seeded as a SKOS ConceptScheme;
// communities may publish their own scheme and cross-map — model.ts therefore
// ACCEPTS foreign concept IRIs (any IRI), and this list is only the default
// picker + validation aid, never a closed set.
export const MAXNEEF_SCHEME = fut("maxneefScheme");

/** A Max-Neef need concept. */
export interface NeedConcept {
  /** The concept IRI, `fut:maxneef-<name>`. */
  readonly iri: string;
  /** The short machine name. */
  readonly name: string;
  /** The human label. */
  readonly label: string;
}

const MAXNEEF_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["subsistence", "Subsistence"],
  ["protection", "Protection"],
  ["affection", "Affection"],
  ["understanding", "Understanding"],
  ["participation", "Participation"],
  ["idleness", "Idleness / leisure"],
  ["creation", "Creation"],
  ["identity", "Identity"],
  ["freedom", "Freedom"],
];

/** The nine seeded Max-Neef need concepts, in canonical order. */
export const MAXNEEF_CONCEPTS: ReadonlyArray<NeedConcept> = MAXNEEF_NAMES.map(([name, label]) => ({
  iri: fut(`maxneef-${name}`),
  name,
  label,
}));

/** Fast IRI → concept lookup over the seed scheme. */
export const MAXNEEF_BY_IRI: ReadonlyMap<string, NeedConcept> = new Map(
  MAXNEEF_CONCEPTS.map((c) => [c.iri, c]),
);

// ── Coded resonance stances (design/01 reaction layer — tri-state) ───────────
export const STANCE_RESONATES = fut("Resonates");
export const STANCE_CONFLICTS = fut("Conflicts");
export const STANCE_UNSURE = fut("Unsure");

/** The three coded stance IRIs. Any other value on read drops the item. */
export const STANCES = [STANCE_RESONATES, STANCE_CONFLICTS, STANCE_UNSURE] as const;
export type Stance = (typeof STANCES)[number];
const STANCE_SET: ReadonlySet<string> = new Set(STANCES);
export const isStance = (v: string): v is Stance => STANCE_SET.has(v);

// ── Coded resonance dimensions (optional qualifier) ──────────────────────────
export const DIM_SHARE = fut("IShareThis");
export const DIM_ASPIRE = fut("IAspireToThis");
export const DIM_SUPPORT = fut("IWouldSupportThis");

/** The three coded dimension IRIs. A non-coded value on read drops the field. */
export const DIMENSIONS = [DIM_SHARE, DIM_ASPIRE, DIM_SUPPORT] as const;
export type Dimension = (typeof DIMENSIONS)[number];
const DIMENSION_SET: ReadonlySet<string> = new Set(DIMENSIONS);
export const isDimension = (v: string): v is Dimension => DIMENSION_SET.has(v);

// ── ODRL consent layer (design/01 "The ODRL consent layer") ──────────────────
// The `fut:` ODRL-profile actions an author's standing consent policy permits or
// prohibits over an expression-layer resource (fut:consentActionScheme). These
// IRIs match the landed futures sector vocabulary exactly (solid-federation-vocab
// sectors/futures/futures.ttl). Defaults are CONSERVATIVE: aggregate + synthesize
// permitted; quoteVerbatim + governmentUse prohibited until explicitly granted.
/** May be included in opinion-space mapping + convergence metrics (k-anonymous). */
export const CONSENT_AGGREGATE = fut("aggregate");
/** May be an input to a fut:SharedFuture (prov:wasDerivedFrom). */
export const CONSENT_SYNTHESIZE = fut("synthesize");
/** May be quoted verbatim in a synthesis / dissent record. */
export const CONSENT_QUOTE_VERBATIM = fut("quoteVerbatim");
/** Derived artifacts may be forwarded into Stage-3 governance reporting. */
export const CONSENT_GOVERNMENT_USE = fut("governmentUse");
/** ODRL left operand: the k-anonymity constraint on derivation (unite default k=5). */
export const CONSENT_K_THRESHOLD = fut("kThreshold");
/** unite's default k-anonymity threshold for any derived publication (design/01). */
export const DEFAULT_K_THRESHOLD = 5;
