// The multi-steward quorum attestation verifier. The attack surface IS the test
// surface: this primitive is the load-bearing "no single owner" (≥2 distinct
// stewards over the SAME content) keystone, so every way to inflate or forge a
// quorum is exercised. Two layers:
//   · fake-seam unit tests — precise control over each VC's verification outcome,
//     driving threshold / dedup / revocation / wrong-digest / malformed paths with
//     no crypto; and
//   · REAL-crypto end-to-end tests — issue + verifyCredential from the actual
//     `@jeswr/solid-vc` over a real RDFC-1.0 digest, proving the composition works
//     against the shipped library, not just against a stub.

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
import { buildQuorumAttestation, QUORUM_FLOOR, verifyQuorumAttestation } from "./quorum.js";

const { namedNode, literal, quad } = DataFactory;

const ARTIFACT = "https://unite.example/d/futures/adoption-decision-1.ttl#it";
const OTHER_ARTIFACT = "https://unite.example/d/futures/adoption-decision-2.ttl#it";
const STEWARD_A = "https://alice.example/profile/card#me";
const STEWARD_B = "https://bob.example/profile/card#me";
const STEWARD_C = "https://carol.example/profile/card#me";

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

/** A VerifiableCredential shaped like a steward attestation (for the FAKE-seam tests
 *  — the `proof` is a placeholder because the injected verify decides the outcome). */
