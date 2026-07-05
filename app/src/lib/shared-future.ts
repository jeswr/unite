// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.2 — the SIGNED, PUBLISHABLE fut:SharedFuture with STRUCTURALLY-ENFORCED
// mandatory dissent (docs/design/next-phases.md §2.2 D1–D4, §2.4, §2.6 (3)). This
// is where a society advisory synthesis becomes a real, verifiable artifact — and
// the maintainer's hard invariant lives HERE: **un-signable if it drops dissent**.
// {@link buildSharedFutureQuads} THROWS before serialisation unless the dissent
// annex is present AND accounts for EVERY standing critique registered at
// endorsement time — mirroring model-society.buildClaimQuads's adoption-invariant
// throw and adoption-decision's dissent-XOR. You cannot construct a signable graph
// that silently omits a critique that was standing when the room converged.
//
// The load-bearing invariants (design §0), enforced structurally at build/verify:
//   • INV-1 — every prov:wasDerivedFrom input must be in the aggregate's
//     `synthesizable` set (re-checked at BUILD and at VERIFY — never optional at
//     the signing boundary); a synthesis written straight to a pod cannot route
//     around aggregate.ts's synthesize-consent gate.
//   • INV-2 / D1 — the mandatory dissent annex: ≥1 fut:dissent XOR an explicit
//     fut:noDissentRecorded true. Build throws with neither/both; parse drops.
//   • D2 (the maintainer's "drops registered dissent") — the annex MUST account
//     for every standing critique (gate.standingCritiqueIds ⊆ the annex's
//     accountedFor). This is the un-signable teeth.
//   • INV-3 — COMPUTED, never asserted: NO status/endorsed triple is emitted; the
//     signature attests the RECOMMENDATION, the bridging evidence is the
//     recomputable common-ground proof.
//   • INV-5 — no single owner: a ≥2 distinct-steward QUORUM (lib/quorum) over a
//     REQUIRED registry-backed trustedStewards allowlist. {@link
//     verifySharedFutureQuorum} THROWS fail-closed when the allowlist is
//     absent/empty — an S5 signing path can NEVER call buildQuorumAttestation
//     unprotected (mirrors S3 adoption-decision.verifyAdoptionDecisionQuorum).
//   • k-ANONYMITY — a synthesis over fewer than `kThreshold` contributors is
//     UN-PUBLISHABLE (build throws, fail-closed); any published fut:ConvergenceMetrics
//     is re-checked k-anonymous at verify (lib/convergence-metrics).
//
// SERIALISE with n3.Writer (via model.serializeTurtle) ONLY — never hand-built
// RDF. PARSE via the guarded accessors — foreign RDF is hostile input.

import {
  issue,
  type KeyPair,
  digestQuads as solidVcDigestQuads,
  type VerifiableCredential,
  type VerificationResult,
} from "@jeswr/solid-vc";
import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import type { ClusterBridgingEvidence } from "./adoption-decision.js";
import {
  metricsAreKAnonymous,
  normalizeKThreshold,
  parseConvergenceMetrics,
} from "./convergence-metrics.js";
import { buildDissentAnnexQuads, type MaterializedDissent } from "./dissent.js";
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
  FUT_BRIDGING_EVIDENCE,
  FUT_BRIDGING_EVIDENCE_CLASS,
  FUT_BRIDGING_SCORE,
  FUT_CLUSTER_LABEL,
  FUT_CONFLICTS_COUNT,
  FUT_DISSENT,
  FUT_DISSENT_RECORD,
  FUT_METHOD_PROVENANCE,
  FUT_NO_DISSENT_RECORDED,
  FUT_RESONATES_COUNT,
  FUT_SEEN_COUNT,
  FUT_SHARED_FUTURE,
  FUT_UNSURE_COUNT,
} from "./fut-draft.js";
import { isMethod } from "./fut-society.js";
import {
  assertStatementCore,
  isHttpIri,
  MAX_CONTENT_LENGTH,
  MAX_LINKS,
  MAX_TITLE_LENGTH,
  readCoded,
  readDateTime,
  readIri,
  readString,
  serializeTurtle,
  typedSubjects,
} from "./model.js";
import { buildQuorumAttestation, type QuorumAttestation, type ResolveKey } from "./quorum.js";

const { namedNode, literal, blankNode, quad } = DataFactory;

const XSD_DATETIME = `${NS.xsd}dateTime`;
const XSD_INTEGER = `${NS.xsd}integer`;
const XSD_BOOLEAN = `${NS.xsd}boolean`;
const XSD_DECIMAL = `${NS.xsd}decimal`;
const XSD_NON_NEGATIVE_INTEGER = `${NS.xsd}nonNegativeInteger`;

// ── The build inputs + the structural gate ────────────────────────────────────

