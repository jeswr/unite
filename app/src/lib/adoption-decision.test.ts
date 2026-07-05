// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.4 the SIGNED fut:AdoptionDecision — the governance keystone. The attack
// surface IS the test surface. The load-bearing S3 requirement is EXERCISED with
// REAL solid-vc crypto (issue + verifyCredential over a real RDFC-1.0 digest):
//   • a ratification WITHOUT a trustedStewards allowlist FAILS CLOSED (throws —
//     the quorum never runs unprotected);
//   • a SUB-quorum ratification is not valid (< the ≥2 floor);
//   • an untrusted (off-allowlist) steward does not count;
//   • the ≥2 floor cannot be lowered by a caller (threshold clamps up);
//   • INV-1 (only consented lineage), INV-2 (mandatory dissent annex), INV-3
//     (no asserted status — a spoofed status triple is IGNORED, status recomputed)
//     are enforced at build/parse time;
//   • untrusted RDF drops the field/item;
//   • the registry-backed steward allowlist resolves fail-closed.

import { buildRegistry } from "@jeswr/federation-registry";
import {
  digestQuads,
  generateKeyPairForSuite,
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import { beforeAll, describe, expect, it } from "vitest";
import { SCOPES } from "../scope/scopes.js";
import type { AdoptionObservation } from "./adoption.js";
import {
  type AdoptionDecisionInput,
  buildAdoptionDecisionQuads,
  computeDecisionStatus,
  issueStewardAttestation,
  parseAdoptionDecisions,
  resolveTrustedStewards,
  reviewerEndorsementGate,
  stewardSigningGate,
  verifyAdoptionDecision,
  verifyAdoptionDecisionQuorum,
} from "./adoption-decision.js";
import { NS, RDF_TYPE } from "./fut.js";
import {
  FUT_ADOPTION_DECISION,
  FUT_ADOPTION_EVIDENCE,
  FUT_ADOPTION_OBSERVATION,
  FUT_BRIDGING_EVIDENCE,
  FUT_DISSENT,
  FUT_OBSERVED_PARTY,
  FUT_OBSERVED_VERSION,
  FUT_SHARED_FUTURE,
} from "./fut-draft.js";
import type { TrustProfile } from "./trust.js";

const { namedNode, literal, blankNode, quad } = DataFactory;

const DELIB = "https://d.example/futures";
const DECISION = "https://d.example/decisions/ad-1.ttl#it";
const V2 = "https://w3id.org/jeswr/sectors/futures/0.2.0";
const INPUT_A = "https://a.example/needs/n1.ttl#it";
const INPUT_B = "https://b.example/needs/n2.ttl#it";
const PARTY_1 = "https://impl1.example/";
const PARTY_2 = "https://impl2.example/";
const SRC_1 = "https://impl1.example/.well-known/storage.ttl";
const SRC_2 = "https://impl2.example/.well-known/storage.ttl";

const STEWARD_A = "https://alice.example/profile/card#me";
const STEWARD_B = "https://bob.example/profile/card#me";
const STEWARD_C = "https://carol.example/profile/card#me";
const ALL_STEWARDS = [STEWARD_A, STEWARD_B, STEWARD_C];

const obs = (party: string, version: string, source: string): AdoptionObservation => ({
  party,
  version,
  observedAt: "2026-07-04T00:00:00Z",
  source,
});

/** A valid decision recommending V2 with two consented inputs + a dissent annex. */
function validInput(overrides: Partial<AdoptionDecisionInput> = {}): AdoptionDecisionInput {
  return {
    id: DECISION,
    content: "Recommend adopting futures sector 0.2.0",
    title: "Adopt 0.2.0",
    proposesVersion: V2,
    adoptionBar: 2,
    adoptionEvidence: [obs(PARTY_1, V2, SRC_1), obs(PARTY_2, V2, SRC_2)],
    derivedFrom: [INPUT_A, INPUT_B],
    bridgingEvidence: [
      {
        clusterLabel: "cluster-0",
        resonatesCount: 3,
        conflictsCount: 0,
        unsureCount: 0,
        seenCount: 3,
      },
      {
        clusterLabel: "cluster-1",
        resonatesCount: 2,
        conflictsCount: 0,
        unsureCount: 0,
        seenCount: 2,
      },
    ],
    dissent: [{ content: "A minority prefers 0.1.0 stability" }],
    methodProvenance: `${NS.fut}resonance-mapping`,
    created: "2026-07-04T00:00:00Z",
    creator: STEWARD_A,
    inDeliberation: DELIB,
    ...overrides,
  };
}

const GATE = { synthesizable: new Set([INPUT_A, INPUT_B]) };

// ── Real crypto: keys + resolver + verify (the quorum.test pattern) ──────────
let keyA: KeyPair;
let keyB: KeyPair;
let keyC: KeyPair;
let realResolveKey: (vm: string) => Promise<CryptoKey | undefined>;
const realVerify = (vc: VerifiableCredential): Promise<VerificationResult> =>
  verifyCredential(vc, { resolveKey: realResolveKey });

beforeAll(async () => {
  keyA = await generateKeyPairForSuite(`${STEWARD_A}#key`, "Ed25519");
  keyB = await generateKeyPairForSuite(`${STEWARD_B}#key`, "Ed25519");
  keyC = await generateKeyPairForSuite(`${STEWARD_C}#key`, "Ed25519");
  const keys = new Map<string, CryptoKey>([
    [keyA.verificationMethod, keyA.publicKey],
    [keyB.verificationMethod, keyB.publicKey],
    [keyC.verificationMethod, keyC.publicKey],
  ]);
  realResolveKey = async (vm: string) => keys.get(vm);
});

async function steward(
  webId: string,
  key: KeyPair,
  quads: readonly Quad[],
): Promise<VerifiableCredential> {
  return issueStewardAttestation({ subject: DECISION, decisionQuads: quads, webId, key });
}

// ── Build-time invariant enforcement (INV-1 / INV-2 / INV-3) ─────────────────
describe("buildAdoptionDecisionQuads — build-time invariants", () => {
  it("builds a valid decision graph (typed AdoptionDecision AND SharedFuture)", () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const types = quads
      .filter((q) => q.subject.value === DECISION && q.predicate.value === RDF_TYPE)
      .map((q) => q.object.value);
    expect(types).toContain(FUT_ADOPTION_DECISION);
    expect(types).toContain(FUT_SHARED_FUTURE);
  });

  it("INV-1: throws when a derivedFrom input lacks fut:synthesize consent", () => {
    expect(() =>
      buildAdoptionDecisionQuads(
        validInput({ derivedFrom: [INPUT_A, "https://evil.example/x#it"] }),
        GATE,
      ),
    ).toThrow(/synthesize consent|INV-1/);
  });

  it("INV-1: throws on an empty lineage (a decision must derive from ≥1 statement)", () => {
    expect(() => buildAdoptionDecisionQuads(validInput({ derivedFrom: [] }), GATE)).toThrow(
      /derive from/,
    );
  });

  it("INV-2: throws with NEITHER dissent nor noDissentRecorded", () => {
    expect(() => buildAdoptionDecisionQuads(validInput({ dissent: [] }), GATE)).toThrow(
      /dissent annex/,
    );
  });

  it("INV-2: throws when noDissentRecorded true is combined with actual dissent", () => {
    expect(() => buildAdoptionDecisionQuads(validInput({ noDissentRecorded: true }), GATE)).toThrow(
      /noDissentRecorded true is only valid/,
    );
  });

  it("INV-2: accepts noDissentRecorded true when the annex carries NO dissent", () => {
    const quads = buildAdoptionDecisionQuads(
      validInput({ dissent: [], noDissentRecorded: true }),
      GATE,
    );
    const flag = quads.find((q) => q.predicate.value === `${NS.fut}noDissentRecorded`);
    expect(flag?.object.value).toBe("true");
  });

  it("INV-3: emits NO adoptionStatus / status decree property", () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const statusish = quads.filter((q) => /status/i.test(q.predicate.value));
    expect(statusish).toHaveLength(0);
  });

  it("throws without ≥1 bridging evidence (the common-ground proof)", () => {
    expect(() => buildAdoptionDecisionQuads(validInput({ bridgingEvidence: [] }), GATE)).toThrow(
      /bridgingEvidence/,
    );
  });

  it("throws on a non-http proposesVersion", () => {
    expect(() =>
      buildAdoptionDecisionQuads(validInput({ proposesVersion: "urn:not-http" }), GATE),
    ).toThrow(/proposesVersion/);
  });

  it("throws on INCONSISTENT bridging counts (seen ≠ resonates+conflicts+unsure)", () => {
    expect(() =>
      buildAdoptionDecisionQuads(
        validInput({
          bridgingEvidence: [
            {
              clusterLabel: "c0",
              resonatesCount: 3,
              conflictsCount: 1,
              unsureCount: 0,
              seenCount: 3,
            },
          ],
        }),
        GATE,
      ),
    ).toThrow(/seenCount/);
  });

  it("throws on an EMPTY clusterLabel (mirrors the parser drop — no silent proof loss)", () => {
    expect(() =>
      buildAdoptionDecisionQuads(
        validInput({
          bridgingEvidence: [
            {
              clusterLabel: "",
              resonatesCount: 3,
              conflictsCount: 0,
              unsureCount: 0,
              seenCount: 3,
            },
          ],
        }),
        GATE,
      ),
    ).toThrow(/clusterLabel/);
  });

  it("throws on an invalid observation observedAt (mirrors the parser drop)", () => {
    expect(() =>
      buildAdoptionDecisionQuads(
        validInput({
          adoptionEvidence: [
            { party: PARTY_1, version: V2, observedAt: "not-a-date", source: SRC_1 },
          ],
        }),
        GATE,
      ),
    ).toThrow(/observedAt/);
  });

  it("throws when an array exceeds MAX_LINKS — never build what the parser can't parse", () => {
    const many = Array.from({ length: 51 }, (_, i) => obs(`https://p${i}.example/`, V2, SRC_1));
    expect(() => buildAdoptionDecisionQuads(validInput({ adoptionEvidence: many }), GATE)).toThrow(
      /MAX_LINKS/,
    );
  });

  it("throws when adoptionBar exceeds the parser's cap (round-trip safety)", () => {
    expect(() => buildAdoptionDecisionQuads(validInput({ adoptionBar: 1_000_001 }), GATE)).toThrow(
      /adoptionBar exceeds/,
    );
  });

  it("round-trips the optional fut:bridgingScore through build → parse", () => {
    const quads = buildAdoptionDecisionQuads(
      validInput({
        bridgingEvidence: [
          {
            clusterLabel: "c0",
            resonatesCount: 3,
            conflictsCount: 0,
            unsureCount: 0,
            seenCount: 3,
            bridgingScore: 0.6,
          },
        ],
      }),
      GATE,
    );
    const [decision] = parseAdoptionDecisions(new Store([...quads]));
    expect(decision?.bridgingEvidence[0]?.bridgingScore).toBe(0.6);
  });
});

