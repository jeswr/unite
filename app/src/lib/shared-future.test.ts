// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.2 the SIGNED fut:SharedFuture — the maintainer's hard invariant is
// "un-signable if it drops dissent". The attack surface IS the test surface, and
// the load-bearing paths are exercised with REAL solid-vc crypto (issue +
// verifyCredential over a real RDFC-1.0 digest):
//   • a synthesis that DROPS a standing critique from the annex is UN-SIGNABLE (throws, D2);
//   • the mandatory dissent annex (D1) + method-provenance (D4) + bridging evidence (D3)
//     + INV-1 consent are enforced at build/parse time;
//   • k-anonymity BLOCKS a too-small-cohort publish (build throws; a sub-k metrics
//     leak in a signed graph is not ratified);
//   • signing WITHOUT a trustedStewards allowlist FAILS CLOSED (throws);
//   • a SUB-quorum SharedFuture is invalid; an untrusted steward does not count;
//   • the ≥2 floor cannot be lowered by a caller (threshold clamps up);
//   • a spoofed/tampered graph cannot be smuggled past the signature (digest-mismatch);
//   • untrusted RDF drops the field/item.

import {
  generateKeyPairForSuite,
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import { beforeAll, describe, expect, it } from "vitest";
import { publishConvergenceMetrics } from "./convergence-metrics.js";
import { buildDissentAnnexQuads, type MaterializedDissent, materializeDissent } from "./dissent.js";
import { NS, RDF_TYPE } from "./fut.js";
import { FUT_NO_DISSENT_RECORDED, FUT_SHARED_FUTURE } from "./fut-draft.js";
import { METHOD_MEDIATED_SYNTHESIS, METHOD_RESONANCE_MAPPING } from "./fut-society.js";
import type { Critique } from "./model.js";
import {
  buildSharedFutureQuads,
  issueSharedFutureAttestation,
  parseSharedFutures,
  type SharedFutureGate,
  type SharedFutureInput,
  serializeSharedFuture,
  verifySharedFuture,
  verifySharedFutureQuorum,
} from "./shared-future.js";

const { namedNode, literal, quad } = DataFactory;

const DELIB = "https://d.example/futures";
const FUTURE = "https://d.example/futures/sf-1.ttl#it";
const METRICS = "https://d.example/futures/sf-1-metrics.ttl#it";
const INPUT_A = "https://a.example/visions/v1.ttl#it";
const INPUT_B = "https://b.example/claims/c1.ttl#it";
const CRIT_1 = "https://c.example/critiques/k1.ttl#it";
const CRIT_2 = "https://d2.example/critiques/k2.ttl#it";
const CRIT_3 = "https://d3.example/critiques/k3.ttl#it";

const STEWARD_A = "https://alice.example/profile/card#me";
const STEWARD_B = "https://bob.example/profile/card#me";
const STEWARD_C = "https://carol.example/profile/card#me";
const ALL_STEWARDS = [STEWARD_A, STEWARD_B, STEWARD_C];

const critique = (id: string, creator: string): Critique => ({
  id,
  content: `A standing concern from ${creator}`,
  onStatement: FUTURE,
  created: "2026-07-04T00:00:00Z",
  creator,
  inDeliberation: DELIB,
});

/** A dissent annex materialised from the given critiques (aggregate-only by default). */
function annex(
  critiques: readonly Critique[],
  quoteVerbatimConsent?: ReadonlySet<string>,
): MaterializedDissent {
  return materializeDissent(critiques, {
    ...(quoteVerbatimConsent ? { quoteVerbatimConsent } : {}),
  });
}

/** A valid SharedFuture with two consented inputs + a real dissent annex. */
function validInput(overrides: Partial<SharedFutureInput> = {}): SharedFutureInput {
  return {
    id: FUTURE,
    content: "A shared future: universal access to affordable housing by 2040.",
    title: "Housing 2040",
    derivedFrom: [INPUT_A, INPUT_B],
    bridgingEvidence: [
      {
        clusterLabel: "cluster-0",
        resonatesCount: 4,
        conflictsCount: 0,
        unsureCount: 0,
        seenCount: 4,
      },
      {
        clusterLabel: "cluster-1",
        resonatesCount: 3,
        conflictsCount: 1,
        unsureCount: 0,
        seenCount: 4,
      },
    ],
    dissent: annex([critique(CRIT_1, STEWARD_C)]),
    methodProvenance: METHOD_RESONANCE_MAPPING,
    contributorCount: 8,
    created: "2026-07-04T00:00:00Z",
    creator: STEWARD_A,
    inDeliberation: DELIB,
    ...overrides,
  };
}

const GATE: SharedFutureGate = {
  synthesizable: new Set([INPUT_A, INPUT_B]),
  standingCritiqueIds: new Set([CRIT_1]),
  kThreshold: 5,
};

// ── Real crypto: keys + resolver + verify (the S3 pattern) ────────────────────
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
  return issueSharedFutureAttestation({ subject: FUTURE, futureQuads: quads, webId, key });
}

