// The multi-steward quorum attestation verifier. The attack surface IS the test
// surface: this primitive is the load-bearing "no single owner" (≥2 distinct
// stewards over the SAME content) keystone, so every way to inflate or forge a
// quorum is exercised. Two layers:
//   · fake-VERIFY unit tests — precise control over each VC's verification OUTCOME
//     (verified / errors / issuer), while the DISTINCTNESS anchor (`resolveKey` →
//     real key thumbprint) stays REAL, so the anti-Sybil dedup is exercised against
//     actual key material; and
//   · REAL-crypto end-to-end tests — issue + verifyCredential from the actual
//     `@jeswr/solid-vc` over a real RDFC-1.0 digest, proving the composition works
//     against the shipped library, not just against a stub — INCLUDING the reported
//     issuer-alias forgery reproduced against real Ed25519 crypto.

import {
  digestQuads,
  generateKeyPairForSuite,
  issue,
  type KeyPair,
  type RelatedResource,
  type VerifiableCredential,
  type VerificationErrorCode,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { DataFactory } from "n3";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildQuorumAttestation,
  QUORUM_FLOOR,
  type ResolveKey,
  verifyQuorumAttestation,
} from "./quorum.js";

const { namedNode, literal, quad } = DataFactory;

const ARTIFACT = "https://unite.example/d/futures/adoption-decision-1.ttl#it";
const OTHER_ARTIFACT = "https://unite.example/d/futures/adoption-decision-2.ttl#it";
const STEWARD_A = "https://alice.example/profile/card#me";
const STEWARD_B = "https://bob.example/profile/card#me";
const STEWARD_C = "https://carol.example/profile/card#me";
// The prefix-TRUNCATION alias of STEWARD_A: same key controls both under the default
// `isControlledBy` prefix heuristic (vm `…/card#me#key` startsWith `…/card#`).
const STEWARD_A_ALIAS = "https://alice.example/profile/card";

const DCT_TITLE = "http://purl.org/dc/terms/title";
const FUT_PROPOSES = "https://w3id.org/jeswr/futures#proposesVersion";

/** A small non-empty artifact graph (the `fut:AdoptionDecision`-shaped content). */
function artifactQuads(title = "Adopt storage spec v2"): Quad[] {
  return [
    quad(namedNode(ARTIFACT), namedNode(DCT_TITLE), literal(title)),
    quad(
      namedNode(ARTIFACT),
      namedNode(FUT_PROPOSES),
      namedNode("https://w3id.org/jeswr/specs/storage/v2"),
    ),
  ];
}

// ── Real keypairs back the distinctness anchor even in the fake-VERIFY tests ─────────
// The fake `verifyVc` seam controls the verify OUTCOME; `resolveKey` is REAL, so the
// RFC 7638 key-thumbprint dedup runs against genuine Ed25519 key material.
let keyA: KeyPair;
let keyB: KeyPair;
let keyC: KeyPair;
const keyMap = new Map<string, CryptoKey>();
const resolveKey: ResolveKey = (vm) => keyMap.get(vm);

beforeAll(async () => {
  keyA = await generateKeyPairForSuite(`${STEWARD_A}#key`, "Ed25519");
  keyB = await generateKeyPairForSuite(`${STEWARD_B}#key`, "Ed25519");
  keyC = await generateKeyPairForSuite(`${STEWARD_C}#key`, "Ed25519");
  for (const k of [keyA, keyB, keyC]) keyMap.set(k.verificationMethod, k.publicKey);
});

/** A VerifiableCredential shaped like a steward attestation (for the fake-VERIFY tests
 *  — the `proof.verificationMethod` names a REAL key so the thumbprint anchor resolves,
 *  while the injected verify decides the pass/fail outcome). */