/** The inputs to assemble a `fut:SharedFuture` graph (S5's advisory synthesis). */
export interface SharedFutureInput {
  /** The SharedFuture resource IRI (subject; https). */
  readonly id: string;
  /** `as:content` — the synthesis recommendation, ≤ {@link MAX_CONTENT_LENGTH}. */
  readonly content: string;
  /** `dct:title` — optional short name, ≤ {@link MAX_TITLE_LENGTH}. */
  readonly title?: string;
  /** `prov:wasDerivedFrom` — the gated candidate's lineage (≥1; INV-1). */
  readonly derivedFrom: readonly string[];
  /** `fut:bridgingEvidence` — per-cluster counts (≥1; D3 common-ground proof). */
  readonly bridgingEvidence: readonly ClusterBridgingEvidence[];
  /** The MATERIALISED dissent annex (S5.1). Its `accountedFor` drives D2. */
  readonly dissent: MaterializedDissent;
  /** `fut:noDissentRecorded true` — the EXPLICIT no-dissent assertion; valid ONLY
   *  when the annex carries NO records AND NO critiques stood (D1: silence ≠ consensus). */
  readonly noDissentRecorded?: boolean;
  /** `fut:methodProvenance` — REQUIRED coded deliberation-method concept (D4). */
  readonly methodProvenance: string;
  /** The DISTINCT contributor count feeding the synthesis — the k-anonymity input:
   *  a synthesis over fewer than `gate.kThreshold` contributors is un-publishable. */
  readonly contributorCount: number;
  /** `dct:created` xsd:dateTime (ISO string). */
  readonly created: string;
  /** `dct:creator` WebID IRI (the assembling steward). */
  readonly creator: string;
  /** `fut:inDeliberation` IRI. */
  readonly inDeliberation: string;
  /** Optional pre-built, k-anon `fut:ConvergenceMetrics` quads (S5.3) to embed in
   *  the signed graph so a consumer can re-check convergence + k-anonymity. */
  readonly convergenceMetrics?: readonly Quad[];
}

/** The structural gate for {@link buildSharedFutureQuads}. */
export interface SharedFutureGate {
  /**
   * INV-1: the aggregate's `synthesizable` set — every `derivedFrom` input MUST be
   * a member, else the build throws (the synthesize-consent gate, re-checked at
   * build so a synthesis written straight to a pod cannot bypass aggregate.ts).
   */
  readonly synthesizable: ReadonlySet<string>;
  /**
   * D2 (dissent faithfulness): the critique IRIs STANDING at endorsement time. The
   * annex MUST account for EVERY one — `gate.standingCritiqueIds ⊆
   * input.dissent.accountedFor` — else the build THROWS. This is the un-signable
   * teeth: you cannot sign a synthesis that silently omits a standing critique.
   */
  readonly standingCritiqueIds: ReadonlySet<string>;
  /**
   * The k-anonymity threshold (design default 5; fail-closed for an invalid value).
   * A synthesis whose `contributorCount` is below this is UN-PUBLISHABLE — the
   * build throws (a sub-k cohort cannot be published without re-identification).
   */
  readonly kThreshold: number;
}

function assertNonNegativeInteger(field: string, n: number): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`buildSharedFuture: ${field} must be a non-negative integer: ${n}`);
  }
}

/**
 * Assemble the `fut:SharedFuture` graph, enforcing every invariant at BUILD time
 * (throw on violation — the un-signable-if-it-drops-dissent guarantee):
 *   • INV-1 — `derivedFrom` non-empty and ⊆ `gate.synthesizable`;
 *   • D1/INV-2 — the dissent annex present (≥1 record XOR noDissentRecorded true);
 *   • D2 — the annex accounts for EVERY `gate.standingCritiqueIds` (else throw);
 *   • D3 — ≥1 `fut:bridgingEvidence` (recomputable common-ground proof);
 *   • D4 — `fut:methodProvenance` is a coded deliberation-method concept;
 *   • k-anonymity — `contributorCount ≥ gate.kThreshold` (else throw, fail-closed);
 *   • INV-3 — NO status/endorsed triple is emitted (the signature attests the
 *     recommendation; the status is recomputed by consumers, never decreed).
 */