// ── The QUORUM ratification gate — the load-bearing S3 requirement ───────────
describe("verifyAdoptionDecision — the ≥2-steward quorum WITH the REQUIRED allowlist", () => {
  it("RATIFIES with two real distinct stewards on the allowlist (status COMPUTED)", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.ratified).toBe(true);
    expect(result.quorum.distinctStewards).toBe(2);
    // The signature attests the RECOMMENDATION; the status is separately COMPUTED
    // from the evidence (2 parties on V2 ≥ bar 2 → Current), never asserted.
    expect(result.computedStatus).toBe("current");
    expect(result.decision?.proposesVersion).toBe(V2);
  });

  it("a SUB-quorum (one steward) is NOT ratified — honest bootstrapping state", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.ratified).toBe(false);
    expect(result.quorum.distinctStewards).toBe(1);
    expect(result.quorum.bootstrapping).toBe(true);
  });

  it("THROWS fail-closed when NO trustedStewards allowlist is supplied (never runs unprotected)", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    // The load-bearing S3 requirement: no allowlist ⇒ the quorum path must NOT run.
    await expect(
      verifyAdoptionDecisionQuorum(quads, vcs, {
        verifyVc: realVerify,
        resolveKey: realResolveKey,
      } as unknown as Parameters<typeof verifyAdoptionDecisionQuorum>[2]),
    ).rejects.toThrow(/trustedStewards/);
    // The full verify path throws too — a ratification cannot skip the gate.
    await expect(
      verifyAdoptionDecision(quads, vcs, {
        verifyVc: realVerify,
        resolveKey: realResolveKey,
      } as unknown as Parameters<typeof verifyAdoptionDecision>[2]),
    ).rejects.toThrow(/trustedStewards/);
  });

  it("THROWS on an EMPTY / whitespace-only allowlist (empty is not 'no allowlist' bypass)", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    for (const bad of [[], ["   "], ["", "  "]]) {
      await expect(
        verifyAdoptionDecisionQuorum(quads, vcs, {
          verifyVc: realVerify,
          resolveKey: realResolveKey,
          trustedStewards: bad,
        }),
      ).rejects.toThrow(/trustedStewards/);
    }
  });

  it("does NOT count an off-allowlist (untrusted) steward", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: [STEWARD_A], // B is a real, valid steward but NOT recognised
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.ratified).toBe(false);
    expect(result.quorum.distinctStewards).toBe(1);
    expect(result.quorum.rejected.find((r) => r.reason === "untrusted-steward")?.issuer).toBe(
      STEWARD_B,
    );
  });

  it("cannot be lowered below the ≥2 floor by a caller (threshold clamps up)", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
      threshold: 1, // an attempt to lower the floor
    });
    expect(result.quorum.threshold).toBe(2);
    expect(result.ratified).toBe(false);
  });

  it("a steward VC signing a DIFFERENT decision's digest does not count (digest-mismatch)", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const otherQuads = buildAdoptionDecisionQuads(
      validInput({ content: "A different recommendation entirely" }),
      GATE,
    );
    const vcA = await steward(STEWARD_A, keyA, quads);
    const vcWrong = await steward(STEWARD_B, keyB, otherQuads); // signs OTHER content
    const result = await verifyAdoptionDecision(quads, [vcA, vcWrong], {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.quorum.distinctStewards).toBe(1);
    expect(result.quorum.rejected.find((r) => r.reason === "digest-mismatch")?.issuer).toBe(
      STEWARD_B,
    );
  });

  it("does NOT ratify a non-decision graph even when two stewards sign it", async () => {
    // Two stewards sign an arbitrary (non-AdoptionDecision) graph. The quorum over the
    // digest is met, but the graph does not parse as a fut:AdoptionDecision, so it is
    // NOT ratified — stewards cannot ratify a decision that does not exist.
    const nonDecision: Quad[] = [
      quad(
        namedNode("https://x.example/thing#it"),
        namedNode(`${NS.dct}title`),
        literal("not a decision"),
      ),
    ];
    const vcs = [
      await steward(STEWARD_A, keyA, nonDecision),
      await steward(STEWARD_B, keyB, nonDecision),
    ];
    const result = await verifyAdoptionDecision(nonDecision, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.quorum.met).toBe(true); // the signatures over the digest DO verify…
    expect(result.decision).toBeUndefined(); // …but there is no parseable decision…
    expect(result.ratified).toBe(false); // …so it is NOT ratified (fail-closed).
    expect(result.computedStatus).toBeUndefined();
  });

  it("does NOT ratify an AMBIGUOUS graph carrying two fut:AdoptionDecision subjects", async () => {
    // Two decisions in one signed graph: the caller cannot know WHICH subject was
    // ratified, so verify fails closed (exactly one parseable decision is required).
    const DECISION_2 = "https://d.example/decisions/ad-2.ttl#it";
    const combined = [
      ...buildAdoptionDecisionQuads(validInput(), GATE),
      ...buildAdoptionDecisionQuads(validInput({ id: DECISION_2 }), GATE),
    ];
    const vcs = [
      await steward(STEWARD_A, keyA, combined),
      await steward(STEWARD_B, keyB, combined),
    ];
    const result = await verifyAdoptionDecision(combined, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.quorum.met).toBe(true); // the signatures verify…
    expect(result.decision).toBeUndefined(); // …but the graph is ambiguous…
    expect(result.ratified).toBe(false); // …so nothing is ratified (fail-closed).
  });

  it("re-checks INV-1 at verify: a signed decision with UNCONSENTED lineage is not ratified", async () => {
    // A validly-built + validly-signed decision, but the verifier's synthesizable set
    // does NOT include one of its lineage inputs → the verify-time INV-1 re-check fails
    // → NOT ratified (defense-in-depth beyond the steward attestation).
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A]), // INPUT_B is NOT consented here
    });
    expect(result.quorum.met).toBe(true);
    expect(result.lineageConsented).toBe(false);
    expect(result.ratified).toBe(false);
  });

  it("ratifies when the supplied synthesizable set covers the whole lineage", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const result = await verifyAdoptionDecision(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      synthesizable: new Set([INPUT_A, INPUT_B]),
    });
    expect(result.lineageConsented).toBe(true);
    expect(result.ratified).toBe(true);
  });
});