function makeVc(opts: {
  issuer: string;
  key: KeyPair;
  digest?: string;
  id?: string;
  relatedResource?: readonly RelatedResource[];
}): VerifiableCredential {
  const related: readonly RelatedResource[] | undefined =
    opts.relatedResource ??
    (opts.digest !== undefined
      ? [{ id: ARTIFACT, digestMultibase: opts.digest, mediaType: "application/n-quads" }]
      : undefined);
  return {
    id: opts.id,
    issuer: opts.issuer,
    credentialSubject: { id: ARTIFACT },
    relatedResource: related,
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "eddsa-rdfc-2022",
      verificationMethod: opts.key.verificationMethod,
      proofPurpose: "assertionMethod",
      proofValue: "z-placeholder",
    },
  } as VerifiableCredential;
}

const verified = (issuer: string): VerificationResult => ({ verified: true, errors: [], issuer });
const failed = (codes: VerificationErrorCode[]): VerificationResult => ({
  verified: false,
  errors: codes.map((code) => ({ code, message: code })),
});

/** A verify seam that returns each VC's pre-declared result (by reference). */
function verifyByMap(results: Map<VerifiableCredential, VerificationResult>) {
  return async (vc: VerifiableCredential): Promise<VerificationResult> =>
    results.get(vc) ?? failed(["MALFORMED"]);
}

