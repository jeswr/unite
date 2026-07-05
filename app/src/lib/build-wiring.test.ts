// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.4 the build-layer WIRING — the attack surface IS the test surface. The two
// security bindings + the lifecycle wiring are EXERCISED with REAL solid-vc /
// federation-trust crypto (the BL.3 / S5 harness):
//   • the merged CONTENT the reviewers signed must be the commission's SCOPED artifact
//     — a merge over content X while the commission authorized Y is REFUSED (binding a);
//   • the BUILDER performing the merge must be the VERIFIED commission assignee — an
//     unrelated actor, and a builder ALIASING via a second identity, are both REFUSED
//     (binding b, the second caught on the quorum's key-thumbprint anchor);
//   • an INVALID commission (forged / off-scope / delegate-less) is refused BEFORE the
//     merge quorum ever runs (fail-closed, "refused before the merge");
//   • a merge WITHOUT a trustedStewards allowlist THROWS (inherited fail-closed);
//   • a self-merge (the builder as the sole reviewer) is refused (below the ≥2 floor);
//   • the lifecycle makes `commissioned`/`merged` UNREACHABLE without the bindings, every
//     illegal transition throws, and a serialize→parse→fold round-trip recomputes the
//     authoritative state (a spoofed cached state triple is ignored — INV-3).

