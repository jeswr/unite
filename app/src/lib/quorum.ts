// AUTHORED-BY Claude Fable 5 (PSS agent)
// AUTHORED-BY Claude Opus 4.8 (PSS agent) — Sybil-resistance hardening: the
//   distinctness anchor is the VERIFIED SIGNING-KEY THUMBPRINT (RFC 7638), not the
//   echoed claimed `vc.issuer` string (a forgeable alias). See the header note below.
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
// SAME digest, counts DISTINCT stewards, and reports whether the count meets the floor.
//
// ── HOW DISTINCTNESS IS ANCHORED (the Sybil-resistance contract) ─────────────────
// Distinctness is anchored on the VERIFIED SIGNING KEY, NOT on the claimed issuer
// string. This is load-bearing: `@jeswr/solid-vc`'s `verifyCredential` ALWAYS echoes
// the CLAIMED `vc.issuer` back as `result.issuer` (it does not re-derive identity from
// the signing key), so the claimed issuer is an attacker-chosen STRING. If we deduped
// on it, ONE key-holder could present two VCs claiming issuer `…/card#me` and `…/card`
// (a prefix-truncation alias), BOTH signed by the SAME key and BOTH passing the default
// `isControlledBy` prefix heuristic — forging distinctStewards=2 from a single owner
// and breaking INV-5. Instead we resolve each proof's `verificationMethod` to its public
// key (via the REQUIRED `resolveKey` seam) and dedup on the RFC 7638 JWK THUMBPRINT of
// that key: two VCs signed by the same key collapse to ONE steward regardless of the
// claimed-issuer string. We ALSO dedup on the (trimmed) canonical issuer, so one
// identity that publishes two DIFFERENT keys still counts once. An OPTIONAL
// `trustedStewards` allowlist adds defense-in-depth: when supplied, only VCs whose
// canonical issuer is a recognised steward count (a distinct WebID a real party
// controls is otherwise indistinguishable, by cryptography alone, from a second WebID
// the SAME party registered — the allowlist is where that trust decision lives).
//
// It MINTS NO vocabulary and ADDS NO crypto — it aggregates existing single-signer
// verifications into a quorum count. FAIL-CLOSED throughout: any unverifiable /
// wrong-digest / revoked / identity-less / keyless / untrusted / duplicate credential
// is EXCLUDED, and a below-floor count is `met: false`. Pure + injectable (VC
// verification AND key resolution AND the content digest are injected), so it is
// exhaustively unit-testable with no network. The one thing it does NOT tolerate is
// running WITHOUT the `resolveKey` crypto anchor: that is a configuration error, not a
// data error, so it throws LOUD rather than silently falling back to string dedup.

