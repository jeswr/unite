// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.4 — the steward-signing glue between the Room and the LANDED signing lib.
// The load-bearing assertions: the glue INVOKES lib/shared-future's throwing
// gate (it does not re-implement or route around it) — a dissent-dropping,
// sub-k, evidence-less or allowlist-less sign REFUSES with the lib's message
// and yields NO artifact; a valid sign runs REAL crypto end-to-end (solid-vc
// issue + the full verifySharedFuture path) and yields the honest ≥2-quorum
// progress (1-of-2 unmet + bootstrapping; 2-of-2 met + ratified; a duplicate
// steward never double-counts).

import {
  generateKeyPairForSuite,
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import { beforeAll, describe, expect, it } from "vitest";
import type { AggregateResult } from "../lib/aggregate.js";
import type { CandidateReception } from "../lib/convergence.js";
import { STANCE_RESONATES } from "../lib/fut.js";
import type { Critique, Resonance, SynthesisCandidate } from "../lib/model.js";
import {
  bridgingEvidenceFor,
  contributorCountFor,
  type SignRoomCandidateArgs,
  type StewardSigningContext,
  sharedFutureIriFor,
  signRoomCandidate,
} from "./sign-future.js";

const DELIB = "https://demo.unite.example/deliberations/society";
const NEED_A = "https://a.example/needs/a.ttl#it";
const NEED_B = "https://b.example/needs/b.ttl#it";
const CAND = "https://h.example/syntheses/s1.ttl#it";
const CRIT_1 = "https://p3.example/critiques/c1.ttl#it";
const CRIT_2 = "https://p4.example/critiques/c2.ttl#it";

const STEWARD_A = "https://hana.example/profile/card#me";
const STEWARD_B = "https://farah.example/profile/card#me";

let keyA: KeyPair;
let keyB: KeyPair;
let resolveKey: (vm: string) => CryptoKey | undefined;
let verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;

beforeAll(async () => {
  keyA = await generateKeyPairForSuite(`${STEWARD_A}#key`, "Ed25519");
  keyB = await generateKeyPairForSuite(`${STEWARD_B}#key`, "Ed25519");
  const keys = new Map<string, CryptoKey>([
    [keyA.verificationMethod, keyA.publicKey],
    [keyB.verificationMethod, keyB.publicKey],
  ]);
  resolveKey = (vm) => keys.get(vm);
  verifyVc = (vc) => verifyCredential(vc, { resolveKey });
});

/** A signing context for one of the two stewards (or a keyless session). */
function contextFor(
  session: "A" | "B" | null,
  trustedStewards: readonly string[] = [STEWARD_A, STEWARD_B],
): StewardSigningContext {
  return {
    steward:
      session === "A"
        ? { webId: STEWARD_A, key: keyA }
        : session === "B"
          ? { webId: STEWARD_B, key: keyB }
          : null,
    trustedStewards,
    resolveKey,
    verifyVc,
  };
}

const candidate: SynthesisCandidate = {
  id: CAND,
  title: "The spine",
  content: "One text carrying both groups.",
  derivedFrom: [NEED_A, NEED_B],
  created: "2026-07-01T00:00:00Z",
  creator: "https://p1.example/#me",
  inDeliberation: DELIB,
};

const critique = (id: string, creator: string): Critique => ({
  id,
  content: `A standing concern from ${creator}`,
  onStatement: CAND,
  created: "2026-07-02T00:00:00Z",
  creator,
  inDeliberation: DELIB,
});

const endorsed: CandidateReception = {
  candidate: CAND,
  outcome: "endorsed",
  perCluster: [
    { resonates: 3, conflicts: 0, unsure: 0, seen: 3, size: 3 },
    { resonates: 2, conflicts: 1, unsure: 0, seen: 3, size: 3 },
  ],
  score: 0.8,
  totalSeen: 6,
  clusterCount: 2,
};

/** A signable baseline: endorsed, 1 standing critique, 6 contributors. */
function args(overrides: Partial<SignRoomCandidateArgs> = {}): SignRoomCandidateArgs {
  const crit = critique(CRIT_1, "https://p3.example/#me");
  return {
    candidate,
    reception: endorsed,
    reviewedCritiques: [crit],
    standingCritiqueIds: new Set([CRIT_1]),
    synthesizable: new Set([NEED_A, NEED_B]),
    contributorCount: 6,
    deliberation: DELIB,
    context: contextFor("A"),
    now: () => "2026-07-05T00:00:00Z",
    ...overrides,
  };
}

describe("the pure mappers", () => {
  it("contributorCountFor counts DISTINCT contributors: author + lineage authors + voters + critics", () => {
    const p = (n: number) => `https://p${n}.example/#me`;
    let seq = 0;
    const vote = (creator: string, on: string): Resonance => ({
      id: `https://r.example/${++seq}`,
      onStatement: on,
      stance: STANCE_RESONATES,
      created: "2026-07-01T00:00:00Z",
      creator,
      inDeliberation: DELIB,
    });
    const result = {
      deliberation: DELIB,
      needs: [
        { id: NEED_A, content: "A", created: "", creator: p(2), inDeliberation: DELIB },
        { id: NEED_B, content: "B", created: "", creator: p(3), inDeliberation: DELIB },
      ],
      resonances: [vote(p(1), CAND), vote(p(4), CAND), vote(p(4), NEED_A), vote(p(2), CAND)],
      proposals: [],
      infraProposals: [],
      candidates: [candidate],
      critiques: [],
      visions: [],
      claims: [],
      values: [],
      synthesizable: new Set([NEED_A, NEED_B]),
      verified: [],
      unverified: [],
      errors: [],
    } as unknown as AggregateResult;
    // p1 (candidate author + voter), p2 (need author + voter), p3 (need author),
    // p4 (voter), p5 (critic) — 5 distinct; a NEED_A vote does not count twice.
    expect(contributorCountFor(result, candidate, [critique(CRIT_1, p(5))])).toBe(5);
  });

  it("bridgingEvidenceFor maps every cluster's counts 1:1 (the recomputable proof)", () => {
    const evidence = bridgingEvidenceFor(endorsed);
    expect(evidence).toEqual([
      {
        clusterLabel: "Group A",
        resonatesCount: 3,
        conflictsCount: 0,
        unsureCount: 0,
        seenCount: 3,
      },
      {
        clusterLabel: "Group B",
        resonatesCount: 2,
        conflictsCount: 1,
        unsureCount: 0,
        seenCount: 3,
      },
    ]);
  });

  it("sharedFutureIriFor is deterministic and fragment-safe", () => {
    expect(sharedFutureIriFor("https://h.example/syntheses/s1.ttl#it")).toBe(
      "https://h.example/syntheses/s1.ttl#shared-future",
    );
    expect(sharedFutureIriFor("https://h.example/syntheses/s1.ttl")).toBe(
      "https://h.example/syntheses/s1.ttl#shared-future",
    );
  });
});

describe("signRoomCandidate — the happy paths (real crypto end-to-end)", () => {
  it("one steward signs: an honest 1-of-≥2 (quorum unmet, bootstrapping, not ratified)", async () => {
    const signed = await signRoomCandidate(args());
    expect(signed.id).toBe(sharedFutureIriFor(CAND));
    expect(signed.vcs).toHaveLength(1);
    expect(signed.view.distinctStewards).toBe(1);
    expect(signed.view.stewardFloor).toBe(2);
    expect(signed.view.quorumMet).toBe(false);
    expect(signed.view.bootstrapping).toBe(true); // 1 valid steward < the ≥2 floor
    expect(signed.verification.ratified).toBe(false);
    expect(signed.view.kind).toBe("shared-future");
    // The annex is carried fail-closed in aggregate (no quoteVerbatim consent surfaced).
    expect(signed.view.dissent).toHaveLength(1);
    expect(signed.view.dissent[0]?.verbatim).toBe(false);
    expect(signed.view.noDissentRecorded).toBe(false);
  });

  it("a second DISTINCT steward completes the quorum: 2 of ≥2, met + ratified + D2-complete", async () => {
    const first = await signRoomCandidate(args({ context: contextFor("A") }));
    const second = await signRoomCandidate(args({ context: contextFor("B"), prior: first }));
    expect(second.vcs).toHaveLength(2);
    expect(second.view.distinctStewards).toBe(2);
    expect(second.view.quorumMet).toBe(true);
    expect(second.view.bootstrapping).toBe(false);
    expect(second.verification.ratified).toBe(true);
    expect(second.verification.dissentComplete).toBe(true);
    expect(second.verification.lineageConsented).toBe(true);
  });

  it("the SAME steward signing twice never double-counts (one steward, one vote)", async () => {
    const first = await signRoomCandidate(args());
    const again = await signRoomCandidate(args({ prior: first }));
    expect(again.vcs).toHaveLength(2); // two credentials presented…
    expect(again.view.distinctStewards).toBe(1); // …ONE distinct steward counted
    expect(again.view.quorumMet).toBe(false);
    expect(again.verification.quorum.rejected.some((r) => r.reason === "duplicate-steward")).toBe(
      true,
    );
  });

  it("NO standing critiques ⇒ the EXPLICIT fut:noDissentRecorded assertion (silence ≠ consensus)", async () => {
    const signed = await signRoomCandidate(
      args({ reviewedCritiques: [], standingCritiqueIds: new Set() }),
    );
    expect(signed.view.noDissentRecorded).toBe(true);
    expect(signed.view.dissent).toHaveLength(0);
  });

  it("a DISAGREEMENT map is a co-equal signable outcome (kind computed, never asserted)", async () => {
    const signed = await signRoomCandidate(
      args({ reception: { ...endorsed, outcome: "disagreement" } }),
    );
    expect(signed.view.kind).toBe("disagreement-map");
    expect(signed.view.distinctStewards).toBe(1);
  });

  it("the scope may RAISE the floor, never lower it (a floor of 3 needs 3)", async () => {
    const first = await signRoomCandidate(args({ stewardFloor: 3 }));
    expect(first.view.stewardFloor).toBe(3);
    const second = await signRoomCandidate(
      args({ stewardFloor: 3, context: contextFor("B"), prior: first }),
    );
    expect(second.view.distinctStewards).toBe(2);
    expect(second.view.quorumMet).toBe(false); // 2 < the raised bar of 3
    // …and a floor "lowered" to 1 clamps back UP to the ≥2 floor.
    const lowered = await signRoomCandidate(args({ stewardFloor: 1 }));
    expect(lowered.view.stewardFloor).toBe(2);
    expect(lowered.view.quorumMet).toBe(false);
  });
});

describe("signRoomCandidate — the un-signable states (the lib's throws, surfaced)", () => {
  it("DROPPED DISSENT (D2): a critique standing NOW but not in the reviewed annex REFUSES", async () => {
    await expect(
      signRoomCandidate(
        args({
          reviewedCritiques: [critique(CRIT_1, "https://p3.example/#me")],
          standingCritiqueIds: new Set([CRIT_1, CRIT_2]), // CRIT_2 landed after review
        }),
      ),
    ).rejects.toThrow(/DROPS a standing critique/);
  });

  it("SUB-K (k-anonymity): a 4-contributor cohort is un-publishable", async () => {
    await expect(signRoomCandidate(args({ contributorCount: 4 }))).rejects.toThrow(
      /below the k-threshold/,
    );
  });

  it("MISSING BRIDGING EVIDENCE (D3): no per-cluster reception REFUSES", async () => {
    await expect(
      signRoomCandidate(args({ reception: { ...endorsed, perCluster: [] } })),
    ).rejects.toThrow(/bridgingEvidence/);
  });

  it("UNCONSENTED LINEAGE (INV-1): a derivedFrom input outside the synthesizable set REFUSES", async () => {
    await expect(signRoomCandidate(args({ synthesizable: new Set([NEED_A]) }))).rejects.toThrow(
      /fut:synthesize consent/,
    );
  });

  it("NO ALLOWLIST (INV-5): an empty trustedStewards THROWS fail-closed — no unprotected quorum", async () => {
    await expect(signRoomCandidate(args({ context: contextFor("A", []) }))).rejects.toThrow(
      /trustedStewards/,
    );
  });

  it("an UNTRUSTED steward's signature does not count toward the quorum", async () => {
    // B signs, but the community's registry names only A as a steward.
    const signed = await signRoomCandidate(args({ context: contextFor("B", [STEWARD_A]) }));
    expect(signed.view.distinctStewards).toBe(0);
    expect(signed.view.quorumMet).toBe(false);
    expect(signed.view.bootstrapping).toBe(false); // zero valid stewards is not bootstrapping
    expect(signed.verification.quorum.rejected.some((r) => r.reason === "untrusted-steward")).toBe(
      true,
    );
  });

  it("NO SESSION KEY: the steward role alone cannot sign (honest refusal, nothing built)", async () => {
    await expect(signRoomCandidate(args({ context: contextFor(null) }))).rejects.toThrow(
      /steward signing key/,
    );
  });

  it("an OPEN round is not an outcome and is refused", async () => {
    await expect(
      signRoomCandidate(args({ reception: { ...endorsed, outcome: "open" } })),
    ).rejects.toThrow(/still open/);
  });

  it("CO-SIGN STALE EVIDENCE: a reception that moved since assembly refuses the co-signature", async () => {
    const first = await signRoomCandidate(args());
    const moved: CandidateReception = {
      ...endorsed,
      perCluster: [
        { resonates: 4, conflicts: 0, unsure: 0, seen: 4, size: 4 }, // a vote landed
        { resonates: 2, conflicts: 1, unsure: 0, seen: 3, size: 3 },
      ],
    };
    await expect(
      signRoomCandidate(args({ context: contextFor("B"), prior: first, reception: moved })),
    ).rejects.toThrow(/endorsement evidence moved/);
  });

  it("CO-SIGN WRONG CANDIDATE: a prior artifact for another candidate refuses", async () => {
    const first = await signRoomCandidate(args());
    const other: SynthesisCandidate = {
      ...candidate,
      id: "https://h.example/syntheses/s2.ttl#it",
    };
    await expect(
      signRoomCandidate(args({ context: contextFor("B"), prior: first, candidate: other })),
    ).rejects.toThrow(/does not address this candidate/);
  });

  it("CO-SIGN SAME-DOCUMENT DIFFERENT-FRAGMENT candidate refuses — the doc-scoped artifact id alone is not the match", async () => {
    const first = await signRoomCandidate(args());
    // Same Turtle document, different fragment ⇒ SAME #shared-future id, but
    // DIFFERENT candidate material — must refuse on the material mismatch.
    const sibling: SynthesisCandidate = {
      ...candidate,
      id: "https://h.example/syntheses/s1.ttl#other",
      content: "A different synthesis in the same document.",
    };
    await expect(
      signRoomCandidate(args({ context: contextFor("B"), prior: first, candidate: sibling })),
    ).rejects.toThrow(/does not match this candidate's reviewed content\/lineage/);
  });

  it("CO-SIGN EDITED CANDIDATE: content edited at the SAME id refuses — unreviewed material is never co-signed", async () => {
    const first = await signRoomCandidate(args());
    const edited: SynthesisCandidate = {
      ...candidate,
      content: "The text was silently rewritten after the first signature.",
    };
    await expect(
      signRoomCandidate(args({ context: contextFor("B"), prior: first, candidate: edited })),
    ).rejects.toThrow(/does not match this candidate's reviewed content\/lineage/);
  });

  it("CO-SIGN STALENESS (D2): a critique that lands AFTER assembly refuses the co-signature", async () => {
    const first = await signRoomCandidate(args());
    // CRIT_2 lands after the artifact was assembled + signed by A…
    const crit2 = critique(CRIT_2, "https://p4.example/#me");
    await expect(
      signRoomCandidate(
        args({
          context: contextFor("B"),
          prior: first,
          reviewedCritiques: [critique(CRIT_1, "https://p3.example/#me"), crit2],
          standingCritiqueIds: new Set([CRIT_1, CRIT_2]),
        }),
      ),
    ).rejects.toThrow(/no longer accounts for every critique/);
  });
});
