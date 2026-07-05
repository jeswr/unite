// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.3 the commission lifecycle — the attack surface IS the test surface. The two
// signed gates are EXERCISED with REAL solid-vc / federation-trust crypto:
//   • every illegal state transition is refused (fail-closed);
//   • a `merged` transition WITHOUT a valid ≥2-steward quorum is refused;
//   • a merge without a trustedStewards allowlist FAILS CLOSED (throws);
//   • a forged / unsigned / off-artifact / untrusted-issuer DelegationCredential
//     cannot commission a build;
//   • untrusted foreign RDF in the thread drops the field/item, never aborts;
//   • the fold is deterministic + order-independent, and computed-not-asserted (a
//     spoofed cached state triple is ignored — the fold recomputes from events).

import { FEDTRUST_DELEGATION_CREDENTIAL, FEDTRUST_FEDERATION } from "@jeswr/federation-trust";
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
import type { CommissionState } from "./channel.js";
import {
  buildCommissionEventQuads,
  buildCommissionStateQuads,
  COMMISSION_STATES,
  type CommissionEvent,
  type CommissionEventType,
  CommissionTransitionError,
  type CommissionTransitionEvent,
  canTransition,
  foldCommissionState,
  issueCommission,
  parseCommissionEvents,
  readCommissionState,
  transition,
  UNITE_COMMISSION_EVENT,
  UNITE_EVENT_TYPE,
  UNITE_ON_THREAD,
  verifyCommission,
  verifyMergeQuorum,
} from "./commission.js";
import { DCT_CREATED, DCT_CREATOR, NS, RDF_TYPE } from "./fut.js";

const { namedNode, literal, quad } = DataFactory;

const COMMISSIONER = "https://alice.example/profile/card#me";
const MALLORY = "https://mallory.example/profile/card#me"; // a non-trusted signer
const ASSIGNEE = "https://bob.example/agent#me"; // the builder/agent
const CAROL = "https://carol.example/profile/card#me"; // reviewer steward
const DAVE = "https://dave.example/profile/card#me"; // reviewer steward

const ARTIFACT = "https://d.example/synthesis/spec-1#it"; // the exact commissioned artifact
const OTHER_ARTIFACT = "https://d.example/synthesis/spec-2#it";
const THREAD = "https://bob.example/build/threads/t1.ttl#it";

const TRUSTED_COMMISSIONERS = [COMMISSIONER];
const TRUSTED_REVIEWERS = [CAROL, DAVE];

/** The deliverable graph the merge quorum attests over. */
const ARTIFACT_QUADS: Quad[] = [
  quad(namedNode(ARTIFACT), namedNode(`${NS.dct}title`), literal("the built artifact")),
];

// ── Real crypto (the adoption-decision.test / quorum.test harness) ────────────
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

