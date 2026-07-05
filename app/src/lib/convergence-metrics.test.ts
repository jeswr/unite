// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.3 the k-anonymous, tier-stratified fut:ConvergenceMetrics publisher — closes
// the design's k-anonymity gap (kThreshold parsed but never enforced). The
// enforcement is fail-closed throughout and RE-CHECKABLE by a consumer.

import { Store } from "n3";
import { describe, expect, it } from "vitest";
import {
  metricsAreKAnonymous,
  normalizeKThreshold,
  type ParsedConvergenceMetrics,
  parseConvergenceMetrics,
  publishConvergenceMetrics,
  type RawConvergenceMetrics,
} from "./convergence-metrics.js";

const DELIB = "https://d.example/futures";
const METRICS = "https://d.example/futures/metrics.ttl#it";

function raw(overrides: Partial<RawConvergenceMetrics> = {}): RawConvergenceMetrics {
  return {
    deliberation: DELIB,
    clusterCount: 3,
    participantCount: 12,
    crossClusterConsensusRate: 0.62,
    bridgingScore: 0.48,
    tierCounts: new Map([
      ["T0", 5],
      ["T1", 6],
      ["T2", 1],
    ]),
    ...overrides,
  };
}

describe("normalizeKThreshold — fail-closed default 5", () => {
  it("uses a positive integer as given", () => {
    expect(normalizeKThreshold(3)).toBe(3);
    expect(normalizeKThreshold(7)).toBe(7);
  });
  it("falls back to 5 for undefined / 0 / negative / fractional / NaN", () => {
    expect(normalizeKThreshold()).toBe(5);
    expect(normalizeKThreshold(0)).toBe(5);
    expect(normalizeKThreshold(-2)).toBe(5);
    expect(normalizeKThreshold(3.5)).toBe(5);
    expect(normalizeKThreshold(Number.NaN)).toBe(5);
  });
});

describe("publishConvergenceMetrics — k-anonymity enforcement", () => {
  it("publishes only the tier strata whose count ≥ k (suppresses the sliver)", () => {
    const res = publishConvergenceMetrics(METRICS, raw(), { kThreshold: 5 });
    expect(res.suppressed).toBe(false);
    // T0 (5) and T1 (6) publish; T2 (1) is suppressed as a sub-k sliver.
    expect(res.publishedTiers.map((t) => t.tier).sort()).toEqual(["T0", "T1"]);
    expect(res.suppressedTiers).toEqual(["T2"]);
  });

  it("SUBTRACTION-LEAK DEFENCE: withholds the aggregate total when a sliver is hidden", () => {
    // total 12, published T0=5 + T1=6 (sum 11) → remainder 1 would reveal T2 by
    // subtraction, so the aggregate participantCount is withheld.
    const res = publishConvergenceMetrics(METRICS, raw(), { kThreshold: 5 });
    expect(res.aggregateCountSuppressed).toBe(true);
    const aggregate = parseConvergenceMetrics(new Store(res.quads)).find(
      (m) => m.tier === undefined,
    );
    expect(aggregate?.participantCount).toBeUndefined();
  });

  it("publishes the aggregate total when nothing is hidden (remainder 0 or ≥ k)", () => {
    // total 11 = T0(5) + T1(6): remainder 0 → the total is safe to publish.
    const res = publishConvergenceMetrics(
      METRICS,
      raw({
        participantCount: 11,
        tierCounts: new Map([
          ["T0", 5],
          ["T1", 6],
        ]),
      }),
      { kThreshold: 5 },
    );
    expect(res.aggregateCountSuppressed).toBe(false);
    const aggregate = parseConvergenceMetrics(new Store(res.quads)).find(
      (m) => m.tier === undefined,
    );
    expect(aggregate?.participantCount).toBe(11);
  });

  it("SUPPRESSES the whole node when the total participantCount < k", () => {
    const res = publishConvergenceMetrics(
      METRICS,
      raw({ participantCount: 3, tierCounts: new Map([["T0", 3]]) }),
      { kThreshold: 5 },
    );
    expect(res.suppressed).toBe(true);
    expect(res.quads).toHaveLength(0);
    expect(res.suppressedTiers).toEqual(["T0"]);
  });

  it("a k-anon leak is BLOCKED even when a broken k<1 is passed (default 5 applies)", () => {
    const res = publishConvergenceMetrics(
      METRICS,
      raw({ participantCount: 4, tierCounts: new Map([["T0", 4]]) }),
      { kThreshold: 0 },
    );
    expect(res.kThreshold).toBe(5);
    expect(res.suppressed).toBe(true);
  });

  it("THROWS on a non-http metrics/deliberation IRI, a negative count, or an out-of-range rate", () => {
    expect(() => publishConvergenceMetrics("urn:x", raw(), {})).toThrow(/metricsIri/);
    expect(() => publishConvergenceMetrics(METRICS, raw({ deliberation: "urn:d" }), {})).toThrow(
      /deliberation/,
    );
    expect(() => publishConvergenceMetrics(METRICS, raw({ participantCount: -1 }), {})).toThrow(
      /participantCount/,
    );
    expect(() =>
      publishConvergenceMetrics(METRICS, raw({ crossClusterConsensusRate: 1.5 }), {}),
    ).toThrow(/crossClusterConsensusRate/);
  });

  it("THROWS on an unknown verification tier", () => {
    expect(() =>
      publishConvergenceMetrics(METRICS, raw({ tierCounts: new Map([["T9" as never, 6]]) }), {}),
    ).toThrow(/unknown verification tier/);
  });

  it("THROWS when Σ tierCounts exceeds participantCount (impossible partition)", () => {
    // total 8, but T0=8 + T1=8 sums to 16 — an impossible input that could otherwise
    // be published and pass k-anon once the (inconsistent) aggregate total is hidden.
    expect(() =>
      publishConvergenceMetrics(
        METRICS,
        raw({
          participantCount: 8,
          tierCounts: new Map([
            ["T0", 8],
            ["T1", 8],
          ]),
        }),
        { kThreshold: 5 },
      ),
    ).toThrow(/exceeds participantCount|partition/);
  });
});

