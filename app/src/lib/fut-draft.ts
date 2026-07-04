// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The futures-sector 0.2.0 DRAFT terms (docs/SCOPE-DIFFERENTIATION.md §3.2 +
// §4.2; Turtle draft in vocab/futures-0.2.0-draft.ttl). ADDITIVE and
// non-breaking over the landed 0.1.0 sector; the sector bump itself lands in
// solid-federation-vocab through the FIRST scope-B deliberation (§3.1
// self-hosting — milestone B4 run for real), so nothing here is asserted as
// a published vocabulary: it is the draft the deliberation will ratify.
//
// Wiring status:
//   • WIRED in S1 (ahead of the bump, per the self-hosting plan):
//     fut:Critique + fut:indirectStakeholders (the Convergence Room's critique
//     unit and the VSD compose prompt — see the doc's "Build decisions").
//   • NOT yet wired (S2 flips scope B live; S4 flips scope C):
//     InfraProposal + its properties, AdoptionDecision/AdoptionObservation,
//     methodProvenance, decomposedBy.
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
