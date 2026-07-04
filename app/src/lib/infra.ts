// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B infrastructure-proposal model (S2 — SCOPE-DIFFERENTIATION §3.2):
// the typed round-trip for `fut:InfraProposal` ⊑ `wf:Task`, following model.ts's
// pattern exactly and grounded in the PUBLISHED futures sector 0.2.0
// (solid-federation-vocab sectors/futures/futures.ttl @ 67b00be — the S1 draft
// formalised; every term here matches that vocabulary).
//
// SERIALISE with n3.Writer ONLY; PARSE via the guarded typed accessors model.ts
// exports. FOREIGN DATA IS HOSTILE INPUT: a malformed optional field drops the
// FIELD, a malformed required field (or a violated SHACL MUST) drops the ITEM —
// never a throw, never an aborted sibling parse. The SHACL MUSTs enforced both
// ways (build throws / parse drops):
//   • ≥1 fut:targetsSystem       (what governed system is being changed)
//   • ≥1 fut:affectsRole         (blast radius by stakeholder role)
//   • ≥1 fut:motivatedBy         (the needs trace — value-centric, inherited)
//   • fut:breakingChange true ⇒ fut:migrationPath present (interop honesty)
// fut:referenceImplementation is optional at COMPOSE (design/04 §2: running
// code is required before ENDORSEMENT, not before compose) and is displayed as
// a link, never fetched/executed by the client (§7 security posture).

import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory } from "n3";
import {
  AS_CONTENT,
  DCT_CREATED,
  DCT_CREATOR,
  DCT_TITLE,
  FUT_IN_DELIBERATION,
  FUT_MOTIVATED_BY,
  NS,
  RDF_TYPE,
  WF_TASK,
} from "./fut.js";
import {
  FUT_AFFECTS_ROLE,
  FUT_BREAKING_CHANGE,
  FUT_INDIRECT_STAKEHOLDERS,
  FUT_INFRA_PROPOSAL,
  FUT_MIGRATION_PATH,
  FUT_PROPOSAL_KIND,
  FUT_REFERENCE_IMPLEMENTATION,
  FUT_TARGETS_SYSTEM,
  isProposalKind,
  isStakeholderRole,
  type ProposalKind,
  type StakeholderRole,
} from "./fut-draft.js";
import {
  assertStatementCore,
  isHttpIri,
  MAX_CONTENT_LENGTH,
  MAX_LINKS,
  MAX_TITLE_LENGTH,
  readBoolean,
  readCoded,
  readDateTime,
  readIri,
  readIris,
  readString,
  serializeTurtle,
  typedSubjects,
} from "./model.js";

const { namedNode, literal, quad } = DataFactory;

const XSD_BOOLEAN = `${NS.xsd}boolean`;
const XSD_DATETIME = `${NS.xsd}dateTime`;

/**
 * A `fut:InfraProposal` ⊑ `wf:Task` (futures 0.2.0; SCOPE-DIFFERENTIATION
 * §3.2): a proposed change to a shared digital system. Inherits the ≥1
 * `fut:motivatedBy` requirement — infrastructure proposals stay value-centric
 * too (what stops scope B degenerating into a feature-request tracker).
 */
