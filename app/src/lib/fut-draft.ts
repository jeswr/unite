// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The futures-sector 0.2.0 terms (docs/SCOPE-DIFFERENTIATION.md §3.2 + §4.2).
// The S1 draft (vocab/futures-0.2.0-draft.ttl) has since been FORMALISED into
// the sector-contract home: solid-federation-vocab sectors/futures/futures.ttl
// @ 67b00be now carries owl:versionInfo 0.2.0 with the immutable version IRI
// <https://w3id.org/jeswr/sectors/futures/0.2.0> — every term here matches it.
// Publication ≠ adoption (design/04 §2): 0.2.0 becomes *Current* only on
// measured fedreg:acceptsSpec advertisement, which is exactly what the first
// scope-B deliberation (§3.1 self-hosting, milestone B4) deliberates and the
// S2 Adoption board makes visible.
//
// Wiring status:
//   • WIRED in S1: fut:Critique + fut:indirectStakeholders (the Convergence
//     Room's critique unit and the VSD compose prompt).
//   • WIRED in S2 (scope B live): InfraProposal + its properties (lib/infra.ts)
//     and the AdoptionObservation SHAPE as computed data (lib/adoption.ts —
//     the signed fut:AdoptionDecision artifact itself is S3).
//   • WIRED in S4 (scope C's voice layer): fut:decomposedBy (the Claim
//     round-trip in model-society.ts carries it for the assistant seam;
//     manual decomposition omits it).
//   • NOT yet wired: fut:methodProvenance (S5 serialises it onto the signed
//     SharedFuture — S4 presents the method label, ui/views/SharedFutureOutcome).

//
// These are IRI constants only — serialisation stays in model.ts (n3.Writer),
// parsing stays guarded (foreign RDF is hostile input). Nothing here mints
// RDF strings by hand.

import { fut } from "./fut.js";

// ── Scope B (§3.2): the infrastructure-proposal layer — S2 wires these ──────

/** `fut:InfraProposal` ⊑ `wf:Task` — a proposed change to a shared digital system. */
export const FUT_INFRA_PROPOSAL = fut("InfraProposal");
/** `fut:targetsSystem` — the governed artifact being changed (≥1, SHACL MUST). */
export const FUT_TARGETS_SYSTEM = fut("targetsSystem");
/** `fut:proposalKind` — the change kind (coded individuals, the fedreg:status pattern). */
export const FUT_PROPOSAL_KIND = fut("proposalKind");
export const KIND_SPEC_CHANGE = fut("SpecChange");
export const KIND_NEW_SPEC = fut("NewSpec");
export const KIND_SERVICE_OPERATION = fut("ServiceOperation");
export const KIND_DEPRECATION = fut("Deprecation");
/** The coded proposal kinds. A non-coded value on read drops the field. */
export const PROPOSAL_KINDS = [
  KIND_SPEC_CHANGE,
  KIND_NEW_SPEC,
  KIND_SERVICE_OPERATION,
  KIND_DEPRECATION,
] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
const PROPOSAL_KIND_SET: ReadonlySet<string> = new Set(PROPOSAL_KINDS);
export const isProposalKind = (v: string): v is ProposalKind => PROPOSAL_KIND_SET.has(v);

/** `fut:affectsRole` — blast radius by stakeholder role (≥1, SHACL MUST). */
export const FUT_AFFECTS_ROLE = fut("affectsRole");
export const ROLE_IMPLEMENTER = fut("ImplementerRole");
export const ROLE_OPERATOR = fut("OperatorRole");
export const ROLE_PARTICIPANT = fut("ParticipantRole");
/** The coded stakeholder roles (declared-then-verified, fail-closed to participant). */
export const STAKEHOLDER_ROLES = [ROLE_IMPLEMENTER, ROLE_OPERATOR, ROLE_PARTICIPANT] as const;
export type StakeholderRole = (typeof STAKEHOLDER_ROLES)[number];
const STAKEHOLDER_ROLE_SET: ReadonlySet<string> = new Set(STAKEHOLDER_ROLES);
export const isStakeholderRole = (v: string): v is StakeholderRole => STAKEHOLDER_ROLE_SET.has(v);

/** `fut:breakingChange` (xsd:boolean) — SHACL: true ⇒ fut:migrationPath present. */
export const FUT_BREAKING_CHANGE = fut("breakingChange");
/** `fut:migrationPath` — the plain-language migration story. */
export const FUT_MIGRATION_PATH = fut("migrationPath");
/** `fut:referenceImplementation` — running code (REQUIRED before endorsement, not compose). */
export const FUT_REFERENCE_IMPLEMENTATION = fut("referenceImplementation");

// ── Scope B (§3.2): the adoption-decision output — S2 wires these ───────────

/** `fut:AdoptionDecision` ⊑ `fut:SharedFuture` — a converged recommendation to
 * adopt a spec version; ratification is MEASURED on the wire, never asserted
 * (there is deliberately no adoptionStatus decree property). */