function makeVc(opts: {
  issuer: string;
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
      verificationMethod: `${opts.issuer}#key`,
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

describe("buildQuorumAttestation — fake-seam unit tests", () => {
  let digestA: string;
  let digestB: string;
  beforeAll(async () => {
    digestA = await digestQuads(artifactQuads());
    digestB = await digestQuads(artifactQuads("A totally different decision"));
  });

  it("meets quorum when exactly the threshold of distinct stewards signs the same digest", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA, id: "urn:vc:a" });
    const vcB = makeVc({ issuer: STEWARD_B, digest: digestA, id: "urn:vc:b" });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcB], {
      verifyVc: verifyByMap(results),
    });
    expect(att.met).toBe(true);
    expect(att.threshold).toBe(2);
    expect(att.distinctStewards).toBe(2);
    expect(att.contentDigest).toBe(digestA);
    expect(att.stewards.map((s) => s.issuer).sort()).toEqual([STEWARD_A, STEWARD_B]);
    expect(att.rejected).toHaveLength(0);
    expect(att.bootstrapping).toBe(false);
  });

  it("is NOT met one steward short — reports the honest bootstrapping state", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vcA], {
      verifyVc: verifyByMap(new Map([[vcA, verified(STEWARD_A)]])),
    });
    expect(att.met).toBe(false);
    expect(att.distinctStewards).toBe(1);
    expect(att.threshold).toBe(2);
    expect(att.bootstrapping).toBe(true);
  });

  it("counts a steward who double-signs only ONCE (one steward, one vote)", async () => {
    // Same WebID signs twice + a distinct second steward — 2 distinct, meets floor.
    const vcA1 = makeVc({ issuer: STEWARD_A, digest: digestA, id: "urn:vc:a1" });
    const vcA2 = makeVc({ issuer: STEWARD_A, digest: digestA, id: "urn:vc:a2" });
    const vcB = makeVc({ issuer: STEWARD_B, digest: digestA, id: "urn:vc:b" });
    const results = new Map([
      [vcA1, verified(STEWARD_A)],
      [vcA2, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA1, vcA2, vcB], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(2);
    expect(att.met).toBe(true);
    const dupes = att.rejected.filter((r) => r.reason === "duplicate-steward");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.issuer).toBe(STEWARD_A);
  });

  it("does NOT meet quorum when a double-signing steward is the ONLY signer", async () => {
    const vcA1 = makeVc({ issuer: STEWARD_A, digest: digestA, id: "urn:vc:a1" });
    const vcA2 = makeVc({ issuer: STEWARD_A, digest: digestA, id: "urn:vc:a2" });
    const results = new Map([
      [vcA1, verified(STEWARD_A)],
      [vcA2, verified(STEWARD_A)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA1, vcA2], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
  });

  it("rejects a VC that binds a DIFFERENT digest (a signature over other content)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const vcWrong = makeVc({ issuer: STEWARD_B, digest: digestB }); // signs OTHER content
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcWrong, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcWrong], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    const mism = att.rejected.filter((r) => r.reason === "digest-mismatch");
    expect(mism).toHaveLength(1);
    expect(mism[0]?.issuer).toBe(STEWARD_B);
  });

  it("excludes a REVOKED steward (composing the Bitstring status-list gate)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const vcRevoked = makeVc({ issuer: STEWARD_B, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcRevoked, failed(["STATUS_REVOKED"])],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcRevoked], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false); // the lone valid steward can't reach the ≥2 floor
    expect(att.rejected.find((r) => r.reason === "revoked")).toBeDefined();
  });

  it("excludes a SUSPENDED steward with a distinct reason", async () => {
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, failed(["STATUS_SUSPENDED"])]])),
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("suspended");
  });

  it("excludes a cryptographically INVALID VC (bad signature)", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const vcBad = makeVc({ issuer: STEWARD_B, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcBad, failed(["INVALID_SIGNATURE"])],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vcA, vcBad], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(1);
    const bad = att.rejected.find((r) => r.reason === "unverified");
    expect(bad?.detail).toBe("INVALID_SIGNATURE");
  });

  it("counts a FORGED-distinct identity that is actually the SAME verified WebID only once", async () => {
    // Two VCs claim DIFFERENT issuer strings, but the verifier BINDS both to the same
    // WebID (result.issuer) — dedup is on the VERIFIED identity, so one vote.
    const vc1 = makeVc({ issuer: "https://sybil.example/#one", digest: digestA, id: "urn:vc:1" });
    const vc2 = makeVc({ issuer: "https://sybil.example/#two", digest: digestA, id: "urn:vc:2" });
    const results = new Map([
      [vc1, verified(STEWARD_A)],
      [vc2, verified(STEWARD_A)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [vc1, vc2], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });

  it("rejects a verified VC with no establishable issuer identity (no-issuer)", async () => {
    const vc = makeVc({ issuer: "", digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, { verified: true, errors: [] }]])),
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("no-issuer");
  });

  it("falls back to the claim issuer when the result omits it (still verified)", async () => {
    // A passing verify with no `result.issuer` but a claimed `vc.issuer` — after a
    // passing verify the issuer-binding gate has confirmed vc.issuer, so it counts.
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, { verified: true, errors: [] }]])),
    });
    expect(att.distinctStewards).toBe(1);
    expect(att.stewards[0]?.issuer).toBe(STEWARD_A);
  });

  it("rejects a VC whose relatedResource is missing/malformed (fail-closed digest bind)", async () => {
    const noRelated = makeVc({ issuer: STEWARD_A }); // no relatedResource at all
    const badRelated = {
      ...makeVc({ issuer: STEWARD_B }),
      relatedResource: "not-an-array",
    } as unknown as VerifiableCredential;
    const results = new Map([
      [noRelated, verified(STEWARD_A)],
      [badRelated, verified(STEWARD_B)],
    ]);
    const att = await buildQuorumAttestation(artifactQuads(), [noRelated, badRelated], {
      verifyVc: verifyByMap(results),
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected.every((r) => r.reason === "digest-mismatch")).toBe(true);
  });

  it("fails closed on EMPTY steward list", async () => {
    const att = await buildQuorumAttestation(artifactQuads(), [], {
      verifyVc: verifyByMap(new Map()),
    });
    expect(att.met).toBe(false);
    expect(att.distinctStewards).toBe(0);
    expect(att.bootstrapping).toBe(false);
    expect(att.contentDigest).toBe(digestA);
  });

  it("fails closed on EMPTY / malformed content (no digest to bind)", async () => {
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    const att = await buildQuorumAttestation([], [vc], {
      verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
    });
    expect(att.met).toBe(false);
    expect(att.contentDigest).toBeUndefined();
    expect(att.contentError).toBeDefined();
    expect(att.distinctStewards).toBe(0);
  });

  it("treats a null / non-object credential as malformed, without aborting siblings", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, digest: digestA });
    const list = [null, vcA, "nope", vcB] as unknown as VerifiableCredential[];
    const att = await buildQuorumAttestation(artifactQuads(), list, {
      verifyVc: verifyByMap(
        new Map([
          [vcA, verified(STEWARD_A)],
          [vcB, verified(STEWARD_B)],
        ]),
      ),
    });
    expect(att.distinctStewards).toBe(2);
    expect(att.met).toBe(true);
    expect(att.rejected.filter((r) => r.reason === "malformed")).toHaveLength(2);
  });

  it("treats a verify seam that THROWS as malformed (fail-closed), not a crash", async () => {
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: async () => {
        throw new Error("verifier exploded");
      },
    });
    expect(att.distinctStewards).toBe(0);
    expect(att.rejected[0]?.reason).toBe("malformed");
    expect(att.rejected[0]?.detail).toContain("exploded");
  });

  it("clamps a below-floor threshold UP to the floor (never lowers no-single-owner)", async () => {
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    // threshold: 1 must NOT let a single steward attest.
    const att = await buildQuorumAttestation(artifactQuads(), [vc], {
      verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
      threshold: 1,
    });
    expect(att.threshold).toBe(QUORUM_FLOOR);
    expect(att.met).toBe(false);
  });

  it("honours a RAISED threshold (a community may require more than the floor)", async () => {
    const vcs = [STEWARD_A, STEWARD_B, STEWARD_C].map((s, i) =>
      makeVc({ issuer: s, digest: digestA, id: `urn:vc:${i}` }),
    );
    const results = new Map(vcs.map((v) => [v, verified(v.issuer)]));
    const three = await buildQuorumAttestation(artifactQuads(), vcs, {
      verifyVc: verifyByMap(results),
      threshold: 3,
    });
    expect(three.threshold).toBe(3);
    expect(three.met).toBe(true);
    const two = await buildQuorumAttestation(artifactQuads(), vcs.slice(0, 2), {
      verifyVc: verifyByMap(results),
      threshold: 3,
    });
    expect(two.met).toBe(false);
    expect(two.distinctStewards).toBe(2);
    // The FLOOR is cleared (2 ≥ 2) — short of the RAISED bar is NOT "bootstrapping".
    expect(two.bootstrapping).toBe(false);
  });

  it("rounds a FRACTIONAL threshold UP (never silently lowers it to the floor)", async () => {
    const vcs = [STEWARD_A, STEWARD_B, STEWARD_C].map((s, i) =>
      makeVc({ issuer: s, digest: digestA, id: `urn:vc:${i}` }),
    );
    const results = new Map(vcs.map((v) => [v, verified(v.issuer)]));
    // 2.5 must become 3, so two stewards do NOT meet it (a naive `Number.isInteger`
    // fallback would drop 2.5 to the floor of 2 and wrongly attest).
    const two = await buildQuorumAttestation(artifactQuads(), vcs.slice(0, 2), {
      verifyVc: verifyByMap(results),
      threshold: 2.5,
    });
    expect(two.threshold).toBe(3);
    expect(two.met).toBe(false);
    const three = await buildQuorumAttestation(artifactQuads(), vcs, {
      verifyVc: verifyByMap(results),
      threshold: 2.5,
    });
    expect(three.threshold).toBe(3);
    expect(three.met).toBe(true);
  });

  it("falls back to the floor on a non-finite / non-numeric threshold", async () => {
    const vc = makeVc({ issuer: STEWARD_A, digest: digestA });
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const att = await buildQuorumAttestation(artifactQuads(), [vc], {
        verifyVc: verifyByMap(new Map([[vc, verified(STEWARD_A)]])),
        threshold: bad,
      });
      expect(att.threshold).toBe(QUORUM_FLOOR);
      expect(att.met).toBe(false);
    }
  });

  it("verifyQuorumAttestation is the boolean mirror of `met`", async () => {
    const vcA = makeVc({ issuer: STEWARD_A, digest: digestA });
    const vcB = makeVc({ issuer: STEWARD_B, digest: digestA });
    const results = new Map([
      [vcA, verified(STEWARD_A)],
      [vcB, verified(STEWARD_B)],
    ]);
    await expect(
      verifyQuorumAttestation(artifactQuads(), [vcA, vcB], { verifyVc: verifyByMap(results) }),
    ).resolves.toBe(true);
    await expect(
      verifyQuorumAttestation(artifactQuads(), [vcA], { verifyVc: verifyByMap(results) }),
    ).resolves.toBe(false);
  });
});

