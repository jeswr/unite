// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.4 — the SIGNED fut:AdoptionDecision (docs/design/next-phases.md §1.3(d) +
// §1.4). The transition from OBSERVED adoption (adoption.ts, a read instrument) to
// DECIDED adoption: a converged infrastructure recommendation, assembled as a
// fut:AdoptionDecision ⊑ fut:SharedFuture graph, ratified by a ≥2-steward QUORUM.
//
// This module is the CONSUMER of the shipped quorum keystone (lib/quorum.ts) — and
// the load-bearing S3 security requirement lives HERE (design/next-phases, the
// quorum re-verify INFO residual): the quorum module leaves `trustedStewards`
// OPTIONAL, so the CONSUMER must REQUIRE it. {@link verifyAdoptionDecisionQuorum}
// THROWS fail-closed when no registry-backed steward allowlist is supplied — an S3
// ratification path can NEVER call buildQuorumAttestation unprotected. Derive the
// allowlist from the community's steward fedreg:Registry via
// {@link resolveTrustedStewards}.
//
// The load-bearing invariants (design §0), enforced structurally:
//   • INV-1 — a decision may derive ONLY from consented statements: every
//     prov:wasDerivedFrom input must be in the aggregate's `synthesizable` set,
//     re-checked at BUILD time (a decision written straight to a pod cannot route
//     around aggregate.ts's synthesize-consent gate). Build throws otherwise.
//   • INV-2 — the mandatory dissent annex: ≥1 fut:dissent OR an explicit
//     fut:noDissentRecorded true. Build throws with neither; parse drops the item.
//   • INV-3 — COMPUTED, never asserted: there is deliberately NO status property.
//     The build emits none; the parse reads none (a spoofed fut:adoptionStatus
//     triple is simply never read); every consumer RECOMPUTES Current/Proposed/
//     Superseded from the evidence against the bar (reusing adoption.computeAdoption).
//     The steward signature attests the RECOMMENDATION, never the status.
//   • INV-5 — no single owner: the quorum floor (≥2 distinct stewards) is inherited
//     from lib/quorum, and the REQUIRED trustedStewards allowlist is where the
//     "distinct verified key = distinct real steward" trust decision lives.
//
// SERIALISE with n3.Writer (via model.serializeTurtle) ONLY — never hand-built RDF.
// PARSE via the guarded model.ts accessors — foreign RDF is hostile input.

import { parseRegistry, TRUSTED_STATUS } from "@jeswr/federation-registry";
import {
  issue,
  type KeyPair,
  digestQuads as solidVcDigestQuads,
  type VerifiableCredential,
  type VerificationResult,
} from "@jeswr/solid-vc";
import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import type { EndorsementGate } from "../scope/scopes.js";
import {
  type AdoptionObservation,
  computeAdoption,
  DEFAULT_ADOPTION_BAR,
  GOVERNED_SYSTEMS,
  type GovernedSystem,
  type VersionAdoption,
} from "./adoption.js";
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
import {
  FUT_ADOPTION_BAR,
  FUT_ADOPTION_DECISION,
  FUT_ADOPTION_EVIDENCE,
  FUT_ADOPTION_OBSERVATION,
  FUT_BRIDGING_EVIDENCE,
  FUT_BRIDGING_EVIDENCE_CLASS,
  FUT_BRIDGING_SCORE,
  FUT_CLUSTER_LABEL,
  FUT_CONFLICTS_COUNT,
  FUT_DISSENT,
  FUT_DISSENT_RECORD,
  FUT_METHOD_PROVENANCE,
  FUT_NO_DISSENT_RECORDED,
  FUT_OBSERVATION_SOURCE,
  FUT_OBSERVED_AT,
  FUT_OBSERVED_PARTY,
  FUT_OBSERVED_VERSION,
  FUT_PROPOSES_VERSION,
  FUT_RESONATES_COUNT,
  FUT_SEEN_COUNT,
  FUT_SHARED_FUTURE,
  FUT_UNSURE_COUNT,
} from "./fut-draft.js";
import {
  assertStatementCore,
  isHttpIri,
  isValidXsdDateTime,
  MAX_CONTENT_LENGTH,
  MAX_LINKS,
  MAX_TITLE_LENGTH,
  readDateTime,
  readIntInRange,
  readIri,
  readString,
  serializeTurtle,
  typedSubjects,
} from "./model.js";
import { DEFAULT_MAX_BODY_BYTES, readBodyCapped } from "./pod.js";
import {
  buildQuorumAttestation,
  QUORUM_FLOOR,
  type QuorumAttestation,
  type ResolveKey,
} from "./quorum.js";
import { hasRole, type TrustProfile } from "./trust.js";

const { namedNode, literal, blankNode, quad } = DataFactory;

const XSD_DATETIME = `${NS.xsd}dateTime`;
const XSD_INTEGER = `${NS.xsd}integer`;
const XSD_BOOLEAN = `${NS.xsd}boolean`;
const XSD_DECIMAL = `${NS.xsd}decimal`;
const XSD_NON_NEGATIVE_INTEGER = `${NS.xsd}nonNegativeInteger`;

/** Upper bound on `fut:adoptionBar` — used by BOTH build (throw) and parse
 *  (drop) so a signed decision is never rejected by its own round-trip. */
const MAX_ADOPTION_BAR = 1_000_000;

/** The computed adoption lifecycle status of the proposed version — never asserted. */
export type ComputedAdoptionStatus = VersionAdoption["status"];

// ── The data model (everything exists in the published 0.2.0 sector) ─────────

/** One opinion cluster's endorsement statistics → a `fut:BridgingEvidence` node
 *  (the proof the recommendation is common ground, recomputable by any consumer). */