// ── Build-time invariants: the un-signable-if-it-drops-dissent guarantee ──────
describe("buildSharedFutureQuads — structural invariants", () => {
  it("builds a valid fut:SharedFuture graph", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const types = quads
      .filter((q) => q.subject.value === FUTURE && q.predicate.value === RDF_TYPE)
      .map((q) => q.object.value);
    expect(types).toContain(FUT_SHARED_FUTURE);
  });

  it("D2: THROWS (un-signable) when the annex DROPS a standing critique", () => {
    // Two critiques stood at endorsement, but the annex accounts for only one.
    const gate: SharedFutureGate = {
      ...GATE,
      standingCritiqueIds: new Set([CRIT_1, CRIT_2]),
    };
    expect(() =>
      buildSharedFutureQuads(validInput({ dissent: annex([critique(CRIT_1, STEWARD_C)]) }), gate),
    ).toThrow(/DROPS a standing critique|UN-SIGNABLE/);
  });

  it("D2: signable when the annex accounts for EVERY standing critique", () => {
    const gate: SharedFutureGate = { ...GATE, standingCritiqueIds: new Set([CRIT_1, CRIT_2]) };
    const both = annex([critique(CRIT_1, STEWARD_C), critique(CRIT_2, STEWARD_B)]);
    expect(() => buildSharedFutureQuads(validInput({ dissent: both }), gate)).not.toThrow();
  });

  it("D1: THROWS when there is neither a dissent record nor noDissentRecorded", () => {
    expect(() =>
      buildSharedFutureQuads(validInput({ dissent: annex([]), noDissentRecorded: false }), {
        ...GATE,
        standingCritiqueIds: new Set(),
      }),
    ).toThrow(/dissent annex/);
  });

  it("D1: noDissentRecorded true is valid only with an EMPTY annex + NO standing critiques", () => {
    // valid: no critiques, explicit no-dissent
    expect(() =>
      buildSharedFutureQuads(validInput({ dissent: annex([]), noDissentRecorded: true }), {
        ...GATE,
        standingCritiqueIds: new Set(),
      }),
    ).not.toThrow();
    // contradiction: records AND the flag
    expect(() =>
      buildSharedFutureQuads(
        validInput({ dissent: annex([critique(CRIT_1, STEWARD_C)]), noDissentRecorded: true }),
        GATE,
      ),
    ).toThrow(/only valid when the annex carries NO dissent/);
  });

  it("D1/D2: noDissentRecorded true THROWS when critiques stood at endorsement", () => {
    expect(() =>
      buildSharedFutureQuads(validInput({ dissent: annex([]), noDissentRecorded: true }), GATE),
    ).toThrow(/cannot assert fut:noDissentRecorded|stood at endorsement/);
  });

  it("D3: THROWS when there is no bridging evidence", () => {
    expect(() => buildSharedFutureQuads(validInput({ bridgingEvidence: [] }), GATE)).toThrow(
      /bridgingEvidence/,
    );
  });

  it("D3: THROWS on count-inconsistent bridging evidence (seen ≠ r+c+u)", () => {
    expect(() =>
      buildSharedFutureQuads(
        validInput({
          bridgingEvidence: [
            {
              clusterLabel: "c",
              resonatesCount: 1,
              conflictsCount: 1,
              unsureCount: 0,
              seenCount: 5,
            },
          ],
        }),
        GATE,
      ),
    ).toThrow(/seenCount must equal/);
  });

  it("D4: THROWS when methodProvenance is not a coded method concept", () => {
    expect(() =>
      buildSharedFutureQuads(validInput({ methodProvenance: "https://evil.example/method" }), GATE),
    ).toThrow(/methodProvenance is REQUIRED/);
  });

  it("D4: accepts each coded method (resonance-mapping / mediated-synthesis)", () => {
    expect(() =>
      buildSharedFutureQuads(validInput({ methodProvenance: METHOD_MEDIATED_SYNTHESIS }), GATE),
    ).not.toThrow();
  });

  it("INV-1: THROWS when a derivedFrom input lacks fut:synthesize consent", () => {
    expect(() =>
      buildSharedFutureQuads(
        validInput({ derivedFrom: [INPUT_A, "https://evil.example/x#it"] }),
        GATE,
      ),
    ).toThrow(/fut:synthesize consent|INV-1/);
  });

  it("INV-1: THROWS on an empty lineage", () => {
    expect(() => buildSharedFutureQuads(validInput({ derivedFrom: [] }), GATE)).toThrow(
      /derive from ≥1 statement/,
    );
  });

  it("k-anonymity: THROWS when contributorCount is below the k-threshold", () => {
    expect(() => buildSharedFutureQuads(validInput({ contributorCount: 4 }), GATE)).toThrow(
      /k-anonymity|below the k-threshold/,
    );
  });

  it("k-anonymity: a broken (k<1) gate falls back to the conservative default, still blocking sub-5", () => {
    expect(() =>
      buildSharedFutureQuads(validInput({ contributorCount: 3 }), { ...GATE, kThreshold: 0 }),
    ).toThrow(/k-anonymity/);
  });

  it("k-anonymity: THROWS when embedded convergenceMetrics carry a sub-k cell", () => {
    // A caller that hand-builds/tampers the metrics quads (rather than calling the
    // publisher) must not be able to sign a graph with a sub-k metrics cell.
    const subK = [
      quad(namedNode(METRICS), namedNode(RDF_TYPE), namedNode(`${NS.fut}ConvergenceMetrics`)),
      quad(namedNode(METRICS), namedNode(`${NS.fut}inDeliberation`), namedNode(DELIB)),
      quad(
        namedNode(METRICS),
        namedNode(`${NS.fut}participantCount`),
        literal("2", namedNode(`${NS.xsd}nonNegativeInteger`)),
      ),
    ];
    expect(() => buildSharedFutureQuads(validInput({ convergenceMetrics: subK }), GATE)).toThrow(
      /not k-anonymous/,
    );
  });

  it("INV-3: emits NO status/endorsed triple", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const preds = new Set(
      quads.filter((q) => q.subject.value === FUTURE).map((q) => q.predicate.value),
    );
    expect([...preds].some((p) => /status|endorsed/i.test(p))).toBe(false);
  });

  it("serialises to Turtle (round-trips through n3.Writer)", async () => {
    const ttl = await serializeSharedFuture(validInput(), GATE);
    expect(ttl).toContain("SharedFuture");
  });
});