export function buildSharedFutureQuads(input: SharedFutureInput, gate: SharedFutureGate): Quad[] {
  const kind = "buildSharedFuture";
  assertStatementCore(kind, input);
  if (input.title !== undefined && input.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`${kind}: title exceeds MAX_TITLE_LENGTH (${MAX_TITLE_LENGTH})`);
  }

  // D4: method-provenance is REQUIRED and must be a coded method concept.
  if (!isMethod(input.methodProvenance)) {
    throw new Error(
      `${kind}: fut:methodProvenance is REQUIRED and must be a coded deliberation-method concept ` +
        `(resonance-mapping / mediated-synthesis / mini-public): ${input.methodProvenance}`,
    );
  }

  // k-ANONYMITY (the fail-closed enforcement): a sub-k cohort cannot be published.
  // Normalise k defensively (>=1, default 5) so a broken gate can never disable it.
  const kThreshold = normalizeKThreshold(gate.kThreshold);
  assertNonNegativeInteger("contributorCount", input.contributorCount);
  if (input.contributorCount < kThreshold) {
    throw new Error(
      `${kind}: k-anonymity — a synthesis over ${input.contributorCount} contributors is below the ` +
        `k-threshold (${kThreshold}); a sub-k cohort is un-publishable (fail-closed)`,
    );
  }

  // INV-1: the lineage consent gate, re-checked at build time.
  if (input.derivedFrom.length === 0) {
    throw new Error(`${kind}: a synthesis must derive from ≥1 statement (prov:wasDerivedFrom)`);
  }
  if (input.derivedFrom.length > MAX_LINKS) {
    throw new Error(`${kind}: derivedFrom exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const d of input.derivedFrom) {
    if (!isHttpIri(d)) throw new Error(`${kind}: derivedFrom input is not an http(s) IRI: ${d}`);
    if (!gate.synthesizable.has(d)) {
      throw new Error(
        `${kind}: derivedFrom input lacks fut:synthesize consent (not in the aggregate's ` +
          `synthesizable set) — a synthesis may derive ONLY from consented statements (INV-1): ${d}`,
      );
    }
  }

  // D3: ≥1 bridging evidence, count-consistent (the recomputable common-ground proof).
  if (input.bridgingEvidence.length === 0) {
    throw new Error(
      `${kind}: a synthesis must carry ≥1 fut:bridgingEvidence (common-ground proof)`,
    );
  }
  if (input.bridgingEvidence.length > MAX_LINKS) {
    throw new Error(`${kind}: bridgingEvidence exceeds MAX_LINKS (${MAX_LINKS})`);
  }
  for (const be of input.bridgingEvidence) {
    for (const [f, v] of [
      ["resonatesCount", be.resonatesCount],
      ["conflictsCount", be.conflictsCount],
      ["unsureCount", be.unsureCount],
      ["seenCount", be.seenCount],
    ] as const) {
      assertNonNegativeInteger(f, v);
    }
    if (be.seenCount !== be.resonatesCount + be.conflictsCount + be.unsureCount) {
      throw new Error(
        `${kind}: bridging evidence seenCount must equal resonates+conflicts+unsure ` +
          `(${be.seenCount} ≠ ${be.resonatesCount}+${be.conflictsCount}+${be.unsureCount})`,
      );
    }
    if (be.clusterLabel.length === 0 || be.clusterLabel.length > MAX_TITLE_LENGTH) {
      throw new Error(
        `${kind}: bridging evidence clusterLabel must be 1–${MAX_TITLE_LENGTH} chars`,
      );
    }
  }

  // D1 (INV-2): the mandatory dissent annex — ≥1 record XOR noDissentRecorded true.
  const records = input.dissent.records;
  const hasDissent = records.length > 0;
  const noDissent = input.noDissentRecorded === true;
  if (!hasDissent && !noDissent) {
    throw new Error(
      `${kind}: a SharedFuture is INVALID without its dissent annex — supply ≥1 fut:dissent ` +
        `OR fut:noDissentRecorded true (silence is never consensus, INV-2/D1)`,
    );
  }
  if (hasDissent && noDissent) {
    throw new Error(
      `${kind}: fut:noDissentRecorded true is only valid when the annex carries NO dissent`,
    );
  }

  // D2 (the maintainer's "drops registered dissent"): EVERY standing critique must
  // be accounted for by the annex. A noDissentRecorded assertion while critiques
  // stood is a contradiction the missing-accounting check ALSO catches, but reject
  // it explicitly for a clear error.
  if (noDissent && gate.standingCritiqueIds.size > 0) {
    throw new Error(
      `${kind}: cannot assert fut:noDissentRecorded true — ${gate.standingCritiqueIds.size} ` +
        `critique(s) stood at endorsement time (their dissent must be carried, not erased)`,
    );
  }
  for (const critiqueId of gate.standingCritiqueIds) {
    if (!input.dissent.accountedFor.has(critiqueId)) {
      throw new Error(
        `${kind}: the dissent annex DROPS a standing critique (${critiqueId}) — a synthesis is ` +
          `UN-SIGNABLE unless every critique standing at endorsement is accounted for (D2)`,
      );
    }
  }

  const s = namedNode(input.id);
  const quads: Quad[] = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_SHARED_FUTURE)),
    quad(s, namedNode(AS_CONTENT), literal(input.content)),
    quad(s, namedNode(DCT_CREATED), literal(input.created, namedNode(XSD_DATETIME))),
    quad(s, namedNode(DCT_CREATOR), namedNode(input.creator)),
    quad(s, namedNode(FUT_IN_DELIBERATION), namedNode(input.inDeliberation)),
    quad(s, namedNode(FUT_METHOD_PROVENANCE), namedNode(input.methodProvenance)),
    ...input.derivedFrom.map((d) => quad(s, namedNode(PROV_WAS_DERIVED_FROM), namedNode(d))),
  ];
  if (input.title !== undefined && input.title.length > 0) {
    quads.push(quad(s, namedNode(DCT_TITLE), literal(input.title)));
  }

  // Bridging evidence: one fut:BridgingEvidence node per opinion cluster.
  for (const be of input.bridgingEvidence) {
    const node = blankNode();
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
  }

  // The dissent annex (INV-2/D1): either the materialised records OR the explicit flag.
  if (noDissent) {
    quads.push(
      quad(s, namedNode(FUT_NO_DISSENT_RECORDED), literal("true", namedNode(XSD_BOOLEAN))),
    );
  } else {
    quads.push(...buildDissentAnnexQuads(input.id, records));
  }

  // Optional embedded convergence metrics (S5.3). RE-CHECK k-anonymity at BUILD
  // (don't just trust the caller called the publisher): a caller that hand-builds
  // or tampers with the metrics quads must NOT be able to sign a graph carrying a
  // sub-k / subtraction-leaking metrics cell. Throw fail-closed if it isn't k-anon.
  if (input.convergenceMetrics !== undefined) {
    const metrics = parseConvergenceMetrics(new Store([...input.convergenceMetrics]));
    if (!metricsAreKAnonymous(metrics, kThreshold)) {
      throw new Error(
        `${kind}: embedded fut:ConvergenceMetrics is not k-anonymous at k=${kThreshold} ` +
          "(a sub-k cell or a subtraction leak) — a sub-k-anonymous synthesis is un-publishable",
      );
    }
    quads.push(...input.convergenceMetrics);
  }

  // INV-3: NO status/endorsed triple is emitted — deliberately.
  return quads;
}