export interface ClusterBridgingEvidence {
  /** `fut:clusterLabel` — the opaque k-anonymous cohort label ("cluster-0"). */
  readonly clusterLabel: string;
  /** `fut:resonatesCount` (xsd:nonNegativeInteger). */
  readonly resonatesCount: number;
  /** `fut:conflictsCount`. */
  readonly conflictsCount: number;
  /** `fut:unsureCount`. */
  readonly unsureCount: number;
  /** `fut:seenCount` (= resonates + conflicts + unsure). */
  readonly seenCount: number;
  /** `fut:bridgingScore` (xsd:decimal) — the per-cluster factor, optional. */
  readonly bridgingScore?: number;
}

/** One `fut:DissentRecord` in the mandatory annex (INV-2). Minimal at S3 — the
 *  full standing-critique materialiser is S5.1 (lib/dissent.ts). */
export interface DissentRecordInput {
  /** `as:content` — the dissenting position (required). */
  readonly content: string;
  /** `dct:creator` — only for a dissent whose author opted into attribution. */
  readonly creator?: string;
}

/** The inputs to assemble a `fut:AdoptionDecision` graph. */
export interface AdoptionDecisionInput {
  /** The decision resource IRI (subject; https). */
  readonly id: string;
  /** `as:content` — the recommendation text, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `dct:title` — optional short name, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title?: string;
  /** `fut:proposesVersion` — the immutable owl:versionIRI recommended (https). */
  readonly proposesVersion: string;
  /** `fut:adoptionBar` — the measured criteria (a positive integer; design/04 §2). */
  readonly adoptionBar: number;
  /** `fut:adoptionEvidence` — the current AdoptionObservation set (re-checkable). */
  readonly adoptionEvidence: readonly AdoptionObservation[];
  /** `prov:wasDerivedFrom` — the gated candidate's lineage (≥1; INV-1). */
  readonly derivedFrom: readonly string[];
  /** `fut:bridgingEvidence` — per-cluster counts (≥1; the common-ground proof). */
  readonly bridgingEvidence: readonly ClusterBridgingEvidence[];
  /** `fut:dissent` — the dissent annex records (INV-2; ≥1 OR noDissentRecorded). */
  readonly dissent: readonly DissentRecordInput[];
  /** `fut:noDissentRecorded true` — the EXPLICIT no-dissent assertion; valid ONLY
   *  when `dissent` is empty (silence is never treated as consensus). */
  readonly noDissentRecorded?: boolean;
  /** `fut:methodProvenance` — the deliberation-method concept (optional label). */
  readonly methodProvenance?: string;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI (the assembling builder/steward). */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
}

/** The INV-1 lineage gate for {@link buildAdoptionDecisionQuads}. */
export interface AdoptionDecisionGate {
  /**
   * The consented statement ids — `AggregateResult.synthesizable`. EVERY
   * `derivedFrom` input MUST be a member, else the build throws: the
   * synthesize-consent gate, re-checked at build time so a decision written
   * straight to a pod cannot bypass aggregate.ts (INV-1).
   */
  readonly synthesizable: ReadonlySet<string>;
}

function assertPositiveInteger(kind: string, field: string, n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${kind}: ${field} must be a positive integer: ${n}`);
  }
}

function assertNonNegativeInteger(kind: string, field: string, n: number): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${kind}: ${field} must be a non-negative integer: ${n}`);
  }
}

/**
 * Assemble the `fut:AdoptionDecision` ⊑ `fut:SharedFuture` graph, enforcing every
 * invariant at BUILD time (throw on violation — mirroring
 * model-society.buildClaimQuads's adoption-invariant throw):
 *   • INV-1 — `derivedFrom` is non-empty and ⊆ `gate.synthesizable`;
 *   • INV-2 — the dissent annex is present (≥1 dissent XOR noDissentRecorded true);
 *   • INV-3 — NO status triple is emitted (the type carries its bar + evidence; the
 *     status is recomputed by consumers, never decreed);
 *   • ≥1 `fut:bridgingEvidence` (the recomputable common-ground proof).
 * The decision is typed as BOTH fut:AdoptionDecision AND fut:SharedFuture (the
 * infra.ts convention) so plain SharedFuture readers federate it.
 */
