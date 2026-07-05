// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The multi-steward QUORUM attestation verifier — the load-bearing keystone of the
// "no single owner" invariant (design/next-phases §1.4 "the one genuinely new
// primitive: multi-steward (quorum) signing"; PLATFORM-PLAN §4.4 / INV-5: ≥2 steward
// signatures is a FLOOR, communities may raise it but never lower it).
//
// The requirement is: attest that ≥N DISTINCT stewards have each signed the SAME
// content. The shipped crypto does not give this out of the box —
//   · `@jeswr/solid-vc` `countersign` produces a proof SET, but its verify gate
//     requires every proof's verificationMethod to be controlled by the SINGLE
//     `vc.issuer`, so DISTINCT stewards counter-signing one credential do not verify
//     (that path is one issuer's several keys); and
//   · `@jeswr/federation-trust`'s membership verifier is intrinsically single-issuer.
// No suite package has an M-of-N notion. So quorum is composed — NOT re-crypto'd — as
// N INDEPENDENT solid-vc credentials over the RDFC-1.0 content digest, aggregated by
// the pure function below. Each steward issues their own `solid-vc` VC whose signed
// `relatedResource` binds `digestMultibase(content)`; this module verifies each one
// (delegating ALL crypto to solid-vc via an injected seam), confirms each binds the
// SAME digest, counts DISTINCT verified issuers, and reports whether the count meets
// the floor.
//
// It MINTS NO vocabulary and ADDS NO crypto — it aggregates existing single-signer
// verifications into a quorum count. FAIL-CLOSED throughout: any unverifiable /
// wrong-digest / revoked / identity-less / duplicate credential is EXCLUDED, and a
// below-floor count is `met: false`. Pure + injectable (the VC verification — which
// carries signature, issuer-binding, validity window AND Bitstring-status-list
// revocation via solid-vc's `resolveStatus` seam — plus the content digest are
// injected), so it is exhaustively unit-testable with no network.

