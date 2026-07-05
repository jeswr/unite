// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.5 — the steward-signing glue between the scope-B Room and the LANDED
// S3.4 signing lib. The load-bearing assertions: the glue INVOKES
// lib/adoption-decision's throwing gates (it does not re-implement or route
// around them) — an unconsented-lineage, annex-dropping, running-code-less,
// partition-uncleared or allowlist-less sign REFUSES with the lib/glue
// message and yields NO artifact; a valid sign runs REAL crypto end-to-end
// (solid-vc issue + the full verifyAdoptionDecision path) and yields the
// honest ≥2-quorum progress AND the INV-3 COMPUTED status (recomputed from
// the signed evidence against the bar — never asserted, never signed).

import {
  generateKeyPairForSuite,
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import { beforeAll, describe, expect, it } from "vitest";
import type { AdoptionObservation } from "../lib/adoption.js";
import type { CandidateReception, InfraCandidateReception } from "../lib/convergence.js";
import { roleClustering } from "../lib/convergence.js";
import {
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
  ROLE_PARTICIPANT,
  type StakeholderRole,
} from "../lib/fut-draft.js";
import type { InfraProposal } from "../lib/infra.js";
import type { Critique, SynthesisCandidate } from "../lib/model.js";
import {
  adoptionDecisionIriFor,
  decisionBridgingEvidence,
  decisionDissent,
  roleCohortLabels,
  roleLabel,
  type SignAdoptionDecisionArgs,
  type SignedAdoptionDecision,
  sameInfraReception,
  signAdoptionCandidate,
} from "./sign-decision.js";
import type { StewardSigningContext } from "./sign-future.js";

const DELIB = "https://demo.unite.example/deliberations/infrastructure";
const NEED_A = "https://a.example/needs/a.ttl#it";
const PROP_1 = "https://a.example/proposals/p1.ttl#it";
const CAND = "https://h.example/syntheses/s1.ttl#it";
const CRIT_1 = "https://p3.example/critiques/c1.ttl#it";
const CRIT_2 = "https://p4.example/critiques/c2.ttl#it";
const VERSION = "https://w3id.org/jeswr/sectors/futures/0.2.0";

const STEWARD_A = "https://hana.example/profile/card#me";
const STEWARD_B = "https://farah.example/profile/card#me";

const U = (n: number) => `https://u${n}.example/#me`;
const I = (n: number) => `https://i${n}.example/#me`;
const PARTICIPANTS = [U(1), U(2), U(3), U(4), I(1), I(2)];
const ROLE_MAP: ReadonlyMap<string, StakeholderRole> = new Map([
  [I(1), ROLE_IMPLEMENTER],
  [I(2), ROLE_IMPLEMENTER],
]);

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
  title: "The 0.2.0 recommendation",
  content: "Recommend the scope-B layer as the governed version.",
  derivedFrom: [PROP_1, NEED_A],
  created: "2026-07-01T00:00:00Z",
  creator: "https://p1.example/#me",
  inDeliberation: DELIB,
};

const proposal = (referenceImplementation?: string): InfraProposal => ({
  id: PROP_1,
  title: "The scope-B layer",
  content: "An infra change.",
  targetsSystem: ["https://w3id.org/jeswr/sectors/futures"],
  affectsRole: [ROLE_IMPLEMENTER],
  motivatedBy: [NEED_A],
  created: "2026-06-15T00:00:00Z",
  creator: "https://p1.example/#me",
  inDeliberation: DELIB,
  ...(referenceImplementation !== undefined ? { referenceImplementation } : {}),
});

const critique = (id: string, creator: string): Critique => ({
  id,
  content: `A standing concern from ${creator}`,
  onStatement: CAND,
  created: "2026-07-02T00:00:00Z",
  creator,
  inDeliberation: DELIB,
});

