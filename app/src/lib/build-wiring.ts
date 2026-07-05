// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.4 — the build-layer WIRING that connects deliberation-outcome → commission →
// build → merge, enforcing the two SECURITY BINDINGS that the BL.3 layer left as the
// caller's responsibility (design docs/design/next-phases.md §3; PLATFORM-PLAN §5).
//
// ── The gap BL.4 closes (why this file exists) ───────────────────────────────────
// BL.3 (commission.ts) shipped the two signed gates INDEPENDENTLY:
//   • {@link verifyCommission} proves a `fedtrust:DelegationCredential` is signed by a
//     TRUSTED commissioner, scoped to EXACTLY one artifact IRI, and names an assignee;
//   • {@link verifyMergeQuorum} proves ≥2 DISTINCT trusted stewards each signed the
//     RDFC-1.0 digest of some `artifactQuads` (content-bound, per-call).
// But NOTHING in BL.3 cross-checks that those two gates are talking about the SAME
// build. Two holes remain, both the CALLER's responsibility, both closed here:
//   (a) the ARTIFACT the reviewers signed the digest of must be the artifact the
//       commission AUTHORIZED — a quorum over content X while the commission scoped
//       artifact Y is a rubber-stamp of the wrong thing;
//   (b) the BUILDER performing the merge must be the VERIFIED commission ASSIGNEE —
//       an unrelated actor cannot ride a valid commission + a valid quorum to land a
//       merge they were never delegated.
// {@link verifyBuildMerge} is the FAIL-CLOSED composite that binds both, THEN runs the
// quorum, so a merge is authorized ONLY when the commission, the artifact identity, the
// builder identity, and the ≥2-steward quorum all agree.
//
// ── The two bindings (the load-bearing security requirement) ─────────────────────
//   BINDING (a) — ARTIFACT. verifyCommission is invoked with its `artifact` scope PINNED
//     to the merge's declared `mergedArtifact.iri`, so a delegation scoped to a DIFFERENT
//     artifact fails `scope-mismatch` → `commission-invalid` (the "declared merge IRI ≠
//     commission scope" half). PLUS this module's own cross-check that the signed CONTENT
//     graph is actually ABOUT that IRI (the commissioned IRI appears as a subject of the
//     `mergedArtifact.quads` the reviewers digested) → `artifact-mismatch` otherwise (the
//     "declared IRI matches, but the reviewers signed a graph about a different subject"
//     half — the check commission.ts structurally CANNOT do because it never sees the
//     merged content). Together: the digest the quorum attests is the digest of a graph
//     that (a1) is declared for, (a2) describes, the exact commissioned artifact.
//   BINDING (b) — BUILDER. The actor performing the merge (`options.builder`) MUST equal
//     the VERIFIED commission `assignee` (the delegate the signed credential names) →
//     `builder-mismatch` otherwise. The quorum's "≥1 reviewer distinct from the builder"
//     self-review guard is then anchored on that VERIFIED assignee — NOT a caller-supplied
//     string — so a builder cannot alias its way past the self-merge rule: distinctness is
//     the quorum's RFC-7638 key-thumbprint anchor, and the builder identity the guard
//     compares against is cryptographically pinned to the commission.
//
// Only AFTER both bindings hold does verifyBuildMerge call {@link verifyMergeQuorum},
// inheriting its REQUIRED-non-empty `trustedStewards` fail-closed gate (a merge NEVER
// runs an unprotected quorum) and its ≥2 floor + distinct-reviewer rule.
//
// ── The lifecycle wiring ─────────────────────────────────────────────────────────
// {@link BuildLifecycle} drives ONE thread through the BL.3 state machine using these
// verified gates: the `commission` edge is gated by {@link verifyCommission}, the `merge`
// edge by {@link verifyBuildMerge}. Because both feed their boolean verdict into
// {@link transition}'s `gatePassed` — and transition THROWS `unverified-evidence` unless
// the gate passed — the `commissioned` and `merged` states are UNREACHABLE without the
// bindings, structurally (not by convention). Every applied step is recorded as a guarded
// {@link CommissionEvent} (built via commission.ts's `buildCommissionEventQuads` — n3.Writer,
// never hand-concatenated RDF), so what the lifecycle writes is exactly what
// {@link parseCommissionEvents} + {@link foldCommissionState} recompute (INV-3:
// computed-not-asserted). Illegal ordering still throws (the state machine is the grammar).
//
// ── Deferred to BL.5 (documented seams, per the BL.3 header) ─────────────────────
// The ODRL usage-policy layer (`odrl:Agreement` chained via `odrld:delegatedUnder`,
// evaluated with @jeswr/solid-odrl) and the ZERO-CREDENTIAL audit-walk expander
// (`auditArtifact` — reconstruct the who-commissioned / who-built / who-reviewed / which-
// digest chain from the persisted events + credentials, verifiable with no live secret)
// are the DEEPER build-layer surfaces (design §3.2 / §3.4). BL.4 delivers the two bindings
// + the lifecycle wiring (the required core) and leaves those two as clean seams: the
// verified commission + merge results this module returns are the authority root they
// compose over. They are a follow-up BEAD, not silent scope.
//
// SERIALISE with n3.Writer (via commission.ts builders + model.serializeTurtle) ONLY.
// PARSE via the guarded model.ts / commission.ts accessors — foreign RDF is hostile input.
// This module COMPOSES commission.ts / quorum.ts / channel.ts / model.ts; it EDITS none.