describe("buildQuorumAttestation — fake-verify unit tests (real key anchor)", () => {
  let digestA: string;
  let digestB: string;
  beforeAll(async () => {
    digestA = await digestQuads(artifactQuads());
    digestB = await digestQuads(artifactQuads("A totally different decision"));
  });

  it("meets quorum when exactly the threshold of distinct stewards signs the same digest", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:a" });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA, id: "urn:vc:b" });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcB], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.met).toBe(true);
    expect(att.threshold).toBe(2);
    expect(att.distinctStewards).toBe(2);
    expect(att.contentDigest).toBe(digestA);
    expect(att.stewards.map((s) => s.issuer).sort()).toEqual([STEWARD_A, STEWARD_B]);
    // Every counted steward carries the key thumbprint it was deduped on.
    expect(att.stewards.every((s) => s.keyThumbprint.startsWith("sha-256:"))).toBe(true);
    expect(new Set(att.stewards.map((s) => s.keyThumbprint)).size).toBe(2);
    expect(att.rejected).toHaveLength(0);
    expect(att.bootstrapping).toBe(false);
  });

  it("is NOT met one steward short — reports the honest bootstrapping state", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vcA], {
      verifyVc: verifyByMap(new Map([[vcA, verified(STEWARD_A)]])),
      resolveKey,
    });
    expect(att.met).toBe(false);
    expect(att.distinctStewards).toBe(1);
    expect(att.threshold).toBe(2);
    expect(att.bootstrapping).toBe(true);
  });

  it("counts a steward who double-signs (same key) only ONCE (one steward, one vote)", async () => {
    const vcA1 = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:a1" });
    const vcA2 = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:a2" });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA, id: "urn:vc:b" });
    const results = new Map([
      [vcA1, verified(STEWARD_A)],
      [vcA2, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA1, vcA2, vcB], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(2);
    expect(att.met).toBe(true);
    const dupes = att.rejected.filter((r) => r.reason === "duplicate-steward");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.issuer).toBe(STEWARD_A);
  });

  it("does NOT meet quorum when a double-signing steward is the ONLY signer", async () => {
    const vcA1 = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:a1" });
    const vcA2 = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:a2" });
    const results = new Map([
      [vcA1, verified(STEWARD_A)],
      [vcA2, verified(STEWARD_A)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA1, vcA2], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
  });

  it("EXPLOIT (fake-verify): one KEY under two claimed-issuer aliases counts ONCE", async () => {
    // The reported HIGH at the seam level: a single key-holder presents two VCs, one
    // per claimed-issuer alias, both "verified". Dedup is on the KEY THUMBPRINT, so
    // they collapse to one steward — the claimed issuer strings are irrelevant.
    const vcMe = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:me" });
    const vcAlias = makeVc({
      issuer: STEWARD_A_ALIAS,
      key: keyA,
      digest: digestA,
      id: "urn:vc:al",
    });
    const results = new Map([
      [vcMe, verified(STEWARD_A)],
      [vcAlias, verified(STEWARD_A_ALIAS)], // solid-vc echoes the CLAIMED alias here
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcMe, vcAlias], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });

  it("counts two DIFFERENT keys under the SAME issuer only ONCE (one identity, many keys)", async () => {
    // The other Sybil face: one identity publishes two distinct keys. Canonical-issuer
    // dedup collapses them, so key multiplicity cannot inflate a single identity.
    const vc1 = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:1" });
    const vc2 = makeVc({ issuer: STEWARD_A, key: keyB, digest: digestA, id: "urn:vc:2" });
    const results = new Map([
      [vc1, verified(STEWARD_A)],
      [vc2, verified(STEWARD_A)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vc1, vc2], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });

  it("counts two genuinely-distinct keys+issuers as TWO", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcB], {
      verifyVc: verifyByMap(
        new Map([
          [vcA, verified(STEWARD_A)],
          [vcB, verified(STEWARD_B)],
        ]),
      ),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(2);
    expect(att.met).toBe(true);
  });

  it("rejects a VC that binds a DIFFERENT digest (a signature over other content)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcWrong = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestB }); // signs OTHER content
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcWrong, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcWrong], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    const mism = att.rejected.filter((r) => r.reason === "digest-mismatch");
    expect(mism).toHaveLength(1);
    expect(mism[0]?.issuer).toBe(STEWARD_B);
  });

  it("excludes a REVOKED steward (composing the Bitstring status-list gate)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcRevoked = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcRevoked, failed(["STATUS_REVOKED"])],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcRevoked], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false); // the lone valid steward can't reach the ≥2 floor
    expect(att.rejected.find((r) => r.reason === "revoked")).toBeDefined();
  });

  it("excludes a SUSPENDED steward with a distinct reason", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, failed(["STATUS_SUSPENDED"])]])),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("suspended");
  });

  it("excludes a cryptographically INVALID VC (bad signature)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcBad = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcBad, failed(["INVALID_SIGNATURE"])],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcBad], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    const bad = att.rejected.find((r) => r.reason === "unverified");
    expect(bad?.detail).toBe("INVALID_SIGNATURE");
  });

  it("rejects a verified VC with no establishable issuer identity (no-issuer)", async () => {
    const vc = makeVc({ issuer: "", key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, { verified: true, errors: [] }]])),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("no-issuer");
  });

  it("rejects a WHITESPACE-ONLY issuer (LOW: dedup key normalisation)", async () => {
    // A blank/whitespace issuer must NOT be treated as a distinct steward — trimming
    // canonicalises it away, so it fails closed as no-issuer, never counted.
    const vc = makeVc({ issuer: "   \t ", key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, { verified: true, errors: [], issuer: "   \t " }]])),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("no-issuer");
  });

  it("does not treat whitespace-padded aliases of one issuer as distinct", async () => {
    // "  A  " and "A" canonicalise to the same steward → deduped by issuer even with
    // two different keys.
    const vcPadded = makeVc({ issuer: `  ${STEWARD_A}  `, key: keyA, digest: digestA, id: "p" });
    const vcPlain = makeVc({ issuer: STEWARD_A, key: keyB, digest: digestA, id: "q" });
    const att = await buildQuorumAttestation(artifactQuads(), [vcPadded, vcPlain], {
      verifyVc: verifyByMap(
        new Map([
          [vcPadded, verified(`  ${STEWARD_A}  `)],
          [vcPlain, verified(STEWARD_A)],
        ]),
      ),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.stewards[0]?.issuer).toBe(STEWARD_A);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });

  it("rejects a verified VC whose signing key cannot be resolved (no-key, fail-closed)", async () => {
    // A verified + digest-bound VC whose proof key is NOT resolvable has no crypto
    // identity to anchor distinctness on → excluded, never counted.
    const vcUnknown = makeVc({
      issuer: STEWARD_A,
      // A key NOT in keyMap → resolveKey returns undefined → no thumbprint.
      key: { ...keyA, verificationMethod: "https://ghost.example/#key" } as KeyPair,
      digest: digestA,
    });
    const att = await buildQuorumAttestation(artifactQuads(), [vcUnknown], {
      verifyVc: verifyByMap(new Map([[vcUnknown, verified(STEWARD_A)]])),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("no-key");
  });

  it("enforces the OPTIONAL trustedStewards allowlist (untrusted-steward)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA }); // not on the allowlist
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcB], {
      verifyVc: verifyByMap(
        new Map([
          [vcA, verified(STEWARD_A)],
          [vcB, verified(STEWARD_B)],
        ]),
      ),
      resolveKey,
      trustedStewards: [STEWARD_A], // only A is recognised
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "untrusted-steward")?.issuer).toBe(STEWARD_B);
  });

  it("throws LOUD when the resolveKey crypto anchor is omitted (not foot-gun-able)", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    await expect(
      buildQuorumAttestation(artifactQuads(), [vc], {
        verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
        // resolveKey deliberately omitted
      } as unknown as Parameters<typeof buildQuorumAttestation>[2]),
    ).rejects.toThrow(/resolveKey/);
  });

  it("rejects a VC whose relatedResource is missing/malformed (fail-closed digest bind)", async () => {
    const noRelated = makeVc({ issuer: STEWARD_A, key: keyA }); // no relatedResource at all
    const badRelated = {
      ...makeVc({ issuer: STEWARD_B, key: keyB }),
      relatedResource: "not-an-array",
    } as unknown as VerifiableCredential;
    const results = new Map([
      [noRelated, verified(STEWARD_A)],
      [badRelated, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [noRelated, badRelated], {
      verifyVc: verifyByMap(results),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected.every((r) => r.reason === "digest-mismatch")).toBe(true);
  });

  it("fails closed on EMPTY steward list", async () => {
    const att = await buildQuorumAttestation(artifactQuads(), [], {
      verifyVc: verifyByMap(new Map()),
      resolveKey,
    });
    expect(att.met).toBe(false);
    expect(att.distinctStewards).toBe(0);
    expect(att.bootstrapping).toBe(false);
    expect(att.contentDigest).toBe(digestA);
  });

  it("fails closed on EMPTY / malformed content (no digest to bind)", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const att = await buildQuorumAttestation([], [vc], {
      verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
      resolveKey,
    });
    expect(att.met).toBe(false);
    expect(att.contentDigest).toBeUndefined();
    expect(att.contentError).toBeDefined();
    expect(att.distinctStewards).toBe(0);
  });

  it("treats a null / non-object credential as malformed, without aborting siblings", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA });
    const list = [null, vcA, "nope", vcB] as unknown as VerifiableCredential[];
    const att = await buildQuorumAttestation(artifactQuads(), list, {
      verifyVc: verifyByMap(
        new Map([
          [vcA, verified(STEWARD_A)],
          [vcB, verified(STEWARD_B)],
        ]),
      ),
      resolveKey,
    });
    expect(att.distinctStewards).toBe(2);
    expect(att.met).toBe(true);
    expect(att.rejected.filter((r) => r.reason === "malformed")).toHaveLength(2);
  });

  it("treats a verify seam that THROWS as malformed (fail-closed), not a crash", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: async () => {
        throw new Error("verifier exploded");
      },
      resolveKey,
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("malformed");
    expect(att.rejected[0]?.detail).toContain("exploded");
  });

  it("clamps a below-floor threshold UP to the floor (never lowers no-single-owner)", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
      resolveKey,
      threshold: 1,
    });
    expect(att.threshold).toBe(QUORUM_FLOOR);
    expect(att.met).toBe(false);
  });

  it("honours a RAISED threshold (a community may require more than the floor)", async () => {
    const vcs = [
      makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:0" }),
      makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA, id: "urn:vc:1" }),
      makeVc({ issuer: STEWARD_C, key: keyC, digest: digestA, id: "urn:vc:2" }),
    ];
    const results = new Map(vcs.map((v) => [v, verified(v.issuer)]));
    const three = await buildQuorumAttestation(artifactQuads(), vcs, {
      verifyVc: verifyByMap(results),
      resolveKey,
      threshold: 3,
    });
    expect(three.threshold).toBe(3);
    expect(three.met).toBe(true);
    const two = await buildQuorumAttestation(artifactQuads(), vcs.slice(0, 2), {
      verifyVc: verifyByMap(results),
      resolveKey,
      threshold: 3,
    });
    expect(two.met).toBe(false);
    expect(two.distinctStewards).toBe(2);
    // The FLOOR is cleared (2 ≥ 2) — short of the RAISED bar is NOT "bootstrapping".
    expect(two.bootstrapping).toBe(false);
  });

  it("rounds a FRACTIONAL threshold UP (never silently lowers it to the floor)", async () => {
    const vcs = [
      makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA, id: "urn:vc:0" }),
      makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA, id: "urn:vc:1" }),
      makeVc({ issuer: STEWARD_C, key: keyC, digest: digestA, id: "urn:vc:2" }),
    ];
    const results = new Map(vcs.map((v) => [v, verified(v.issuer)]));
    const two = await buildQuorumAttestation(artifactQuads(), vcs.slice(0, 2), {
      verifyVc: verifyByMap(results),
      resolveKey,
      threshold: 2.5,
    });
    expect(two.threshold).toBe(3);
    expect(two.met).toBe(false);
    const three = await buildQuorumAttestation(artifactQuads(), vcs, {
      verifyVc: verifyByMap(results),
      resolveKey,
      threshold: 2.5,
    });
    expect(three.threshold).toBe(3);
    expect(three.met).toBe(true);
  });

  it("falls back to the floor on a non-finite / non-numeric threshold", async () => {
    const vc = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const att = await buildQuorumAttestation(artifactQuads(), [vc], {
        verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
        resolveKey,
        threshold: bad,
      });
      expect(att.threshold).toBe(QUORUM_FLOOR);
      expect(att.met).toBe(false);
    }
  });

  it("verifyQuorumAttestation is the boolean mirror of `met`", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, key: keyA, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, key: keyB, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    await expect(
      verifyQuorumAttestation(artifactQuads(), [vcA, vcB], {
        verifyVc: verifyByMap(results),
        resolveKey,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyQuorumAttestation(artifactQuads(), [vcA], {
        verifyVc: verifyByMap(results),
        resolveKey,
      }),
    ).resolves.toBe(false);
  });
});