const opinionEndorsed: CandidateReception = {
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

/** The role partition: implementers (2) + participants (4), both positive.
 *  Cohort order = sorted role IRIs (Implementer < Participant). */
const roleEndorsed: CandidateReception = {
  candidate: CAND,
  outcome: "endorsed",
  perCluster: [
    { resonates: 2, conflicts: 0, unsure: 0, seen: 2, size: 2 },
    { resonates: 3, conflicts: 1, unsure: 0, seen: 4, size: 4 },
  ],
  score: 0.75,
  totalSeen: 6,
  clusterCount: 2,
};

const bothCleared: InfraCandidateReception = {
  candidate: CAND,
  outcome: "endorsed",
  opinion: opinionEndorsed,
  role: roleEndorsed,
  bothCleared: true,
};

const roleOpen: InfraCandidateReception = {
  candidate: CAND,
  outcome: "open",
  opinion: opinionEndorsed,
  role: { ...roleEndorsed, outcome: "open" },
  bothCleared: false,
};

/** Two live advertisers of the recommended version — the observable half of
 *  the design/04 §2 bar (2) is met, so the COMPUTED status is "current". */
const evidence: AdoptionObservation[] = [
  {
    party: "https://storage-alpha.example/pods/",
    version: VERSION,
    observedAt: "2026-07-05T00:00:00Z",
    source: "https://storage-alpha.example/registry/alpha.ttl",
  },
  {
    party: "https://storage-beta.example/pods/",
    version: VERSION,
    observedAt: "2026-07-05T00:00:00Z",
    source: "https://storage-beta.example/registry/beta.ttl",
  },
];

/** A signable baseline: endorsed in BOTH partitions, running code present,
 *  1 standing critique reviewed, evidence meeting the observable bar. */
function args(overrides: Partial<SignAdoptionDecisionArgs> = {}): SignAdoptionDecisionArgs {
  return {
    candidate,
    infra: bothCleared,
    participants: PARTICIPANTS,
    roleMap: ROLE_MAP,
    reviewedCritiques: [critique(CRIT_1, "https://p3.example/#me")],
    standingCritiqueIds: new Set([CRIT_1]),
    synthesizable: new Set([PROP_1, NEED_A]),
    lineageProposals: [proposal("https://github.com/jeswr/unite/commit/abc123")],
    adoptionEvidence: evidence,
    proposesVersion: VERSION,
    deliberation: DELIB,
    context: contextFor("A"),
    now: () => "2026-07-05T00:00:00Z",
    ...overrides,
  };
}

describe("the pure mappers", () => {
  it("adoptionDecisionIriFor is deterministic AND unique per candidate (fragment preserved)", () => {
    // The fragment is preserved into a single valid decision fragment, so two
    // candidates in the SAME document produce DISTINCT decision IRIs.
    expect(adoptionDecisionIriFor("https://h.example/syntheses/s1.ttl#it")).toBe(
      "https://h.example/syntheses/s1.ttl#adoption-decision-it",
    );
    expect(adoptionDecisionIriFor("https://h.example/syntheses/s1.ttl#other")).toBe(
      "https://h.example/syntheses/s1.ttl#adoption-decision-other",
    );
    // Deterministic (same candidate → same IRI) and fragment-less handled.
    expect(adoptionDecisionIriFor("https://h.example/syntheses/s1.ttl#it")).toBe(
      "https://h.example/syntheses/s1.ttl#adoption-decision-it",
    );
    expect(adoptionDecisionIriFor("https://h.example/syntheses/s1.ttl")).toBe(
      "https://h.example/syntheses/s1.ttl#adoption-decision",
    );
    // Two candidates in one document never collide.
    expect(adoptionDecisionIriFor("https://d.example/doc.ttl#a")).not.toBe(
      adoptionDecisionIriFor("https://d.example/doc.ttl#b"),
    );
  });

  it("roleCohortLabels is PINNED to lib/convergence roleClustering's cohort order", () => {
    // The alignment invariant: labels[i] must name the cohort roleClustering
    // assigns index i — for every participant, the label at its assignment
    // index is the label of its own (fail-closed) role.
    const clustering = roleClustering(PARTICIPANTS, ROLE_MAP);
    const labels = roleCohortLabels(PARTICIPANTS, ROLE_MAP);
    expect(labels).toHaveLength(clustering.k);
    const parts = [...new Set(PARTICIPANTS)].sort();
    parts.forEach((p, i) => {
      const g = clustering.assignments[i] as number;
      expect(labels[g]).toBe(roleLabel(ROLE_MAP.get(p) ?? ROLE_PARTICIPANT));
    });
    // …and a mixed three-role partition stays aligned too.
    const threeRoles = new Map<string, StakeholderRole>([
      [U(1), ROLE_OPERATOR],
      [I(1), ROLE_IMPLEMENTER],
    ]);
    const parts3 = [U(1), U(2), I(1)];
    const clust3 = roleClustering(parts3, threeRoles);
    const labels3 = roleCohortLabels(parts3, threeRoles);
    expect(labels3).toHaveLength(clust3.k);
    [...new Set(parts3)].sort().forEach((p, i) => {
      const g = clust3.assignments[i] as number;
      expect(labels3[g]).toBe(roleLabel(threeRoles.get(p) ?? ROLE_PARTICIPANT));
    });
  });

  it("decisionBridgingEvidence carries BOTH partitions: opinion clusters then role cohorts", () => {
    const rows = decisionBridgingEvidence(bothCleared, PARTICIPANTS, ROLE_MAP);
    expect(rows.map((r) => r.clusterLabel)).toEqual([
      "Group A",
      "Group B",
      "role: implementers",
      "role: participants",
    ]);
    // Counts are carried 1:1 (the recomputable proof), never patched.
    expect(rows[2]).toMatchObject({
      resonatesCount: 2,
      conflictsCount: 0,
      unsureCount: 0,
      seenCount: 2,
    });
  });

  it("decisionDissent is fail-closed aggregate-only: carried, counted, never attributed", () => {
    const { dissent, accountedFor } = decisionDissent([critique(CRIT_1, "https://p3.example/#me")]);
    expect(dissent).toHaveLength(1);
    // No quoteVerbatim consent is surfaced ⇒ no attribution, placeholder text.
    expect(dissent[0]?.creator).toBeUndefined();
    expect(accountedFor.has(CRIT_1)).toBe(true);
  });

  it("sameInfraReception detects movement in EITHER partition", () => {
    expect(sameInfraReception(bothCleared, bothCleared)).toBe(true);
    const movedRole: InfraCandidateReception = {
      ...bothCleared,
      role: {
        ...roleEndorsed,
        perCluster: [
          { resonates: 1, conflicts: 1, unsure: 0, seen: 2, size: 2 },
          { resonates: 3, conflicts: 1, unsure: 0, seen: 4, size: 4 },
        ],
      },
    };
    expect(sameInfraReception(bothCleared, movedRole)).toBe(false);
  });
});

describe("signAdoptionCandidate — the happy paths (real crypto end-to-end)", () => {
  it("one steward signs: honest 1-of-≥2, bootstrapping, NOT ratified, status COMPUTED not asserted", async () => {
    const signed = await signAdoptionCandidate(args());
    expect(signed.id).toBe(adoptionDecisionIriFor(CAND));
    expect(signed.vcs).toHaveLength(1);
    const q = signed.verification.quorum;
    expect(q.distinctStewards).toBe(1);
    expect(q.threshold).toBe(2);
    expect(q.met).toBe(false);
    expect(q.bootstrapping).toBe(true);
    expect(signed.verification.ratified).toBe(false);
    // The decision renders from the PARSE OF THE SIGNED QUADS.
    expect(signed.verification.decision?.content).toBe(candidate.content);
    expect(signed.verification.decision?.proposesVersion).toBe(VERSION);
    expect(signed.verification.decision?.hasDissentAnnex).toBe(true);
    // INV-3: the LIVE recompute — 2 advertising parties ≥ the bar of 2.
    expect(signed.verification.computedStatus).toBe("current");
    // …and the signed graph carries NO status triple of any kind.
    expect(signed.quads.some((quad) => quad.predicate.value.toLowerCase().includes("status"))).toBe(
      false,
    );
  });

  it("thin evidence recomputes to 'proposed' — the signature never upgrades a status", async () => {
    const signed = await signAdoptionCandidate(
      args({ adoptionEvidence: [evidence[0] as AdoptionObservation] }),
    );
    expect(signed.verification.computedStatus).toBe("proposed"); // 1 < the bar of 2
    expect(signed.verification.quorum.distinctStewards).toBe(1);
  });

  it("a second DISTINCT steward completes the quorum: 2 of ≥2, met + ratified", async () => {
    const first = await signAdoptionCandidate(args({ context: contextFor("A") }));
    const second = await signAdoptionCandidate(args({ context: contextFor("B"), prior: first }));
    expect(second.vcs).toHaveLength(2);
    expect(second.verification.quorum.distinctStewards).toBe(2);
    expect(second.verification.quorum.met).toBe(true);
    expect(second.verification.ratified).toBe(true);
    expect(second.verification.lineageConsented).toBe(true);
  });

  it("the SAME steward signing twice never double-counts (one steward, one vote)", async () => {
    const first = await signAdoptionCandidate(args());
    const again = await signAdoptionCandidate(args({ prior: first }));
    expect(again.vcs).toHaveLength(2);
    expect(again.verification.quorum.distinctStewards).toBe(1);
    expect(again.verification.quorum.met).toBe(false);
  });

  it("NO standing critiques ⇒ the EXPLICIT fut:noDissentRecorded assertion (silence ≠ consensus)", async () => {
    const signed = await signAdoptionCandidate(
      args({ reviewedCritiques: [], standingCritiqueIds: new Set() }),
    );
    expect(signed.verification.decision?.hasDissentAnnex).toBe(true);
    expect(signed.quads.some((quad) => quad.predicate.value.endsWith("noDissentRecorded"))).toBe(
      true,
    );
  });

  it("the scope may RAISE the floor, never lower it", async () => {
    const raised = await signAdoptionCandidate(args({ stewardFloor: 3 }));
    expect(raised.verification.quorum.threshold).toBe(3);
    const lowered = await signAdoptionCandidate(args({ stewardFloor: 1 }));
    expect(lowered.verification.quorum.threshold).toBe(2); // clamps UP to the ≥2 floor
  });

  it("an UNTRUSTED steward's signature does not count toward the quorum", async () => {
    const signed = await signAdoptionCandidate(args({ context: contextFor("B", [STEWARD_A]) }));
    expect(signed.verification.quorum.distinctStewards).toBe(0);
    expect(signed.verification.quorum.met).toBe(false);
    expect(signed.verification.ratified).toBe(false);
  });
});

describe("signAdoptionCandidate — the §3.4 both-partitions gate (strict, fail-safe)", () => {
  it("role-lens OPEN BLOCKS (S3.6 pending): opinion-endorsed but role-unconfirmed is un-signable", async () => {
    // STRICT §3.4: both partitions must clear. The role partition's "open"
    // (insufficient verified cohorts — the cross-participant role data flow is
    // S3.6) blocks fail-safe; signing never outruns confirmed cross-role
    // consensus. The refusal names the pending role partition + S3.6.
    await expect(signAdoptionCandidate(args({ infra: roleOpen }))).rejects.toThrow(
      /verified-role lens is open.*S3.6/,
    );
  });

  it("the §3.4 gate: an active verified-role DISAGREEMENT blocks (fail-safe)", async () => {
    const infra: InfraCandidateReception = {
      ...bothCleared,
      outcome: "disagreement",
      role: { ...roleEndorsed, outcome: "disagreement" },
      bothCleared: false,
    };
    await expect(signAdoptionCandidate(args({ infra }))).rejects.toThrow(
      /verified-role lens is disagreement/,
    );
  });

  it("the §3.4 gate: an opinion DISAGREEMENT refuses, naming the lens", async () => {
    const infra: InfraCandidateReception = {
      ...bothCleared,
      outcome: "disagreement",
      opinion: { ...opinionEndorsed, outcome: "disagreement" },
      bothCleared: false,
    };
    await expect(signAdoptionCandidate(args({ infra }))).rejects.toThrow(
      /opinion lens is disagreement/,
    );
  });

  it("BOTH partitions endorsed (bothCleared) is signable — the gate clears", async () => {
    const signed = await signAdoptionCandidate(args({ infra: bothCleared }));
    expect(signed.verification.decision).toBeDefined();
    expect(signed.verification.quorum.distinctStewards).toBe(1);
  });
});

describe("signAdoptionCandidate — the un-signable states (throws, no artifact)", () => {
  it("RUNNING CODE (design/04 §2): a lineage proposal without a reference implementation refuses", async () => {
    await expect(signAdoptionCandidate(args({ lineageProposals: [proposal()] }))).rejects.toThrow(
      /running code missing on 1 of 1/,
    );
  });

  it("RUNNING CODE (roborev High): a candidate derived ONLY from needs (no infra proposal) refuses — no running code to recommend", async () => {
    // An endorsed candidate whose lineage carries zero infra proposals has
    // nothing that could hold a reference implementation, so it can never
    // satisfy the running-code bar — it must not become an AdoptionDecision.
    await expect(signAdoptionCandidate(args({ lineageProposals: [] }))).rejects.toThrow(
      /lineage carries no infra proposal/,
    );
  });

  it("DROPPED DISSENT: a critique standing NOW but not in the reviewed annex refuses", async () => {
    await expect(
      signAdoptionCandidate(args({ standingCritiqueIds: new Set([CRIT_1, CRIT_2]) })),
    ).rejects.toThrow(/DROPS a standing critique/);
  });

  it("UNCONSENTED LINEAGE (INV-1): a derivedFrom input outside the synthesizable set — the LIB's throw, verbatim", async () => {
    await expect(signAdoptionCandidate(args({ synthesizable: new Set([NEED_A]) }))).rejects.toThrow(
      /fut:synthesize consent/,
    );
  });

  it("NO ALLOWLIST (INV-5): an empty trustedStewards THROWS fail-closed — no unprotected quorum", async () => {
    await expect(signAdoptionCandidate(args({ context: contextFor("A", []) }))).rejects.toThrow(
      /trustedStewards/,
    );
  });

  it("NO SESSION KEY: the steward role alone cannot sign", async () => {
    await expect(signAdoptionCandidate(args({ context: contextFor(null) }))).rejects.toThrow(
      /steward signing key/,
    );
  });

  it("CO-SIGN EDITED CANDIDATE: content edited at the SAME id refuses", async () => {
    const first = await signAdoptionCandidate(args());
    const edited: SynthesisCandidate = {
      ...candidate,
      content: "The text was silently rewritten after the first signature.",
    };
    await expect(
      signAdoptionCandidate(args({ context: contextFor("B"), prior: first, candidate: edited })),
    ).rejects.toThrow(/does not match this candidate's reviewed content\/lineage/);
  });

  it("CO-SIGN STALE DISSENT (roborev High): a critique landed + reviewed after the first signature refuses the co-sign of the OLD annex", async () => {
    // First steward signs with the annex accounting for CRIT_1 only.
    const first = await signAdoptionCandidate(args());
    // A NEW critique lands and is NOW reviewed AND standing: the D2
    // standingCritiqueIds check passes (reviewedCritiques ⊇ standing), but the
    // reused prior graph still carries only CRIT_1's annex — the co-sign must
    // refuse (it cannot drop the newly-standing dissent into an old digest).
    await expect(
      signAdoptionCandidate(
        args({
          context: contextFor("B"),
          prior: first,
          reviewedCritiques: [
            critique(CRIT_1, "https://p3.example/#me"),
            critique(CRIT_2, "https://p4.example/#me"),
          ],
          standingCritiqueIds: new Set([CRIT_1, CRIT_2]),
        }),
      ),
    ).rejects.toThrow(/dissent annex changed/);
  });

  it("CO-SIGN DIFFERENT VERSION: a prior artifact recommending another version refuses", async () => {
    const first = await signAdoptionCandidate(args());
    await expect(
      signAdoptionCandidate(
        args({
          context: contextFor("B"),
          prior: first,
          proposesVersion: "https://w3id.org/jeswr/sectors/futures/0.1.0",
        }),
      ),
    ).rejects.toThrow(/DIFFERENT version/);
  });

  it("CO-SIGN MOVED EVIDENCE: a role-partition change since assembly refuses the co-signature", async () => {
    const first = await signAdoptionCandidate(args());
    const moved: InfraCandidateReception = {
      ...bothCleared,
      role: {
        ...roleEndorsed,
        perCluster: [
          { resonates: 2, conflicts: 0, unsure: 0, seen: 2, size: 2 },
          { resonates: 4, conflicts: 1, unsure: 0, seen: 5, size: 5 }, // a vote landed
        ],
      },
    };
    await expect(
      signAdoptionCandidate(args({ context: contextFor("B"), prior: first, infra: moved })),
    ).rejects.toThrow(/endorsement evidence moved/);
  });

  it("CO-SIGN WRONG CANDIDATE: a prior artifact for another candidate refuses", async () => {
    const first: SignedAdoptionDecision = await signAdoptionCandidate(args());
    const other: SynthesisCandidate = {
      ...candidate,
      id: "https://h.example/syntheses/s2.ttl#it",
    };
    await expect(
      signAdoptionCandidate(args({ context: contextFor("B"), prior: first, candidate: other })),
    ).rejects.toThrow(/does not address this candidate/);
  });

  it("CO-SIGN MOVED WIRE EVIDENCE (roborev Medium): the observed adoption evidence changed since assembly refuses", async () => {
    const first = await signAdoptionCandidate(args());
    // A DIFFERENT advertiser set observed at co-sign time — the co-signature
    // would bind the first steward's snapshot while this steward saw another
    // wire. Refuse (a re-observed observedAt alone would NOT trip this — only a
    // genuine party/version/source change does).
    const movedEvidence: AdoptionObservation[] = [
      {
        party: "https://storage-gamma.example/pods/",
        version: VERSION,
        observedAt: "2026-07-06T00:00:00Z",
        source: "https://storage-gamma.example/registry/gamma.ttl",
      },
    ];
    await expect(
      signAdoptionCandidate(
        args({ context: contextFor("B"), prior: first, adoptionEvidence: movedEvidence }),
      ),
    ).rejects.toThrow(/observed adoption evidence.*moved/);
  });

  it("CO-SIGN same advertisers, only observedAt ticked → still co-signable (timestamp is not the wire)", async () => {
    const first = await signAdoptionCandidate(args());
    // The SAME party/version/source, re-observed at a later observedAt: the
    // wire is unchanged, so the co-signature proceeds and completes the quorum.
    const reobserved: AdoptionObservation[] = evidence.map((o) => ({
      ...o,
      observedAt: "2026-07-09T12:00:00Z",
    }));
    const second = await signAdoptionCandidate(
      args({ context: contextFor("B"), prior: first, adoptionEvidence: reobserved }),
    );
    expect(second.verification.quorum.distinctStewards).toBe(2);
    expect(second.verification.quorum.met).toBe(true);
  });
});