// ── Parse + COMPUTED status (INV-3) + untrusted-RDF hardening ────────────────
describe("parseAdoptionDecisions + computeDecisionStatus — computed, never asserted", () => {
  it("parses a decision and reads NO status (a spoofed status triple is IGNORED)", () => {
    // A decision whose evidence is BELOW the bar (only 1 party) but which asserts a
    // spoofed `fut:adoptionStatus "Current"`. The parse never reads it; the status
    // is recomputed from the evidence → "proposed". A captured room cannot decree Current.
    const quads = buildAdoptionDecisionQuads(
      validInput({ adoptionEvidence: [obs(PARTY_1, V2, SRC_1)] }),
      GATE,
    );
    const store = new Store([
      ...quads,
      // The spoof: an asserted-status decree that MUST be ignored.
      quad(namedNode(DECISION), namedNode(`${NS.fut}adoptionStatus`), literal("Current")),
    ]);
    const [decision] = parseAdoptionDecisions(store);
    expect(decision).toBeDefined();
    if (!decision) return;
    // The parsed shape carries NO status field at all (INV-3).
    expect(Object.keys(decision)).not.toContain("status");
    expect(Object.keys(decision)).not.toContain("adoptionStatus");
    // Recomputed: 1 party < bar 2 → Proposed. The spoofed "Current" is ignored.
    const status = computeDecisionStatus(
      decision.proposesVersion,
      decision.adoptionEvidence,
      decision.adoptionBar,
    );
    expect(status).toBe("proposed");
  });

  it("computes Current when the bar is met (evidence, not a decree)", () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const [decision] = parseAdoptionDecisions(new Store([...quads]));
    expect(decision).toBeDefined();
    if (!decision) return;
    expect(
      computeDecisionStatus(
        decision.proposesVersion,
        decision.adoptionEvidence,
        decision.adoptionBar,
      ),
    ).toBe("current");
  });

  it("untrusted RDF drops the FIELD: a malformed observation drops, siblings survive", () => {
    const quads = buildAdoptionDecisionQuads(
      validInput({ adoptionEvidence: [obs(PARTY_1, V2, SRC_1)] }),
      GATE,
    );
    // Inject a HOSTILE second observation whose observedParty is a LITERAL (not an
    // http IRI) — readIri drops it → the observation drops, the valid one survives.
    const bad = blankNode("hostile");
    const store = new Store([
      ...quads,
      quad(namedNode(DECISION), namedNode(FUT_ADOPTION_EVIDENCE), bad),
      quad(bad, namedNode(RDF_TYPE), namedNode(FUT_ADOPTION_OBSERVATION)),
      quad(bad, namedNode(FUT_OBSERVED_PARTY), literal("not-an-iri")),
      quad(bad, namedNode(FUT_OBSERVED_VERSION), namedNode(V2)),
    ]);
    const [decision] = parseAdoptionDecisions(store);
    expect(decision?.adoptionEvidence).toHaveLength(1); // the hostile one dropped
    expect(decision?.adoptionEvidence[0]?.party).toBe(PARTY_1);
  });

  it("untrusted RDF drops the ITEM: a decision missing its dissent annex is not parsed", () => {
    // Start from a fully valid decision, then STRIP the dissent annex — the ONLY
    // remaining defect is the missing annex, so the item drops for exactly that.
    const full = buildAdoptionDecisionQuads(validInput({ dissent: [{ content: "x" }] }), GATE);
    const dissentNodes = new Set(
      full.filter((q) => q.predicate.value === FUT_DISSENT).map((q) => q.object.value),
    );
    const stripped = full.filter(
      (q) => q.predicate.value !== FUT_DISSENT && !dissentNodes.has(q.subject.value),
    );
    expect(parseAdoptionDecisions(new Store(stripped))).toHaveLength(0);
  });

  it("parse mirrors the build: a decision missing the fut:SharedFuture superclass type is dropped", () => {
    // The builder types a decision as BOTH fut:AdoptionDecision AND fut:SharedFuture;
    // strip the superclass type → the decision is not discoverable as a SharedFuture,
    // so the parse drops it (a hand-authored graph cannot omit the superclass).
    const full = buildAdoptionDecisionQuads(validInput(), GATE);
    const stripped = full.filter(
      (q) => !(q.predicate.value === RDF_TYPE && q.object.value === FUT_SHARED_FUTURE),
    );
    expect(parseAdoptionDecisions(new Store(stripped))).toHaveLength(0);
  });

  it("parse mirrors the build: a decision with NO bridging evidence is dropped", () => {
    // The parse must require the common-ground proof too (a hand-authored signed
    // graph cannot omit it): strip fut:bridgingEvidence from an otherwise-valid graph.
    const full = buildAdoptionDecisionQuads(validInput(), GATE);
    const beNodes = new Set(
      full.filter((q) => q.predicate.value === FUT_BRIDGING_EVIDENCE).map((q) => q.object.value),
    );
    const stripped = full.filter(
      (q) => q.predicate.value !== FUT_BRIDGING_EVIDENCE && !beNodes.has(q.subject.value),
    );
    expect(parseAdoptionDecisions(new Store(stripped))).toHaveLength(0);
  });

  it("a CONTENT-LESS dangling fut:dissent does not satisfy the annex (dropped)", () => {
    // Strip the as:content off the dissent record → a dangling dissent edge that must
    // NOT count as a valid annex (and there is no noDissentRecorded flag).
    const full = buildAdoptionDecisionQuads(validInput({ dissent: [{ content: "x" }] }), GATE);
    const dissentNodes = new Set(
      full.filter((q) => q.predicate.value === FUT_DISSENT).map((q) => q.object.value),
    );
    const stripped = full.filter(
      (q) => !(dissentNodes.has(q.subject.value) && q.predicate.value === `${NS.as}content`),
    );
    expect(parseAdoptionDecisions(new Store(stripped))).toHaveLength(0);
  });

  it("drops a CONTRADICTORY annex: both content-bearing dissent AND noDissentRecorded true", () => {
    // The build rejects this contradiction; the parse must mirror it (a synthesis
    // cannot both quote dissent AND claim there was none).
    const full = buildAdoptionDecisionQuads(validInput(), GATE); // has dissent, no flag
    const contradiction = [
      ...full,
      quad(
        namedNode(DECISION),
        namedNode(`${NS.fut}noDissentRecorded`),
        literal("true", namedNode(`${NS.xsd}boolean`)),
      ),
    ];
    expect(parseAdoptionDecisions(new Store(contradiction))).toHaveLength(0);
  });

  it("drops a MULTI-VALUED noDissentRecorded that tries to hide the dissent contradiction", () => {
    // A graph with content-bearing dissent PLUS noDissentRecorded true — but DUPLICATED
    // so readBoolean's single() would return undefined (silently masking the flag). The
    // strict reader rejects a multi-valued flag → the annex is invalid → the item drops.
    const full = buildAdoptionDecisionQuads(validInput(), GATE); // has dissent, no flag
    const trueLit = literal("true", namedNode(`${NS.xsd}boolean`));
    const falseLit = literal("false", namedNode(`${NS.xsd}boolean`));
    const attack = [
      ...full,
      quad(namedNode(DECISION), namedNode(`${NS.fut}noDissentRecorded`), trueLit),
      quad(namedNode(DECISION), namedNode(`${NS.fut}noDissentRecorded`), falseLit),
    ];
    expect(parseAdoptionDecisions(new Store(attack))).toHaveLength(0);
  });

  it("FAIL-CLOSED lineage: a malformed extra prov:wasDerivedFrom drops the whole item", () => {
    // model.readIris would SILENTLY drop a malformed lineage value (hiding it from the
    // verify-time INV-1 check); the strict reader drops the whole decision instead, so
    // unconsented/hidden lineage can never be ratified.
    const full = buildAdoptionDecisionQuads(validInput(), GATE);
    const withBadLineage = [
      ...full,
      quad(namedNode(DECISION), namedNode(`${NS.prov}wasDerivedFrom`), literal("not-an-iri")),
    ];
    expect(parseAdoptionDecisions(new Store(withBadLineage))).toHaveLength(0);
  });

  it("BOUNDED: a hostile fut:adoptionEvidence fan-out drops the whole decision", () => {
    // MAX_LINKS is 50; inject 51 extra evidence edges → readEvidence overflows → the
    // decision drops fail-closed (a huge dataset cannot force unbounded parsing).
    const full = buildAdoptionDecisionQuads(
      validInput({ adoptionEvidence: [obs(PARTY_1, V2, SRC_1)] }),
      GATE,
    );
    const extra: Quad[] = [];
    for (let i = 0; i < 51; i++) {
      extra.push(quad(namedNode(DECISION), namedNode(FUT_ADOPTION_EVIDENCE), blankNode(`x${i}`)));
    }
    expect(parseAdoptionDecisions(new Store([...full, ...extra]))).toHaveLength(0);
  });

  it("parses TWO decisions in ONE dataset without blank-node collision", () => {
    // Fresh unlabeled blank nodes: two separately-built decision graphs must not have
    // their observations / bridging evidence / dissent records merge in a shared Store.
    const DECISION_2 = "https://d.example/decisions/ad-2.ttl#it";
    const d1 = buildAdoptionDecisionQuads(
      validInput({ adoptionEvidence: [obs(PARTY_1, V2, SRC_1)] }),
      GATE,
    );
    const d2 = buildAdoptionDecisionQuads(
      validInput({
        id: DECISION_2,
        adoptionEvidence: [obs(PARTY_1, V2, SRC_1), obs(PARTY_2, V2, SRC_2)],
      }),
      GATE,
    );
    const decisions = parseAdoptionDecisions(new Store([...d1, ...d2]));
    expect(decisions).toHaveLength(2);
    const byId = new Map(decisions.map((d) => [d.id, d]));
    // Each decision keeps its OWN evidence count — no cross-contamination.
    expect(byId.get(DECISION)?.adoptionEvidence).toHaveLength(1);
    expect(byId.get(DECISION_2)?.adoptionEvidence).toHaveLength(2);
    // …and its own bridging evidence + dissent annex survive.
    expect(byId.get(DECISION)?.bridgingEvidence.length).toBeGreaterThan(0);
    expect(byId.get(DECISION_2)?.hasDissentAnnex).toBe(true);
  });

  it("drops a bridging-evidence node with INCONSISTENT counts (parse mirrors build)", () => {
    // A single bridging evidence whose seenCount is tampered to not equal the sum →
    // the node drops → no common-ground proof left → the decision drops.
    const full = buildAdoptionDecisionQuads(
      validInput({
        bridgingEvidence: [
          {
            clusterLabel: "c0",
            resonatesCount: 3,
            conflictsCount: 0,
            unsureCount: 0,
            seenCount: 3,
          },
        ],
      }),
      GATE,
    );
    const tampered = full.map((q) =>
      q.predicate.value === `${NS.fut}seenCount`
        ? quad(q.subject, q.predicate, literal("99", namedNode(`${NS.xsd}nonNegativeInteger`)))
        : q,
    );
    expect(parseAdoptionDecisions(new Store(tampered))).toHaveLength(0);
  });
});