// ── Parse mirrors every build invariant (foreign RDF is hostile) ──────────────
describe("parseSharedFutures — parse mirrors build", () => {
  it("round-trips a valid SharedFuture and reads NO status (INV-3)", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const parsed = parseSharedFutures(new Store([...quads]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe(FUTURE);
    expect(parsed[0]?.methodProvenance).toBe(METHOD_RESONANCE_MAPPING);
  });

  it("a spoofed asserted-status triple is IGNORED (never read)", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    // Inject a hostile "status" triple — it must have zero effect on the parse.
    const spoofed = [
      ...quads,
      quad(namedNode(FUTURE), namedNode(`${NS.fut}adoptionStatus`), literal("current")),
      quad(namedNode(FUTURE), namedNode(`${NS.fut}endorsed`), literal("true")),
    ];
    const parsed = parseSharedFutures(new Store(spoofed));
    expect(parsed).toHaveLength(1);
    expect(Object.keys(parsed[0] ?? {})).not.toContain("status");
  });

  it("drops an item whose methodProvenance is a non-coded value (untrusted RDF)", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    // Rewrite methodProvenance to junk in the parsed graph.
    const stripped = quads.filter((q) => q.predicate.value !== `${NS.fut}methodProvenance`);
    const hostile = [
      ...stripped,
      quad(
        namedNode(FUTURE),
        namedNode(`${NS.fut}methodProvenance`),
        namedNode("https://evil.example/m"),
      ),
    ];
    expect(parseSharedFutures(new Store(hostile))).toHaveLength(0);
  });

  it("parse mirrors build: a dissent record with a creator but NO source lineage is rejected", () => {
    // A hand-built graph that makes an aggregate record verbatim-shaped (adds a
    // creator without prov:wasDerivedFrom) must be rejected — the whole item drops.
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const recNode = quads.find((q) => q.predicate.value === `${NS.fut}dissent`)?.object;
    expect(recNode?.termType).toBe("BlankNode");
    if (recNode?.termType === "BlankNode") {
      const malformed = [
        ...quads,
        quad(recNode, namedNode(`${NS.dct}creator`), namedNode("https://x.example/#me")),
      ];
      expect(parseSharedFutures(new Store(malformed))).toHaveLength(0);
    }
  });

  it("parse mirrors build: a verbatim record with MULTIPLE lineage triples INVALIDATES the annex", () => {
    // A record carrying two prov:wasDerivedFrom triples is MALFORMED. It must not be
    // silently reclassified as an aggregate record (readIri collapses "multiple" to
    // undefined) — that would hide a duplicate/forged lineage from the D2
    // distinct-coverage check. The whole item drops (fail-closed).
    const verbatim = annex([critique(CRIT_1, STEWARD_C)], new Set([CRIT_1]));
    const quads = buildSharedFutureQuads(validInput({ dissent: verbatim }), GATE);
    const recNode = quads.find((q) => q.predicate.value === `${NS.fut}dissent`)?.object;
    expect(recNode?.termType).toBe("BlankNode");
    if (recNode?.termType === "BlankNode") {
      const malformed = [
        ...quads,
        // second prov:wasDerivedFrom on the same verbatim record → multi-valued
        quad(recNode, namedNode(`${NS.prov}wasDerivedFrom`), namedNode(CRIT_2)),
      ];
      expect(parseSharedFutures(new Store(malformed))).toHaveLength(0);
    }
  });

  it("parse mirrors build: a record with MULTIPLE creator triples INVALIDATES the annex", () => {
    const verbatim = annex([critique(CRIT_1, STEWARD_C)], new Set([CRIT_1]));
    const quads = buildSharedFutureQuads(validInput({ dissent: verbatim }), GATE);
    const recNode = quads.find((q) => q.predicate.value === `${NS.fut}dissent`)?.object;
    if (recNode?.termType === "BlankNode") {
      const malformed = [
        ...quads,
        quad(recNode, namedNode(`${NS.dct}creator`), namedNode("https://other.example/#me")),
      ];
      expect(parseSharedFutures(new Store(malformed))).toHaveLength(0);
    }
  });

  it("parse mirrors build: a dissent record NOT typed fut:DissentRecord is rejected", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    // strip the rdf:type fut:DissentRecord from the record node
    const stripped = quads.filter(
      (q) => !(q.predicate.value === RDF_TYPE && q.object.value === `${NS.fut}DissentRecord`),
    );
    expect(parseSharedFutures(new Store(stripped))).toHaveLength(0);
  });

  it("drops an item whose dissent annex is absent (D1 on read)", () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const noAnnex = quads.filter(
      (q) =>
        q.predicate.value !== `${NS.fut}dissent` && q.predicate.value !== FUT_NO_DISSENT_RECORDED,
    );
    expect(parseSharedFutures(new Store(noAnnex))).toHaveLength(0);
  });

  it("does NOT parse an AdoptionDecision graph (proposesVersion → excluded)", () => {
    const quads = [
      ...buildSharedFutureQuads(validInput(), GATE),
      quad(
        namedNode(FUTURE),
        namedNode(`${NS.fut}proposesVersion`),
        namedNode("https://w3id.org/x/1.0"),
      ),
    ];
    expect(parseSharedFutures(new Store(quads))).toHaveLength(0);
  });
});