import type { VerifiableCredential, VerificationResult } from "@jeswr/solid-vc";
import type {
  Quad,
  Quad_Graph,
  Quad_Object,
  Quad_Predicate,
  Quad_Subject,
  Term,
} from "@rdfjs/types";
import { DataFactory } from "n3";
import type { CommissionState } from "./channel.js";
import {
  buildCommissionEventQuads,
  buildCommissionStateQuads,
  type CommissionEvent,
  type CommissionEventType,
  CommissionTransitionError,
  type CommissionVerification,
  canTransition,
  type MergeGateResult,
  transition,
  UNITE_COMMISSION_EVENT,
  verifyCommission,
  verifyMergeQuorum,
} from "./commission.js";
import { isHttpIri, serializeTurtle } from "./model.js";
import type { ResolveKey } from "./quorum.js";

// The `unite:` build namespace, derived from an exported commission.ts IRI so it can
// never drift from the constants those builders use (`…/unite/build#`).
const UNITE_NS = UNITE_COMMISSION_EVENT.slice(0, UNITE_COMMISSION_EVENT.indexOf("#") + 1);

// ═══════════════════════════════════════════════════════════════════════════════
// verifyBuildMerge — the two bindings + the quorum (the FAIL-CLOSED composite)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The merged artifact presented for a merge: its canonical IRI + the content graph the
 * reviewers signed the RDFC-1.0 digest of. Both halves of binding (a) are checked
 * against this: `iri` vs the commission scope, and `quads` (the digested content) vs
 * `iri` (the content must describe the declared artifact).
 */
export interface MergedArtifact {
  /** The artifact's canonical IRI — MUST equal the commission's verified scope (a1). */
  readonly iri: string;
  /** The merged content graph the reviewer quorum attests the digest of — MUST be
   *  ABOUT {@link MergedArtifact.iri} (a2: the IRI appears as a subject). */
  readonly quads: readonly Quad[];
}

/** Why a build-merge was NOT authorized. A security surface must never collapse all
 *  failures into one — {@link BuildMergeResult.reasons} carries every applicable one. */
export type BuildMergeRejectReason =
  /** The signed commission did not authorize building THIS artifact — forged / unsigned
   *  / untrusted-commissioner / off-scope (`scope-mismatch`: the delegation authorized a
   *  DIFFERENT artifact) / delegate-less. See {@link BuildMergeResult.commission.reasons}
   *  for the specific commission failure(s). Refused BEFORE the merge runs. */
  | "commission-invalid"
  /** BINDING (a2): the merged CONTENT graph the reviewers signed is not ABOUT the
   *  commissioned artifact IRI (the IRI is not a subject of `mergedArtifact.quads`) — a
   *  quorum over a graph describing a different subject cannot land THIS commission. */
  | "artifact-mismatch"
  /** BINDING (b): the actor performing the merge (`options.builder`) is not the VERIFIED
   *  commission assignee — an unrelated party cannot ride the commission + quorum. */
  | "builder-mismatch"
  /** The ≥2-steward quorum was not met, or no counted reviewer was distinct from the
   *  builder (a lone self-review). See {@link BuildMergeResult.merge} for the attestation. */
  | "quorum-failed";

/** The outcome of a build-merge authorization decision. */
export interface BuildMergeResult {
  /** `true` IFF the commission verified AND binding (a) holds AND binding (b) holds AND
   *  the ≥2-steward quorum is allowed — the ONLY value a caller may treat as "merge OK". */
  readonly allowed: boolean;
  /** EVERY reason it was not authorized (empty IFF `allowed`). */
  readonly reasons: readonly BuildMergeRejectReason[];
  /** The full commission verification (verified flag + commissioner/assignee/scope + its
   *  own reasons) — the authority root, surfaced for honest UIs + audit. */
  readonly commission: CommissionVerification;
  /** The VERIFIED assignee the quorum's self-review guard was anchored on (== the
   *  builder that binding (b) required), when the commission verified an assignee. */
  readonly builder?: string;
  /** The commissioned artifact IRI (the verified delegation scope), when present. */
  readonly artifact?: string;
  /** The canonical RDFC-1.0 digest of the merged content the quorum attested, when the
   *  quorum ran (== the digest each counted reviewer signed). */
  readonly contentDigest?: string;
  /** The full merge-gate result (attestation counts + reviewer-distinct-from-builder +
   *  allowed), when the commission verified and the quorum ran. Absent when the
   *  commission was invalid (the merge is refused before the quorum — fail-closed). */
  readonly merge?: MergeGateResult;
}