/** Serialise a `fut:SharedFuture` to Turtle. Throws on any invariant violation. */
export async function serializeSharedFuture(
  input: SharedFutureInput,
  gate: SharedFutureGate,
): Promise<string> {
  return serializeTurtle(buildSharedFutureQuads(input, gate), { prov: NS.prov });
}

// ── Steward signing (each steward's independent solid-vc credential) ──────────

/** Inputs to {@link issueSharedFutureAttestation}. */
export interface SharedFutureAttestationInput {
  /** The SharedFuture resource IRI (credentialSubject + relatedResource id). */
  readonly subject: string;
  /** The SharedFuture graph the steward attests (its RDFC-1.0 digest is bound). */
  readonly futureQuads: readonly Quad[];
  /** The steward's WebID (the credential issuer). */
  readonly webId: string;
  /** The steward's signing key (`verificationMethod` controlled by `webId`). */
  readonly key: KeyPair;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads`. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/**
 * A single steward signs the SharedFuture: an independent solid-vc credential (the
 * `fut:SharedFutureCredential` shape) over the artifact's RDFC-1.0 digest, bound
 * via `relatedResource`, retaining the steward's own WebID identity binding — the
 * shape the quorum verifier aggregates. Same primitive as S3's
 * issueStewardAttestation; a thin composition of solid-vc `issue` + `digestQuads`.
 */
export async function issueSharedFutureAttestation(
  input: SharedFutureAttestationInput,
): Promise<VerifiableCredential> {
  if (!isHttpIri(input.subject)) {
    throw new Error(
      `issueSharedFutureAttestation: subject is not an http(s) IRI: ${input.subject}`,
    );
  }
  if (!isHttpIri(input.webId)) {
    throw new Error(`issueSharedFutureAttestation: webId is not an http(s) IRI: ${input.webId}`);
  }
  const digestFn = input.digest ?? solidVcDigestQuads;
  const digest = await digestFn(input.futureQuads);
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

// ── The QUORUM ratification gate (the LOAD-BEARING S5 requirement) ────────────

/** Options for {@link verifySharedFutureQuorum} / {@link verifySharedFuture}. */
export interface SharedFutureQuorumOptions {
  /** REQUIRED. Verify ONE steward credential (signature + issuer-binding +
   *  validity + revocation). In production close over `verifyCredential(vc, …)`. */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /** REQUIRED. The signing-key resolver — the quorum distinctness anchor. */
  readonly resolveKey: ResolveKey;
  /**
   * REQUIRED for S5 (the LOAD-BEARING gate). The registry-backed canonical steward
   * allowlist (derive it from the community's steward fedreg:Registry via
   * adoption-decision.resolveTrustedStewards). The quorum module leaves this
   * OPTIONAL; S5 signing MUST NOT run without it — a missing/EMPTY allowlist THROWS
   * (fail-closed), so buildQuorumAttestation is never called unprotected. This is
   * where the "distinct verified key = distinct real steward" trust decision lives
   * (INV-5). MIRRORS S3's adoption-decision.verifyAdoptionDecisionQuorum — a
   * candidate to extract as a shared @jeswr/quorum-attestation gate (design §1.4).
   */
  readonly trustedStewards: readonly string[];
  /** The steward-signature floor (default + minimum {@link QUORUM_FLOOR}); a
   *  community may RAISE it, never lower it (the quorum clamps up to the floor). */
  readonly threshold?: number;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads`. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/**
 * Verify the ≥2-steward QUORUM over a SharedFuture graph — the S5 signing gate.
 * THROWS fail-closed when `trustedStewards` is absent/empty (the load-bearing
 * requirement: an S5 quorum NEVER runs without a registry-backed steward
 * allowlist), then delegates to the shipped {@link buildQuorumAttestation} with
 * the allowlist wired in. Returns the full attestation (met / distinctStewards /
 * bootstrapping / rejections) for honest surfaces.
 */
export async function verifySharedFutureQuorum(
  futureQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: SharedFutureQuorumOptions,
): Promise<QuorumAttestation> {
  const allowlist = Array.isArray(options.trustedStewards)
    ? options.trustedStewards.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  if (allowlist.length === 0) {
    throw new TypeError(
      "verifySharedFutureQuorum: a non-empty `trustedStewards` allowlist is REQUIRED — S5 signing " +
        "must not run an unprotected quorum (derive it from the community's steward fedreg:Registry " +
        "via resolveTrustedStewards)",
    );
  }
  return buildQuorumAttestation(futureQuads, stewardVCs, {
    verifyVc: options.verifyVc,
    resolveKey: options.resolveKey,
    trustedStewards: allowlist,
    ...(options.threshold !== undefined ? { threshold: options.threshold } : {}),
    ...(options.digest !== undefined ? { digest: options.digest } : {}),
  });
}

// ── Parse (mirrors every build invariant — foreign RDF is hostile) ────────────

/** A parsed, valid `fut:SharedFuture` (D1–D4 satisfied). NO status is read (INV-3). */
export interface ParsedSharedFuture {
  readonly id: string;
  readonly content: string;
  readonly title?: string;
  readonly derivedFrom: readonly string[];
  readonly bridgingEvidence: readonly ClusterBridgingEvidence[];
  readonly methodProvenance: string;
  readonly created: string;
  readonly creator: string;
  readonly inDeliberation: string;
  /** True iff the mandatory dissent annex is present + well-formed (D1). */
  readonly hasDissentAnnex: boolean;
  /** The count of content-bearing fut:DissentRecords. The honest materializeDissent
   *  builds the annex 1:1 with (⊇) the standing critiques, so at verify D2 requires
   *  `>= standing.size` — FEWER records dropped dissent. (Verify uses `>=` not `===`
   *  to mirror the build gate's `standingCritiqueIds ⊆ accountedFor` subset
   *  semantics, which permits over-coverage; count-PADDING via duplicate quotes is
   *  caught by {@link verbatimDissentRecordCount}, not the count comparison.) */
  readonly dissentRecordCount: number;
  /** The DISTINCT source-critique IRIs of the VERBATIM records (deduped) —
   *  re-checkable at verify: every one must be a standing critique (a quote of a
   *  non-standing critique is caught) AND, combined with {@link
   *  verbatimDissentRecordCount}, DISTINCT coverage is recomputed (duplicate
   *  quotes of one critique that pad the count while dropping others are caught). */
  readonly verbatimDissentCritiques: readonly string[];
  /** The RAW count of VERBATIM records (WITH duplicates). Equals
   *  `verbatimDissentCritiques.length` iff no critique is quoted twice — the D2
   *  distinct-coverage test that defeats a count-padding duplicate-quote forgery. */
  readonly verbatimDissentRecordCount: number;
}

/** A single xsd:nonNegativeInteger (or xsd:integer) literal ≥ 0, else undefined. */
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

/** A single xsd:decimal literal (finite), else undefined. */
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

/** Read the WELL-FORMED fut:BridgingEvidence nodes (mirrors the build's count
 *  consistency). BOUNDED FAIL-CLOSED: a fan-out beyond MAX_LINKS ⇒ undefined
 *  (drop the whole SharedFuture). */
function readBridgingEvidence(ds: DatasetCore, s: Term): ClusterBridgingEvidence[] | undefined {
  const out: ClusterBridgingEvidence[] = [];
  let seen = 0;
  for (const q of ds.match(s, namedNode(FUT_BRIDGING_EVIDENCE), null, null)) {
    if (++seen > MAX_LINKS) return undefined;
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
      seenCount !== resonatesCount + conflictsCount + unsureCount
    ) {
      continue;
    }
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

/** The parsed dissent annex: its D1 validity, its record COUNT (the re-checkable D2
 *  floor), and the source-critique IRIs of its VERBATIM records (re-checkable
 *  against the endorsement-time standing set). */
interface ParsedAnnex {
  /** D1: ≥1 content-bearing fut:dissent XOR fut:noDissentRecorded true. */
  readonly valid: boolean;
  /** The number of content-bearing fut:DissentRecords (materialised 1:1 with (⊇) the
   *  standing critiques, so the D2 re-check requires this to be `>=` the
   *  endorsement-time standing-critique count — a shortfall dropped dissent). */
  readonly recordCount: number;
  /** The DISTINCT prov:wasDerivedFrom source-critique IRIs of the VERBATIM records
   *  (deduped) — these MUST be a subset of the endorsement-time standing critiques
   *  (a verbatim quote of a non-standing/fabricated critique is caught at verify). */
  readonly verbatimCritiques: readonly string[];
  /** The RAW number of VERBATIM records (WITH duplicates) — compared against the
   *  DISTINCT `verbatimCritiques` count to reject duplicate quotes that pad the
   *  total while dropping other standing critiques (the D2 distinct-coverage test). */
  readonly verbatimRecordCount: number;
}

/**
 * Parse the dissent annex of `s` (D1 on read — mirrors the build EXACTLY, including
 * the contradiction the build rejects): ≥1 content-bearing fut:dissent XOR
 * fut:noDissentRecorded true. BOTH ⇒ contradictory ⇒ invalid; NEITHER ⇒ invalid
 * (silence ≠ consensus). ALSO surfaces the record count + verbatim source lineage so
 * verifySharedFuture can re-check D2 (dissent faithfulness). BOUNDED FAIL-CLOSED
 * against a hostile fan-out.
 */
function parseDissentAnnex(ds: DatasetCore, s: Term): ParsedAnnex {
  const invalid: ParsedAnnex = {
    valid: false,
    recordCount: 0,
    verbatimCritiques: [],
    verbatimRecordCount: 0,
  };
  let recordCount = 0;
  let verbatimRecordCount = 0;
  const verbatimCritiques = new Set<string>();
  let seen = 0;
  for (const q of ds.match(s, namedNode(FUT_DISSENT), null, null)) {
    if (++seen > MAX_LINKS) return invalid; // hostile fan-out
    const rec = q.object;
    if (rec.termType !== "NamedNode" && rec.termType !== "BlankNode") return invalid; // malformed target
    // Mirror the builder EXACTLY (a hand-signed graph cannot smuggle a malformed
    // record past verify): every record is rdf:type fut:DissentRecord + content-bearing;
    // it is either a VERBATIM record (BOTH dct:creator AND prov:wasDerivedFrom, both
    // http(s)) or an AGGREGATE record (NEITHER). Anything else ⇒ invalid annex.
    let typed = false;
    for (const _q of ds.match(rec, namedNode(RDF_TYPE), namedNode(FUT_DISSENT_RECORD), null)) {
      typed = true;
      break;
    }
    if (!typed) return invalid;
    const content = readString(ds, rec, AS_CONTENT, MAX_CONTENT_LENGTH);
    if (content === undefined || content.length === 0) return invalid;
    // COUNT the creator + lineage triples DIRECTLY — readIri (via `single`) collapses
    // BOTH "absent" and "multiple" to undefined, so relying on it would silently
    // reclassify a MALFORMED multi-valued verbatim record (e.g. two prov:wasDerivedFrom
    // triples) as aggregate-only and hide it from the distinct-coverage D2 check.
    // Mirror the builder EXACTLY: a record is VERBATIM iff EXACTLY ONE http(s) creator
    // AND EXACTLY ONE http(s) lineage; AGGREGATE iff ZERO of BOTH; anything else is
    // malformed and INVALIDATES the annex (a hand-signed graph cannot smuggle a
    // malformed record past verify).
    const creatorCount = ds.match(rec, namedNode(DCT_CREATOR), null, null).size;
    const lineageCount = ds.match(rec, namedNode(PROV_WAS_DERIVED_FROM), null, null).size;
    if (creatorCount === 0 && lineageCount === 0) {
      recordCount += 1; // aggregate record — NEITHER attribution nor lineage
      continue;
    }
    if (creatorCount !== 1 || lineageCount !== 1) return invalid; // malformed multi-valued
    const creator = readIri(ds, rec, DCT_CREATOR);
    const lineage = readIri(ds, rec, PROV_WAS_DERIVED_FROM);
    if (creator === undefined || lineage === undefined) return invalid; // single but non-http(s)
    recordCount += 1;
    verbatimRecordCount += 1; // RAW count (with duplicates) for the distinct-coverage test
    verbatimCritiques.add(lineage); // DISTINCT set (deduped)
  }
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
  if (flagCount > 1 || flagMalformed) return invalid;
  const hasDissent = recordCount > 0;
  return {
    valid: hasDissent !== flagTrue, // XOR
    recordCount,
    verbatimCritiques: [...verbatimCritiques],
    verbatimRecordCount,
  };
}

/** Strictly read prov:wasDerivedFrom FAIL-CLOSED (any non-http(s) object or an
 *  over-MAX_LINKS count drops the whole SharedFuture — the complete lineage the
 *  INV-1 consent re-check runs over). */
function readLineageStrict(ds: DatasetCore, s: Term): string[] | undefined {
  const out: string[] = [];
  for (const q of ds.match(s, namedNode(PROV_WAS_DERIVED_FROM), null, null)) {
    const o = q.object;
    if (o.termType !== "NamedNode" || !isHttpIri(o.value)) return undefined;
    out.push(o.value);
    if (out.length > MAX_LINKS) return undefined;
  }
  return out;
}

/**
 * Parse every well-formed `fut:SharedFuture` in the dataset. A missing/malformed
 * required field, an absent method-provenance (D4), an absent common-ground proof
 * (≥1 bridging evidence, D3), a missing dissent annex (D1), or a malformed/oversized
 * lineage (INV-1) drops the ITEM — the parse mirrors EVERY build invariant, so a
 * hand-authored signed graph cannot smuggle in an invalid SharedFuture. Reads NO
 * status/endorsed property (INV-3). NOTE: AdoptionDecision graphs (typed ALSO as
 * fut:SharedFuture) are excluded here — an AdoptionDecision carries
 * fut:proposesVersion, which a plain society SharedFuture never does; use
 * adoption-decision.parseAdoptionDecisions for those.
 */
export function parseSharedFutures(ds: DatasetCore): ParsedSharedFuture[] {
  const out: ParsedSharedFuture[] = [];
  for (const s of typedSubjects(ds, FUT_SHARED_FUTURE)) {
    // Exclude an AdoptionDecision (a fut:SharedFuture subtype with proposesVersion)
    // — S5's parse is for PLAIN society syntheses; the S3 module owns decisions.
    let isDecision = false;
    for (const _q of ds.match(s, namedNode(`${NS.fut}proposesVersion`), null, null)) {
      isDecision = true;
      break;
    }
    if (isDecision) continue;

    const content = readString(ds, s, AS_CONTENT, MAX_CONTENT_LENGTH);
    const created = readDateTime(ds, s, DCT_CREATED);
    const creator = readIri(ds, s, DCT_CREATOR);
    const inDeliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    const methodProvenance = readCoded(ds, s, FUT_METHOD_PROVENANCE, isMethod);
    const derivedFrom = readLineageStrict(ds, s);
    const bridgingEvidence = readBridgingEvidence(ds, s);
    const annex = parseDissentAnnex(ds, s);
    if (
      content === undefined ||
      created === undefined ||
      creator === undefined ||
      inDeliberation === undefined ||
      methodProvenance === undefined || // D4: a coded method is required
      derivedFrom === undefined ||
      derivedFrom.length === 0 ||
      bridgingEvidence === undefined ||
      bridgingEvidence.length === 0 || // D3
      !annex.valid // D1
    ) {
      continue;
    }
    const title = readString(ds, s, DCT_TITLE, MAX_TITLE_LENGTH);
    out.push({
      id: s.value,
      content,
      derivedFrom,
      bridgingEvidence,
      methodProvenance,
      created,
      creator,
      inDeliberation,
      hasDissentAnnex: annex.valid,
      dissentRecordCount: annex.recordCount,
      verbatimDissentCritiques: annex.verbatimCritiques,
      verbatimDissentRecordCount: annex.verbatimRecordCount,
      ...(title !== undefined ? { title } : {}),
    });
  }
  return out;
}

// ── The full S5 verify path (quorum + parse + INV-1 + k-anonymity) ────────────

/** The full verification of a signed SharedFuture. */
export interface SharedFutureVerification {
  /** The parsed synthesis (undefined when the graph carries no valid one). */
  readonly sharedFuture?: ParsedSharedFuture;
  /** The ≥2-steward quorum attestation over the artifact digest. */
  readonly quorum: QuorumAttestation;
  /**
   * `true` IFF the quorum is met AND the signed graph parses as exactly one valid
   * `fut:SharedFuture` AND its lineage is fully consented (INV-1) AND any published
   * convergence metrics are k-anonymous AND (when the standing-critique set is
   * supplied) the dissent annex is faithful (D2). Fail-closed on all — ≥2 stewards
   * signing an arbitrary / unconsented / sub-k-leaking / dissent-dropping graph do
   * NOT ratify it.
   */
  readonly ratified: boolean;
  /** Whether every parsed `derivedFrom` is in the supplied `synthesizable` set. */
  readonly lineageConsented?: boolean;
  /** Whether every published `fut:ConvergenceMetrics` cell is k-anonymous (≥ k). */
  readonly kAnonymous: boolean;
  /**
   * D2 re-check (dissent faithfulness), present only when `standingCritiqueIds` is
   * supplied. It soundly catches the THREE RE-CHECKABLE forgeries by DISTINCT
   * COVERAGE (mirroring the build-time `standingCritiqueIds ⊆ accountedFor` SUBSET
   * check on the SIGNED graph), not a mere count comparison:
   *   (1) the annex record count `<` the standing count — dropped dissent
   *       (under-representation). (Verify uses `>=` not `===` to match the build
   *       gate's subset semantics, which permits an over-covering annex.)
   *   (2) a VERBATIM quote of a critique that was NOT standing (a fabricated quote);
   *   (3) DUPLICATE verbatim quotes of one critique that pad the count while
   *       silently dropping OTHER standing critiques (the raw verbatim-record count
   *       must equal the DISTINCT verbatim-critique count) — THIS is what defeats the
   *       count-padding forgery a bare count comparison ratified.
   * `true` iff none holds. LIMIT (by design, not an oversight): a swap AMONG
   * anonymous aggregate records that keeps the count is NOT re-checkable — aggregate
   * records are deliberately non-identifying (privacy / k-anonymity), so per-critique
   * coverage of *aggregated* dissent cannot be recomputed post-hoc without weakening
   * that privacy. That residual is covered by the BUILD-time D2 throw (a faithful
   * builder cannot construct it) + the ≥2-steward attestation (INV-5). `undefined`
   * when the verifier did not supply the standing set.
   */
  readonly dissentComplete?: boolean;
}

/**
 * The full S5 verify path over a SharedFuture GRAPH + presented steward VCs:
 *   1. verify the ≥2-steward quorum WITH the REQUIRED trustedStewards allowlist
 *      (throws fail-closed if absent — the load-bearing gate);
 *   2. parse the SharedFuture from the SIGNED quads (bound to exactly what the
 *      stewards signed — no external-dataset seam, so unsigned content can never
 *      be ratified); FAIL-CLOSED on ambiguity (exactly ONE parseable synthesis);
 *   3. re-check INV-1 (lineage ⊆ the REQUIRED `synthesizable` set);
 *   4. re-check k-anonymity of any embedded `fut:ConvergenceMetrics` (≥ k);
 *   5. re-check D2 (dissent faithfulness) WHEN `standingCritiqueIds` is supplied —
 *      the signed annex must account for every standing critique (a hand-signed
 *      partial annex is caught here, not only at the un-re-checkable build).
 * The signature attests the RECOMMENDATION (`ratified`); nothing is decreed.
 */
export async function verifySharedFuture(
  futureQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: SharedFutureQuorumOptions & {
    /**
     * REQUIRED. The aggregate's `synthesizable` set — ratification requires every
     * parsed `derivedFrom` input to be a member (INV-1 re-checked at verify, never
     * optional; fail-closed — an empty set consents nothing).
     */
    readonly synthesizable: ReadonlySet<string>;
    /** The k-anonymity threshold to re-check published metrics against (default 5). */
    readonly kThreshold?: number;
    /**
     * The critique IRIs STANDING at endorsement time. When supplied, D2 is
     * RE-CHECKED against the signed graph by DISTINCT COVERAGE (the SOUND,
     * re-checkable part): the annex must carry AT LEAST this many records (fewer
     * dropped dissent; `>=` mirrors the build gate's subset semantics), every verbatim
     * quote must be OF a standing critique (no fabricated quote), AND no critique may
     * be quoted twice to pad the count while dropping another (raw verbatim-record
     * count = distinct verbatim-critique count) — so a hand-built graph that
     * under-represents or duplicates a quote cannot be ratified even though it was
     * signed. The community verifier HAS this
     * set (it recomputed the room). See {@link
     * SharedFutureVerification.dissentComplete} for the design-intended residual
     * (anonymous-aggregate swap) covered by build enforcement + attestation.
     */
    readonly standingCritiqueIds?: ReadonlySet<string>;
  },
): Promise<SharedFutureVerification> {
  // 1. The quorum gate — REQUIRES the allowlist (throws when absent).
  const quorum = await verifySharedFutureQuorum(futureQuads, stewardVCs, options);

  // 2. Parse from the SIGNED quads (bound to exactly what was signed). Fail-closed
  //    on an ambiguous graph: exactly ONE parseable synthesis, else not ratified.
  const ds = new Store([...futureQuads]);
  const parsed = parseSharedFutures(ds);
  const sharedFuture = parsed.length === 1 ? parsed[0] : undefined;

  // 3. INV-1 re-check (never optional at this boundary).
  const lineageConsented =
    sharedFuture === undefined
      ? undefined
      : sharedFuture.derivedFrom.every((d) => options.synthesizable.has(d));

  // 4. k-anonymity re-check over any published convergence metrics.
  const kAnonymous = metricsAreKAnonymous(parseConvergenceMetrics(ds), options.kThreshold);

  // 5. D2 re-check (dissent faithfulness) — only when the standing set is supplied.
  //    DISTINCT COVERAGE, not a bare count comparison (the count-only check ratified a
  //    forgery of 3 duplicate verbatim quotes of ONE critique that padded the total
  //    while dropping the other two). All THREE must hold:
  //      (a) recordCount ≥ standing.size — a shortfall DROPPED dissent (the honest
  //          annex is materialised 1:1 with ⊇ the standing critiques, so it can never
  //          have FEWER records than critiques stood). This MIRRORS the build-time
  //          `standingCritiqueIds ⊆ accountedFor` SUBSET semantics — the builder
  //          permits an annex that OVER-covers, so verify must not reject a surplus
  //          (that would be a build/verify contract mismatch);
  //      (b) NO duplicate verbatim quote — the raw verbatim-record count equals the
  //          DISTINCT verbatim-critique count, so a critique quoted twice (to pad the
  //          count while dropping another) cannot slip through (THIS is what closes
  //          the count-padding forgery, independent of the count comparison); AND
  //      (c) every DISTINCT verbatim quote is OF a standing critique (no fabricated
  //          quote).
  //    (a)+(b) force at least |standing.size − distinctVerbatim| aggregate records to
  //    exist for the remaining standing critiques (pigeonhole → coverage). Fail-closed:
  //    any violation ⇒ dissentComplete false. (A swap among ANONYMOUS aggregate
  //    records that keeps the count is not re-checkable by design — see
  //    dissentComplete's doc; it is covered by the build throw + the ≥2-steward
  //    attestation, not this re-check.)
  const standing = options.standingCritiqueIds;
  const dissentComplete =
    standing === undefined || sharedFuture === undefined
      ? undefined
      : sharedFuture.dissentRecordCount >= standing.size &&
        sharedFuture.verbatimDissentRecordCount === sharedFuture.verbatimDissentCritiques.length &&
        sharedFuture.verbatimDissentCritiques.every((c) => standing.has(c));

  return {
    ...(sharedFuture !== undefined ? { sharedFuture } : {}),
    quorum,
    ratified:
      quorum.met &&
      sharedFuture !== undefined &&
      lineageConsented === true &&
      kAnonymous &&
      dissentComplete !== false, // undefined (not supplied) does not block; false does
    ...(lineageConsented !== undefined ? { lineageConsented } : {}),
    kAnonymous,
    ...(dissentComplete !== undefined ? { dissentComplete } : {}),
  };
}