// ── The quorum gate — the LOAD-BEARING trustedStewards requirement ────────────
describe("verifySharedFutureQuorum — the trustedStewards gate", () => {
  it("THROWS fail-closed when trustedStewards is empty (no unprotected quorum)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    await expect(
      verifySharedFutureQuorum(quads, vcs, {
        verifyVc: realVerify,
        resolveKey: realResolveKey,
        trustedStewards: [],
      }),
    ).rejects.toThrow(/non-empty `trustedStewards` allowlist is REQUIRED/);
  });

  it("THROWS fail-closed when trustedStewards is absent", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    await expect(
      verifySharedFutureQuorum(quads, [], {
        verifyVc: realVerify,
        resolveKey: realResolveKey,
        // @ts-expect-error — deliberately omitting the required allowlist
        trustedStewards: undefined,
      }),
    ).rejects.toThrow(/REQUIRED/);
  });

  it("meets the ≥2 quorum with two distinct trusted stewards (REAL crypto)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const q = await verifySharedFutureQuorum(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
    });
    expect(q.met).toBe(true);
    expect(q.distinctStewards).toBe(2);
  });

  it("a SUB-quorum (one steward) is not met — below the ≥2 floor (bootstrapping)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads)];
    const q = await verifySharedFutureQuorum(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
    });
    expect(q.met).toBe(false);
    expect(q.bootstrapping).toBe(true);
  });

  it("an untrusted (off-allowlist) steward does not count", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_C, keyC, quads)];
    const q = await verifySharedFutureQuorum(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: [STEWARD_A, STEWARD_B], // C excluded
    });
    expect(q.met).toBe(false);
    expect(q.distinctStewards).toBe(1);
    expect(q.rejected.some((r) => r.reason === "untrusted-steward")).toBe(true);
  });

  it("the ≥2 floor cannot be lowered by a caller (threshold clamps up)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads)];
    const q = await verifySharedFutureQuorum(quads, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
      threshold: 1, // attempt to lower below the floor
    });
    expect(q.threshold).toBe(2);
    expect(q.met).toBe(false);
  });

  it("a TAMPERED graph cannot be smuggled past the signature (digest-mismatch)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    // Present a graph with an extra spoofed triple — the signed digest no longer matches.
    const tampered = [
      ...quads,
      quad(namedNode(FUTURE), namedNode(`${NS.fut}adoptionStatus`), literal("current")),
    ];
    const q = await verifySharedFutureQuorum(tampered, vcs, {
      verifyVc: realVerify,
      resolveKey: realResolveKey,
      trustedStewards: ALL_STEWARDS,
    });
    expect(q.met).toBe(false);
    expect(q.rejected.every((r) => r.reason === "digest-mismatch")).toBe(true);
  });
});