/** Options for {@link verifyBuildMerge}. The seams keep the module network-free +
 *  exhaustively unit-testable; the allowlists are the REQUIRED fail-closed trust roots. */
export interface VerifyBuildMergeOptions {
  /**
   * Verify ONE credential — the crypto boundary for BOTH the commission credential AND
   * each reviewer credential (signature + issuer-binding + validity + revocation, all in
   * the injected seam). In production close over
   * `verifyCredential(vc, { resolveKey, isControlledBy, resolveStatus, … })`.
   */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /** REQUIRED. The signing-key resolver — the quorum's RFC-7638 anti-Sybil distinctness
   *  anchor (pass the SAME resolver `verifyVc` closes over). */
  readonly resolveKey: ResolveKey;
  /**
   * REQUIRED, non-empty. The recognised COMMISSIONERS whose signature may commission a
   * build. Passed through to {@link verifyCommission}, which THROWS fail-closed on an
   * absent/empty allowlist — a commission verification never runs without knowing who
   * may commission.
   */
  readonly trustedCommissioners: readonly string[];
  /**
   * REQUIRED, non-empty. The recognised REVIEWER/steward identities. Passed through to
   * {@link verifyMergeQuorum}, which THROWS fail-closed on an absent/empty allowlist — a
   * merge never runs an unprotected quorum.
   */
  readonly trustedStewards: readonly string[];
  /**
   * The ACTOR performing the merge (a WebID). BINDING (b): this MUST equal the VERIFIED
   * commission assignee, else the merge is refused `builder-mismatch`.
   */
  readonly builder: string;
  /** The reviewer-signature floor (default + minimum {@link QUORUM_FLOOR} = 2). A caller
   *  may RAISE it, never lower it (the quorum clamps up to the floor). */
  readonly threshold?: number;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads` inside the quorum. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/** True iff `iri` appears as the subject of at least one quad in `quads` — the content
 *  graph the reviewers digested actually DESCRIBES the commissioned artifact (binding a2).
 *  An empty / off-subject graph is fail-closed false. */
function graphDescribes(quads: readonly Quad[], iri: string): boolean {
  if (!Array.isArray(quads)) return false;
  for (const q of quads) {
    if (q.subject.termType === "NamedNode" && q.subject.value === iri) return true;
  }
  return false;
}

/** Rebuild ONE RDF term as a fresh, plain-valued term — reading every field ONCE. Isolates
 *  the snapshot from a caller who later mutates the original term (or passes a getter-backed
 *  "mutable" term), so the digest + binding checks can't run over shifting data. THROWS on a
 *  malformed term (null / no `termType`) OR an UNSUPPORTED term type (Variable / nested Quad):
 *  it must NOT silently coerce unsupported terms (that would change the graph the reviewers
 *  attested); {@link cloneQuads} turns any such throw into a whole-graph failure. */
function cloneTerm(t: Term): Term {
  if (
    t == null ||
    typeof t !== "object" ||
    typeof (t as { termType?: unknown }).termType !== "string"
  ) {
    throw new TypeError("malformed RDF term");
  }
  switch (t.termType) {
    case "NamedNode":
      return DataFactory.namedNode(t.value);
    case "BlankNode":
      return DataFactory.blankNode(t.value);
    case "Literal":
      return t.language
        ? DataFactory.literal(t.value, t.language)
        : t.datatype != null
          ? DataFactory.literal(t.value, DataFactory.namedNode(t.datatype.value))
          : DataFactory.literal(t.value); // datatype-less malformed literal → plain (xsd:string)
    case "DefaultGraph":
      return DataFactory.defaultGraph();
    default:
      // Variable / nested-Quad are not ground artifact data — reject (never coerce), so the
      // whole snapshot fails rather than authorizing over a term the reviewers never signed.
      throw new TypeError(`unsupported RDF term type: ${t.termType}`);
  }
}

/**
 * Deep-copy a quad array into fresh terms + a fresh array — a synchronous TOCTOU snapshot of
 * the artifact graph the reviewers' digest is attested over. WHOLE-GRAPH FAIL-CLOSED: if ANY
 * quad is malformed or carries an unsupported term, returns `undefined` — NOT a sanitized
 * SUBSET. Approving over a subset would let unreviewed content ride along: a graph of valid
 * quads V plus malformed quads M must NOT be reduced to V (whose digest a reviewer signed) and
 * then authorized. The caller ({@link verifyBuildMerge}) treats `undefined` as an invalid
 * artifact and DENIES (never throws — a hostile graph yields a refused result, not an exception).
 */
function cloneQuads(quads: readonly Quad[]): Quad[] | undefined {
  const out: Quad[] = [];
  for (const q of quads) {
    try {
      if (q == null || typeof q !== "object") return undefined;
      out.push(
        DataFactory.quad(
          cloneTerm(q.subject) as Quad_Subject,
          cloneTerm(q.predicate) as Quad_Predicate,
          cloneTerm(q.object) as Quad_Object,
          cloneTerm(q.graph) as Quad_Graph,
        ),
      );
    } catch {
      return undefined; // ANY malformed/unsupported quad fails the WHOLE snapshot (no partial graph)
    }
  }
  return out;
}

/**
 * Deep-copy one presented credential into a FRESH, isolated object — the TOCTOU snapshot for
 * a credential verified across an `await`. NEVER returns the caller's original reference (that
 * would leave caller-mutable state live through async verification) and NEVER throws on a
 * hostile input (that would turn bad data into an exception in an otherwise fail-closed
 * verifier). A real VC is pure data → structuredClone. A non-cloneable-but-data-bearing object
 * (e.g. a stray function property) → a JSON round-trip that copies only the serialisable fields
 * into a fresh object (dropping the non-cloneable values). A pathological input (circular /
 * BigInt) → a fresh empty object, which verifyCommission / verifyMergeQuorum reject as a
 * malformed credential (fail-closed). Every path yields a fresh object with no shared reference.
 */
function cloneVc(vc: VerifiableCredential): VerifiableCredential {
  try {
    return structuredClone(vc);
  } catch {
    try {
      return JSON.parse(JSON.stringify(vc)) as VerifiableCredential;
    } catch {
      return {} as VerifiableCredential;
    }
  }
}

/** True iff `next` sorts strictly AFTER `prev` under the SAME (`dct:created`, `id`)
 *  comparator {@link foldCommissionState} uses (oldest `dct:created` first, malformed →
 *  epoch 0, tie-broken by ascending id). Used to enforce that a lifecycle's recorded event
 *  order equals its folded order, so the persisted log recomputes the live state. */
function isStrictlyAfter(
  prev: { readonly at: string; readonly id: string },
  next: { readonly at: string; readonly id: string },
): boolean {
  const pt = Date.parse(prev.at);
  const nt = Date.parse(next.at);
  const pm = Number.isNaN(pt) ? 0 : pt;
  const nm = Number.isNaN(nt) ? 0 : nt;
  if (pm !== nm) return nm > pm;
  return next.id > prev.id;
}

/**
 * Authorize a build-merge: enforce the two BL.4 bindings, then the ≥2-steward quorum.
 * FAIL-CLOSED — `allowed` is `true` ONLY when EVERY gate passes:
 *   1. the COMMISSION verifies (signed by a trusted commissioner, scoped EXACTLY to
 *      `mergedArtifact.iri`, and names an assignee) — else `commission-invalid`, and the
 *      merge is refused BEFORE the quorum runs (never trust an unverified scope/builder);
 *   2. BINDING (a2): the merged CONTENT graph is ABOUT the commissioned artifact IRI —
 *      else `artifact-mismatch` (the a1 "declared IRI == commission scope" half is
 *      enforced in step 1 by pinning verifyCommission's scope to `mergedArtifact.iri`);
 *   3. BINDING (b): `options.builder` == the VERIFIED assignee — else `builder-mismatch`;
 *   4. the ≥2-steward QUORUM over the content is met AND ≥1 reviewer is distinct from the
 *      VERIFIED assignee — else `quorum-failed`.
 * THROWS (never returns) only on a CONFIGURATION error: a non-http(s) `mergedArtifact.iri`,
 * or (inherited) an absent/empty `trustedCommissioners` / `trustedStewards` allowlist.
 */
export async function verifyBuildMerge(
  commissionVC: VerifiableCredential,
  mergedArtifact: MergedArtifact,
  reviewerVCs: readonly VerifiableCredential[],
  options: VerifyBuildMergeOptions,
): Promise<BuildMergeResult> {
  if (
    mergedArtifact === null ||
    typeof mergedArtifact !== "object" ||
    typeof mergedArtifact.iri !== "string" ||
    !isHttpIri(mergedArtifact.iri)
  ) {
    throw new TypeError(
      "verifyBuildMerge: mergedArtifact.iri must be an http(s) IRI (the artifact the merge " +
        "is bound to) — a merge cannot be authorized without a valid artifact identity",
    );
  }
  const artifactIri = mergedArtifact.iri;

  // SNAPSHOT every mutable input SYNCHRONOUSLY, before ANY `await` (no TOCTOU): all three
  // verifications are async, so verifying the caller's LIVE objects would let a concurrent
  // mutation slip between a signature check and the subsequent claim/digest reads — making
  // scope/assignee, the artifact digest, or a reviewer's bound digest be read from data the
  // verifier never accepted. We snapshot the commission VC, the artifact graph (fresh terms),
  // and every reviewer VC into objects the caller has no reference to, then verify + read +
  // store ONLY those. (The commission snapshot is also stored/reused for the merge binding.)
  const commissionSnapshot = cloneVc(commissionVC);
  // A whole-graph-fail-closed snapshot: `undefined` iff the presented graph had ANY malformed
  // / unsupported quad. Never a sanitized subset — a partial graph would authorize unreviewed
  // content. An invalid graph denies via `artifact-mismatch` (empty snapshot below).
  const artifactSnapshot = cloneQuads(
    Array.isArray(mergedArtifact.quads) ? mergedArtifact.quads : [],
  );
  const artifactInvalid = artifactSnapshot === undefined;
  const artifactQuads = artifactSnapshot ?? [];
  const reviewerSnapshots = Array.isArray(reviewerVCs) ? reviewerVCs.map(cloneVc) : [];

  // (1) The COMMISSION — with its scope PINNED to the merge's declared artifact, so a
  //     delegation scoped to a DIFFERENT artifact fails `scope-mismatch` (binding a1).
  //     Throws fail-closed on an absent/empty trustedCommissioners allowlist (config).
  const commission = await verifyCommission(commissionSnapshot, {
    verifyVc: options.verifyVc,
    trustedCommissioners: options.trustedCommissioners,
    artifact: artifactIri,
  });

  // Fail-closed: an INVALID commission is refused BEFORE the merge — we must never run
  // the quorum against, or bind a builder to, an attacker-controlled scope/assignee. A
  // verified commission whose `fedtrust:delegate` is NOT an http(s) WebID cannot bind a
  // real builder (verifyCommission requires the claim present, not that it is a WebID),
  // so a malformed assignee is refused here too — never let it reach the builder binding.
  if (
    !commission.verified ||
    commission.assignee === undefined ||
    !isHttpIri(commission.assignee)
  ) {
    return { allowed: false, reasons: ["commission-invalid"], commission };
  }
  const assignee = commission.assignee;
  const reasons: BuildMergeRejectReason[] = [];

  // (2) BINDING (a): the reviewers' digested CONTENT must be about the commissioned
  //     artifact. a1 (declared IRI == verified scope) is guaranteed by the pin above;
  //     re-assert it defensively, add a2 (the graph describes the IRI), and deny outright a
  //     whole-graph-invalid artifact (a malformed/unsupported quad → never a partial approval).
  if (
    artifactInvalid ||
    commission.artifact !== artifactIri ||
    !graphDescribes(artifactQuads, artifactIri)
  ) {
    reasons.push("artifact-mismatch");
  }

  // (3) BINDING (b): the actor performing the merge must be the VERIFIED assignee — a real
  //     http(s) WebID, compared BYTE-FOR-BYTE (NOT trimmed): a builder that is not exactly
  //     the commissioned WebID must never satisfy the binding (a trimmed near-match would).
  const claimedBuilder = typeof options.builder === "string" ? options.builder : "";
  if (!isHttpIri(claimedBuilder) || claimedBuilder !== assignee) {
    reasons.push("builder-mismatch");
  }

  // (4) The ≥2-steward QUORUM over the content, with the self-review guard anchored on
  //     the VERIFIED assignee (never a caller string — a builder cannot alias past it).
  //     Throws fail-closed on an absent/empty trustedStewards allowlist (config).
  const merge = await verifyMergeQuorum(artifactQuads, reviewerSnapshots, {
    verifyVc: options.verifyVc,
    resolveKey: options.resolveKey,
    trustedStewards: options.trustedStewards,
    builder: assignee,
    ...(options.threshold !== undefined ? { threshold: options.threshold } : {}),
    ...(options.digest !== undefined ? { digest: options.digest } : {}),
  });
  if (!merge.allowed) reasons.push("quorum-failed");

  return {
    allowed: reasons.length === 0,
    reasons,
    commission,
    builder: assignee,
    ...(commission.artifact !== undefined ? { artifact: commission.artifact } : {}),
    ...(merge.attestation.contentDigest !== undefined
      ? { contentDigest: merge.attestation.contentDigest }
      : {}),
    merge,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BuildLifecycle — driving a commission through the state machine via verified gates
// ═══════════════════════════════════════════════════════════════════════════════

/** The signing/trust seams + the thread a {@link BuildLifecycle} advances. */
export interface BuildLifecycleConfig {
  /** Verify ONE credential — the crypto boundary for the commission + reviewer VCs. */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /** The signing-key resolver — the quorum distinctness anchor. */
  readonly resolveKey: ResolveKey;
  /** REQUIRED, non-empty. The recognised commissioners (fail-closed in verifyCommission). */
  readonly trustedCommissioners: readonly string[];
  /** REQUIRED, non-empty. The recognised reviewer/stewards (fail-closed in the quorum). */
  readonly trustedStewards: readonly string[];
  /** The `wf:Task` (thread) IRI these lifecycle events advance (persisted `unite:onThread`). */
  readonly thread: string;
  /** The reviewer-signature floor override (≥ {@link QUORUM_FLOOR}; clamps up). */
  readonly threshold?: number;
  /** Optional digest seam (tests). */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/** The per-step provenance a lifecycle transition records as a {@link CommissionEvent}. */
export interface LifecycleStepMeta {
  /** The event resource IRI (subject; https). */
  readonly id: string;
  /** `dct:creator` — the actor who performed this step (https). For the MERGE step this
   *  is also the BUILDER whose identity binding (b) checks against the verified assignee. */
  readonly actor: string;
  /** `dct:created` — the event's xsd:dateTime stamp (drives the deterministic fold order). */
  readonly at: string;
  /** `unite:evidence` — the signed credential / attestation resource this step points at
   *  (the commission's DelegationCredential; the merge's quorum). Optional. */
  readonly evidence?: string;
}

/**
 * The commission step's inputs. NOTE there is deliberately NO caller-supplied `actor`: the
 * commission event's `dct:creator` is bound to the CRYPTOGRAPHICALLY VERIFIED commissioner
 * (the credential signer), so a valid commission can never be persisted with a forged
 * creator (the merge step's actor is likewise bound — to the verified assignee — via
 * binding (b)). The caller supplies only the event id, timestamp, artifact scope + evidence.
 */
export interface CommissionStepMeta {
  /** The event resource IRI (subject; https). */
  readonly id: string;
  /** `dct:created` — the event's xsd:dateTime stamp (drives the deterministic fold order). */
  readonly at: string;
  /** The exact artifact IRI the commission must be scoped to (per-artifact commissioning). */
  readonly artifact: string;
  /** `unite:evidence` — the signed DelegationCredential resource this commission points at. */
  readonly evidence?: string;
}

/**
 * A small, stateful orchestrator that drives ONE build thread through the BL.3 commission
 * state machine using the BL.4 verified gates. Each transition goes through
 * {@link transition} (so illegal ordering throws), and the two GATED edges run their real
 * verification first: {@link commission} runs {@link verifyCommission}, {@link merge} runs
 * {@link verifyBuildMerge}. Because transition THROWS `unverified-evidence` unless the gate
 * passed, `commissioned` and `merged` are UNREACHABLE without the bindings — by
 * construction, not convention. Every applied step is recorded as a guarded
 * {@link CommissionEvent}; {@link serialize}/{@link toQuads} emit them (+ the cached state)
 * via n3.Writer, so what this writes is exactly what {@link parseCommissionEvents} +
 * {@link foldCommissionState} recompute. Steps MUST be recorded in strictly-increasing
 * (`dct:created`, `id`) order (enforced fail-closed) so that call order == fold order and
 * the round-trip holds; the two GATED steps + {@link commission} bind their provenance to
 * verified identities (commissioner / assignee), never a caller-supplied actor.
 */
export class BuildLifecycle {
  #state: CommissionState;
  #assignee: string | undefined;
  #artifact: string | undefined;
  #commissionVC: VerifiableCredential | undefined;
  #lastCommission: CommissionVerification | undefined;
  #lastMerge: BuildMergeResult | undefined;
  readonly #events: CommissionEvent[] = [];
  readonly #eventIds = new Set<string>();
  readonly #config: BuildLifecycleConfig;

  /**
   * Create a lifecycle for `config.thread`. It ALWAYS starts at `drafted` — there is NO
   * caller-chosen initial state, deliberately: allowing construction directly at
   * `commissioned`/`in-review`/… would make a GATED state reachable without ever passing
   * its verification gate (and its later ungated edges free), defeating the whole
   * "commissioned/merged unreachable without the bindings" property. Rehydrating a
   * persisted thread is the FOLD's job ({@link parseCommissionEvents} +
   * {@link foldCommissionState} recompute the authoritative state from the events + the
   * verified-gate sets — INV-3), NOT a trusted constructor seed. This driver only moves a
   * commission FORWARD from `drafted` through the real gates.
   */
  constructor(config: BuildLifecycleConfig) {
    if (!isHttpIri(config.thread)) {
      throw new TypeError(`BuildLifecycle: thread must be an http(s) IRI: ${config.thread}`);
    }
    // Snapshot the config — DON'T hold the caller's reference. Otherwise a caller could
    // mutate the thread IRI or the trust allowlists AFTER construction and change the
    // trust roots later records/verifications run against (breaking the "one thread" +
    // stable-trust-root assumptions). Copy + freeze the allowlist arrays; the seams
    // (verifyVc/resolveKey/digest) are functions kept by reference by necessity.
    this.#config = Object.freeze({
      verifyVc: config.verifyVc,
      resolveKey: config.resolveKey,
      trustedCommissioners: Object.freeze([...config.trustedCommissioners]),
      trustedStewards: Object.freeze([...config.trustedStewards]),
      thread: config.thread,
      ...(config.threshold !== undefined ? { threshold: config.threshold } : {}),
      ...(config.digest !== undefined ? { digest: config.digest } : {}),
    });
    this.#state = "drafted";
  }

  /** The current computed lifecycle state. */
  get state(): CommissionState {
    return this.#state;
  }

  /** The VERIFIED commission assignee (the delegated builder), once commissioned. */
  get assignee(): string | undefined {
    return this.#assignee;
  }

  /** The commissioned artifact IRI (the verified delegation scope), once commissioned. */
  get artifact(): string | undefined {
    return this.#artifact;
  }

  /** The applied lifecycle events, in application order (for persistence / audit). A
   *  DEFENSIVE COPY — mutating the returned array cannot inject an event into the log that
   *  bypassed the gates / transition ordering ({@link toQuads} serialises the private
   *  `#events`, which only {@link #record} ever appends to). */
  get events(): readonly CommissionEvent[] {
    return [...this.#events];
  }

  /** The most recent commission verification (surfaces WHY a commission step failed). */
  get lastCommission(): CommissionVerification | undefined {
    return this.#lastCommission;
  }

  /** The most recent build-merge decision (surfaces WHY a merge step failed). */
  get lastMerge(): BuildMergeResult | undefined {
    return this.#lastMerge;
  }

  /**
   * `drafted → commissioned`, gated by {@link verifyCommission}. Verifies the signed
   * `fedtrust:DelegationCredential` (trusted commissioner, scoped to `meta.artifact`, names
   * an assignee); on success advances + records + pins the verified assignee/artifact for
   * the later merge binding. On a failed verification (or an illegal edge) THROWS a
   * {@link CommissionTransitionError} (fail-closed) and the state is unchanged — but
   * {@link lastCommission} carries the failure reasons for the surface.
   */
  async commission(vc: VerifiableCredential, meta: CommissionStepMeta): Promise<CommissionState> {
    // Reject an illegal edge (commission only from `drafted`) BEFORE running verification —
    // an out-of-state call is a grammar error, not a failed gate, and must not spend crypto
    // or leave a misleading {@link lastCommission}.
    if (!canTransition(this.#state, { type: "commission", gatePassed: true })) {
      throw new CommissionTransitionError(this.#state, "commission", "illegal-transition");
    }
    // SNAPSHOT the credential SYNCHRONOUSLY, before ANY `await` (no TOCTOU): verifyCommission
    // is async, so verifying the caller's LIVE object would let a concurrent mutation slip
    // between the signature check and the post-verify claim reads. We verify + read + STORE
    // this ONE isolated snapshot (which the caller has no reference to) so signature, claims,
    // and the later merge re-verification are all the same immutable object. GUARDED clone —
    // a non-cloneable malformed credential passes through as-is (verifyCommission rejects it
    // as a DATA failure), never an input-triggered exception; cloning here also makes the
    // whole step atomic (if it throws, no state has advanced).
    const snapshot = cloneVc(vc);
    const verification = await verifyCommission(snapshot, {
      verifyVc: this.#config.verifyVc,
      trustedCommissioners: this.#config.trustedCommissioners,
      artifact: meta.artifact,
    });
    this.#lastCommission = verification;
    const { verified, assignee, commissioner } = verification;
    // transition throws `unverified-evidence` unless the gate passed, `illegal-transition`
    // unless in `drafted` — so `commissioned` is unreachable without a verified commission. A
    // verified commission ALWAYS carries a trusted http(s) commissioner + assignee; require
    // BOTH be real WebIDs for the gate so the recorded provenance is a real signer and the
    // pinned assignee is a real merge-actor identity (a malformed delegate can't advance).
    const gatePassed =
      verified &&
      assignee !== undefined &&
      isHttpIri(assignee) &&
      commissioner !== undefined &&
      isHttpIri(commissioner);
    const next = transition(this.#state, { type: "commission", gatePassed });
    // Defensive narrow — unreachable when `next` was returned (gatePassed guaranteed both),
    // but never trust reachability for a security-relevant record.
    if (commissioner === undefined || assignee === undefined) {
      throw new CommissionTransitionError(this.#state, "commission", "unverified-evidence");
    }
    // BIND the event provenance to the VERIFIED commissioner (the credential signer), NOT a
    // caller-supplied string — a valid commission can never be persisted with a forged creator.
    this.#record("commission", {
      id: meta.id,
      actor: commissioner,
      at: meta.at,
      ...(meta.evidence !== undefined ? { evidence: meta.evidence } : {}),
    });
    // Commit ALL state changes together, only after the clone + record both succeeded.
    this.#state = next;
    this.#assignee = assignee;
    this.#artifact = verification.artifact ?? meta.artifact;
    this.#commissionVC = snapshot;
    return next;
  }

  /** `commissioned → in-progress` (ungated). */
  start(meta: LifecycleStepMeta): CommissionState {
    return this.#applyUngated("start", meta);
  }

  /** `in-progress → pr-open` (ungated). */
  openPr(meta: LifecycleStepMeta): CommissionState {
    return this.#applyUngated("open-pr", meta);
  }

  /** `pr-open → in-review` (ungated). */
  requestReview(meta: LifecycleStepMeta): CommissionState {
    return this.#applyUngated("request-review", meta);
  }

  /** `in-review → in-progress` (ungated — a bounded review loop). */
  requestChanges(meta: LifecycleStepMeta): CommissionState {
    return this.#applyUngated("request-changes", meta);
  }

  /** `* → rejected` from any non-terminal working state (ungated). */
  reject(meta: LifecycleStepMeta): CommissionState {
    return this.#applyUngated("reject", meta);
  }

  /**
   * `in-review → merged`, gated by {@link verifyBuildMerge} — the BOTH-bindings + quorum
   * composite. The merge actor is `meta.actor` (binding (b) checks it == the verified
   * assignee); the merged artifact + reviewer VCs drive binding (a) + the quorum. On a
   * refused decision (any binding or the quorum failing) or an illegal edge THROWS a
   * {@link CommissionTransitionError} (fail-closed) with the state unchanged — but
   * {@link lastMerge} carries the reasons. So `merged` is unreachable without the bindings.
   */
  async merge(
    mergedArtifact: MergedArtifact,
    reviewerVCs: readonly VerifiableCredential[],
    meta: LifecycleStepMeta,
  ): Promise<CommissionState> {
    // Reject an illegal edge (merge only from `in-review`) BEFORE running the merge
    // verification — an out-of-state call is a grammar error, not a failed gate, and must
    // not spend crypto/key-resolution or leave a misleading {@link lastMerge}.
    if (!canTransition(this.#state, { type: "merge", gatePassed: true })) {
      throw new CommissionTransitionError(this.#state, "merge", "illegal-transition");
    }
    // Defensive: `in-review` is only reachable via `commissioned`, so a commission VC is
    // always set here — but never trust reachability for a security gate.
    if (this.#commissionVC === undefined) {
      throw new CommissionTransitionError(this.#state, "merge", "unverified-evidence");
    }
    const result = await verifyBuildMerge(this.#commissionVC, mergedArtifact, reviewerVCs, {
      verifyVc: this.#config.verifyVc,
      resolveKey: this.#config.resolveKey,
      trustedCommissioners: this.#config.trustedCommissioners,
      trustedStewards: this.#config.trustedStewards,
      builder: meta.actor,
      ...(this.#config.threshold !== undefined ? { threshold: this.#config.threshold } : {}),
      ...(this.#config.digest !== undefined ? { digest: this.#config.digest } : {}),
    });
    this.#lastMerge = result;
    const next = transition(this.#state, { type: "merge", gatePassed: result.allowed });
    this.#record("merge", meta);
    this.#state = next;
    return next;
  }

  /** The applied events + the cached state triple, as quads (n3.Writer-serialisable). */
  toQuads(): Quad[] {
    const quads: Quad[] = [];
    for (const event of this.#events) quads.push(...buildCommissionEventQuads(event));
    quads.push(...buildCommissionStateQuads(this.#config.thread, this.#state));
    return quads;
  }

  /** Serialise the applied events + cached state to Turtle (via model.serializeTurtle). */
  serialize(): Promise<string> {
    return serializeTurtle(this.toQuads(), { unite: UNITE_NS });
  }

  /** Apply an UNGATED transition: compute the next state (throws on an illegal edge),
   *  record the guarded event (throws on a bad IRI/date — never store what won't parse),
   *  then advance. */
  #applyUngated(type: CommissionEventType, meta: LifecycleStepMeta): CommissionState {
    const next = transition(this.#state, { type });
    this.#record(type, meta);
    this.#state = next;
    return next;
  }

  /** Record one applied step as a guarded {@link CommissionEvent}. Validates every field
   *  by building its quads (throws on a non-http(s) IRI / bad timestamp) so the event
   *  never enters the log unless it round-trips through {@link parseCommissionEvents}, and
   *  FREEZES the event so a caller holding a reference from {@link events} cannot later
   *  mutate what {@link toQuads}/{@link serialize} persist (every field is a primitive, so
   *  a shallow freeze is total). */
  #record(type: CommissionEventType, meta: LifecycleStepMeta): void {
    const event: CommissionEvent = Object.freeze({
      id: meta.id,
      type,
      thread: this.#config.thread,
      actor: meta.actor,
      at: meta.at,
      ...(meta.evidence !== undefined ? { evidence: meta.evidence } : {}),
    });
    buildCommissionEventQuads(event); // fail-closed validation (throws on invalid field)
    // ROUND-TRIP INTEGRITY (a): a REUSED event IRI would serialise two events onto the SAME
    // subject → multi-valued fields → `parseCommissionEvents`'s single-value guard DROPS
    // both → the fold no longer recomputes the live state. Reject a duplicate id fail-closed.
    if (this.#eventIds.has(event.id)) {
      throw new Error(
        `BuildLifecycle: duplicate event id (each step needs a fresh IRI): ${event.id}`,
      );
    }
    // ROUND-TRIP INTEGRITY (b): transitions are applied in call order, but {@link
    // foldCommissionState} re-sorts the persisted events by (`dct:created`, `id`). If a
    // caller recorded a step whose (at, id) sort-key was NOT strictly after the previous
    // one, the fold would replay the events in a DIFFERENT order and could recompute a
    // DIFFERENT state than the live one. Enforce strictly-increasing (at, id) — matching the
    // fold's comparator — so call order == fold order by construction (fail-closed).
    const prev = this.#events[this.#events.length - 1];
    if (prev !== undefined && !isStrictlyAfter(prev, event)) {
      throw new Error(
        "BuildLifecycle: each step must be strictly after the previous in (dct:created, id) order " +
          "so the persisted event log folds back to the live state (round-trip integrity)",
      );
    }
    this.#events.push(event);
    this.#eventIds.add(event.id);
  }
}