/** A reviewer's independent attestation binding the artifact's RDFC-1.0 digest. */
async function reviewerAttestation(
  webId: string,
  key: KeyPair,
  quads: readonly Quad[] = ARTIFACT_QUADS,
): Promise<VerifiableCredential> {
  const digest = await digestQuads(quads);
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

// ═══════════════════════════════════════════════════════════════════════════════
// The pure state machine
// ═══════════════════════════════════════════════════════════════════════════════
describe("transition — the pure, fail-closed state machine", () => {
  const legal: [CommissionState, CommissionTransitionEvent, CommissionState][] = [
    ["drafted", { type: "commission", gatePassed: true }, "commissioned"],
    ["commissioned", { type: "start" }, "in-progress"],
    ["commissioned", { type: "reject" }, "rejected"],
    ["in-progress", { type: "open-pr" }, "pr-open"],
    ["in-progress", { type: "reject" }, "rejected"],
    ["pr-open", { type: "request-review" }, "in-review"],
    ["pr-open", { type: "reject" }, "rejected"],
    ["in-review", { type: "merge", gatePassed: true }, "merged"],
    ["in-review", { type: "request-changes" }, "in-progress"],
    ["in-review", { type: "reject" }, "rejected"],
  ];

  it("advances along every LEGAL edge", () => {
    for (const [from, event, to] of legal) {
      expect(transition(from, event)).toBe(to);
      expect(canTransition(from, event)).toBe(true);
    }
  });

  it("REFUSES every illegal (state, event) pair — fail-closed", () => {
    const events: CommissionEventType[] = [
      "commission",
      "start",
      "open-pr",
      "request-review",
      "request-changes",
      "merge",
      "reject",
    ];
    const legalKeys = new Set(legal.map(([from, e]) => `${from}|${e.type}`));
    for (const from of COMMISSION_STATES) {
      for (const type of events) {
        if (legalKeys.has(`${from}|${type}`)) continue;
        // Pass the gate so a refusal here is purely the illegal EDGE, not the gate.
        const event = { type, gatePassed: true } as CommissionTransitionEvent;
        expect(canTransition(from, event)).toBe(false);
        expect(() => transition(from, event)).toThrow(CommissionTransitionError);
        try {
          transition(from, event);
        } catch (e) {
          expect((e as CommissionTransitionError).code).toBe("illegal-transition");
        }
      }
    }
  });

  it("terminal states (merged / rejected) have NO outgoing transition", () => {
    for (const terminal of ["merged", "rejected"] as const) {
      for (const type of ["start", "merge", "reject", "commission"] as CommissionEventType[]) {
        expect(canTransition(terminal, { type, gatePassed: true })).toBe(false);
      }
    }
  });

  it("a GATED transition without verified evidence is refused (unverified-evidence)", () => {
    for (const event of [
      { type: "commission" as const }, // gatePassed undefined
      { type: "commission" as const, gatePassed: false },
    ]) {
      expect(canTransition("drafted", event)).toBe(false);
      expect(() => transition("drafted", event)).toThrow(/verified signed evidence/);
      try {
        transition("drafted", event);
      } catch (e) {
        expect((e as CommissionTransitionError).code).toBe("unverified-evidence");
      }
    }
    // The MERGE gate: in-review → merged is refused without a met quorum.
    expect(() => transition("in-review", { type: "merge", gatePassed: false })).toThrow(
      /verified signed evidence/,
    );
    expect(transition("in-review", { type: "merge", gatePassed: true })).toBe("merged");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// The COMMISSION — the signed fedtrust:DelegationCredential
// ═══════════════════════════════════════════════════════════════════════════════
describe("issueCommission + verifyCommission — the per-artifact signed commission", () => {
  async function commission(
    commissioner = COMMISSIONER,
    key = keyCommissioner,
    artifact = ARTIFACT,
  ): Promise<VerifiableCredential> {
    return issueCommission({
      commissioner,
      assignee: ASSIGNEE,
      assigneeKey: keyAssignee.publicKey,
      artifact,
      key,
    });
  }

  const opts = (over: Record<string, unknown> = {}) => ({
    verifyVc: realVerify,
    trustedCommissioners: TRUSTED_COMMISSIONERS,
    artifact: ARTIFACT,
    ...over,
  });

  it("a real signed commission binding commissioner → assignee → artifact VERIFIES", async () => {
    const vc = await commission();
    const result = await verifyCommission(vc, opts({ assignee: ASSIGNEE }));
    expect(result.verified).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.commissioner).toBe(COMMISSIONER);
    expect(result.assignee).toBe(ASSIGNEE);
    expect(result.artifact).toBe(ARTIFACT);
  });

  it("a FORGED (post-sign-tampered) commission cannot commission (unverified)", async () => {
    const vc = await commission();
    // Tamper the signed scope claim AFTER issuance → the Data-Integrity proof no
    // longer matches → verifyVc fails → the commission is not authorized.
    const forged = {
      ...vc,
      credentialSubject: { ...vc.credentialSubject, [`${NS.fut}tamper`]: "x" },
    } as VerifiableCredential;
    const result = await verifyCommission(forged, opts());
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("unverified");
  });

  it("an UNSIGNED credential-shaped object cannot commission (unverified)", async () => {
    const unsigned = {
      issuer: COMMISSIONER,
      type: ["https://w3id.org/jeswr/fedtrust#DelegationCredential"],
      credentialSubject: {
        id: ASSIGNEE,
        "https://w3id.org/jeswr/fedtrust#delegate": ASSIGNEE,
        "https://w3id.org/jeswr/fedtrust#federation": ARTIFACT,
      },
      proof: { type: "DataIntegrityProof", verificationMethod: `${COMMISSIONER}#key` },
    } as unknown as VerifiableCredential;
    const result = await verifyCommission(unsigned, opts());
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("unverified");
  });

  it("a valid delegation for a DIFFERENT artifact cannot commission THIS build (scope-mismatch)", async () => {
    const vc = await commission(COMMISSIONER, keyCommissioner, OTHER_ARTIFACT);
    const result = await verifyCommission(vc, opts()); // expects ARTIFACT, got OTHER_ARTIFACT
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("scope-mismatch");
  });

  it("a commission signed by an UNTRUSTED commissioner is refused (untrusted-commissioner)", async () => {
    const vc = await commission(MALLORY, keyMallory); // validly signed, but off-allowlist
    const result = await verifyCommission(vc, opts());
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("untrusted-commissioner");
  });

  it("a delegation to a DIFFERENT assignee than expected is refused (assignee-mismatch)", async () => {
    const vc = await commission();
    const result = await verifyCommission(vc, opts({ assignee: "https://eve.example/agent#me" }));
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("assignee-mismatch");
  });

  it("a delegate-LESS delegation is refused even with NO expected assignee (no-assignee)", async () => {
    // A validly-signed, trusted-issuer, correctly-scoped delegation that names NO
    // `fedtrust:delegate`. A commission MUST bind an assignee, so this authorizes
    // nobody — refused whether or not the caller pins an expected assignee (roborev
    // Medium: the delegate claim is required unconditionally).
    const noDelegate = await issue({
      credential: {
        issuer: COMMISSIONER,
        type: [FEDTRUST_DELEGATION_CREDENTIAL],
        credentialSubject: { id: ARTIFACT, [FEDTRUST_FEDERATION]: ARTIFACT }, // scope, NO delegate
      },
      key: keyCommissioner,
    });
    // (a) caller omits `assignee` — must still fail no-assignee (the earlier gap).
    const withoutExpected = await verifyCommission(noDelegate, opts());
    expect(withoutExpected.verified).toBe(false);
    expect(withoutExpected.reasons).toContain("no-assignee");
    // (b) caller pins `assignee` — also fails no-assignee (nothing to match).
    const withExpected = await verifyCommission(noDelegate, opts({ assignee: ASSIGNEE }));
    expect(withExpected.verified).toBe(false);
    expect(withExpected.reasons).toContain("no-assignee");
  });

  it("a NON-delegation credential is refused (not-a-delegation)", async () => {
    const plain = await reviewerAttestation(COMMISSIONER, keyCommissioner); // a plain VC, no delegation type
    const result = await verifyCommission(plain, opts());
    expect(result.verified).toBe(false);
    expect(result.reasons).toContain("not-a-delegation");
  });

  it("THROWS fail-closed when NO trustedCommissioners allowlist is supplied", async () => {
    const vc = await commission();
    for (const bad of [[], ["   "], undefined]) {
      await expect(
        verifyCommission(vc, {
          verifyVc: realVerify,
          artifact: ARTIFACT,
          trustedCommissioners: bad as string[],
        }),
      ).rejects.toThrow(/trustedCommissioners/);
    }
  });

  it("THROWS on a non-http(s) artifact scope (configuration error)", async () => {
    const vc = await commission();
    await expect(verifyCommission(vc, opts({ artifact: "urn:not-http" }))).rejects.toThrow(
      /artifact/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// The MERGE-GATE — the ≥2-steward quorum over the artifact
// ═══════════════════════════════════════════════════════════════════════════════
describe("verifyMergeQuorum — no merge without a valid ≥2 quorum + required allowlist", () => {
  const opts = (over: Record<string, unknown> = {}) => ({
    verifyVc: realVerify,
    resolveKey: realResolveKey,
    trustedStewards: TRUSTED_REVIEWERS,
    builder: ASSIGNEE,
    ...over,
  });

  it("ALLOWS a merge with two distinct reviewers (met + distinct from builder)", async () => {
    const vcs = [
      await reviewerAttestation(CAROL, keyCarol),
      await reviewerAttestation(DAVE, keyDave),
    ];
    const result = await verifyMergeQuorum(ARTIFACT_QUADS, vcs, opts());
    expect(result.attestation.met).toBe(true);
    expect(result.attestation.distinctStewards).toBe(2);
    expect(result.reviewerDistinctFromBuilder).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("REFUSES a merge with only ONE reviewer (below the ≥2 floor)", async () => {
    const vcs = [await reviewerAttestation(CAROL, keyCarol)];
    const result = await verifyMergeQuorum(ARTIFACT_QUADS, vcs, opts());
    expect(result.attestation.met).toBe(false);
    expect(result.attestation.bootstrapping).toBe(true);
    expect(result.allowed).toBe(false);
  });

  it("the ≥2 floor cannot be lowered by a caller (threshold clamps up)", async () => {
    const vcs = [await reviewerAttestation(CAROL, keyCarol)];
    const result = await verifyMergeQuorum(ARTIFACT_QUADS, vcs, opts({ threshold: 1 }));
    expect(result.attestation.threshold).toBe(2);
    expect(result.allowed).toBe(false);
  });

  it("THROWS fail-closed when NO trustedStewards allowlist is supplied", async () => {
    const vcs = [
      await reviewerAttestation(CAROL, keyCarol),
      await reviewerAttestation(DAVE, keyDave),
    ];
    for (const bad of [[], ["  "], undefined]) {
      await expect(
        verifyMergeQuorum(ARTIFACT_QUADS, vcs, {
          verifyVc: realVerify,
          resolveKey: realResolveKey,
          builder: ASSIGNEE,
          trustedStewards: bad as string[],
        }),
      ).rejects.toThrow(/trustedStewards/);
    }
  });

  it("a reviewer signing a DIFFERENT artifact's digest does not count (digest-mismatch)", async () => {
    const otherQuads: Quad[] = [
      quad(namedNode(OTHER_ARTIFACT), namedNode(`${NS.dct}title`), literal("a different artifact")),
    ];
    const vcs = [
      await reviewerAttestation(CAROL, keyCarol),
      await reviewerAttestation(DAVE, keyDave, otherQuads), // signs OTHER content
    ];
    const result = await verifyMergeQuorum(ARTIFACT_QUADS, vcs, opts());
    expect(result.attestation.distinctStewards).toBe(1);
    expect(result.allowed).toBe(false);
  });

  it("the builder MAY be one of the reviewers if ≥1 OTHER reviewer signs too", async () => {
    // design/04 §4.3: ≥2 approvals, ≥1 distinct from the builder. Builder Bob + Carol.
    const vcs = [
      await reviewerAttestation(ASSIGNEE, keyAssignee),
      await reviewerAttestation(CAROL, keyCarol),
    ];
    const result = await verifyMergeQuorum(ARTIFACT_QUADS, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: [ASSIGNEE, CAROL],
      builder: ASSIGNEE,
    });
    expect(result.attestation.met).toBe(true);
    expect(result.reviewerDistinctFromBuilder).toBe(true); // Carol ≠ Bob
    expect(result.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// The commission-event RDF model + guarded parse (untrusted RDF)
// ═══════════════════════════════════════════════════════════════════════════════
describe("commission events — build / parse / hostile RDF isolation", () => {
  const ev = (over: Partial<CommissionEvent> = {}): CommissionEvent => ({
    id: "https://bob.example/build/events/e1.ttl#it",
    type: "start",
    thread: THREAD,
    actor: ASSIGNEE,
    at: "2026-07-05T10:00:00Z",
    ...over,
  });

  it("round-trips an event through build → parse", () => {
    const e = ev({ type: "commission", evidence: "https://bob.example/build/creds/c1.ttl#it" });
    const parsed = parseCommissionEvents(new Store(buildCommissionEventQuads(e)));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: e.id,
      type: "commission",
      thread: THREAD,
      actor: ASSIGNEE,
      at: e.at,
      evidence: e.evidence,
    });
  });

  it("build throws on a non-http(s) IRI / bad timestamp (never write what won't parse)", () => {
    expect(() => buildCommissionEventQuads(ev({ thread: "urn:x" }))).toThrow(/thread/);
    expect(() => buildCommissionEventQuads(ev({ at: "not-a-date" }))).toThrow(/xsd:dateTime/);
  });

  it("untrusted RDF drops the ITEM: a hostile event (literal onThread) drops, siblings survive", () => {
    const good = buildCommissionEventQuads(ev());
    const hostile = namedNode("https://evil.example/e2#it");
    const store = new Store([
      ...good,
      quad(hostile, namedNode(RDF_TYPE), namedNode(UNITE_COMMISSION_EVENT)),
      quad(hostile, namedNode(UNITE_EVENT_TYPE), namedNode(`${NS.fut}Merge`)), // a NON-coded event type
      quad(hostile, namedNode(UNITE_ON_THREAD), literal("not-an-iri")), // hostile: literal, not IRI
      quad(hostile, namedNode(DCT_CREATOR), namedNode(ASSIGNEE)),
      quad(
        hostile,
        namedNode(DCT_CREATED),
        literal("2026-07-05T11:00:00Z", namedNode(`${NS.xsd}dateTime`)),
      ),
    ]);
    const parsed = parseCommissionEvents(store);
    expect(parsed).toHaveLength(1); // the hostile one dropped
    expect(parsed[0]?.id).toBe(ev().id);
  });

  it("the thread filter keeps only events for the folded thread", () => {
    const mine = buildCommissionEventQuads(ev());
    const other = buildCommissionEventQuads(
      ev({ id: "https://bob.example/build/events/e9.ttl#it", thread: "https://x.example/t9#it" }),
    );
    const parsed = parseCommissionEvents(new Store([...mine, ...other]), { thread: THREAD });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.thread).toBe(THREAD);
  });

  it("caches + reads the computed state on the wf:Task (a HINT, not a decree)", () => {
    const quads = buildCommissionStateQuads(THREAD, "in-review");
    expect(readCommissionState(new Store(quads), THREAD)).toBe("in-review");
    // A non-coded / hostile value drops to undefined (guarded).
    const hostile = new Store([
      quad(namedNode(THREAD), namedNode(`${NS.fut}commissionState`), literal("Merged")),
    ]);
    expect(readCommissionState(hostile, THREAD)).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// The fold — deterministic, order-independent, gated, computed-not-asserted
// ═══════════════════════════════════════════════════════════════════════════════
describe("foldCommissionState — the pure fold over events + signed evidence", () => {
  const mkEvent = (
    id: string,
    type: CommissionEventType,
    at: string,
    actor = ASSIGNEE,
    evidence?: string,
  ): CommissionEvent => ({
    id,
    type,
    thread: THREAD,
    actor,
    at,
    ...(evidence !== undefined ? { evidence } : {}),
  });

  const COMMISSION_ID = "https://bob.example/build/events/commission#it";
  const MERGE_ID = "https://bob.example/build/events/merge#it";
  const happyPath = (): CommissionEvent[] => [
    mkEvent(COMMISSION_ID, "commission", "2026-07-05T10:00:00Z", COMMISSIONER, "https://c/1#it"),
    mkEvent("https://bob.example/build/events/start#it", "start", "2026-07-05T10:05:00Z"),
    mkEvent("https://bob.example/build/events/pr#it", "open-pr", "2026-07-05T10:10:00Z"),
    mkEvent("https://bob.example/build/events/rev#it", "request-review", "2026-07-05T10:15:00Z"),
    mkEvent(MERGE_ID, "merge", "2026-07-05T10:20:00Z", CAROL, "https://c/2#it"),
  ];

  it("folds the happy path to `merged` when BOTH gates verified", () => {
    const fold = foldCommissionState(happyPath(), {
      verifiedCommissions: new Set([COMMISSION_ID]),
      approvedMerges: new Set([MERGE_ID]),
    });
    expect(fold.state).toBe("merged");
    expect(fold.rejected).toHaveLength(0);
    expect(fold.applied.map((a) => a.to)).toEqual([
      "commissioned",
      "in-progress",
      "pr-open",
      "in-review",
      "merged",
    ]);
  });

  it("is ORDER-INDEPENDENT — a shuffled event array folds to the same state", () => {
    const events = happyPath();
    const gates = {
      verifiedCommissions: new Set([COMMISSION_ID]),
      approvedMerges: new Set([MERGE_ID]),
    };
    const canonical = foldCommissionState(events, gates);
    // Every permutation-ish reordering yields the identical result (sorted by dct:created).
    for (const shuffled of [
      [...events].reverse(),
      [events[4], events[0], events[3], events[1], events[2]] as CommissionEvent[],
      [events[2], events[4], events[1], events[0], events[3]] as CommissionEvent[],
    ]) {
      const fold = foldCommissionState(shuffled, gates);
      expect(fold.state).toBe(canonical.state);
      expect(fold.applied.map((a) => `${a.from}->${a.to}`)).toEqual(
        canonical.applied.map((a) => `${a.from}->${a.to}`),
      );
    }
  });

  it("REFUSES the `merged` transition when the merge quorum did NOT verify (stays in-review)", () => {
    const fold = foldCommissionState(happyPath(), {
      verifiedCommissions: new Set([COMMISSION_ID]),
      approvedMerges: new Set(), // the quorum was NOT met/allowed
    });
    expect(fold.state).toBe("in-review");
    const mergeRejection = fold.rejected.find((r) => r.event.id === MERGE_ID);
    expect(mergeRejection?.reason).toBe("unverified-evidence");
  });

  it("REFUSES `commissioned` when the commission credential did NOT verify (stays drafted)", () => {
    const fold = foldCommissionState(happyPath(), {
      verifiedCommissions: new Set(), // the commission did not verify
      approvedMerges: new Set([MERGE_ID]),
    });
    expect(fold.state).toBe("drafted");
    expect(fold.rejected[0]?.reason).toBe("unverified-evidence");
    // …and every later event is then an illegal edge from `drafted` (fail-isolated).
    expect(fold.applied).toHaveLength(0);
  });

  it("is FAIL-ISOLATED: an illegal event is skipped + recorded, the fold continues", () => {
    const events = [
      mkEvent(COMMISSION_ID, "commission", "2026-07-05T10:00:00Z", COMMISSIONER),
      // an out-of-place `merge` while only `commissioned` — illegal, must be skipped
      mkEvent("https://bob.example/build/events/badmerge#it", "merge", "2026-07-05T10:02:00Z"),
      mkEvent("https://bob.example/build/events/start#it", "start", "2026-07-05T10:05:00Z"),
    ];
    const fold = foldCommissionState(events, {
      verifiedCommissions: new Set([COMMISSION_ID]),
      approvedMerges: new Set(["https://bob.example/build/events/badmerge#it"]),
    });
    expect(fold.state).toBe("in-progress"); // commission + start applied; bad merge skipped
    expect(fold.rejected.find((r) => r.reason === "illegal-transition")).toBeDefined();
  });

  it("COMPUTED, not asserted: the fold ignores a spoofed cached state triple (INV-3)", () => {
    // Persist events that fold to `in-progress`, but SPOOF a `unite:commissionState Merged`
    // triple on the task. readCommissionState returns the hint; the fold recomputes the
    // truth from the events — a captured pod cannot decree a merge.
    const events = [
      mkEvent(COMMISSION_ID, "commission", "2026-07-05T10:00:00Z", COMMISSIONER),
      mkEvent("https://bob.example/build/events/start#it", "start", "2026-07-05T10:05:00Z"),
    ];
    const spoof = new Store([
      ...events.flatMap(buildCommissionEventQuads),
      ...buildCommissionStateQuads(THREAD, "merged"), // the SPOOF
    ]);
    expect(readCommissionState(spoof, THREAD)).toBe("merged"); // the (untrusted) hint
    const parsed = parseCommissionEvents(spoof, { thread: THREAD });
    const fold = foldCommissionState(parsed, {
      verifiedCommissions: new Set([COMMISSION_ID]),
    });
    expect(fold.state).toBe("in-progress"); // the AUTHORITATIVE recomputed state
  });

  it("END-TO-END with real crypto: verify the commission + merge, then fold to merged", async () => {
    // Build the two signed gates for REAL, populate the fold's verified sets from the
    // verification results, then fold — the full write-path integration.
    const commissionVc = await issueCommission({
      commissioner: COMMISSIONER,
      assignee: ASSIGNEE,
      assigneeKey: keyAssignee.publicKey,
      artifact: ARTIFACT,
      key: keyCommissioner,
    });
    const commissionOk = await verifyCommission(commissionVc, {
      verifyVc: realVerify,
      trustedCommissioners: TRUSTED_COMMISSIONERS,
      artifact: ARTIFACT,
      assignee: ASSIGNEE,
    });

    const carolVc = await reviewerAttestation(CAROL, keyCarol);
    const daveVc = await reviewerAttestation(DAVE, keyDave);
    const mergeVcs = [carolVc, daveVc];
    const merge = await verifyMergeQuorum(ARTIFACT_QUADS, mergeVcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: TRUSTED_REVIEWERS,
      builder: ASSIGNEE,
    });

    const verifiedCommissions = new Set(commissionOk.verified ? [COMMISSION_ID] : []);
    const approvedMerges = new Set(merge.allowed ? [MERGE_ID] : []);
    const fold = foldCommissionState(happyPath(), { verifiedCommissions, approvedMerges });

    expect(commissionOk.verified).toBe(true);
    expect(merge.allowed).toBe(true);
    expect(fold.state).toBe("merged");

    // And the negative: strip the second reviewer → the merge is not allowed → the fold
    // halts at in-review (no merge without a valid ≥2 quorum).
    const subMerge = await verifyMergeQuorum(ARTIFACT_QUADS, [carolVc], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: TRUSTED_REVIEWERS,
      builder: ASSIGNEE,
    });
    const halted = foldCommissionState(happyPath(), {
      verifiedCommissions,
      approvedMerges: new Set(subMerge.allowed ? [MERGE_ID] : []),
    });
    expect(subMerge.allowed).toBe(false);
    expect(halted.state).toBe("in-review");
  });
});