// ── REAL-crypto end-to-end: prove the composition against the actual solid-vc ────
describe("buildQuorumAttestation — real solid-vc issue + verifyCredential", () => {
  let keyA: KeyPair;
  let keyB: KeyPair;
  let content: Quad[];
  let realDigest: string;
  let resolveKey: (vm: string) => Promise<CryptoKey | undefined>;

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
    keyA = await generateKeyPairForSuite(`${STEWARD_A}#key`, "Ed25519");
    keyB = await generateKeyPairForSuite(`${STEWARD_B}#key`, "Ed25519");
    content = artifactQuads("Real signed adoption decision");
    realDigest = await digestQuads(content);
    const keys = new Map<string, CryptoKey>([
      [keyA.verificationMethod, keyA.publicKey],
      [keyB.verificationMethod, keyB.publicKey],
    ]);
    resolveKey = async (vm: string) => keys.get(vm);
  });

  const realVerify = (vc: VerifiableCredential) => verifyCredential(vc, { resolveKey });

  it("meets quorum with two REAL independent steward signatures over the same digest", async () => {
    const vcA = await issueSteward(STEWARD_A, keyA, realDigest);
    const vcB = await issueSteward(STEWARD_B, keyB, realDigest);
    const att = await buildQuorumAttestation(content, [vcA, vcB], { verifyVc: realVerify });
    expect(att.met).toBe(true);
    expect(att.distinctStewards).toBe(2);
    expect(att.contentDigest).toBe(realDigest);
    expect(att.stewards.map((s) => s.issuer).sort()).toEqual([STEWARD_A, STEWARD_B]);
  });

  it("rejects a REAL VC that validly signs a DIFFERENT artifact's digest", async () => {
    const otherDigest = await digestQuads(artifactQuads("some other artifact"));
    const vcA = await issueSteward(STEWARD_A, keyA, realDigest);
    const vcWrong = await issueSteward(STEWARD_B, keyB, otherDigest); // real signature, wrong content
    const att = await buildQuorumAttestation(content, [vcA, vcWrong], { verifyVc: realVerify });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "digest-mismatch")?.issuer).toBe(STEWARD_B);
  });

  it("excludes a REAL VC whose signed graph was tampered after issuance", async () => {
    const vcA = await issueSteward(STEWARD_A, keyA, realDigest);
    const vcB = await issueSteward(STEWARD_B, keyB, realDigest);
    // Tamper vcB's bound digest AFTER signing — the proof no longer covers it.
    const tampered = {
      ...vcB,
      relatedResource: [{ id: ARTIFACT, digestMultibase: realDigest, mediaType: "text/turtle" }],
      credentialSubject: { id: OTHER_ARTIFACT },
    } as VerifiableCredential;
    const att = await buildQuorumAttestation(content, [vcA, tampered], { verifyVc: realVerify });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "unverified")).toBeDefined();
  });

  it("counts the SAME real steward signing twice only once", async () => {
    const vc1 = await issueSteward(STEWARD_A, keyA, realDigest);
    const vc2 = await issueSteward(STEWARD_A, keyA, realDigest);
    const att = await buildQuorumAttestation(content, [vc1, vc2], { verifyVc: realVerify });
    expect(att.distinctStewards).toBe(1);
    expect(att.met).toBe(false);
    expect(att.rejected.find((r) => r.reason === "duplicate-steward")).toBeDefined();
  });
});