export interface InfraProposal {
  /** The resource IRI (subject). */
  readonly id: string;
  /** `dct:title` — the short name task trackers render, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title: string;
  /** `as:content` — the plain-language change description, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `fut:targetsSystem` — the governed artifact(s) being changed (≥1, SHACL MUST). */
  readonly targetsSystem: readonly string[];
  /** `fut:proposalKind` — the coded change kind (wizard-required; drop-field on read). */
  readonly proposalKind?: ProposalKind;
  /** `fut:affectsRole` — blast radius by stakeholder role (≥1, SHACL MUST). */
  readonly affectsRole: readonly StakeholderRole[];
  /** `fut:breakingChange` — interop honesty; true ⇒ {@link InfraProposal.migrationPath}. */
  readonly breakingChange?: boolean;
  /** `fut:migrationPath` — the plain-language migration story a breaking change carries. */
  readonly migrationPath?: string;
  /** `fut:referenceImplementation` — running code (repo/commit IRI). Optional at
   * compose; REQUIRED before endorsement; displayed as a link, never fetched. */
  readonly referenceImplementation?: string;
  /** `fut:motivatedBy` — the Need/ValueStatement IRIs served (≥1). */
  readonly motivatedBy: readonly string[];
  /** `fut:indirectStakeholders` — the VSD prompt (optional free text). */
  readonly indirectStakeholders?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI. */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/** Validate an {@link InfraProposal} and build its quads. Throws on an invalid field. */
export function buildInfraProposalQuads(proposal: InfraProposal): Quad[] {
  assertStatementCore("serializeInfraProposal", proposal);
  if (proposal.title.length === 0 || proposal.title.length > MAX_TITLE_LENGTH) {
    throw new Error("serializeInfraProposal: title must be 1–200 characters");
  }
  if (proposal.targetsSystem.length === 0) {
    throw new Error(
      "serializeInfraProposal: a proposal must name ≥1 governed system (fut:targetsSystem)",
    );
  }
  if (proposal.targetsSystem.length > MAX_LINKS) {
    throw new Error(`serializeInfraProposal: targetsSystem exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const iri of proposal.targetsSystem) {
    if (!isHttpIri(iri)) throw new Error(`serializeInfraProposal: not an http(s) IRI: ${iri}`);
  }
  if (proposal.affectsRole.length === 0) {
    throw new Error(
      "serializeInfraProposal: a proposal must declare its blast radius (≥1 fut:affectsRole)",
    );
  }
  for (const role of proposal.affectsRole) {
    if (!isStakeholderRole(role)) {
      throw new Error(`serializeInfraProposal: not a coded stakeholder role: ${role}`);
    }
  }
  if (proposal.proposalKind !== undefined && !isProposalKind(proposal.proposalKind)) {
    throw new Error(`serializeInfraProposal: not a coded proposal kind: ${proposal.proposalKind}`);
  }
  if (proposal.breakingChange === true) {
    if (proposal.migrationPath === undefined || proposal.migrationPath.trim().length === 0) {
      throw new Error(
        "serializeInfraProposal: a breaking change must carry a migration story (fut:migrationPath)",
      );
    }
  }
  if (proposal.migrationPath !== undefined && proposal.migrationPath.length > MAX_CONTENT_LENGTH) {
    throw new Error("serializeInfraProposal: migrationPath exceeds MAX_CONTENT_LENGTH");
  }
  if (
    proposal.referenceImplementation !== undefined &&
    !isHttpIri(proposal.referenceImplementation)
  ) {
    throw new Error(
      `serializeInfraProposal: not an http(s) IRI: ${proposal.referenceImplementation}`,
    );
  }
  if (proposal.motivatedBy.length === 0) {
    throw new Error("serializeInfraProposal: a proposal must trace to ≥1 need (fut:motivatedBy)");
  }
  if (proposal.motivatedBy.length > MAX_LINKS) {
    throw new Error(`serializeInfraProposal: motivatedBy exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const iri of proposal.motivatedBy) {
    if (!isHttpIri(iri)) throw new Error(`serializeInfraProposal: not an http(s) IRI: ${iri}`);
  }
  if (
    proposal.indirectStakeholders !== undefined &&
    proposal.indirectStakeholders.length > MAX_CONTENT_LENGTH
  ) {
    throw new Error("serializeInfraProposal: indirectStakeholders exceeds MAX_CONTENT_LENGTH");
  }

  const s = namedNode(proposal.id);
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_INFRA_PROPOSAL)),
    // Asserted explicitly (not left to OWL subclass reasoning) so plain
    // wf:Task readers — solid-issues, Pod Manager — federate proposals as-is
    // (the S1 build decision 5, applied identically to scope B).
    quad(s, namedNode(RDF_TYPE), namedNode(WF_TASK)),
    quad(s, namedNode(DCT_TITLE), literal(proposal.title)),
    quad(s, namedNode(AS_CONTENT), literal(proposal.content)),
    quad(s, namedNode(DCT_CREATED), literal(proposal.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(proposal.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(proposal.inDeliberation)),
    ...proposal.targetsSystem.map((t) => quad(s, namedNode(FUT_TARGETS_SYSTEM), namedNode(t))),
    ...proposal.affectsRole.map((r) => quad(s, namedNode(FUT_AFFECTS_ROLE), namedNode(r))),
    ...proposal.motivatedBy.map((n) => quad(s, namedNode(FUT_MOTIVATED_BY), namedNode(n))),
  ];
  if (proposal.proposalKind !== undefined) {
    quads.push(quad(s, namedNode(FUT_PROPOSAL_KIND), namedNode(proposal.proposalKind)));
  }
  if (proposal.breakingChange !== undefined) {
    quads.push(
      quad(
        s,
        namedNode(FUT_BREAKING_CHANGE),
        literal(proposal.breakingChange ? "true" : "false", namedNode(XSD_BOOLEAN)),
      ),
    );
  }
  // A whitespace-only story is NO story: never serialised (mirrors the parse).
  if (proposal.migrationPath !== undefined && proposal.migrationPath.trim().length > 0) {
    quads.push(quad(s, namedNode(FUT_MIGRATION_PATH), literal(proposal.migrationPath)));
  }
  if (proposal.referenceImplementation !== undefined) {
    quads.push(
      quad(s, namedNode(FUT_REFERENCE_IMPLEMENTATION), namedNode(proposal.referenceImplementation)),
    );
  }
  if (proposal.indirectStakeholders !== undefined && proposal.indirectStakeholders.length > 0) {
    quads.push(
      quad(s, namedNode(FUT_INDIRECT_STAKEHOLDERS), literal(proposal.indirectStakeholders)),
    );
  }
  return quads;
}

/** Serialise an {@link InfraProposal} to Turtle. Throws on an invalid field. */
export async function serializeInfraProposal(proposal: InfraProposal): Promise<string> {
  return serializeTurtle(buildInfraProposalQuads(proposal), { wf: NS.wf });
}

/**
 * EVERY coded stakeholder role asserted on (s, fut:affectsRole): non-coded /
 * non-IRI values DROP (field-level hostility isolation), duplicates collapse,
 * output is in the canonical coded order (deterministic).
 */
function readRoles(ds: DatasetCore, s: Term): StakeholderRole[] {
  const found = new Set<StakeholderRole>();
  for (const q of ds.match(s, namedNode(FUT_AFFECTS_ROLE), null, null)) {
    if (q.object.termType === "NamedNode" && isStakeholderRole(q.object.value)) {
      found.add(q.object.value);
    }
  }
  // Canonical order = sorted IRIs (deterministic regardless of dataset order).
  return [...found].sort();
}

/** Parse every well-formed {@link InfraProposal} in the dataset; malformed items drop. */
export function parseInfraProposals(ds: DatasetCore): InfraProposal[] {
  const out: InfraProposal[] = [];
  for (const s of typedSubjects(ds, FUT_INFRA_PROPOSAL)) {
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    const targetsSystem = readIris(ds, s, FUT_TARGETS_SYSTEM);
    const affectsRole = readRoles(ds, s);
    const motivatedBy = readIris(ds, s, FUT_MOTIVATED_BY);
    const breakingChange = readBoolean(ds, s, FUT_BREAKING_CHANGE);
    // A whitespace-only migration story is NO migration story (mirrors the
    // build-side trim check — hostile RDF must not satisfy the breaking-change
    // invariant with "   "): treat it as absent everywhere below.
    const rawMigrationPath = readString(ds, s, FUT_MIGRATION_PATH, MAX_CONTENT_LENGTH);
    const migrationPath =
      rawMigrationPath !== undefined && rawMigrationPath.trim().length > 0
        ? rawMigrationPath
        : undefined;
    if (
      title === undefined ||
      title.length === 0 || // mirrors build: a title is 1–200 chars
      content === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      targetsSystem.length === 0 || // SHACL MUST: ≥1 governed system
      affectsRole.length === 0 || // SHACL MUST: ≥1 declared blast-radius role
      motivatedBy.length === 0 || // SHACL MUST: the needs trace
      (breakingChange === true && migrationPath === undefined)
      // interop honesty: a breaking change WITHOUT a migration story (absent,
      // empty, or whitespace-only) is not a conforming proposal — drop the
      // ITEM, same posture as the build throw.
    ) {
      continue; // a required field / SHACL MUST is violated → drop this item
    }
    const proposalKind = readCoded(ds, s, FUT_PROPOSAL_KIND, isProposalKind);
    const referenceImplementation = readIri(ds, s, FUT_REFERENCE_IMPLEMENTATION);
    const indirectStakeholders = readString(ds, s, FUT_INDIRECT_STAKEHOLDERS, MAX_CONTENT_LENGTH);
    out.push({
      id: s.value,
      title,
      content,
      targetsSystem,
      affectsRole,
      motivatedBy,
      created,
      creator,
      inDeliberation,
      ...(proposalKind !== undefined ? { proposalKind } : {}),
      ...(breakingChange !== undefined ? { breakingChange } : {}),
      ...(migrationPath !== undefined ? { migrationPath } : {}),
      ...(referenceImplementation !== undefined ? { referenceImplementation } : {}),
      ...(indirectStakeholders !== undefined ? { indirectStakeholders } : {}),
    });
  }
  return out;
}

/** Human labels for the coded proposal kinds (render aid; vocab labels). */
export const PROPOSAL_KIND_LABELS: Readonly<Record<ProposalKind, string>> = {
  [`${NS.fut}SpecChange`]: "spec change",
  [`${NS.fut}NewSpec`]: "new spec",
  [`${NS.fut}ServiceOperation`]: "service operation",
  [`${NS.fut}Deprecation`]: "deprecation",
} as Record<ProposalKind, string>;

/** Human labels for the coded stakeholder roles (render aid; vocab labels). */
export const STAKEHOLDER_ROLE_LABELS: Readonly<Record<StakeholderRole, string>> = {
  [`${NS.fut}ImplementerRole`]: "implementers",
  [`${NS.fut}OperatorRole`]: "operators",
  [`${NS.fut}ParticipantRole`]: "participants",
} as Record<StakeholderRole, string>;