export function buildAdoptionDecisionQuads(
  input: AdoptionDecisionInput,
  gate: AdoptionDecisionGate,
): Quad[] {
  const kind = "buildAdoptionDecision";
  assertStatementCore(kind, input);
  if (input.title !== undefined && input.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`${kind}: title exceeds MAX_TITLE_LENGTH (${MAX_TITLE_LENGTH})`);
  }
  if (!isHttpIri(input.proposesVersion)) {
    throw new Error(`${kind}: proposesVersion is not an http(s) IRI: ${input.proposesVersion}`);
  }
  assertPositiveInteger(kind, "adoptionBar", input.adoptionBar);
  if (input.adoptionBar > MAX_ADOPTION_BAR) {
    throw new Error(`${kind}: adoptionBar exceeds ${MAX_ADOPTION_BAR}`);
  }

  // INV-1: the lineage consent gate, re-checked at build time.
  if (input.derivedFrom.length === 0) {
    throw new Error(`${kind}: a decision must derive from ≥1 statement (prov:wasDerivedFrom)`);
  }
  if (input.derivedFrom.length > MAX_LINKS) {
    throw new Error(`${kind}: derivedFrom exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const d of input.derivedFrom) {
    if (!isHttpIri(d)) throw new Error(`${kind}: derivedFrom input is not an http(s) IRI: ${d}`);
    if (!gate.synthesizable.has(d)) {
      throw new Error(
        `${kind}: derivedFrom input lacks fut:synthesize consent (not in the aggregate's ` +
          `synthesizable set) — a decision may derive ONLY from consented statements (INV-1): ${d}`,
      );
    }
  }

  // INV-2: the mandatory dissent annex.
  const hasDissent = input.dissent.length > 0;
  const noDissent = input.noDissentRecorded === true;
  if (!hasDissent && !noDissent) {
    throw new Error(
      `${kind}: a SharedFuture is INVALID without its dissent annex — supply ≥1 fut:dissent ` +
        `OR fut:noDissentRecorded true (silence is never consensus, INV-2)`,
    );
  }
  if (hasDissent && noDissent) {
    throw new Error(
      `${kind}: fut:noDissentRecorded true is only valid when the annex carries NO dissent`,
    );
  }
  for (const d of input.dissent) {
    if (d.content.length === 0 || d.content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`${kind}: a dissent record must carry text ≤ MAX_CONTENT_LENGTH`);
    }
    if (d.creator !== undefined && !isHttpIri(d.creator)) {
      throw new Error(`${kind}: dissent creator is not an http(s) IRI: ${d.creator}`);
    }
  }

  // ≥1 bridging evidence (the recomputable common-ground proof), capped at MAX_LINKS
  // to mirror the parser's fail-closed fan-out bound (never build what won't parse).
  if (input.bridgingEvidence.length === 0) {
    throw new Error(`${kind}: a decision must carry ≥1 fut:bridgingEvidence (common-ground proof)`);
  }
  if (input.bridgingEvidence.length > MAX_LINKS) {
    throw new Error(`${kind}: bridgingEvidence exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  if (input.adoptionEvidence.length > MAX_LINKS) {
    throw new Error(`${kind}: adoptionEvidence exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  if (input.dissent.length > MAX_LINKS) {
    throw new Error(`${kind}: dissent exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const be of input.bridgingEvidence) {
    for (const [f, v] of [
      ["resonatesCount", be.resonatesCount],
      ["conflictsCount", be.conflictsCount],
      ["unsureCount", be.unsureCount],
      ["seenCount", be.seenCount],
    ] as const) {
      assertNonNegativeInteger(kind, f, v);
    }
    // The counts must be internally consistent — seen = resonates + conflicts +
    // unsure (the vocab's definition of seenCount) — so impossible "evidence" cannot
    // be built, signed, and displayed as a governance proof.
    if (be.seenCount !== be.resonatesCount + be.conflictsCount + be.unsureCount) {
      throw new Error(
        `${kind}: bridging evidence seenCount must equal resonates+conflicts+unsure ` +
          `(${be.seenCount} ≠ ${be.resonatesCount}+${be.conflictsCount}+${be.unsureCount})`,
      );
    }
    // Mirror the parser: an empty / over-length clusterLabel would round-trip a node
    // the parser then drops (silently losing the proof) — reject it at build time.
    if (be.clusterLabel.length === 0 || be.clusterLabel.length > MAX_TITLE_LENGTH) {
      throw new Error(
        `${kind}: bridging evidence clusterLabel must be 1–${MAX_TITLE_LENGTH} chars`,
      );
    }
  }

  // Evidence observations (each re-checkable). Validate the IRIs AND the timestamp
  // the SAME way the parser does, so a built decision never round-trips an observation
  // the parser would silently drop (a lost re-checkable evidence cell).
  for (const o of input.adoptionEvidence) {
    for (const iri of [o.party, o.version, o.source]) {
      if (!isHttpIri(iri)) throw new Error(`${kind}: observation IRI is not http(s): ${iri}`);
    }
    if (!isValidXsdDateTime(o.observedAt)) {
      throw new Error(
        `${kind}: observation observedAt is not a valid xsd:dateTime: ${o.observedAt}`,
      );
    }
  }
  if (input.methodProvenance !== undefined && !isHttpIri(input.methodProvenance)) {
    throw new Error(`${kind}: methodProvenance is not an http(s) IRI: ${input.methodProvenance}`);
  }

  const s = namedNode(input.id);
  const quads: Quad[] = [
    // Typed as BOTH the decision and its SharedFuture superclass (asserted, not
    // left to OWL reasoning — the infra.ts convention for plain readers).
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_ADOPTION_DECISION)),
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_SHARED_FUTURE)),
    quad(s, namedNode(AS_CONTENT), literal(input.content)),
    quad(s, namedNode(DCT_CREATED), literal(input.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(input.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(input.inDeliberation)),
    quad(s, namedNode(FUT_PROPOSES_VERSION), namedNode(input.proposesVersion)),
    quad(
      s,
      namedNode(FUT_ADOPTION_BAR),
      literal(String(input.adoptionBar), namedNode(XSD_INTEGER)),
    ),
    ...input.derivedFrom.map((d) => quad(s, namedNode(PROV_WAS_DERIVED_FROM), namedNode(d))),
  ];
  if (input.title !== undefined && input.title.length > 0) {
    quads.push(quad(s, namedNode(DCT_TITLE), literal(input.title)));
  }
  if (input.methodProvenance !== undefined) {
    quads.push(quad(s, namedNode(FUT_METHOD_PROVENANCE), namedNode(input.methodProvenance)));
  }

  // Evidence: one fut:AdoptionObservation node per observation.
  input.adoptionEvidence.forEach((o) => {
    const obs = blankNode(); // fresh unlabeled → no cross-decision collision in a shared Store
    quads.push(
      quad(s, namedNode(FUT_ADOPTION_EVIDENCE), obs),
      quad(obs, namedNode(RDF_TYPE), namedNode(FUT_ADOPTION_OBSERVATION)),
      quad(obs, namedNode(FUT_OBSERVED_PARTY), namedNode(o.party)),
      quad(obs, namedNode(FUT_OBSERVED_VERSION), namedNode(o.version)),
      quad(obs, namedNode(FUT_OBSERVED_AT), literal(o.observedAt, namedNode(XSD_DATETIME))),
      quad(obs, namedNode(FUT_OBSERVATION_SOURCE), namedNode(o.source)),
    );
  });

  // Bridging evidence: one fut:BridgingEvidence node per opinion cluster.
  input.bridgingEvidence.forEach((be) => {
    const node = blankNode(); // fresh unlabeled → no cross-decision collision
    quads.push(
      quad(s, namedNode(FUT_BRIDGING_EVIDENCE), node),
      quad(node, namedNode(RDF_TYPE), namedNode(FUT_BRIDGING_EVIDENCE_CLASS)),
      quad(node, namedNode(FUT_CLUSTER_LABEL), literal(be.clusterLabel)),
      quad(
        node,
        namedNode(FUT_RESONATES_COUNT),
        literal(String(be.resonatesCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
      quad(
        node,
        namedNode(FUT_CONFLICTS_COUNT),
        literal(String(be.conflictsCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
      quad(
        node,
        namedNode(FUT_UNSURE_COUNT),
        literal(String(be.unsureCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
      quad(
        node,
        namedNode(FUT_SEEN_COUNT),
        literal(String(be.seenCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
    );
    if (be.bridgingScore !== undefined && Number.isFinite(be.bridgingScore)) {
      quads.push(
        quad(
          node,
          namedNode(FUT_BRIDGING_SCORE),
          literal(String(be.bridgingScore), namedNode(XSD_DECIMAL)),
        ),
      );
    }
  });

  // The dissent annex (INV-2).
  if (noDissent) {
    quads.push(
      quad(s, namedNode(FUT_NO_DISSENT_RECORDED), literal("true", namedNode(XSD_BOOLEAN))),
    );
  } else {
    input.dissent.forEach((d) => {
      const rec = blankNode(); // fresh unlabeled → no cross-decision collision
      quads.push(
        quad(s, namedNode(FUT_DISSENT), rec),
        quad(rec, namedNode(RDF_TYPE), namedNode(FUT_DISSENT_RECORD)),
        quad(rec, namedNode(AS_CONTENT), literal(d.content)),
      );
      if (d.creator !== undefined) {
        quads.push(quad(rec, namedNode(DCT_CREATOR), namedNode(d.creator)));
      }
    });
  }

  // INV-3: NO status triple is emitted — deliberately. A consumer recomputes it.
  return quads;
}

/** Serialise a `fut:AdoptionDecision` to Turtle. Throws on any invariant violation. */
export async function serializeAdoptionDecision(
  input: AdoptionDecisionInput,
  gate: AdoptionDecisionGate,
): Promise<string> {
  return serializeTurtle(buildAdoptionDecisionQuads(input, gate), { prov: NS.prov });
}

// ── The steward attestation (each steward's independent signature) ────────────

/** Inputs to {@link issueStewardAttestation}. */
export interface StewardAttestationInput {
  /** The decision resource IRI (the credentialSubject + relatedResource id). */
  readonly subject: string;
  /** The decision graph the steward attests (its RDFC-1.0 digest is bound). */
  readonly decisionQuads: readonly Quad[];
  /** The steward's WebID (the credential issuer). */
  readonly webId: string;
  /** The steward's signing key (`verificationMethod` controlled by `webId`). */
  readonly key: KeyPair;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads`. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/**
 * A single steward signs the AdoptionDecision: an independent solid-vc credential
 * over the artifact's RDFC-1.0 digest (bound via `relatedResource`), retaining the
 * steward's own WebID identity binding — the shape design §1.4 prescribes and the
 * quorum verifier aggregates. This is a thin composition of solid-vc `issue` +
 * `digestQuads`; it adds no crypto.
 */
export async function issueStewardAttestation(
  input: StewardAttestationInput,
): Promise<VerifiableCredential> {
  if (!isHttpIri(input.subject)) {
    throw new Error(`issueStewardAttestation: subject is not an http(s) IRI: ${input.subject}`);
  }
  if (!isHttpIri(input.webId)) {
    throw new Error(`issueStewardAttestation: webId is not an http(s) IRI: ${input.webId}`);
  }
  const digestFn = input.digest ?? solidVcDigestQuads;
  const digest = await digestFn(input.decisionQuads);
  return issue({
    credential: {
      issuer: input.webId,
      credentialSubject: { id: input.subject },
      relatedResource: [
        { id: input.subject, digestMultibase: digest, mediaType: "application/n-quads" },
      ],
    },
    key: input.key,
  });
}

// ── The registry-backed steward allowlist (the REQUIRED quorum gate input) ────

/** Options for {@link resolveTrustedStewards}. */
export interface ResolveTrustedStewardsOptions {
  /** The credential-free read fetch. */
  readonly fetch: typeof fetch;
  /** Cap on the registry body (default {@link DEFAULT_MAX_BODY_BYTES}). */
  readonly maxBodyBytes?: number;
  /**
   * Restrict to memberships asserted by these authority IRIs (the community's
   * recognised steward-registrars). When omitted, any assertedBy on a well-formed
   * membership is accepted — supply it to pin the trust root.
   */
  readonly expectedAssertedBy?: readonly string[];
  /** Cap on the number of stewards returned (bounded fan-out; default 100). */
  readonly maxStewards?: number;
}

/**
 * Resolve the CANONICAL, REGISTRY-BACKED steward allowlist for the quorum gate: the
 * `fedreg:Membership.app` WebIDs of every VALID, `Active` membership on the
 * community's steward `fedreg:Registry` (the community curates which WebIDs are
 * stewards there). https-only, https-fetch, byte-capped, fail-isolated. Returns a
 * sorted, deduped, capped list; on a fetch/parse failure returns `[]` — and an
 * EMPTY list correctly BLOCKS ratification downstream (the verify gate requires a
 * non-empty allowlist), so a broken registry never silently opens the gate.
 */
export async function resolveTrustedStewards(
  registryIri: string,
  options: ResolveTrustedStewardsOptions,
): Promise<string[]> {
  if (!isHttpIri(registryIri) || !registryIri.startsWith("https:")) return [];
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxStewards = options.maxStewards ?? 100;
  const trustedAuthorities =
    options.expectedAssertedBy === undefined
      ? undefined
      : new Set(options.expectedAssertedBy.filter(isHttpIri));
  const fetchFn: typeof fetch = async (i, init) => {
    const res = await options.fetch(i, init);
    if (!res.ok || res.body === null) return res;
    const text = await readBodyCapped(res, maxBytes);
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };

  let parsed: Awaited<ReturnType<typeof parseRegistry>>;
  try {
    parsed = await parseRegistry(registryIri, { fetch: fetchFn });
  } catch {
    return []; // fail-closed: a broken registry yields no stewards (blocks the gate)
  }

  const stewards = new Set<string>();
  for (const m of parsed.members) {
    if (!m.valid || m.membership === undefined) continue;
    const mem = m.membership;
    // Only a TRUSTED_STATUS (Active) membership counts as a live steward —
    // Proposed is pending, Suspended/Revoked are withdrawn (fedreg vocab).
    if (mem.status === undefined || !TRUSTED_STATUS.has(mem.status)) continue;
    if (!isHttpIri(mem.app)) continue;
    if (trustedAuthorities !== undefined) {
      const okAuthority = (mem.assertedBy ?? []).some((a) => trustedAuthorities.has(a));
      if (!okAuthority) continue;
    }
    stewards.add(mem.app);
  }
  return [...stewards].sort().slice(0, maxStewards);
}

// ── The QUORUM ratification gate (the load-bearing S3 requirement) ────────────

/** Options for {@link verifyAdoptionDecisionQuorum} / {@link verifyAdoptionDecision}. */
export interface AdoptionDecisionQuorumOptions {
  /**
   * REQUIRED. Verify ONE steward credential (the crypto boundary — signature +
   * issuer-binding + validity + revocation). In production close over
   * `verifyCredential(vc, { resolveKey, isControlledBy, resolveStatus, … })`.
   */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /** REQUIRED. The signing-key resolver — the quorum distinctness anchor. */
  readonly resolveKey: ResolveKey;
  /**
   * REQUIRED for S3 (the LOAD-BEARING gate). The registry-backed canonical steward
   * allowlist (see {@link resolveTrustedStewards}). The quorum module leaves this
   * OPTIONAL; S3 governance ratification MUST NOT run without it — a missing or
   * EMPTY allowlist THROWS (fail-closed), so buildQuorumAttestation is never called
   * unprotected. This is where the "distinct verified key = distinct real steward"
   * trust decision lives (INV-5).
   */
  readonly trustedStewards: readonly string[];
  /**
   * The steward-signature floor (default + minimum {@link QUORUM_FLOOR}). A
   * community may RAISE it (e.g. from an EndorsementGate.stewardSignatures), never
   * lower it — the quorum clamps up to the floor.
   */
  readonly threshold?: number;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads`. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/**
 * Verify the ≥2-steward QUORUM over an AdoptionDecision graph — the S3 ratification
 * gate. THROWS fail-closed when `trustedStewards` is absent/empty (the load-bearing
 * requirement: an S3 quorum NEVER runs without a registry-backed steward
 * allowlist), then delegates to the shipped {@link buildQuorumAttestation} with the
 * allowlist wired in. Returns the full attestation (met / distinctStewards /
 * bootstrapping / rejections) for honest surfaces.
 */
export async function verifyAdoptionDecisionQuorum(
  decisionQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: AdoptionDecisionQuorumOptions,
): Promise<QuorumAttestation> {
  const allowlist = Array.isArray(options.trustedStewards)
    ? options.trustedStewards.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  if (allowlist.length === 0) {
    throw new TypeError(
      "verifyAdoptionDecisionQuorum: a non-empty `trustedStewards` allowlist is REQUIRED — S3 " +
        "governance ratification must not run an unprotected quorum (derive it from the community's " +
        "steward fedreg:Registry via resolveTrustedStewards)",
    );
  }
  return buildQuorumAttestation(decisionQuads, stewardVCs, {
    verifyVc: options.verifyVc,
    resolveKey: options.resolveKey,
    trustedStewards: allowlist,
    ...(options.threshold !== undefined ? { threshold: options.threshold } : {}),
    ...(options.digest !== undefined ? { digest: options.digest } : {}),
  });
}

// ── Parse + the COMPUTED status (INV-3: never read an asserted status) ─────────

/** A parsed `fut:AdoptionDecision` — carries its bar + evidence, NEVER a status. */
export interface ParsedAdoptionDecision {
  readonly id: string;
  readonly content: string;
  readonly title?: string;
  readonly proposesVersion: string;
  readonly adoptionBar: number;
  readonly adoptionEvidence: readonly AdoptionObservation[];
  readonly derivedFrom: readonly string[];
  /** The per-cluster common-ground proof (≥1; the parse REQUIRES it, mirroring
   *  the build — a hand-authored decision cannot omit it). */
  readonly bridgingEvidence: readonly ClusterBridgingEvidence[];
  readonly methodProvenance?: string;
  readonly created: string;
  readonly creator: string;
  readonly inDeliberation: string;
  /** True iff the mandatory dissent annex is present (≥1 CONTENT-bearing
   *  fut:DissentRecord OR fut:noDissentRecorded true). */
  readonly hasDissentAnnex: boolean;
}

/** A single xsd:nonNegativeInteger (or xsd:integer) literal ≥ 0, else undefined.
 *  model.readIntInRange only accepts xsd:integer, but the counts are serialised as
 *  xsd:nonNegativeInteger — so this accepts BOTH datatypes, fail-closed otherwise. */
function readNonNegInt(ds: DatasetCore, s: Term, p: string): number | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) {
    const t = q.object;
    if (t.termType !== "Literal") return undefined;
    const dt = t.datatype.value;
    if (dt !== XSD_NON_NEGATIVE_INTEGER && dt !== XSD_INTEGER) return undefined;
    if (!/^\d+$/.test(t.value)) return undefined;
    const n = Number.parseInt(t.value, 10);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

/** A single xsd:decimal literal (a finite number), else undefined. Guarded like the
 *  other readers — a hostile/typed-wrong literal drops the field. */
function readDecimal(ds: DatasetCore, s: Term, p: string): number | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) {
    const t = q.object;
    if (t.termType !== "Literal" || t.datatype.value !== XSD_DECIMAL) return undefined;
    if (!/^[+-]?\d+(\.\d+)?$/.test(t.value)) return undefined;
    const n = Number.parseFloat(t.value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Read the fut:AdoptionObservation objects of `s` fut:adoptionEvidence; a malformed
 *  observation drops (field-level). BOUNDED FAIL-CLOSED: a hostile fan-out beyond
 *  MAX_LINKS edges returns `undefined` (⇒ drop the whole decision), so a huge dataset
 *  cannot force unbounded parsing. Empty evidence is legitimate (a not-yet-adopted
 *  version) — only overflow, never emptiness, drops. */
function readEvidence(ds: DatasetCore, s: Term): AdoptionObservation[] | undefined {
  const out: AdoptionObservation[] = [];
  let seen = 0;
  for (const q of ds.match(s, namedNode(FUT_ADOPTION_EVIDENCE), null, null)) {
    if (++seen > MAX_LINKS) return undefined; // hostile fan-out → drop the decision
    const obs = q.object;
    if (obs.termType !== "NamedNode" && obs.termType !== "BlankNode") continue;
    const party = readIri(ds, obs, FUT_OBSERVED_PARTY);
    const version = readIri(ds, obs, FUT_OBSERVED_VERSION);
    const observedAt = readDateTime(ds, obs, FUT_OBSERVED_AT);
    const source = readIri(ds, obs, FUT_OBSERVATION_SOURCE);
    if (
      party === undefined ||
      version === undefined ||
      observedAt === undefined ||
      source === undefined
    ) {
      continue; // a malformed observation drops (keeps siblings)
    }
    out.push({ party, version, observedAt, source });
  }
  return out;
}

/** Read the WELL-FORMED fut:BridgingEvidence nodes of `s` fut:bridgingEvidence; a node
 *  missing its label / any count / with inconsistent counts drops (the
 *  seen=resonates+conflicts+unsure check mirrors the build). BOUNDED FAIL-CLOSED: a
 *  fan-out beyond MAX_LINKS returns `undefined` (⇒ drop the decision). */
function readBridgingEvidence(ds: DatasetCore, s: Term): ClusterBridgingEvidence[] | undefined {
  const out: ClusterBridgingEvidence[] = [];
  let seen = 0;
  for (const q of ds.match(s, namedNode(FUT_BRIDGING_EVIDENCE), null, null)) {
    if (++seen > MAX_LINKS) return undefined; // hostile fan-out → drop the decision
    const node = q.object;
    if (node.termType !== "NamedNode" && node.termType !== "BlankNode") continue;
    const clusterLabel = readString(ds, node, FUT_CLUSTER_LABEL, MAX_TITLE_LENGTH);
    const resonatesCount = readNonNegInt(ds, node, FUT_RESONATES_COUNT);
    const conflictsCount = readNonNegInt(ds, node, FUT_CONFLICTS_COUNT);
    const unsureCount = readNonNegInt(ds, node, FUT_UNSURE_COUNT);
    const seenCount = readNonNegInt(ds, node, FUT_SEEN_COUNT);
    if (
      clusterLabel === undefined ||
      clusterLabel.length === 0 ||
      resonatesCount === undefined ||
      conflictsCount === undefined ||
      unsureCount === undefined ||
      seenCount === undefined ||
      seenCount !== resonatesCount + conflictsCount + unsureCount // count consistency
    ) {
      continue; // a malformed / inconsistent bridging-evidence node drops (keeps siblings)
    }
    // The optional per-cluster factor round-trips (guarded decimal; absent → omitted).
    const bridgingScore = readDecimal(ds, node, FUT_BRIDGING_SCORE);
    out.push({
      clusterLabel,
      resonatesCount,
      conflictsCount,
      unsureCount,
      seenCount,
      ...(bridgingScore !== undefined ? { bridgingScore } : {}),
    });
  }
  return out;
}

/**
 * True iff `s` carries a present, VALID dissent annex (INV-2 on read — mirrors the
 * build validation EXACTLY, including the contradiction the build rejects): the annex
 * is valid iff it has ≥1 content-bearing fut:dissent XOR fut:noDissentRecorded true.
 * BOTH present (a synthesis both quoting dissent AND claiming none) is contradictory
 * and drops; NEITHER present drops (silence is never consensus). BOUNDED FAIL-CLOSED:
 * a fut:dissent fan-out beyond MAX_LINKS is hostile → the annex is treated as invalid.
 */
function hasDissentAnnex(ds: DatasetCore, s: Term): boolean {
  let hasDissent = false;
  let seen = 0;
  for (const q of ds.match(s, namedNode(FUT_DISSENT), null, null)) {
    if (++seen > MAX_LINKS) return false; // hostile fan-out → fail-closed (invalid annex)
    if (hasDissent) continue; // one valid record suffices; keep counting for the cap
    const rec = q.object;
    if (rec.termType !== "NamedNode" && rec.termType !== "BlankNode") continue;
    const content = readString(ds, rec, AS_CONTENT, MAX_CONTENT_LENGTH);
    if (content !== undefined && content.length > 0) hasDissent = true;
  }
  // Read fut:noDissentRecorded STRICTLY: a MULTI-VALUED or MALFORMED flag is hostile
  // (readBoolean's single() silently returns undefined for ≠1 values, which a graph
  // carrying `true` + a duplicate could exploit to hide the contradiction) → the annex
  // is invalid. Exactly one well-formed boolean gives the flag; absent gives no flag.
  let flagCount = 0;
  let flagTrue = false;
  let flagMalformed = false;
  for (const q of ds.match(s, namedNode(FUT_NO_DISSENT_RECORDED), null, null)) {
    flagCount += 1;
    const o = q.object;
    const ok =
      o.termType === "Literal" &&
      o.datatype.value === XSD_BOOLEAN &&
      (o.value === "true" || o.value === "false" || o.value === "1" || o.value === "0");
    if (!ok) {
      flagMalformed = true;
      continue;
    }
    if (o.value === "true" || o.value === "1") flagTrue = true;
  }
  if (flagCount > 1 || flagMalformed) return false; // hostile flag → invalid annex
  return hasDissent !== flagTrue; // XOR: exactly one of {content-bearing dissent, true flag}
}

/**
 * Strictly read `prov:wasDerivedFrom` FAIL-CLOSED (unlike model.readIris, which
 * silently drops malformed values + truncates at MAX_LINKS — which would hide
 * unconsented lineage from the verify-time INV-1 check). ANY non-http(s) object, or a
 * count exceeding MAX_LINKS, drops the whole decision (mirrors the build's throw), so
 * the parsed lineage is the COMPLETE, exact set the consent re-check runs over.
 * Returns `undefined` when the lineage is malformed/oversized (⇒ drop the item).
 */
function readLineageStrict(ds: DatasetCore, s: Term): string[] | undefined {
  const out: string[] = [];
  for (const q of ds.match(s, namedNode(PROV_WAS_DERIVED_FROM), null, null)) {
    const o = q.object;
    if (o.termType !== "NamedNode" || !isHttpIri(o.value)) return undefined; // malformed → drop
    out.push(o.value);
    if (out.length > MAX_LINKS) return undefined; // oversized → drop (mirrors build cap)
  }
  return out;
}

/**
 * Parse every well-formed `fut:AdoptionDecision` in the dataset. A missing/malformed
 * required field, an absent common-ground proof (≥1 bridging evidence), or a missing
 * dissent annex drops the ITEM (foreign RDF is hostile — the parse mirrors every
 * build-time invariant, so a hand-authored signed graph cannot bypass them).
 * CRUCIALLY it reads NO status property (INV-3) — a spoofed `fut:adoptionStatus`
 * triple in the graph is simply never looked at; the status is only ever recomputed.
 */
export function parseAdoptionDecisions(ds: DatasetCore): ParsedAdoptionDecision[] {
  const out: ParsedAdoptionDecision[] = [];
  for (const s of typedSubjects(ds, FUT_ADOPTION_DECISION)) {
    // Mirror the build: a decision is typed as BOTH fut:AdoptionDecision AND its
    // fut:SharedFuture superclass. Requiring the superclass on read means a
    // hand-authored graph cannot ratify a decision that plain SharedFuture readers
    // would never discover (parse-mirrors-build).
    let isSharedFuture = false;
    for (const _q of ds.match(s, namedNode(RDF_TYPE), namedNode(FUT_SHARED_FUTURE), null)) {
      isSharedFuture = true;
      break;
    }
    if (!isSharedFuture) continue;
    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const proposesVersion = readIri(ds, s, FUT_PROPOSES_VERSION);
    const adoptionBar = readIntInRange(ds, s, FUT_ADOPTION_BAR, 1, MAX_ADOPTION_BAR);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    const derivedFrom = readLineageStrict(ds, s);
    const adoptionEvidence = readEvidence(ds, s);
    const bridgingEvidence = readBridgingEvidence(ds, s);
    const annex = hasDissentAnnex(ds, s);
    if (
      content === undefined ||
      proposesVersion === undefined ||
      adoptionBar === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      derivedFrom === undefined || // malformed / oversized lineage → drop (fail-closed)
      derivedFrom.length === 0 ||
      adoptionEvidence === undefined || // hostile evidence fan-out → drop (fail-closed)
      bridgingEvidence === undefined || // hostile bridging fan-out → drop (fail-closed)
      bridgingEvidence.length === 0 || // ≥1 common-ground proof (mirrors build)
      !annex
    ) {
      continue; // a required field / SHACL MUST is violated → drop the item
    }
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    const methodProvenance = readIri(ds, s, FUT_METHOD_PROVENANCE);
    out.push({
      id: s.value,
      content,
      proposesVersion,
      adoptionBar,
      adoptionEvidence,
      derivedFrom,
      bridgingEvidence,
      created,
      creator,
      inDeliberation,
      hasDissentAnnex: annex,
      ...(title !== undefined ? { title } : {}),
      ...(methodProvenance !== undefined ? { methodProvenance } : {}),
    });
  }
  return out;
}

/**
 * Recompute the COMPUTED adoption status of the proposed version from the evidence
 * against the bar (INV-3 — never an asserted status). Reuses
 * adoption.computeAdoption over the governed lineages: if `proposesVersion` is a
 * declared version, its column's computed status (current / superseded / proposed)
 * is returned; otherwise the observable half of the bar is evaluated standalone
 * (bar met ⇒ "current", else "proposed" — no supersession context).
 */
export function computeDecisionStatus(
  proposesVersion: string,
  evidence: readonly AdoptionObservation[],
  bar: number = DEFAULT_ADOPTION_BAR,
  systems: readonly GovernedSystem[] = GOVERNED_SYSTEMS,
): ComputedAdoptionStatus {
  const { matrices } = computeAdoption(systems, evidence, bar);
  for (const matrix of matrices) {
    const column = matrix.versions.find((v) => v.version.iri === proposesVersion);
    if (column !== undefined) return column.status;
  }
  // Not a declared lineage version: evaluate the observable bar standalone.
  const parties = new Set(
    evidence.filter((o) => o.version === proposesVersion).map((o) => o.party),
  );
  return parties.size >= bar ? "current" : "proposed";
}

/** The full verification of a signed AdoptionDecision. */
export interface AdoptionDecisionVerification {
  /** The parsed decision (undefined when the graph carries none). */
  readonly decision?: ParsedAdoptionDecision;
  /** The ≥2-steward quorum attestation over the decision digest. */
  readonly quorum: QuorumAttestation;
  /** `true` IFF the quorum is met AND the signed graph parses as a valid
   *  `fut:AdoptionDecision` AND its lineage is fully consented (INV-1 re-checked at
   *  verify against the REQUIRED `synthesizable` set) — the recommendation is ratified
   *  (NOT the adoption status, which is separately computed). Fail-closed on all three:
   *  ≥2 stewards signing an arbitrary / malformed / unconsented-lineage graph do NOT
   *  ratify. */
  readonly ratified: boolean;
  /** Whether every parsed `derivedFrom` input is in the supplied `synthesizable` set
   *  (INV-1 re-checked at verify). `undefined` only when no decision parsed. */
  readonly lineageConsented?: boolean;
  /** The COMPUTED adoption status recomputed from evidence vs bar (INV-3), or
   *  undefined when the graph carries no parseable decision. */
  readonly computedStatus?: ComputedAdoptionStatus;
}

/**
 * The full S3 verify path over a decision GRAPH + presented steward VCs:
 *   1. verify the ≥2-steward quorum WITH the REQUIRED trustedStewards allowlist
 *      (throws fail-closed if absent — the load-bearing gate);
 *   2. parse the decision from the SIGNED quads themselves (INV-3: never reads a
 *      status) — the parse is bound to exactly what the stewards signed, so unsigned
 *      content can never be ratified;
 *   3. re-check INV-1 (lineage ⊆ the REQUIRED `synthesizable` set) — a signed graph
 *      with unconsented lineage is not ratified, so INV-1 is never optional at the
 *      verification boundary;
 *   4. recompute the adoption status from its evidence vs bar.
 * The signature attests the recommendation (`ratified`); the status is always
 * recomputed (`computedStatus`) — a captured room can sign a recommendation, it
 * cannot sign adoption. (A downstream consumer that only needs the signature check,
 * trusting the steward attestation for INV-1, uses {@link verifyAdoptionDecisionQuorum}
 * + {@link parseAdoptionDecisions} directly.)
 */
export async function verifyAdoptionDecision(
  decisionQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: AdoptionDecisionQuorumOptions & {
    /** The governed lineages for the status recompute (default GOVERNED_SYSTEMS). */
    readonly systems?: readonly GovernedSystem[];
    /**
     * REQUIRED. The aggregate's `synthesizable` set — ratification requires every
     * parsed `derivedFrom` input to be a member (INV-1 re-checked at verify, never
     * optional at this boundary; fail-closed — an empty set consents nothing). The
     * community verifier HAS this (it recomputes the aggregate to render the room).
     */
    readonly synthesizable: ReadonlySet<string>;
  },
): Promise<AdoptionDecisionVerification> {
  // 1. The quorum gate — REQUIRES the allowlist (throws when absent).
  const quorum = await verifyAdoptionDecisionQuorum(decisionQuads, stewardVCs, options);

  // 2. Parse the decision from the SIGNED quads (bound to exactly what was signed —
  //    there is deliberately NO external-dataset seam, which would decouple the parsed
  //    content from the verified digest and let unsigned content be "ratified").
  //    FAIL-CLOSED on an ambiguous graph: exactly ONE parseable decision, else the
  //    caller cannot know WHICH subject was ratified — 0 or ≥2 ⇒ not ratified.
  const decisions = parseAdoptionDecisions(new Store([...decisionQuads]));
  const decision = decisions.length === 1 ? decisions[0] : undefined;

  // 3. INV-1 re-check (never optional at this boundary): every lineage input must be
  //    consented against the required synthesizable set.
  const lineageConsented =
    decision === undefined
      ? undefined
      : decision.derivedFrom.every((d) => options.synthesizable.has(d));

  // 4. Recompute the status (never asserted).
  const computedStatus =
    decision !== undefined
      ? computeDecisionStatus(
          decision.proposesVersion,
          decision.adoptionEvidence,
          decision.adoptionBar,
          options.systems ?? GOVERNED_SYSTEMS,
        )
      : undefined;

  return {
    ...(decision !== undefined ? { decision } : {}),
    quorum,
    // Fail-closed: ratification requires the quorum AND a parseable decision AND a
    // fully consented lineage (INV-1) — all three, never any one optional.
    ratified: quorum.met && decision !== undefined && lineageConsented === true,
    ...(lineageConsented !== undefined ? { lineageConsented } : {}),
    ...(computedStatus !== undefined ? { computedStatus } : {}),
  };
}

// ── Reviewer / steward endorsement gating (design §1.3(c), composing trust.ts) ─

/** Whether an action is permitted, with an honest locked reason when not. */
export interface EndorsementAccess {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * The reviewer gate: moving a scope-B candidate INTO the endorsement round needs
 * the `reviewer` role when the scope's {@link EndorsementGate.reviewerRoleRequired}
 * is set (infrastructure). Composes the shipped fail-closed trust.ts `hasRole`
 * (a session with no verified reviewer credential is locked out). No new
 * verification code — `CredentialTrustResolver` already resolves roles fail-closed.
 */
export function reviewerEndorsementGate(
  profile: TrustProfile,
  gate: EndorsementGate,
): EndorsementAccess {
  if (!gate.reviewerRoleRequired) return { allowed: true };
  if (hasRole(profile, "reviewer")) return { allowed: true };
  return {
    allowed: false,
    reason: "moving a candidate into endorsement requires a verified reviewer role credential",
  };
}

/**
 * The steward gate: SIGNING the AdoptionDecision needs the `steward` role. The
 * browser only ever presents a signing action to a verified steward; the quorum
 * verifier is the real security boundary (this is a UX lock, fail-closed).
 */
export function stewardSigningGate(profile: TrustProfile): EndorsementAccess {
  if (hasRole(profile, "steward")) return { allowed: true };
  return {
    allowed: false,
    reason: "signing an adoption decision requires a verified steward role credential",
  };
}