describe("parse + metricsAreKAnonymous — the re-checkable assertion", () => {
  it("round-trips the published aggregate + tier strata", () => {
    const res = publishConvergenceMetrics(METRICS, raw(), { kThreshold: 5 });
    const parsed = parseConvergenceMetrics(new Store(res.quads));
    // 1 aggregate + 2 published strata (T0, T1)
    expect(parsed).toHaveLength(3);
    expect(
      parsed
        .filter((m) => m.tier !== undefined)
        .map((m) => m.tier)
        .sort(),
    ).toEqual(["T0", "T1"]);
  });

  it("is TRUE for a properly-published graph (every cell ≥ k)", () => {
    const res = publishConvergenceMetrics(METRICS, raw(), { kThreshold: 5 });
    expect(metricsAreKAnonymous(parseConvergenceMetrics(new Store(res.quads)), 5)).toBe(true);
  });

  it("is FALSE when any parsed cell is sub-k (a leak)", () => {
    // Published at k=2 (T0=5), then RE-CHECKED at the conservative k=5. A graph
    // published under a lower k must still be caught if it carries a cell below the
    // re-check k. Here T0=5 is ≥5, so this graph IS k-anon at 5:
    const res = publishConvergenceMetrics(METRICS, raw({ tierCounts: new Map([["T0", 5]]) }), {
      kThreshold: 2,
    });
    const parsed = parseConvergenceMetrics(new Store(res.quads));
    expect(metricsAreKAnonymous(parsed, 5)).toBe(true);
    // But a graph carrying a genuinely sub-k cell is caught:
    const leaky = parseConvergenceMetrics(
      new Store(
        publishConvergenceMetrics(METRICS, raw({ tierCounts: new Map([["T0", 3]]) }), {
          kThreshold: 2,
        }).quads,
      ),
    );
    expect(metricsAreKAnonymous(leaky, 5)).toBe(false);
  });

  it("an empty metrics set is vacuously k-anonymous", () => {
    expect(metricsAreKAnonymous([], 5)).toBe(true);
  });

  it("CATCHES a SUBTRACTION leak: total + partial strata revealing a sub-k remainder", () => {
    // A hand-built / legacy graph the publisher would never emit: total 12 published
    // with T0=5 + T1=6 (each ≥5) leaks T2 = 12−5−6 = 1. Every published cell is
    // individually k-anon, but the subtraction check must reject it.
    const leaky: ParsedConvergenceMetrics[] = [
      { id: METRICS, deliberation: DELIB, participantCount: 12 },
      { id: `${METRICS}#T0`, deliberation: DELIB, participantCount: 5, tier: "T0" },
      { id: `${METRICS}#T1`, deliberation: DELIB, participantCount: 6, tier: "T1" },
    ];
    expect(metricsAreKAnonymous(leaky, 5)).toBe(false);
    // The same strata WITHOUT the aggregate total (the publisher's fix) are k-anon:
    expect(metricsAreKAnonymous(leaky.slice(1), 5)).toBe(true);
  });

  it("does NOT cross-contaminate metrics for DIFFERENT deliberations", () => {
    // Two internally-consistent metrics resources for DIFFERENT deliberations. Each
    // aggregate is checked only against ITS OWN deliberation's strata (remainder 0),
    // so distinct deliberations never pool and cannot subtract across each other.
    const DELIB_2 = "https://d.example/futures-2";
    const two: ParsedConvergenceMetrics[] = [
      { id: "https://d.example/m-a.ttl#it", deliberation: DELIB, participantCount: 10 },
      {
        id: "https://d.example/m-a.ttl#metrics-T0",
        deliberation: DELIB,
        participantCount: 10,
        tier: "T0",
      },
      { id: "https://d.example/m-b.ttl#it", deliberation: DELIB_2, participantCount: 8 },
      {
        id: "https://d.example/m-b.ttl#metrics-T1",
        deliberation: DELIB_2,
        participantCount: 8,
        tier: "T1",
      },
    ];
    expect(metricsAreKAnonymous(two, 5)).toBe(true);
  });

  it("CATCHES a CROSS-DOCUMENT subtraction leak sharing one deliberation (Finding 2)", () => {
    // The exploit the Opus verify found: the aggregate total lives in ONE document
    // and the tier strata in ANOTHER, but both carry the SAME fut:inDeliberation.
    // Grouping by DOCUMENT missed it (the aggregate had no strata in its own document
    // → remainder = total ≥ k); grouping by DELIBERATION catches it: 12 − 5 − 6 = 1
    // re-identifies a k=1 cohort, even though every published cell is individually ≥ k.
    const split: ParsedConvergenceMetrics[] = [
      { id: "https://d.example/m-agg.ttl#it", deliberation: DELIB, participantCount: 12 },
      {
        id: "https://d.example/m-strata.ttl#T0",
        deliberation: DELIB,
        participantCount: 5,
        tier: "T0",
      },
      {
        id: "https://d.example/m-strata.ttl#T1",
        deliberation: DELIB,
        participantCount: 6,
        tier: "T1",
      },
    ];
    expect(metricsAreKAnonymous(split, 5)).toBe(false);
    // Removing the split-out aggregate total (the publisher's own defence never emits
    // it) leaves only the strata — no total to subtract from → k-anonymous.
    expect(metricsAreKAnonymous(split.slice(1), 5)).toBe(true);
  });

  it("INTENTIONALLY rejects MULTIPLE aggregate totals for one deliberation (fail-closed, hard rule)", () => {
    // A deliberation has ONE coherent participant count and the honest flow embeds
    // exactly ONE metrics resource per deliberation per signed graph. So a deliberation
    // carrying >1 aggregate total is rejected OUTRIGHT — malformed, or an
    // aggregate-minus-aggregate leak (10 − 8 = 2 discloses a k=2 delta cohort). This is
    // deliberate: grouping by document/publication instead would REOPEN the
    // cross-document subtraction leak (Finding 2). A genuinely independent second
    // measurement belongs in its OWN deliberation (see the different-deliberation test
    // above) or its OWN signed artifact.

    // (i) two aggregates WITH strata → rejected (the >1-aggregate hard rule).
    const twoAggsWithStrata: ParsedConvergenceMetrics[] = [
      { id: "https://d.example/m-a.ttl#it", deliberation: DELIB, participantCount: 10 },
      {
        id: "https://d.example/m-a.ttl#metrics-T0",
        deliberation: DELIB,
        participantCount: 10,
        tier: "T0",
      },
      { id: "https://d.example/m-b.ttl#it", deliberation: DELIB, participantCount: 8 },
      {
        id: "https://d.example/m-b.ttl#metrics-T1",
        deliberation: DELIB,
        participantCount: 8,
        tier: "T1",
      },
    ];
    expect(metricsAreKAnonymous(twoAggsWithStrata, 5)).toBe(false);

    // (ii) two aggregate-ONLY totals, NO strata, each ≥ k, remainders ≥ k — the case
    //      the strata-subtraction check alone would MISS, but the hard rule rejects
    //      (10 − 8 = 2 is a sub-k delta cohort).
    const twoAggsOnly: ParsedConvergenceMetrics[] = [
      { id: "https://d.example/m-a.ttl#it", deliberation: DELIB, participantCount: 10 },
      { id: "https://d.example/m-b.ttl#it", deliberation: DELIB, participantCount: 8 },
    ];
    expect(metricsAreKAnonymous(twoAggsOnly, 5)).toBe(false);
  });
});