import {
  type RelatedResource,
  digestQuads as solidVcDigestQuads,
  type VerifiableCredential,
  type VerificationResult,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";

/**
 * The no-single-owner floor (INV-5 / PLATFORM-PLAN §4.4): a quorum needs at least
 * this many DISTINCT stewards. A caller may pass a HIGHER threshold (a community may
 * raise the bar), never a lower one — {@link buildQuorumAttestation} clamps up to
 * this floor so the invariant cannot be weakened by a caller bug.
 */
export const QUORUM_FLOOR = 2;

/** Why one presented credential did not count toward the quorum. */
export type QuorumRejectReason =
  /** solid-vc verification failed (bad signature / expired / not-yet-valid /
   *  issuer-binding mismatch / untrusted issuer / status unreachable / structural). */
  | "unverified"
  /** The credential's Bitstring status list marks it revoked (`STATUS_REVOKED`). */
  | "revoked"
  /** The credential's Bitstring status list marks it suspended (`STATUS_SUSPENDED`). */
  | "suspended"
  /** Verified, but it does not bind the artifact's digest — a signature over
   *  DIFFERENT content, so it cannot be counted for THIS content. */
  | "digest-mismatch"
  /** Verified + digest-bound, but no verified issuer identity could be established. */
  | "no-issuer"
  /** Verified + digest-bound, but its steward already counted (one steward = one
   *  vote, however many times they sign). */
  | "duplicate-steward"
  /** Not a usable credential object, or the verify seam threw. */
  | "malformed";

/** A distinct steward whose independent signature was counted toward the quorum. */
export interface QuorumSteward {
  /** The steward's verified issuer IRI (WebID/DID) — the dedup identity. */
  readonly issuer: string;
  /** The credential IRI that carried the signature, when present. */
  readonly credentialId?: string;
}

/** A presented credential that did NOT count, with the reason (for honest surfaces). */
export interface QuorumRejection {
  /** The credential's position in the presented `stewardVCs` array. */
  readonly index: number;
  /** The claimed issuer, when the credential carried one (for display/audit). */
  readonly issuer?: string;
  readonly reason: QuorumRejectReason;
  /** A machine-readable detail (e.g. joined solid-vc error codes), when available. */
  readonly detail?: string;
}

/** The outcome of a quorum attestation over one artifact. */
export interface QuorumAttestation {
  /** `true` IFF `distinctStewards >= threshold` — the quorum is met. Fail-closed. */
  readonly met: boolean;
  /** The effective threshold applied (≥ {@link QUORUM_FLOOR}; never below it). */
  readonly threshold: number;
  /** The number of DISTINCT, verified, digest-bound stewards counted. */
  readonly distinctStewards: number;
  /** The artifact's canonical RDFC-1.0 digest (`digestMultibase`); undefined when
   *  the content could not be digested (see {@link QuorumAttestation.contentError}). */
  readonly contentDigest?: string;
  /** Set when the content digest itself failed (empty/malformed graph) — the whole
   *  attestation is then `met: false` with no signatures examined. */
  readonly contentError?: string;
  /** The distinct counted stewards. */
  readonly stewards: readonly QuorumSteward[];
  /** Every presented credential that did not count, with its reason. */
  readonly rejected: readonly QuorumRejection[];
  /** `true` when at least one valid steward exists but the floor is not yet met —
   *  the honest "bootstrapping: single-steward" state (design/04 §6), rendered as
   *  e.g. "1 of 2 stewards", NEVER by silently lowering the floor. */
  readonly bootstrapping: boolean;
}

/** Injected dependencies for {@link buildQuorumAttestation}. */
export interface QuorumOptions {
  /**
   * Verify ONE steward credential. This is the crypto boundary — it MUST carry the
   * full solid-vc gate: signature, issuer-binding, validity window, and (composing
   * the Bitstring status list) revocation. In production close over
   * `verifyCredential(vc, { resolveKey, resolveStatus: createBitstringStatusResolver(…),
   * trustedIssuers: <the community steward allowlist>, … })`; in tests inject a stub.
   * Injecting it keeps this module network-free and exhaustively testable.
   */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /**
   * The quorum threshold (default + minimum {@link QUORUM_FLOOR}). Clamped UP to the
   * floor — a value below it is raised, never honoured (INV-5: never lower the floor).
   */
  readonly threshold?: number;
  /**
   * Canonical digest of the artifact quads. Defaults to solid-vc `digestQuads`
   * (RDFC-1.0 → sha2-256 → multibase; deterministic, network-free). Injectable so a
   * test can drive the digest deterministically.
   */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** A non-empty string, or undefined. */
function nonEmpty(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** A rejection record, OMITTING optional props that are undefined (the tsconfig
 *  uses `exactOptionalPropertyTypes`, so `issuer: undefined` is not `issuer?: string`). */
function rejection(
  index: number,
  reason: QuorumRejectReason,
  issuer?: string,
  detail?: string,
): QuorumRejection {
  return {
    index,
    reason,
    ...(issuer !== undefined ? { issuer } : {}),
    ...(detail !== undefined ? { detail } : {}),
  };
}

/** A counted steward, omitting `credentialId` when the credential had no IRI. */
function steward(issuer: string, credentialId?: string): QuorumSteward {
  return { issuer, ...(credentialId !== undefined ? { credentialId } : {}) };
}

/**
 * The issuer the verifier CRYPTOGRAPHICALLY BOUND. Prefer `result.issuer` (the
 * identity the proof was checked against); fall back to `vc.issuer` only when the
 * result omitted it — after a passing verify the issuer-binding gate has already
 * confirmed the credential's verificationMethod is controlled by `vc.issuer`, so it
 * is the verified identity in that case. A missing/empty issuer ⇒ undefined (no
 * distinct identity can be established → the credential is not counted).
 */
function verifiedIssuer(result: VerificationResult, vc: VerifiableCredential): string | undefined {
  return nonEmpty(result.issuer) ?? nonEmpty(vc.issuer);
}

/** Map a failed verification to the most specific rejection reason. */
function failureReason(result: VerificationResult): QuorumRejectReason {
  const codes = new Set(result.errors.map((e) => e.code));
  if (codes.has("STATUS_REVOKED")) return "revoked";
  if (codes.has("STATUS_SUSPENDED")) return "suspended";
  return "unverified";
}

/** The solid-vc error codes of a failed verification, joined (for `detail`). */
function failureDetail(result: VerificationResult): string | undefined {
  const codes = result.errors.map((e) => e.code);
  return codes.length > 0 ? codes.join(",") : undefined;
}

/**
 * True iff the (already-verified) credential carries a SIGNED `relatedResource`
 * whose `digestMultibase` equals the artifact's canonical digest. Because
 * `relatedResource` is part of the signed claim graph, a passing verification makes
 * this binding authentic: a steward cannot present a digest they did not sign, and a
 * signature over content A (digest A) can never match content B's digest. Guarded
 * against a malformed/absent `relatedResource` (fail-closed → false).
 */
function bindsDigest(vc: VerifiableCredential, contentDigest: string): boolean {
  const related: readonly RelatedResource[] | undefined = vc.relatedResource;
  if (!Array.isArray(related)) return false;
  return related.some(
    (r) =>
      r != null &&
      typeof r === "object" &&
      typeof r.digestMultibase === "string" &&
      r.digestMultibase === contentDigest,
  );
}

/**
 * Aggregate N independent steward credentials into a quorum attestation over one
 * artifact. For each presented credential, in order:
 *
 *  1. reject if it is not a credential object, or the verify seam throws (malformed);
 *  2. verify it (signature + issuer-binding + validity + revocation, all in the
 *     injected `verifyVc`) — reject a failure (revoked/suspended/unverified);
 *  3. reject if it does not bind the artifact's canonical digest (digest-mismatch —
 *     a signature over different content);
 *  4. reject if no verified issuer identity is present (no-issuer);
 *  5. reject if that issuer already counted (duplicate-steward — one steward, one
 *     vote); otherwise COUNT it as a distinct steward.
 *
 * The quorum is met IFF the distinct count reaches the effective threshold (clamped
 * up to {@link QUORUM_FLOOR}). Never throws; a content-digest failure returns a
 * `met: false` attestation with `contentError` set.
 */
export async function buildQuorumAttestation(
  contentQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: QuorumOptions,
): Promise<QuorumAttestation> {
  const requested = Number.isInteger(options.threshold)
    ? (options.threshold as number)
    : QUORUM_FLOOR;
  const threshold = Math.max(requested, QUORUM_FLOOR);
  const digestFn = options.digest ?? solidVcDigestQuads;

  // The single content identity every steward must have signed. Fail-closed on empty
  // content BEFORE hashing: `digestQuads([])` does NOT throw (it hashes the empty
  // N-Quads string to a stable digest), so an unchecked empty graph would let N
  // stewards "attest" nothing and meet quorum — an empty artifact is never
  // attestable (the same posture `digestRdfContent` takes for empty text).
  if (!Array.isArray(contentQuads) || contentQuads.length === 0) {
    return {
      met: false,
      threshold,
      distinctStewards: 0,
      contentError: "empty artifact graph — nothing to attest",
      stewards: [],
      rejected: [],
      bootstrapping: false,
    };
  }
  // A malformed graph can still make the digest function throw; fail-closed there too.
  let contentDigest: string;
  try {
    contentDigest = await digestFn(contentQuads);
  } catch (e) {
    return {
      met: false,
      threshold,
      distinctStewards: 0,
      contentError: messageOf(e),
      stewards: [],
      rejected: [],
      bootstrapping: false,
    };
  }

  const stewards: QuorumSteward[] = [];
  const rejected: QuorumRejection[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < stewardVCs.length; index += 1) {
    const vc = stewardVCs[index];

    if (vc === null || typeof vc !== "object") {
      rejected.push(rejection(index, "malformed", undefined, "not a credential object"));
      continue;
    }

    // (a) verify cryptographically — the injected seam owns signature, issuer-binding,
    //     validity window and revocation. A hostile seam might throw; fail-closed.
    let result: VerificationResult;
    try {
      result = await options.verifyVc(vc);
    } catch (e) {
      rejected.push(rejection(index, "malformed", nonEmpty(vc.issuer), messageOf(e)));
      continue;
    }
    if (!result.verified) {
      rejected.push(
        rejection(index, failureReason(result), nonEmpty(vc.issuer), failureDetail(result)),
      );
      continue;
    }

    // (b) same-digest binding — reject a valid signature over DIFFERENT content.
    if (!bindsDigest(vc, contentDigest)) {
      rejected.push(rejection(index, "digest-mismatch", verifiedIssuer(result, vc)));
      continue;
    }

    // (c) distinct steward identity — dedupe by the VERIFIED issuer.
    const issuer = verifiedIssuer(result, vc);
    if (issuer === undefined) {
      rejected.push(rejection(index, "no-issuer"));
      continue;
    }
    if (seen.has(issuer)) {
      rejected.push(rejection(index, "duplicate-steward", issuer));
      continue;
    }
    seen.add(issuer);
    stewards.push(steward(issuer, nonEmpty(vc.id)));
  }

  const distinctStewards = stewards.length;
  const met = distinctStewards >= threshold;
  return {
    met,
    threshold,
    distinctStewards,
    contentDigest,
    stewards,
    rejected,
    bootstrapping: !met && distinctStewards >= 1,
  };
}

/**
 * Boolean quorum gate: `true` IFF ≥ `threshold` (clamped to {@link QUORUM_FLOOR})
 * distinct, verified, non-revoked stewards each signed the SAME content. Fail-closed
 * — see {@link buildQuorumAttestation} for the full attestation (counts, rejections,
 * the bootstrapping state) a surface should render.
 */
export async function verifyQuorumAttestation(
  contentQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: QuorumOptions,
): Promise<boolean> {
  return (await buildQuorumAttestation(contentQuads, stewardVCs, options)).met;
}