// ── The registry-backed steward allowlist ────────────────────────────────────
describe("resolveTrustedStewards — the registry-backed canonical allowlist", () => {
  const REGISTRY = "https://community.example/stewards.ttl";

  function fetchServing(docs: Record<string, string>): typeof fetch {
    return async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const body = docs[url];
      if (body === undefined) return new Response("not found", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
    };
  }

  it("returns only the ACTIVE steward memberships' WebIDs (Revoked/Proposed excluded)", async () => {
    const doc = await buildRegistry({
      id: REGISTRY,
      members: [
        {
          id: `${REGISTRY}#m0`,
          app: STEWARD_A,
          status: "Active",
          assertedBy: ["https://community.example/#reg"],
        },
        {
          id: `${REGISTRY}#m1`,
          app: STEWARD_B,
          status: "Active",
          assertedBy: ["https://community.example/#reg"],
        },
        {
          id: `${REGISTRY}#m2`,
          app: STEWARD_C,
          status: "Revoked",
          assertedBy: ["https://community.example/#reg"],
        },
      ],
    }).toString();
    const stewards = await resolveTrustedStewards(REGISTRY, {
      fetch: fetchServing({ [REGISTRY]: doc }),
    });
    expect(stewards).toEqual([STEWARD_A, STEWARD_B].sort());
    expect(stewards).not.toContain(STEWARD_C);
  });

  it("fails closed to [] on a broken registry (which BLOCKS the quorum downstream)", async () => {
    const stewards = await resolveTrustedStewards(REGISTRY, { fetch: fetchServing({}) });
    expect(stewards).toEqual([]);
  });

  it("refuses a non-https registry IRI", async () => {
    const stewards = await resolveTrustedStewards("http://community.example/s.ttl", {
      fetch: fetchServing({}),
    });
    expect(stewards).toEqual([]);
  });
});