import {
  type DataIntegrityProof,
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
  /** Verified + digest-bound + has an issuer, but NO signing-key thumbprint could be
   *  resolved (no proof `verificationMethod` resolved to a public key) — without the
   *  cryptographic identity anchor the credential CANNOT be counted (fail-closed). */
  | "no-key"
  /** Verified + digest-bound, but the canonical issuer is NOT in the supplied
   *  `trustedStewards` allowlist (only enforced when an allowlist is provided). */
  | "untrusted-steward"
  /** Verified + digest-bound, but its steward already counted — the SAME signing key
   *  OR the SAME canonical issuer as a counted steward (one steward = one vote,
   *  however many keys/aliases they present). */
  | "duplicate-steward"
  /** Not a usable credential object, or the verify seam threw. */
  | "malformed";

/** A distinct steward whose independent signature was counted toward the quorum. */
export interface QuorumSteward {
  /** The steward's canonical (trimmed) verified issuer IRI (WebID/DID) — the DISPLAY
   *  identity + the `trustedStewards` allowlist key. NOTE: this is NOT the distinctness
   *  anchor; distinctness is anchored on {@link QuorumSteward.keyThumbprint}. */
  readonly issuer: string;
  /** The RFC 7638 JWK thumbprint of the verified signing key — the anti-Sybil
   *  distinctness anchor this steward was counted (and deduped) on. */
  readonly keyThumbprint: string;
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

/** Resolve a `verificationMethod` IRI to its public key — the SAME shape as
 *  solid-vc's `VerifyCredentialOptions.resolveKey`, so a caller passes ONE resolver to
 *  both the injected verify AND here (they MUST agree, or a verified VC's key may fail
 *  to resolve → fail-closed `no-key`). */
export type ResolveKey = (
  verificationMethod: string,
) => Promise<CryptoKey | undefined> | CryptoKey | undefined;

/** Injected dependencies for {@link buildQuorumAttestation}. */
export interface QuorumOptions {
  /**
   * Verify ONE steward credential. This is the crypto boundary — it MUST carry the
   * full solid-vc gate: signature, issuer-binding, validity window, and (composing
   * the Bitstring status list) revocation. In production close over
   * `verifyCredential(vc, { resolveKey, isControlledBy: createWebIdKeyResolver().isControlledBy,
   * resolveStatus: createBitstringStatusResolver(…), … })` — prefer the
   * document-resolved `isControlledBy` over the default prefix heuristic. Injecting it
   * keeps this module network-free and exhaustively testable.
   *
   * NOTE this seam is trusted for signature/validity/binding ONLY; it is NOT trusted
   * for steward DISTINCTNESS — that is anchored independently on the verified signing
   * key's thumbprint (see {@link QuorumOptions.resolveKey}), because solid-vc's
   * `result.issuer` merely echoes the CLAIMED `vc.issuer`.
   */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /**
   * REQUIRED. Resolve each proof's `verificationMethod` IRI to its public key so this
   * module can thumbprint it (RFC 7638) — the anti-Sybil DISTINCTNESS ANCHOR. Pass the
   * SAME resolver `verifyVc` closes over. Omitting it is a configuration error:
   * {@link buildQuorumAttestation} throws LOUD rather than silently degrading to
   * claimed-issuer-string dedup (the forgeable default the alias exploit used). A key
   * this resolver cannot resolve simply fails closed — that VC is not counted.
   */
  readonly resolveKey: ResolveKey;
  /**
   * OPTIONAL defense-in-depth allowlist of canonical steward identities (WebID/DID
   * IRIs). When supplied, a VC counts ONLY if its canonical (trimmed) verified issuer
   * is a member (exact match after trimming) — else it is rejected `untrusted-steward`.
   *
   * WHY OPTIONAL: the crypto anchor (key-thumbprint dedup, always on) already defeats
   * the claimed-issuer ALIAS forgery, AND canonical-issuer dedup defeats one identity
   * publishing several keys. What cryptography ALONE cannot decide is whether two
   * genuinely distinct WebIDs+keys are two real parties or one party's two
   * registrations — that is a TRUST decision, and the allowlist is where a community
   * records it. Supply it for a real ≥2 quorum in production; omit it only for a
   * closed test / a context where distinct verified keys are trusted to be distinct
   * parties by construction.
   */
  readonly trustedStewards?: readonly string[];
  /**
   * The quorum threshold (default + minimum {@link QUORUM_FLOOR}). Normalised
   * FAIL-SAFE: a fractional value is rounded UP (`Math.ceil`, so 2.5 ⇒ 3, never
   * lowered), a non-finite/non-numeric value falls back to the floor, and the result
   * is clamped up to {@link QUORUM_FLOOR} — always ≥ the request AND ≥ the floor
   * (INV-5: a caller may raise the bar, never lower it).
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

/**
 * The canonical steward identity for a credential: the verified/claimed issuer,
 * TRIMMED, or `undefined` if empty/whitespace-only. Prefer `result.issuer` (what the
 * verifier reports) falling back to `vc.issuer`; after a passing verify the
 * issuer-binding gate has confirmed the signing key is controlled by this issuer, so
 * it is a sound DISPLAY + allowlist identity — but it is deliberately NOT the
 * distinctness anchor (that is the key thumbprint), because solid-vc echoes the
 * claimed string here. Trimming closes the whitespace-only / stray-whitespace
 * near-duplicate (the LOW); it does NOT strip fragments/paths (that would WRONGLY
 * merge two genuinely distinct WebIDs sharing a document).
 */
function canonicalIssuer(result: VerificationResult, vc: VerifiableCredential): string | undefined {
  const raw = nonEmpty(result.issuer) ?? nonEmpty(vc.issuer);
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
function steward(issuer: string, keyThumbprint: string, credentialId?: string): QuorumSteward {
  return { issuer, keyThumbprint, ...(credentialId !== undefined ? { credentialId } : {}) };
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

/** The proof `verificationMethod` IRIs on a credential (one proof, or a proof set),
 *  trimmed + de-duplicated + non-empty. Fail-closed on a missing/malformed proof. */
function verificationMethods(vc: VerifiableCredential): string[] {
  const raw = vc.proof;
  const proofs: readonly DataIntegrityProof[] = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === "object"
      ? [raw as DataIntegrityProof]
      : [];
  const vms = new Set<string>();
  for (const p of proofs) {
    if (p != null && typeof p === "object" && typeof p.verificationMethod === "string") {
      const vm = p.verificationMethod.trim();
      if (vm.length > 0) vms.add(vm);
    }
  }
  return [...vms];
}

/** RFC 7638 required JWK members per key type, ALREADY in lexicographic order (the
 *  order the thumbprint hash requires). An unknown `kty` ⇒ no thumbprint (fail-closed
 *  — an unverifiable identity is never counted). */
const THUMBPRINT_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  EC: ["crv", "kty", "x", "y"],
  OKP: ["crv", "kty", "x"],
  RSA: ["e", "kty", "n"],
  oct: ["k", "kty"],
};

/** URL-safe, unpadded base64 of raw bytes (RFC 7515 §2 base64url). */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The RFC 7638 JWK thumbprint of a public key — the anti-Sybil DISTINCTNESS ANCHOR.
 * Exports the key to a JWK, keeps ONLY the type-specific required members in
 * lexicographic order with no whitespace, SHA-256s the UTF-8 bytes, and base64url-
 * encodes the digest (WebCrypto only — no added dependency, works in browser + Node).
 * FAIL-CLOSED (returns `undefined`, never throws) on a non-exportable key, an unknown
 * key type, or a missing/blank required member — a key we cannot canonically identify
 * must not be counted as a distinct steward.
 */
async function keyThumbprint(key: CryptoKey): Promise<string | undefined> {
  let jwk: JsonWebKey;
  try {
    jwk = await crypto.subtle.exportKey("jwk", key);
  } catch {
    return undefined;
  }
  const kty = typeof jwk.kty === "string" ? jwk.kty : undefined;
  const members = kty !== undefined ? THUMBPRINT_MEMBERS[kty] : undefined;
  if (members === undefined) return undefined;
  const fields = jwk as Record<string, unknown>;
  const parts: string[] = [];
  for (const m of members) {
    const v = fields[m];
    if (typeof v !== "string" || v.length === 0) return undefined;
    parts.push(`${JSON.stringify(m)}:${JSON.stringify(v)}`);
  }
  const canonical = `{${parts.join(",")}}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `sha-256:${base64url(new Uint8Array(digest))}`;
}

/**
 * The set of signing-key thumbprints backing a credential — resolve EACH proof's
 * `verificationMethod` to its public key and thumbprint it. A resolver that throws /
 * returns nothing, or a key that will not thumbprint, is skipped (fail-closed). The
 * returned set is empty ⇒ no cryptographic identity ⇒ the VC is not counted.
 */
async function stewardKeyThumbprints(
  vc: VerifiableCredential,
  resolveKey: ResolveKey,
): Promise<Set<string>> {
  const thumbprints = new Set<string>();
  for (const vm of verificationMethods(vc)) {
    let key: CryptoKey | undefined;
    try {
      key = (await resolveKey(vm)) ?? undefined;
    } catch {
      key = undefined;
    }
    if (key === undefined) continue;
    const tp = await keyThumbprint(key);
    if (tp !== undefined) thumbprints.add(tp);
  }
  return thumbprints;
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
 *  4. reject if no canonical verified issuer is present (no-issuer);
 *  5. reject if a `trustedStewards` allowlist is supplied and the issuer is not a
 *     member (untrusted-steward);
 *  6. reject if NO signing-key thumbprint resolves (no-key — no crypto identity);
 *  7. reject if the SAME key thumbprint OR the SAME canonical issuer already counted
 *     (duplicate-steward — one steward, one vote); otherwise COUNT it.
 *
 * The quorum is met IFF the distinct count reaches the effective threshold (clamped
 * up to {@link QUORUM_FLOOR}). Never throws on DATA; a content-digest failure returns
 * a `met: false` attestation with `contentError` set. It DOES throw on the ONE
 * configuration error — a missing `resolveKey` crypto anchor — rather than silently
 * running unprotected.
 */
export async function buildQuorumAttestation(
  contentQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: QuorumOptions,
): Promise<QuorumAttestation> {
  // Fail LOUD on a missing crypto anchor: distinctness is anchored on the verified
  // signing-key thumbprint, so a caller MUST supply `resolveKey`. Refusing to run
  // (rather than degrading to forgeable claimed-issuer-string dedup) is the whole
  // point — the module cannot be foot-gunned into the unprotected default.
  if (typeof options.verifyVc !== "function") {
    throw new TypeError("buildQuorumAttestation: `verifyVc` seam is required");
  }
  if (typeof options.resolveKey !== "function") {
    throw new TypeError(
      "buildQuorumAttestation: `resolveKey` is required — distinctness is anchored on the " +
        "verified signing-key thumbprint, never the claimed issuer string",
    );
  }
  const { resolveKey } = options;

  // Normalise the threshold FAIL-SAFE: a finite numeric threshold is rounded UP
  // (`Math.ceil`) so a fractional bar like 2.5 becomes 3, never silently lowered to
  // the floor; a non-finite / non-numeric threshold (undefined / NaN / Infinity)
  // falls back to the floor. Then clamp up to {@link QUORUM_FLOOR} — the result is
  // ALWAYS ≥ what the caller asked AND ≥ the no-single-owner floor (never below).
  const requested =
    typeof options.threshold === "number" && Number.isFinite(options.threshold)
      ? Math.ceil(options.threshold)
      : QUORUM_FLOOR;
  const threshold = Math.max(requested, QUORUM_FLOOR);
  const digestFn = options.digest ?? solidVcDigestQuads;

  // The optional defense-in-depth allowlist, canonicalised the SAME way as issuers
  // (trimmed) so membership is compared apples-to-apples. `undefined` ⇒ not enforced.
  const allowlist =
    options.trustedStewards === undefined
      ? undefined
      : new Set(
          options.trustedStewards
            .filter((s): s is string => typeof s === "string")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );

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
  const seenThumbprints = new Set<string>();
  const seenIssuers = new Set<string>();

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
      rejected.push(rejection(index, "digest-mismatch", canonicalIssuer(result, vc)));
      continue;
    }

    // (c) a canonical (trimmed, non-empty) issuer must exist — the display + allowlist
    //     identity (NOT the distinctness anchor). No issuer ⇒ nothing to display/trust.
    const issuer = canonicalIssuer(result, vc);
    if (issuer === undefined) {
      rejected.push(rejection(index, "no-issuer"));
      continue;
    }

    // (d) OPTIONAL defense-in-depth: the issuer must be a recognised steward.
    if (allowlist !== undefined && !allowlist.has(issuer)) {
      rejected.push(rejection(index, "untrusted-steward", issuer));
      continue;
    }

    // (e) THE DISTINCTNESS ANCHOR: resolve the verified signing key(s) and thumbprint.
    //     No thumbprint ⇒ no cryptographic identity ⇒ cannot be counted (fail-closed).
    const thumbprints = await stewardKeyThumbprints(vc, resolveKey);
    if (thumbprints.size === 0) {
      rejected.push(rejection(index, "no-key", issuer));
      continue;
    }

    // (f) one steward, one vote — dedupe on EITHER a repeated signing KEY (the alias
    //     forgery: same key, different claimed issuer) OR a repeated canonical ISSUER
    //     (one identity publishing several keys). Either collision ⇒ already counted.
    const keyReused = [...thumbprints].some((tp) => seenThumbprints.has(tp));
    if (keyReused || seenIssuers.has(issuer)) {
      rejected.push(rejection(index, "duplicate-steward", issuer));
      continue;
    }

    // Count. The steward's recorded thumbprint is the (sorted) first of its keys — a
    // stable representative; ALL of its keys are marked seen so a later VC reusing ANY
    // of them is a duplicate.
    const primaryThumbprint = [...thumbprints].sort()[0] as string;
    for (const tp of thumbprints) seenThumbprints.add(tp);
    seenIssuers.add(issuer);
    stewards.push(steward(issuer, primaryThumbprint, nonEmpty(vc.id)));
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
    // "bootstrapping" is specifically the single-steward reality — at least one valid
    // steward but the no-single-owner FLOOR not yet reached. It is measured against
    // QUORUM_FLOOR, NOT the (possibly raised) threshold: a community that requires 3
    // of 5 and has 2 signed stewards has cleared the floor (not "bootstrapping") — it
    // is merely short of its own raised bar, which `met` already reports.
    bootstrapping: distinctStewards >= 1 && distinctStewards < QUORUM_FLOOR,
  };
}

/**
 * Boolean quorum gate: `true` IFF ≥ `threshold` (clamped to {@link QUORUM_FLOOR})
 * distinct, verified, non-revoked stewards each signed the SAME content — where
 * DISTINCT is anchored on the verified signing-key thumbprint, not the claimed issuer.
 * Fail-closed — see {@link buildQuorumAttestation} for the full attestation (counts,
 * rejections, the bootstrapping state) a surface should render.
 */
export async function verifyQuorumAttestation(
  contentQuads: readonly Quad[],
  stewardVCs: readonly VerifiableCredential[],
  options: QuorumOptions,
): Promise<boolean> {
  return (await buildQuorumAttestation(contentQuads, stewardVCs, options)).met;
}