import {
  FEDTRUST_DELEGATE,
  FEDTRUST_DELEGATION_CREDENTIAL,
  FEDTRUST_FEDERATION,
} from "@jeswr/federation-trust";
import {
  digestQuads,
  generateKeyPairForSuite,
  issue,
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import { beforeAll, describe, expect, it } from "vitest";
import { BuildLifecycle, type MergedArtifact, verifyBuildMerge } from "./build-wiring.js";
import {
  buildCommissionEventQuads,
  buildCommissionStateQuads,
  CommissionTransitionError,
  foldCommissionState,
  issueCommission,
  parseCommissionEvents,
  readCommissionState,
} from "./commission.js";
import { NS } from "./fut.js";

const { namedNode, literal, quad } = DataFactory;

const COMMISSIONER = "https://alice.example/profile/card#me";
const MALLORY = "https://mallory.example/profile/card#me"; // an untrusted signer
const ASSIGNEE = "https://bob.example/agent#me"; // the delegated builder/agent
const ASSIGNEE_ALIAS = "https://bob.example/agent"; // same key, fragment-truncated alias
const CAROL = "https://carol.example/profile/card#me"; // reviewer steward
const DAVE = "https://dave.example/profile/card#me"; // reviewer steward
const EVE = "https://eve.example/agent#me"; // a party who was NOT delegated

const ARTIFACT = "https://d.example/synthesis/spec-1#it"; // the commissioned artifact (Y)
const OTHER_ARTIFACT = "https://d.example/synthesis/spec-2#it"; // a DIFFERENT artifact (Z)
const THREAD = "https://bob.example/build/threads/t1.ttl#it";

const TRUSTED_COMMISSIONERS = [COMMISSIONER];
const TRUSTED_REVIEWERS = [CAROL, DAVE];

/** The content graph FOR a given artifact IRI (the graph the reviewers digest). */
function graphFor(iri: string): Quad[] {
  return [quad(namedNode(iri), namedNode(`${NS.dct}title`), literal(`the built artifact ${iri}`))];
}
function artifactFor(iri: string): MergedArtifact {
  return { iri, quads: graphFor(iri) };
}

// ── Real crypto (the adoption-decision / quorum / commission harness) ─────────
let keyCommissioner: KeyPair;
let keyMallory: KeyPair;
let keyAssignee: KeyPair;
let keyCarol: KeyPair;
let keyDave: KeyPair;
let realResolveKey: (vm: string) => Promise<CryptoKey | undefined>;
const realVerify = (vc: VerifiableCredential): Promise<VerificationResult> =>
  verifyCredential(vc, { resolveKey: realResolveKey });

beforeAll(async () => {
  keyCommissioner = await generateKeyPairForSuite(`${COMMISSIONER}#key`, "Ed25519");
  keyMallory = await generateKeyPairForSuite(`${MALLORY}#key`, "Ed25519");
  keyAssignee = await generateKeyPairForSuite(`${ASSIGNEE}#key`, "Ed25519");
  keyCarol = await generateKeyPairForSuite(`${CAROL}#key`, "Ed25519");
  keyDave = await generateKeyPairForSuite(`${DAVE}#key`, "Ed25519");
  const keys = new Map<string, CryptoKey>(
    [keyCommissioner, keyMallory, keyAssignee, keyCarol, keyDave].map((k) => [
      k.verificationMethod,
      k.publicKey,
    ]),
  );
  realResolveKey = async (vm) => keys.get(vm);
});

/** A signed commission binding commissioner → assignee → artifact scope. */
function commissionVc(
  artifact = ARTIFACT,
  commissioner = COMMISSIONER,
  key = keyCommissioner,
  assignee = ASSIGNEE,
  assigneeKey = keyAssignee,
): Promise<VerifiableCredential> {
  return issueCommission({
    commissioner,
    assignee,
    assigneeKey: assigneeKey.publicKey,
    artifact,
    key,
  });
}

/** A reviewer's independent attestation binding the RDFC-1.0 digest of `quads`. The
 *  claimed `issuer` may differ from the signing `key` (to exercise the alias defense). */
async function reviewerAttestation(
  issuer: string,
  key: KeyPair,
  quads: readonly Quad[],
): Promise<VerifiableCredential> {
  const digest = await digestQuads(quads);
  return issue({
    credential: {
      issuer,
      credentialSubject: { id: ARTIFACT },
      relatedResource: [
        { id: ARTIFACT, digestMultibase: digest, mediaType: "application/n-quads" },
      ],
    },
    key,
  });
}

const buildOpts = (over: Record<string, unknown> = {}) => ({
  verifyVc: realVerify,
  resolveKey: realResolveKey,
  trustedCommissioners: TRUSTED_COMMISSIONERS,
  trustedStewards: TRUSTED_REVIEWERS,
  builder: ASSIGNEE,
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════════
// verifyBuildMerge — the two bindings + the quorum
// ═══════════════════════════════════════════════════════════════════════════════
describe("verifyBuildMerge — binds artifact + builder, then the ≥2-steward quorum", () => {
  it("HAPPY PATH: valid commission + right artifact + right builder + a ≥2 quorum → allowed", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts());
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.commission.verified).toBe(true);
    expect(result.builder).toBe(ASSIGNEE);
    expect(result.artifact).toBe(ARTIFACT);
    expect(result.contentDigest).toBe(await digestQuads(merged.quads));
    expect(result.merge?.allowed).toBe(true);
    expect(result.merge?.attestation.distinctStewards).toBe(2);
  });

  it("BINDING (a): a merge whose commission SCOPED a DIFFERENT artifact is refused (commission-invalid)", async () => {
    // The commission authorized Z; the merge is declared for Y → verifyCommission
    // (scope pinned to Y) fails scope-mismatch → refused before the quorum runs.
    const vc = await commissionVc(OTHER_ARTIFACT); // scoped Z
    const merged = artifactFor(ARTIFACT); // merging Y
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts());
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["commission-invalid"]);
    expect(result.commission.reasons).toContain("scope-mismatch");
    expect(result.merge).toBeUndefined(); // refused BEFORE the merge (fail-closed)
  });

  it("BINDING (a): a quorum over CONTENT ABOUT A DIFFERENT SUBJECT is refused (artifact-mismatch)", async () => {
    // The commission scoped Y and the merge is DECLARED for Y, but the signed content
    // graph describes Z — the reviewers rubber-stamped the wrong thing. The quorum itself
    // PASSES (they signed that graph), so only the content-identity binding catches it.
    const vc = await commissionVc(ARTIFACT); // scoped Y
    const zGraph = graphFor(OTHER_ARTIFACT); // content ABOUT Z
    const merged: MergedArtifact = { iri: ARTIFACT, quads: zGraph }; // declares Y, describes Z
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, zGraph),
      await reviewerAttestation(DAVE, keyDave, zGraph),
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts());
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["artifact-mismatch"]);
    expect(result.merge?.allowed).toBe(true); // the quorum passed — only the binding refused
  });

  it("BINDING (b): a builder who is NOT the verified assignee is refused (builder-mismatch)", async () => {
    const vc = await commissionVc(); // delegate = ASSIGNEE (Bob)
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts({ builder: EVE }));
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["builder-mismatch"]);
    expect(result.builder).toBe(ASSIGNEE); // the guard is anchored on the VERIFIED assignee
  });

  it("BINDING (b): a builder ALIASING via a second WebID on the SAME key is caught on the key-thumbprint", async () => {
    // Bob (the builder) tries to manufacture a ≥2 quorum from himself: two reviewer VCs,
    // DIFFERENT claimed issuers (…/agent#me and …/agent), BOTH signed by Bob's ONE key.
    // The quorum dedupes on the RFC-7638 key thumbprint → 1 distinct steward → not met.
    // Both alias forms are ALLOWLISTED so ONLY the key-thumbprint anchor can catch it.
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(ASSIGNEE, keyAssignee, merged.quads),
      await reviewerAttestation(ASSIGNEE_ALIAS, keyAssignee, merged.quads), // same key, alias id
    ];
    const result = await verifyBuildMerge(
      vc,
      merged,
      reviewers,
      buildOpts({ trustedStewards: [ASSIGNEE, ASSIGNEE_ALIAS] }),
    );
    expect(result.merge?.attestation.distinctStewards).toBe(1); // collapsed on the key
    expect(result.reasons).toContain("quorum-failed");
    expect(result.allowed).toBe(false);
  });

  it("a FORGED (post-sign-tampered) commission is refused before the merge (commission-invalid)", async () => {
    const vc = await commissionVc();
    const forged = {
      ...vc,
      credentialSubject: { ...vc.credentialSubject, [`${NS.fut}tamper`]: "x" },
    } as VerifiableCredential;
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(forged, merged, reviewers, buildOpts());
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["commission-invalid"]);
    expect(result.commission.reasons).toContain("unverified");
    expect(result.merge).toBeUndefined();
  });

  it("a commission by an UNTRUSTED commissioner is refused before the merge (commission-invalid)", async () => {
    const vc = await commissionVc(ARTIFACT, MALLORY, keyMallory); // validly signed, off-allowlist
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts());
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["commission-invalid"]);
    expect(result.commission.reasons).toContain("untrusted-commissioner");
  });

  it("a SELF-MERGE (the builder as the sole reviewer) is refused (below the ≥2 floor)", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [await reviewerAttestation(ASSIGNEE, keyAssignee, merged.quads)];
    const result = await verifyBuildMerge(
      vc,
      merged,
      reviewers,
      buildOpts({ trustedStewards: [ASSIGNEE, CAROL] }),
    );
    expect(result.merge?.attestation.met).toBe(false);
    expect(result.reasons).toContain("quorum-failed");
    expect(result.allowed).toBe(false);
  });

  it("THROWS fail-closed when NO trustedStewards allowlist is supplied (merge never runs unprotected)", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    for (const bad of [[], ["  "], undefined]) {
      await expect(
        verifyBuildMerge(vc, merged, reviewers, buildOpts({ trustedStewards: bad })),
      ).rejects.toThrow(/trustedStewards/);
    }
  });

  it("THROWS fail-closed when NO trustedCommissioners allowlist is supplied", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    await expect(
      verifyBuildMerge(vc, merged, [], buildOpts({ trustedCommissioners: [] })),
    ).rejects.toThrow(/trustedCommissioners/);
  });

  it("THROWS on a non-http(s) mergedArtifact.iri (configuration error)", async () => {
    const vc = await commissionVc();
    await expect(
      verifyBuildMerge(vc, { iri: "urn:not-http", quads: [] }, [], buildOpts()),
    ).rejects.toThrow(/mergedArtifact\.iri/);
  });

  it("collects EVERY applicable reason — a security surface never collapses failures", async () => {
    // Commission is VALID (scoped Y). But: content describes Z (artifact-mismatch), the
    // builder is Eve (builder-mismatch), and only one reviewer signs (quorum-failed).
    const vc = await commissionVc(ARTIFACT);
    const zGraph = graphFor(OTHER_ARTIFACT);
    const merged: MergedArtifact = { iri: ARTIFACT, quads: zGraph };
    const reviewers = [await reviewerAttestation(CAROL, keyCarol, zGraph)];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts({ builder: EVE }));
    expect(result.allowed).toBe(false);
    expect([...result.reasons].sort()).toEqual(
      ["artifact-mismatch", "builder-mismatch", "quorum-failed"].sort(),
    );
  });

  it("a reviewer signing a DIFFERENT digest than the merged content does not count (quorum-failed)", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, graphFor(OTHER_ARTIFACT)), // signs OTHER content
    ];
    const result = await verifyBuildMerge(vc, merged, reviewers, buildOpts());
    expect(result.merge?.attestation.distinctStewards).toBe(1);
    expect(result.reasons).toContain("quorum-failed");
    expect(result.allowed).toBe(false);
  });

  it("BINDING (b): a non-http(s) builder string is refused (builder-mismatch), never coerced", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(
      vc,
      merged,
      reviewers,
      buildOpts({ builder: "not-a-webid" }),
    );
    expect(result.reasons).toContain("builder-mismatch");
    expect(result.allowed).toBe(false);
  });

  it("BINDING (b): a whitespace-padded near-match builder is refused (byte-for-byte, no trim)", async () => {
    const vc = await commissionVc(); // assignee = ASSIGNEE
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(
      vc,
      merged,
      reviewers,
      buildOpts({ builder: ` ${ASSIGNEE} ` }),
    );
    expect(result.reasons).toContain("builder-mismatch");
    expect(result.allowed).toBe(false);
  });

  it("a NON-CLONEABLE commission object RESOLVES to a result, never throws (guarded clone)", async () => {
    const vc = await commissionVc();
    // A function property makes structuredClone throw; the guarded clone must NOT turn that
    // into an input-triggered exception — verifyBuildMerge returns a normal result object
    // (an unguarded structuredClone would have rejected the promise with DataCloneError).
    const nonCloneable = { ...vc, tamper: () => "x" } as unknown as VerifiableCredential;
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(nonCloneable, merged, reviewers, buildOpts());
    expect(typeof result.allowed).toBe("boolean"); // returned a result — did NOT throw
  });

  it("a VALID+MALFORMED graph denies the WHOLE merge — no partial-graph approval, never throws", async () => {
    const vc = await commissionVc();
    const validQuad = graphFor(ARTIFACT)[0] as Quad;
    // Reviewers legitimately sign the digest of the VALID subset only.
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, [validQuad]),
      await reviewerAttestation(DAVE, keyDave, [validQuad]),
    ];
    // The PRESENTED graph = the reviewed valid quad + a malformed quad. The snapshot must fail
    // as a WHOLE (not sanitize down to the reviewed subset), so the merge is DENIED — otherwise
    // unreviewed malformed content would ride along on the reviewers' subset signature.
    const hostile = [
      validQuad,
      { subject: null, predicate: null, object: null, graph: null },
    ] as unknown as Quad[];
    const result = await verifyBuildMerge(
      vc,
      { iri: ARTIFACT, quads: hostile },
      reviewers,
      buildOpts(),
    );
    expect(typeof result.allowed).toBe("boolean"); // resolved, not thrown
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("artifact-mismatch");
  });

  it("SNAPSHOTS mutable inputs — a mutation DURING async verification cannot change the checked data (TOCTOU)", async () => {
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    // A hostile verify seam that MUTATES the caller's inputs mid-verification (simulating a
    // concurrent mutation racing the await): it appends a foreign quad and tries to swap the
    // declared artifact IRI. Because verifyBuildMerge snapshotted all inputs synchronously
    // before the first await, the digest + bindings still run over the ORIGINAL data.
    const mutatingVerify = (v: VerifiableCredential) => {
      (merged.quads as Quad[]).push(
        quad(namedNode(OTHER_ARTIFACT), namedNode(`${NS.dct}x`), literal("injected")),
      );
      (merged as { iri: string }).iri = OTHER_ARTIFACT;
      return realVerify(v);
    };
    const result = await verifyBuildMerge(
      vc,
      merged,
      reviewers,
      buildOpts({ verifyVc: mutatingVerify }),
    );
    expect(result.allowed).toBe(true); // the snapshot isolated the concurrent mutation
  });

  it("a verified commission whose DELEGATE is not an http(s) WebID is refused (commission-invalid)", async () => {
    // A validly-signed, trusted-issuer, correctly-scoped delegation whose `fedtrust:delegate`
    // is a NON-http string. verifyCommission accepts it (the claim is present), but the merge
    // gate refuses — a malformed assignee can never bind a real builder.
    const badDelegate = await issue({
      credential: {
        issuer: COMMISSIONER,
        type: [FEDTRUST_DELEGATION_CREDENTIAL],
        credentialSubject: {
          id: ARTIFACT,
          [FEDTRUST_FEDERATION]: ARTIFACT,
          [FEDTRUST_DELEGATE]: "not-a-webid", // malformed delegate
        },
      },
      key: keyCommissioner,
    });
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    const result = await verifyBuildMerge(
      badDelegate,
      merged,
      reviewers,
      buildOpts({ builder: "not-a-webid" }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["commission-invalid"]);
    expect(result.merge).toBeUndefined(); // refused before the merge
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BuildLifecycle — commissioned/merged unreachable without the bindings
// ═══════════════════════════════════════════════════════════════════════════════
describe("BuildLifecycle — drives the state machine through the verified gates", () => {
  const config = () => ({
    verifyVc: realVerify,
    resolveKey: realResolveKey,
    trustedCommissioners: TRUSTED_COMMISSIONERS,
    trustedStewards: TRUSTED_REVIEWERS,
    thread: THREAD,
  });

  // A monotonic clock so a step's DEFAULT `at` is always strictly after the previous —
  // the lifecycle enforces strictly-increasing (dct:created, id) so the persisted log folds
  // back to the live state. Tests that pin ordering pass an explicit `at`.
  const BASE = Date.parse("2026-07-05T10:00:00Z");
  let clock = 0;
  const nextAt = () => {
    clock += 1;
    return new Date(BASE + clock * 60_000).toISOString();
  };

  const meta = (id: string, actor = ASSIGNEE, at = nextAt(), evidence?: string) => ({
    id,
    actor,
    at,
    ...(evidence !== undefined ? { evidence } : {}),
  });

  // The commission step supplies NO actor (its provenance is bound to the verified
  // commissioner) — just id / timestamp / artifact scope (+ optional evidence).
  const cmeta = (id: string, at = nextAt(), evidence?: string) => ({
    id,
    at,
    artifact: ARTIFACT,
    ...(evidence !== undefined ? { evidence } : {}),
  });

  it("drives drafted → merged END-TO-END with real crypto, then serialize→parse→fold recomputes `merged`", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];

    expect(lc.state).toBe("drafted");
    await lc.commission(
      vc,
      cmeta(
        "https://bob.example/build/events/c#it",
        "2026-07-05T10:00:00Z",
        "https://bob.example/build/creds/c1#it",
      ),
    );
    expect(lc.state).toBe("commissioned");
    expect(lc.assignee).toBe(ASSIGNEE);
    expect(lc.artifact).toBe(ARTIFACT);
    // The commission event's dct:creator is bound to the VERIFIED commissioner (the signer),
    // NOT a caller-supplied actor — no forged commission provenance.
    expect(lc.events.find((e) => e.type === "commission")?.actor).toBe(COMMISSIONER);

    lc.start(meta("https://bob.example/build/events/s#it", ASSIGNEE, "2026-07-05T10:05:00Z"));
    lc.openPr(meta("https://bob.example/build/events/p#it", ASSIGNEE, "2026-07-05T10:10:00Z"));
    lc.requestReview(meta("https://bob.example/build/events/r#it", CAROL, "2026-07-05T10:15:00Z"));
    expect(lc.state).toBe("in-review");

    await lc.merge(
      merged,
      reviewers,
      meta("https://bob.example/build/events/m#it", ASSIGNEE, "2026-07-05T10:20:00Z"),
    );
    expect(lc.state).toBe("merged");
    expect(lc.lastMerge?.allowed).toBe(true);

    // Persist → re-read (guarded) → fold: the authoritative state recomputes to `merged`.
    const turtle = await lc.serialize();
    expect(turtle).toContain("unite:");
    const store = new Store(lc.toQuads());
    const events = parseCommissionEvents(store, { thread: THREAD });
    expect(events).toHaveLength(5);
    const fold = foldCommissionState(events, {
      verifiedCommissions: new Set([events.find((e) => e.type === "commission")?.id ?? ""]),
      approvedMerges: new Set([events.find((e) => e.type === "merge")?.id ?? ""]),
    });
    expect(fold.state).toBe("merged");
    // The cached state triple is a HINT; the fold is authoritative (INV-3).
    expect(readCommissionState(store, THREAD)).toBe("merged");
  });

  it("`commissioned` is UNREACHABLE with an invalid commission — transition throws, state stays drafted", async () => {
    const lc = new BuildLifecycle(config());
    const forged = await commissionVc(ARTIFACT, MALLORY, keyMallory); // untrusted commissioner
    await expect(
      lc.commission(forged, cmeta("https://bob.example/build/events/c#it")),
    ).rejects.toThrow(CommissionTransitionError);
    expect(lc.state).toBe("drafted"); // fail-closed — never advanced
    expect(lc.lastCommission?.verified).toBe(false); // …but the reason is surfaced
    expect(lc.lastCommission?.reasons).toContain("untrusted-commissioner");
    expect(lc.events).toHaveLength(0);
  });

  it("`merged` is UNREACHABLE when a binding fails — merge throws, state stays in-review", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    const merged = artifactFor(ARTIFACT);
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it"));
    lc.start(meta("https://bob.example/build/events/s#it"));
    lc.openPr(meta("https://bob.example/build/events/p#it"));
    lc.requestReview(meta("https://bob.example/build/events/r#it", CAROL));
    expect(lc.state).toBe("in-review");

    // The merge actor EVE is not the verified assignee → binding (b) fails → refused.
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    await expect(
      lc.merge(merged, reviewers, meta("https://bob.example/build/events/m#it", EVE)),
    ).rejects.toThrow(CommissionTransitionError);
    expect(lc.state).toBe("in-review"); // fail-closed — never merged
    expect(lc.lastMerge?.reasons).toContain("builder-mismatch");
  });

  it("merge() from an ILLEGAL state throws WITHOUT running the crypto or setting lastMerge", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it"));
    expect(lc.state).toBe("commissioned"); // NOT in-review — a merge here is an illegal edge
    const merged = artifactFor(ARTIFACT);
    await expect(
      lc.merge(merged, [], meta("https://bob.example/build/events/m#it", ASSIGNEE)),
    ).rejects.toThrow(CommissionTransitionError);
    expect(lc.state).toBe("commissioned"); // unchanged
    expect(lc.lastMerge).toBeUndefined(); // crypto never ran — no misleading result
  });

  it("every ILLEGAL transition throws — the state machine is the grammar", () => {
    const lc = new BuildLifecycle(config());
    // From `drafted`, only `commission` is legal — `start`/`open-pr`/`request-review` throw.
    expect(() => lc.start(meta("https://bob.example/e#it"))).toThrow(CommissionTransitionError);
    expect(() => lc.openPr(meta("https://bob.example/e#it"))).toThrow(CommissionTransitionError);
    expect(() => lc.requestReview(meta("https://bob.example/e#it"))).toThrow(
      CommissionTransitionError,
    );
    expect(lc.state).toBe("drafted");
    expect(lc.events).toHaveLength(0);
  });

  it("a spoofed cached state triple is IGNORED — the fold recomputes from the events (INV-3)", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it"));
    lc.start(meta("https://bob.example/build/events/s#it"));
    expect(lc.state).toBe("in-progress");

    // A hostile pod publishes the REAL coded `unite:commissionState → Merged` decree
    // (the exact predicate/value readCommissionState reads) alongside the events — the
    // fold ignores the hint and recomputes from the events (INV-3).
    const spoof = new Store([
      ...lc.events.flatMap((e) => buildCommissionEventQuads(e)),
      ...buildCommissionStateQuads(THREAD, "merged"),
    ]);
    expect(readCommissionState(spoof, THREAD)).toBe("merged"); // the (untrusted) hint
    const events = parseCommissionEvents(spoof, { thread: THREAD });
    const fold = foldCommissionState(events, {
      verifiedCommissions: new Set([events.find((e) => e.type === "commission")?.id ?? ""]),
    });
    expect(fold.state).toBe("in-progress"); // the AUTHORITATIVE recomputed state
  });

  it("the `events` getter is a DEFENSIVE COPY — mutating it cannot inject a bypassed event", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it"));
    lc.start(meta("https://bob.example/build/events/s#it"));
    const before = lc.toQuads().length;

    // (a) the returned array is a copy — pushing to it does not grow the internal log.
    const leaked = lc.events as unknown as unknown[];
    leaked.push({
      id: "https://evil.example/e#it",
      type: "merge",
      thread: THREAD,
      actor: EVE,
      at: "2026-07-05T10:00:00Z",
    });
    expect(lc.events).toHaveLength(2);
    expect(lc.toQuads()).toHaveLength(before);

    // (b) the returned event objects are FROZEN — a caller cannot mutate persisted provenance.
    const ev = lc.events[0] as { actor: string };
    expect(() => {
      ev.actor = EVE;
    }).toThrow(TypeError); // strict-mode frozen-object write throws
    expect(lc.events[0]?.actor).toBe(COMMISSIONER); // unchanged
  });

  it("REFUSES to record an event with a non-http(s) IRI / bad timestamp (never write what won't parse)", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it"));
    // A hostile step id / timestamp is rejected at record time (guarded builder throws).
    expect(() =>
      lc.start({ id: "urn:not-http", actor: ASSIGNEE, at: "2026-07-05T10:05:00Z" }),
    ).toThrow(/thread|IRI|id/);
    expect(() =>
      lc.start({ id: "https://bob.example/e#it", actor: ASSIGNEE, at: "not-a-date" }),
    ).toThrow(/xsd:dateTime/);
    expect(lc.state).toBe("commissioned"); // unchanged — the bad step never applied
  });

  it("REFUSES a step recorded OUT OF (dct:created, id) ORDER — the fold must recompute the live state", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it", "2026-07-05T10:05:00Z"));
    // A start stamped BEFORE the commission would fold before it (illegal replay) → the live
    // in-progress state would NOT recompute. Refused fail-closed at record time.
    expect(() =>
      lc.start(meta("https://bob.example/build/events/s#it", ASSIGNEE, "2026-07-05T10:00:00Z")),
    ).toThrow(/order/);
    expect(lc.state).toBe("commissioned"); // unchanged — the out-of-order step never applied
  });

  it("REFUSES a REUSED event IRI — a duplicate subject would break the serialize→parse round-trip", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc();
    const dupId = "https://bob.example/build/events/c#it";
    await lc.commission(vc, cmeta(dupId, "2026-07-05T10:00:00Z"));
    // A later step reusing the commission's IRI passes the (at, id) order check (later time)
    // but would collide on the RDF subject → refused fail-closed at record time.
    expect(() => lc.start(meta(dupId, ASSIGNEE, "2026-07-05T10:05:00Z"))).toThrow(/duplicate/);
    expect(lc.state).toBe("commissioned"); // unchanged
    expect(lc.events).toHaveLength(1);
  });

  it("the stored commission VC is an immutable SNAPSHOT — mutating the caller's VC after commission() cannot swap the merge gate", async () => {
    const lc = new BuildLifecycle(config());
    const vc = await commissionVc(); // delegate Bob, scoped ARTIFACT
    const merged = artifactFor(ARTIFACT);
    await lc.commission(vc, cmeta("https://bob.example/build/events/c#it", "2026-07-05T10:00:00Z"));

    // The caller TAMPERS their VC object after commissioning (rewrites the signed scope).
    (vc as unknown as { credentialSubject: Record<string, unknown> }).credentialSubject = {
      id: OTHER_ARTIFACT,
    };

    lc.start(meta("https://bob.example/build/events/s#it", ASSIGNEE, "2026-07-05T10:05:00Z"));
    lc.openPr(meta("https://bob.example/build/events/p#it", ASSIGNEE, "2026-07-05T10:10:00Z"));
    lc.requestReview(meta("https://bob.example/build/events/r#it", CAROL, "2026-07-05T10:15:00Z"));
    const reviewers = [
      await reviewerAttestation(CAROL, keyCarol, merged.quads),
      await reviewerAttestation(DAVE, keyDave, merged.quads),
    ];
    // The merge re-verifies the untampered SNAPSHOT (not the caller's mutated object) → the
    // original valid commission still authorizes the merge.
    await lc.merge(
      merged,
      reviewers,
      meta("https://bob.example/build/events/m#it", ASSIGNEE, "2026-07-05T10:20:00Z"),
    );
    expect(lc.state).toBe("merged");
    expect(lc.lastMerge?.allowed).toBe(true);
  });

  it("SNAPSHOTS the config — mutating the caller's allowlist after construction cannot widen trust", async () => {
    // A fresh allowlist array (never the shared const) so mutating it can't leak across tests.
    const mutableCfg = { ...config(), trustedCommissioners: [COMMISSIONER] };
    const lc = new BuildLifecycle(mutableCfg);
    // The caller WIDENS their allowlist array AFTER construction to include Mallory.
    (mutableCfg.trustedCommissioners as string[]).push(MALLORY);
    // The lifecycle snapshotted the original [COMMISSIONER], so Mallory is still untrusted.
    const forged = await commissionVc(ARTIFACT, MALLORY, keyMallory);
    await expect(
      lc.commission(forged, cmeta("https://bob.example/build/events/c#it")),
    ).rejects.toThrow(CommissionTransitionError);
    expect(lc.lastCommission?.reasons).toContain("untrusted-commissioner");
    expect(lc.state).toBe("drafted");
  });

  it("THROWS on a non-http(s) thread IRI at construction (configuration error)", () => {
    expect(() => new BuildLifecycle({ ...config(), thread: "urn:x" })).toThrow(/thread/);
  });
});