// ── Reviewer / steward endorsement gating (composing trust.ts) ───────────────
describe("reviewer / steward endorsement gates (compose trust.ts, fail-closed)", () => {
  const infraGate = SCOPES.infrastructure.endorsementGate;
  const reviewer: TrustProfile = { tier: 1, roles: ["reviewer"] };
  const stewardProfile: TrustProfile = { tier: 1, roles: ["steward"] };
  const plain: TrustProfile = { tier: 1, roles: [] };

  it("reviewer gate LOCKS a session without the reviewer role (infrastructure)", () => {
    expect(reviewerEndorsementGate(plain, infraGate).allowed).toBe(false);
    expect(reviewerEndorsementGate(reviewer, infraGate).allowed).toBe(true);
  });

  it("reviewer gate is open when the scope does not require the role", () => {
    expect(reviewerEndorsementGate(plain, SCOPES.apps.endorsementGate).allowed).toBe(true);
  });

  it("steward gate LOCKS signing to a verified steward", () => {
    expect(stewardSigningGate(plain).allowed).toBe(false);
    expect(stewardSigningGate(stewardProfile).allowed).toBe(true);
  });
});

// ── The steward attestation composition (real solid-vc) ──────────────────────
describe("issueStewardAttestation — a real single-steward signature over the digest", () => {
  it("binds the decision's RDFC-1.0 digest and verifies with the shipped verifier", async () => {
    const quads = buildAdoptionDecisionQuads(validInput(), GATE);
    const vc = await steward(STEWARD_A, keyA, quads);
    const digest = await digestQuads(quads);
    expect(vc.relatedResource?.[0]?.digestMultibase).toBe(digest);
    expect((await realVerify(vc)).verified).toBe(true);
  });
});