// ── REAL-crypto end-to-end: prove the composition against the actual solid-vc ────
describe("buildQuorumAttestation — real solid-vc issue + verifyCredential", () => {
  let realKeyA: KeyPair;
  let realKeyB: KeyPair;
  let content: Quad[];
  let realDigest: string;
  let realResolveKey: (vm: string) => Promise<CryptoKey | undefined>;

  /** Issue a real steward VC binding `digest` under `relatedResource`. */
  async function issueSteward(
    webId: string,
    key: KeyPair,
    digest: string,
  ): Promise<VerifiableCredential> {
    return issue({
      credential: {
        issuer: webId,
        credentialSubject: { id: ARTIFACT },
        relatedResource: [
          { id: ARTIFACT, digestMultibase: digest, mediaType: "application/n-quads" },
        ],
      },
      key,
    });
  }

  beforeAll(async () => {
    realKeyA = await generateKeyPairForSuite(`${STEWARD_A}#key`, "Ed25519");
    realKeyB = await generateKeyPairForSuite(`${STEWARD_B}#key`, "Ed25519");
    content = artifactQuads("Real signed adoption decision");
    realDigest = await digestQuads(content);
    const keys = new Map<string, CryptoKey>([
      [realKeyA.verificationMethod, realKeyA.publicKey],
      [realKeyB.verificationMethod, realKeyB.publicKey],
    ]);
    realResolveKey = async (vm: string) => keys.get(vm);
  });

  const realVerify = (vc: VerifiableCredential) =>
    verifyCredential(vc, { resolveKey: realResolveKey });

  it("meets quorum with two REAL independent steward signatures over the same digest", async () => {
    const vcA = await issueSteward(STEWARD_A, realKeyA, realDigest);
    const vcB = await issueSteward(STEWARD_B, realKeyB, realDigest);
    const att = await buildQuorumAttestation(content, [vcA, vcB], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
    });
    expect(att.met).toBe(true);
    expect(att.distinctStewards).toBe(2);
    expect(att.contentDigest).toBe(realDigest);
    expect(att.stewards.map((s) => s.issuer).sort()).toEqual([STEWARD_A, STEWARD_B]);
  });

  it("EXPLOIT (real crypto): one key, two claimed-issuer aliases, both verify → counts ONCE", async () => {
    // The reported HIGH, reproduced against REAL Ed25519 crypto. STEWARD_A's key
    // `…/card#me#key` is accepted by the default prefix `isControlledBy` for BOTH the
    // full WebID `…/card#me` AND its truncation `…/card`, so a single key-holder can
    // sign two VCs with distinct claimed issuers that BOTH verify. Old code counted 2
    // (Sybil); the key-thumbprint anchor collapses them to 1.
    const vcMe = await issueSteward(STEWARD_A, realKeyA, realDigest); // issuer …/card#me
    const vcAlias = await issueSteward(STEWARD_A_ALIAS, realKeyA, realDigest); // issuer …/card, SAME key

    // Sanity: both really do verify against the shipped verifier + default controls.
    expect((await realVerify(vcMe)).verified).toBe(true);
    expect((await realVerify(vcAlias)).verified).toBe(true);

    const att = await buildQuorumAttestation(content, [vcMe, vcAlias], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });

  it("rejects a REAL VC that validly signs a DIFFERENT artifact's digest", async () => {
    const otherDigest = await digestQuads(artifactQuads("some other artifact"));
    const vcA = await issueSteward(STEWARD_A, realKeyA, realDigest);
    const vcWrong = await issueSteward(STEWARD_B, realKeyB, otherDigest); // real signature, wrong content
    const att = await buildQuorumAttestation(content, [vcA, vcWrong], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "digest-mismatch")?.issuer).toBe(STEWARD_B);
  });

  it("excludes a REAL VC whose signed graph was tampered after issuance", async () => {
    const vcA = await issueSteward(STEWARD_A, realKeyA, realDigest);
    const vcB = await issueSteward(STEWARD_B, realKeyB, realDigest);
    // Tamper vcB's bound digest AFTER signing — the proof no longer covers it.
    const tampered = {
      ...vcB,
      relatedResource: [{ id: ARTIFACT, digestMultibase: realDigest, mediaType: "text/turtle" }],
      credentialSubject: { id: OTHER_ARTIFACT },
    } as VerifiableCredential;
    const att = await buildQuorumAttestation(content, [vcA, tampered], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "unverified")).toBeDefined();
  });

  it("counts the SAME real steward signing twice only once", async () => {
    const vc1 = await issueSteward(STEWARD_A, realKeyA, realDigest);
    const vc2 = await issueSteward(STEWARD_A, realKeyA, realDigest);
    const att = await buildQuorumAttestation(content, [vc1, vc2], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });
});