// ── The full verify path (ratification) ───────────────────────────────────────
describe("verifySharedFuture — full ratification", () => {
  const opts = () => ({
    verifyVc: realVerify,
    resolveKey: realResolveKey,
    trustedStewards: ALL_STEWARDS,
    synthesizable: new Set([INPUT_A, INPUT_B]),
    kThreshold: 5,
  });

  it("ratifies a valid, ≥2-signed, consented, k-anon SharedFuture", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, opts());
    expect(v.ratified).toBe(true);
    expect(v.lineageConsented).toBe(true);
    expect(v.kAnonymous).toBe(true);
    expect(v.sharedFuture?.id).toBe(FUTURE);
  });

  it("does NOT ratify a single-steward (sub-quorum) synthesis", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads)];
    const v = await verifySharedFuture(quads, vcs, opts());
    expect(v.ratified).toBe(false);
  });

  it("does NOT ratify when the lineage is unconsented (INV-1 re-check)", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    // The verifier's synthesizable set no longer consents INPUT_B.
    const v = await verifySharedFuture(quads, vcs, {
      ...opts(),
      synthesizable: new Set([INPUT_A]),
    });
    expect(v.ratified).toBe(false);
    expect(v.lineageConsented).toBe(false);
  });

  it("does NOT ratify when an embedded metrics cell leaks a sub-k count (k-anon)", async () => {
    // Hand-build a signed graph carrying a metrics node whose participantCount < k.
    const leaky = [
      ...buildSharedFutureQuads(validInput(), GATE),
      quad(namedNode(METRICS), namedNode(RDF_TYPE), namedNode(`${NS.fut}ConvergenceMetrics`)),
      quad(namedNode(METRICS), namedNode(`${NS.fut}inDeliberation`), namedNode(DELIB)),
      quad(
        namedNode(METRICS),
        namedNode(`${NS.fut}participantCount`),
        literal("2", namedNode(`${NS.xsd}nonNegativeInteger`)),
      ),
    ];
    const vcs = [await steward(STEWARD_A, keyA, leaky), await steward(STEWARD_B, keyB, leaky)];
    const v = await verifySharedFuture(leaky, vcs, opts());
    expect(v.kAnonymous).toBe(false);
    expect(v.ratified).toBe(false);
  });

  it("ratifies with a properly-published k-anon metrics node embedded", async () => {
    const metrics = publishConvergenceMetrics(
      METRICS,
      {
        deliberation: DELIB,
        clusterCount: 2,
        participantCount: 8,
        crossClusterConsensusRate: 0.7,
        bridgingScore: 0.5,
        tierCounts: new Map([["T0", 8]]),
      },
      { kThreshold: 5 },
    );
    expect(metrics.suppressed).toBe(false);
    const quads = buildSharedFutureQuads(validInput({ convergenceMetrics: metrics.quads }), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, opts());
    expect(v.kAnonymous).toBe(true);
    expect(v.ratified).toBe(true);
  });

  // ── D2 RE-CHECK at verify: a signed-but-partial annex must NOT ratify ────────
  it("D2 re-check: a signed annex that DROPPED a standing critique is NOT ratified", async () => {
    // The annex accounts for ONE critique, but the verifier knows TWO stood at
    // endorsement — a hand-signed partial annex is caught at verify, not only build.
    const quads = buildSharedFutureQuads(validInput(), GATE); // annex accounts for CRIT_1 only
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, {
      ...opts(),
      standingCritiqueIds: new Set([CRIT_1, CRIT_2]), // two stood; annex carries one
    });
    expect(v.dissentComplete).toBe(false);
    expect(v.ratified).toBe(false);
  });

  it("D2 re-check: ratifies when the annex accounts for every standing critique", async () => {
    const quads = buildSharedFutureQuads(validInput(), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, {
      ...opts(),
      standingCritiqueIds: new Set([CRIT_1]),
    });
    expect(v.dissentComplete).toBe(true);
    expect(v.ratified).toBe(true);
  });

  it("D2 re-check: a VERBATIM quote of a NON-standing critique is NOT ratified", async () => {
    // A verbatim record quoting CRIT_1, verified against a standing set that does
    // NOT contain CRIT_1 → the quote is of a non-standing/fabricated critique.
    const verbatim = annex([critique(CRIT_1, STEWARD_C)], new Set([CRIT_1]));
    const quads = buildSharedFutureQuads(validInput({ dissent: verbatim }), GATE);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, {
      ...opts(),
      standingCritiqueIds: new Set([CRIT_2]), // CRIT_1 is NOT standing here
    });
    expect(v.dissentComplete).toBe(false);
    expect(v.ratified).toBe(false);
  });

  // ── Finding 1 (MEDIUM): the distinct-coverage D2 re-check ────────────────────
  it("D2 re-check: DUPLICATE verbatim quotes that PAD the count while dropping critiques are NOT ratified", async () => {
    // The execution-proven exploit the Opus verify found: THREE verbatim records all
    // quoting the SAME critique CRIT_1, dropping CRIT_2 + CRIT_3 entirely. The count
    // (3) matches the standing count (3) and the DE-DUPED verbatim set {CRIT_1} is
    // trivially ⊆ standing — so the OLD count-based check ratified it. The DISTINCT
    // coverage re-check (raw verbatim-record count ≠ distinct verbatim-critique count)
    // catches it.
    const base = buildSharedFutureQuads(
      validInput({ dissent: annex([]), noDissentRecorded: true }),
      { ...GATE, standingCritiqueIds: new Set() },
    );
    const withoutFlag = base.filter((q) => q.predicate.value !== FUT_NO_DISSENT_RECORDED);
    const dup = {
      content: "CRIT_1 quoted verbatim",
      verbatim: true as const,
      creator: STEWARD_C,
      derivedFromCritique: CRIT_1,
    };
    // Three DISTINCT blank-node records, all deriving from the one critique CRIT_1.
    const forged = [...withoutFlag, ...buildDissentAnnexQuads(FUTURE, [dup, dup, dup])];
    const vcs = [await steward(STEWARD_A, keyA, forged), await steward(STEWARD_B, keyB, forged)];
    const standing = new Set([CRIT_1, CRIT_2, CRIT_3]); // three stood; annex covers ONE
    const v = await verifySharedFuture(forged, vcs, { ...opts(), standingCritiqueIds: standing });

    // The quorum is genuinely met + the graph parses (the forgery is signable) …
    expect(v.quorum.met).toBe(true);
    expect(v.sharedFuture?.dissentRecordCount).toBe(3);
    expect(v.sharedFuture?.verbatimDissentRecordCount).toBe(3);
    expect(v.sharedFuture?.verbatimDissentCritiques).toEqual([CRIT_1]);
    // … and the OLD count-based predicate WOULD have ratified this forgery:
    const sf = v.sharedFuture;
    expect(
      sf !== undefined &&
        sf.dissentRecordCount >= standing.size &&
        sf.verbatimDissentCritiques.every((c) => standing.has(c)),
    ).toBe(true);
    // … but the DISTINCT-coverage re-check catches it → NOT ratified.
    expect(v.dissentComplete).toBe(false);
    expect(v.ratified).toBe(false);
  });

  it("D2 re-check: ratifies a legitimate all-verbatim annex with DISTINCT quotes per standing critique", async () => {
    // The honest distinct-verbatim path must NOT false-positive: one verbatim record
    // per standing critique (CRIT_1, CRIT_2), distinct lineages, count 2 = standing 2.
    const gate: SharedFutureGate = { ...GATE, standingCritiqueIds: new Set([CRIT_1, CRIT_2]) };
    const bothVerbatim = annex(
      [critique(CRIT_1, STEWARD_C), critique(CRIT_2, STEWARD_B)],
      new Set([CRIT_1, CRIT_2]),
    );
    const quads = buildSharedFutureQuads(validInput({ dissent: bothVerbatim }), gate);
    const vcs = [await steward(STEWARD_A, keyA, quads), await steward(STEWARD_B, keyB, quads)];
    const v = await verifySharedFuture(quads, vcs, {
      ...opts(),
      standingCritiqueIds: new Set([CRIT_1, CRIT_2]),
    });
    expect(v.sharedFuture?.verbatimDissentRecordCount).toBe(2);
    expect(v.dissentComplete).toBe(true);
    expect(v.ratified).toBe(true);
  });

  // ── Finding 2 (LOW): the deliberation-grouped subtraction-leak defence ───────
  it("k-anon: a CROSS-DOCUMENT metrics split sharing one deliberation is NOT ratified", async () => {
    // The execution-proven exploit: the aggregate total lives in one metrics document
    // and the tier strata in ANOTHER, but both carry the SAME fut:inDeliberation.
    // Document-grouping missed the subtraction leak (12 − 5 − 6 = 1, a k=1 cohort);
    // deliberation-grouping catches it. Every published cell is individually ≥ k.
    const AGG = "https://d.example/futures/m-agg.ttl#it";
    const T0 = "https://d.example/futures/m-strata.ttl#T0";
    const T1 = "https://d.example/futures/m-strata.ttl#T1";
    const nn = (v: string) => literal(v, namedNode(`${NS.xsd}nonNegativeInteger`));
    const split = [
      ...buildSharedFutureQuads(validInput(), GATE),
      // aggregate total (participantCount 12) in ONE document
      quad(namedNode(AGG), namedNode(RDF_TYPE), namedNode(`${NS.fut}ConvergenceMetrics`)),
      quad(namedNode(AGG), namedNode(`${NS.fut}inDeliberation`), namedNode(DELIB)),
      quad(namedNode(AGG), namedNode(`${NS.fut}participantCount`), nn("12")),
      // strata (5 + 6) in a DIFFERENT document, same deliberation
      quad(namedNode(T0), namedNode(RDF_TYPE), namedNode(`${NS.fut}ConvergenceMetrics`)),
      quad(namedNode(T0), namedNode(`${NS.fut}inDeliberation`), namedNode(DELIB)),
      quad(
        namedNode(T0),
        namedNode(`${NS.fut}verificationTier`),
        literal("T0", namedNode(`${NS.xsd}string`)),
      ),
      quad(namedNode(T0), namedNode(`${NS.fut}participantCount`), nn("5")),
      quad(namedNode(T1), namedNode(RDF_TYPE), namedNode(`${NS.fut}ConvergenceMetrics`)),
      quad(namedNode(T1), namedNode(`${NS.fut}inDeliberation`), namedNode(DELIB)),
      quad(
        namedNode(T1),
        namedNode(`${NS.fut}verificationTier`),
        literal("T1", namedNode(`${NS.xsd}string`)),
      ),
      quad(namedNode(T1), namedNode(`${NS.fut}participantCount`), nn("6")),
    ];
    const vcs = [await steward(STEWARD_A, keyA, split), await steward(STEWARD_B, keyB, split)];
    const v = await verifySharedFuture(split, vcs, opts());
    expect(v.quorum.met).toBe(true); // genuinely signed …
    expect(v.kAnonymous).toBe(false); // … but the cross-document subtraction leak is caught
    expect(v.ratified).toBe(false);
  });
});