export const FUT_ADOPTION_DECISION = fut("AdoptionDecision");
export const FUT_PROPOSES_VERSION = fut("proposesVersion");
export const FUT_ADOPTION_BAR = fut("adoptionBar");
export const FUT_ADOPTION_EVIDENCE = fut("adoptionEvidence");
/** `fut:AdoptionObservation` — one observed fedreg:acceptsSpec advertisement. */
export const FUT_ADOPTION_OBSERVATION = fut("AdoptionObservation");
export const FUT_OBSERVED_PARTY = fut("observedParty");
export const FUT_OBSERVED_VERSION = fut("observedVersion");
export const FUT_OBSERVED_AT = fut("observedAt");
/** The registry/storage-description IRI the claim can be re-checked against —
 * an index entry is a cache, never authoritative (design/02 §2). */
export const FUT_OBSERVATION_SOURCE = fut("observationSource");

// ── fut:SharedFuture annex terms (published sector; S3 wires the AdoptionDecision
//    subset — the inherited mandatory dissent + bridging evidence — and S5 the
//    full SharedFuture). Every IRI matches solid-federation-vocab
//    sectors/futures/futures.ttl exactly (verified against the published sector). ─

/** `fut:SharedFuture` — the convergence-artifact superclass. `fut:AdoptionDecision`
 * ⊑ `fut:SharedFuture`, so the decision is typed as BOTH (asserted explicitly, the
 * infra.ts convention, so plain SharedFuture readers see it without OWL reasoning)
 * and inherits the mandatory dissent annex + bridging evidence. */
export const FUT_SHARED_FUTURE = fut("SharedFuture");

/** `fut:bridgingEvidence` → `fut:BridgingEvidence` — per-cluster endorsement
 * statistics (≥1 mandatory, SHACL): the proof a synthesis is common ground, not
 * one cluster's position. Recomputable by any consumer from the raw counts. */
export const FUT_BRIDGING_EVIDENCE = fut("bridgingEvidence");
export const FUT_BRIDGING_EVIDENCE_CLASS = fut("BridgingEvidence");
/** The opaque k-anonymous cluster label (never a member list). */
export const FUT_CLUSTER_LABEL = fut("clusterLabel");
export const FUT_RESONATES_COUNT = fut("resonatesCount");
export const FUT_CONFLICTS_COUNT = fut("conflictsCount");
export const FUT_UNSURE_COUNT = fut("unsureCount");
export const FUT_SEEN_COUNT = fut("seenCount");
/** `fut:bridgingScore` (xsd:decimal, no domain) — the group-informed-consensus
 * factor, carried on a BridgingEvidence (per-cluster) or the synthesis (product). */
export const FUT_BRIDGING_SCORE = fut("bridgingScore");

/** `fut:dissent` → `fut:DissentRecord` — the MANDATORY dissent annex (INV-2): a
 * first-class minority report. A SharedFuture is INVALID without either ≥1
 * `fut:dissent` OR an explicit `fut:noDissentRecorded true` — convergence must
 * never mean erasure. */
export const FUT_DISSENT = fut("dissent");
export const FUT_DISSENT_RECORD = fut("DissentRecord");
/** `fut:noDissentRecorded` (xsd:boolean) — the EXPLICIT "no dissent" assertion;
 * required `true` whenever a SharedFuture carries no `fut:dissent` (silence is
 * never treated as consensus). */
export const FUT_NO_DISSENT_RECORDED = fut("noDissentRecorded");
/** `fut:endorsedBy` — a post-synthesis Resonance endorsing/contesting the artifact. */
export const FUT_ENDORSED_BY = fut("endorsedBy");

// ── Scope C (§4.2): self-describing legitimacy — S4/S5 wire these ───────────

/** `fut:methodProvenance` — SharedFuture → the deliberation-method concept
 * (resonance-mapping / mediated-synthesis / mini-public). SHACL: REQUIRED on
 * any SharedFuture whose inputs permitted fut:governmentUse. */
export const FUT_METHOD_PROVENANCE = fut("methodProvenance");
/** `fut:decomposedBy` — a derived Claim → the decomposition prov:Activity
 * (with prov:hadPlan), mirroring the SynthesisMediator PROV pattern. */
export const FUT_DECOMPOSED_BY = fut("decomposedBy");

// ── Convergence Room (S1 — WIRED ahead of the sector bump) ──────────────────

/** `fut:Critique` — one critique in a Convergence-Room critique round
 * (design/03 §4 step 2: critiques are captured AS DATA; design/01 assembles
 * the DissentRecord FROM them but never assigned the unit a class — this
 * draft does). Properties: as:content, fut:onStatement → the candidate,
 * dct:created/creator, fut:inDeliberation. Standing critiques at endorsement
 * time are the raw material of the mandatory dissent annex. */
export const FUT_CRITIQUE = fut("Critique");

/** `fut:indirectStakeholders` — the VSD prompt (design/03 §5; Friedman &
 * Hendry 2019): who is affected that is not in the room, free text on a
 * proposal. Part of scope A's compose grammar (§1 row 1). */
export const FUT_INDIRECT_STAKEHOLDERS = fut("indirectStakeholders");
