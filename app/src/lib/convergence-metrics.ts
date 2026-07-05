// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.3 — the k-anonymous, tier-stratified fut:ConvergenceMetrics publisher
// (docs/design/next-phases.md §2.4 "ConvergenceMetrics"; design/02 §5 "stratify
// and disclose, never exclude"; design/03 §6 "convergence as a MEASURED
// constraint"). Closes the k-anonymity gap the design flags: consent.ts PARSES
// `fut:kThreshold` (default 5) but nothing ENFORCED it on publication until now.
//
// THE ENFORCEMENT (fail-closed throughout):
//   • the WHOLE metrics node is SUPPRESSED (nothing published) when the total
//     participantCount < k — a sub-k cohort's metrics re-identify it;
//   • each per-tier STRATUM is published only when that tier's count ≥ k; a
//     0 < count < k tier cell is SUPPRESSED (design/02 §5 stratify-and-disclose:
//     the sliver is protected, not the whole disclosure blocked);
//   • an unknown / invalid k falls back to the CONSERVATIVE default 5, never 0
//     or 1 (the k-anon protection can never be silently disabled).
//
// The published counts are RE-CHECKABLE: {@link parseConvergenceMetrics} +
// {@link metricsAreKAnonymous} let a consumer independently confirm no sub-k cell
// leaked — the verify path (shared-future.verifySharedFuture) runs exactly this.
//
// Serialisation via n3.Writer (typed quads, correct xsd datatypes) — never
// hand-built RDF. Every term is verified against the published futures sector
// (fut-draft.ts FUT_CONVERGENCE_METRICS + the numeric props). The verification
// tier is carried as its coded string (trust.ts MembershipTier convention; the
// tier value is `xsd:string` pending an ObjectProperty confirmation in the
// sector — the k-anon LOGIC, not the exact tier-term typing, is the load-bearing
// part, and it is exhaustively tested).

import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory } from "n3";
import { DEFAULT_K_THRESHOLD, FUT_IN_DELIBERATION, NS, RDF_TYPE } from "./fut.js";
import {
  FUT_BRIDGING_SCORE,
  FUT_CLUSTER_COUNT,
  FUT_CONVERGENCE_METRICS,
  FUT_CROSS_CLUSTER_CONSENSUS_RATE,
  FUT_PARTICIPANT_COUNT,
  FUT_VERIFICATION_TIER,
} from "./fut-draft.js";
import { isHttpIri, readIri } from "./model.js";

const { namedNode, literal, quad } = DataFactory;

const XSD_NON_NEGATIVE_INTEGER = `${NS.xsd}nonNegativeInteger`;
const XSD_DECIMAL = `${NS.xsd}decimal`;
const XSD_STRING = `${NS.xsd}string`;

/** The identity tiers (design/02 §5; trust.ts MembershipTier): T0 pseudonymous,
 *  T1 community-vouched, T2 personhood-verified. */
export const TIERS = ["T0", "T1", "T2"] as const;
export type Tier = (typeof TIERS)[number];
const TIER_SET: ReadonlySet<string> = new Set(TIERS);
/** Type guard for a coded verification-tier string. */
export const isTier = (v: string): v is Tier => TIER_SET.has(v);

/** Upper bound on a published count (mirrors the parser cap; a hostile huge count drops). */
const MAX_COUNT = 100_000_000;

/**
 * Normalise the k-anonymity threshold FAIL-CLOSED: a positive integer is used as
 * given; anything else (undefined / NaN / < 1 / fractional) falls back to the
 * conservative design default {@link DEFAULT_K_THRESHOLD} (5). The protection can
 * never be silently disabled by a bad/absent k (an attacker passing k=0 or k=1 to
 * un-suppress a sliver gets the default instead).
 */
export function normalizeKThreshold(k?: number): number {
  return typeof k === "number" && Number.isInteger(k) && k >= 1 ? k : DEFAULT_K_THRESHOLD;
}

/** The raw (pre-k-anonymisation) metrics for a deliberation. */
export interface RawConvergenceMetrics {
  /** `fut:inDeliberation` — the deliberation the metrics summarise (https IRI). */
  readonly deliberation: string;
  /** `fut:clusterCount` — the opinion-space cluster count (≥ 0). */
  readonly clusterCount: number;
  /** `fut:participantCount` — the TOTAL distinct verified participants (≥ 0). */
  readonly participantCount: number;
  /** `fut:crossClusterConsensusRate` — the group-informed-consensus share, [0,1]. */
  readonly crossClusterConsensusRate: number;
  /** `fut:bridgingScore` — the product bridging score (finite). */
  readonly bridgingScore: number;
  /** Per-tier participant counts. Each stratum publishes only when its count ≥ k. */
  readonly tierCounts: ReadonlyMap<Tier, number>;
}

/** A per-tier stratum that WAS published (its count met k). */
export interface PublishedTierStratum {
  readonly tier: Tier;
  readonly participantCount: number;
}

/** The outcome of a k-anonymous metrics publication. */
export interface ConvergenceMetricsResult {
  /** The k-anon metrics quads to attach to the SharedFuture graph. EMPTY when the
   *  whole publication is suppressed (`suppressed === true`). */
  readonly quads: Quad[];
  /** True IFF the whole metrics node was suppressed (total participantCount < k). */
  readonly suppressed: boolean;
  /** The tier strata that were published (count ≥ k). */
  readonly publishedTiers: readonly PublishedTierStratum[];
  /** The tiers SUPPRESSED for being sub-k (0 < count < k) — surfaced honestly. */
  readonly suppressedTiers: readonly Tier[];
  /**
   * True when the aggregate `fut:participantCount` was ALSO withheld to defeat a
   * SUBTRACTION leak: publishing the total (12) alongside a proper subset of the
   * tier strata (T0=5, T1=6) would reveal the suppressed sliver (T2 = 12−5−6 = 1).
   * So the total is emitted only when the un-published remainder is 0 or ≥ k.
   */
  readonly aggregateCountSuppressed: boolean;
  /** The effective k applied (≥ 1; the conservative default when unknown). */
  readonly kThreshold: number;
}

/** A same-document fragment IRI for a tier stratum (SETS the fragment; never appends). */
function stratumIri(metricsIri: string, tier: Tier): string {
  const u = new URL(metricsIri);
  u.hash = `metrics-${tier}`;
  return u.toString();
}

function assertNonNegInt(field: string, n: number): void {
  if (!Number.isInteger(n) || n < 0 || n > MAX_COUNT) {
    throw new Error(
      `publishConvergenceMetrics: ${field} must be a non-negative integer ≤ ${MAX_COUNT}: ${n}`,
    );
  }
}

/**
 * Publish k-anonymous, tier-stratified `fut:ConvergenceMetrics` for a
 * deliberation. Enforces {@link normalizeKThreshold}: the whole node is suppressed
 * when the total participantCount < k; each tier stratum publishes only when its
 * own count ≥ k. Pure + deterministic. Throws on structurally invalid raw input
 * (a bad deliberation IRI, a negative/non-integer count, an out-of-range rate) —
 * the publisher must never emit malformed governance data.
 *
 * @param metricsIri the metrics resource IRI (subject of the aggregate node)
 */
export function publishConvergenceMetrics(
  metricsIri: string,
  raw: RawConvergenceMetrics,
  options: { kThreshold?: number } = {},
): ConvergenceMetricsResult {
  if (!isHttpIri(metricsIri)) {
    throw new Error(`publishConvergenceMetrics: metricsIri is not an http(s) IRI: ${metricsIri}`);
  }
  if (!isHttpIri(raw.deliberation)) {
    throw new Error(
      `publishConvergenceMetrics: deliberation is not an http(s) IRI: ${raw.deliberation}`,
    );
  }
  assertNonNegInt("clusterCount", raw.clusterCount);
  assertNonNegInt("participantCount", raw.participantCount);
  if (
    !Number.isFinite(raw.crossClusterConsensusRate) ||
    raw.crossClusterConsensusRate < 0 ||
    raw.crossClusterConsensusRate > 1
  ) {
    throw new Error(
      `publishConvergenceMetrics: crossClusterConsensusRate must be in [0,1]: ${raw.crossClusterConsensusRate}`,
    );
  }
  if (!Number.isFinite(raw.bridgingScore)) {
    throw new Error(
      `publishConvergenceMetrics: bridgingScore must be finite: ${raw.bridgingScore}`,
    );
  }
  let tierSum = 0;
  for (const [tier, count] of raw.tierCounts) {
    if (!isTier(tier))
      throw new Error(`publishConvergenceMetrics: unknown verification tier: ${tier}`);
    assertNonNegInt(`tierCounts[${tier}]`, count);
    tierSum += count;
  }
  // The tiers PARTITION the participants (a participant sits in exactly one tier),
  // so their counts must sum to ≤ the total. An impossible input (e.g. total 8 with
  // T0=8 + T1=8) is rejected — otherwise it could be published and later pass the
  // k-anonymity re-check once the (inconsistent) aggregate total is suppressed.
  if (tierSum > raw.participantCount) {
    throw new Error(
      `publishConvergenceMetrics: Σ tierCounts (${tierSum}) exceeds participantCount ` +
        `(${raw.participantCount}) — the tiers partition the participants and cannot over-sum`,
    );
  }

  const kThreshold = normalizeKThreshold(options.kThreshold);

  // Whole-node suppression: a sub-k cohort's metrics are identifying → publish nothing.
  if (raw.participantCount < kThreshold) {
    const suppressedTiers = TIERS.filter((t) => (raw.tierCounts.get(t) ?? 0) > 0);
    return {
      quads: [],
      suppressed: true,
      publishedTiers: [],
      suppressedTiers,
      aggregateCountSuppressed: true,
      kThreshold,
    };
  }

  const s = namedNode(metricsIri);
  const d = namedNode(raw.deliberation);

  // Per-tier stratification FIRST: a stratum publishes only when its count meets k;
  // a 0 < count < k sliver is suppressed (never published raw).
  const publishedTiers: PublishedTierStratum[] = [];
  const suppressedTiers: Tier[] = [];
  const strataQuads: Quad[] = [];
  for (const tier of TIERS) {
    const count = raw.tierCounts.get(tier) ?? 0;
    if (count === 0) continue; // nothing to disclose or hide
    if (count < kThreshold) {
      suppressedTiers.push(tier);
      continue;
    }
    const st = namedNode(stratumIri(metricsIri, tier));
    strataQuads.push(
      quad(st, namedNode(RDF_TYPE), namedNode(FUT_CONVERGENCE_METRICS)),
      quad(st, namedNode(FUT_IN_DELIBERATION), d),
      quad(st, namedNode(FUT_VERIFICATION_TIER), literal(tier, namedNode(XSD_STRING))),
      quad(
        st,
        namedNode(FUT_PARTICIPANT_COUNT),
        literal(String(count), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
    );
    publishedTiers.push({ tier, participantCount: count });
  }

  // SUBTRACTION-LEAK DEFENCE (the load-bearing k-anon fix): the aggregate total,
  // published alongside a proper subset of the tier strata, reveals the hidden
  // remainder by subtraction. Emit `fut:participantCount` on the aggregate ONLY
  // when the un-published remainder (total − Σ published strata) is 0 (nothing
  // hidden) or ≥ k (the hidden group is itself k-anonymous). Otherwise withhold it
  // — the aggregate node still carries the non-identifying cluster/rate/bridging
  // stats. FAIL-CLOSED: a negative remainder (malformed input) also withholds.
  const publishedSum = publishedTiers.reduce((acc, t) => acc + t.participantCount, 0);
  const remainder = raw.participantCount - publishedSum;
  const aggregateCountSuppressed = !(remainder === 0 || remainder >= kThreshold);

  const quads: Quad[] = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_CONVERGENCE_METRICS)),
    quad(s, namedNode(FUT_IN_DELIBERATION), d),
    quad(
      s,
      namedNode(FUT_CLUSTER_COUNT),
      literal(String(raw.clusterCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
    ),
    quad(
      s,
      namedNode(FUT_CROSS_CLUSTER_CONSENSUS_RATE),
      literal(String(raw.crossClusterConsensusRate), namedNode(XSD_DECIMAL)),
    ),
    quad(
      s,
      namedNode(FUT_BRIDGING_SCORE),
      literal(String(raw.bridgingScore), namedNode(XSD_DECIMAL)),
    ),
  ];
  if (!aggregateCountSuppressed) {
    quads.push(
      quad(
        s,
        namedNode(FUT_PARTICIPANT_COUNT),
        literal(String(raw.participantCount), namedNode(XSD_NON_NEGATIVE_INTEGER)),
      ),
    );
  }
  quads.push(...strataQuads);

  return {
    quads,
    suppressed: false,
    publishedTiers,
    suppressedTiers,
    aggregateCountSuppressed,
    kThreshold,
  };
}

// ── Re-checkable parse (a consumer independently verifies k-anonymity) ─────────

/** A parsed `fut:ConvergenceMetrics` node — an aggregate (no tier) or a stratum. */
export interface ParsedConvergenceMetrics {
  readonly id: string;
  readonly deliberation: string;
  /** Absent when the aggregate total was withheld (the subtraction-leak defence);
   *  always present on a published stratum. */
  readonly participantCount?: number;
  /** Present on a per-tier stratum; absent on the aggregate node. */
  readonly tier?: Tier;
}

/** A single xsd:nonNegativeInteger object in [0, MAX_COUNT], else undefined. */
function readNonNegInt(ds: DatasetCore, s: Term, p: string): number | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) {
    const t = q.object;
    if (t.termType !== "Literal" || t.datatype.value !== XSD_NON_NEGATIVE_INTEGER) return undefined;
    if (!/^\d+$/.test(t.value)) return undefined;
    const n = Number.parseInt(t.value, 10);
    return Number.isInteger(n) && n >= 0 && n <= MAX_COUNT ? n : undefined;
  }
  return undefined;
}

/** A single coded xsd:string verification-tier, else undefined. */
function readTier(ds: DatasetCore, s: Term): Tier | undefined {
  const matched = ds.match(s, namedNode(FUT_VERIFICATION_TIER), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) {
    const t = q.object;
    if (t.termType !== "Literal" || t.datatype.value !== XSD_STRING) return undefined;
    return isTier(t.value) ? t.value : undefined;
  }
  return undefined;
}

/**
 * Parse every well-formed `fut:ConvergenceMetrics` node in the dataset (aggregate
 * + strata). A node missing its deliberation IRI drops (foreign RDF is hostile);
 * the participantCount is OPTIONAL (an aggregate node legitimately withholds it
 * under the subtraction-leak defence). BOUNDED FAIL-CLOSED against a hostile fan-out.
 */
export function parseConvergenceMetrics(ds: DatasetCore): ParsedConvergenceMetrics[] {
  const out: ParsedConvergenceMetrics[] = [];
  let seen = 0;
  for (const q of ds.match(null, namedNode(RDF_TYPE), namedNode(FUT_CONVERGENCE_METRICS), null)) {
    if (++seen > MAX_COUNT) break; // pathological fan-out guard
    const s = q.subject;
    if (s.termType !== "NamedNode" || !isHttpIri(s.value)) continue;
    const deliberation = readIri(ds, s, FUT_IN_DELIBERATION);
    if (deliberation === undefined) continue;
    const participantCount = readNonNegInt(ds, s, FUT_PARTICIPANT_COUNT);
    const tier = readTier(ds, s);
    out.push({
      id: s.value,
      deliberation,
      ...(participantCount !== undefined ? { participantCount } : {}),
      ...(tier !== undefined ? { tier } : {}),
    });
  }
  return out;
}

/**
 * True IFF the published metrics leak no sub-k cell — the re-checkable k-anonymity
 * assertion (a consumer, or verifySharedFuture, runs this on the signed graph to
 * confirm no cell fell below k, INCLUDING via subtraction). Two checks, both
 * fail-closed:
 *   (a) every node that publishes a `participantCount` has it ≥ k; AND
 *   (b) no SUBTRACTION leak — per deliberation, an aggregate total published
 *       alongside a proper subset of the tier strata must not reveal a sub-k
 *       remainder: `aggregateTotal − Σ(strata) ∈ {0} ∪ [k, ∞)`. A hand-built graph
 *       carrying total=12 + T0=5 + T1=6 (hiding T2=1) is caught here even though
 *       every published cell is individually ≥ k.
 * An unknown k uses the conservative default; an empty set is vacuously k-anonymous.
 */
export function metricsAreKAnonymous(
  metrics: readonly ParsedConvergenceMetrics[],
  k?: number,
): boolean {
  const kThreshold = normalizeKThreshold(k);
  // (a) no published cell below k.
  for (const m of metrics) {
    if (m.participantCount !== undefined && m.participantCount < kThreshold) return false;
  }
  // (b) no subtraction leak. Group by the metrics RESOURCE DOCUMENT (the IRI with
  //     its fragment stripped) — the publisher emits an aggregate `<m>#it` and its
  //     strata `<m>#metrics-T0` in the SAME document, so a stratum groups with its
  //     own aggregate; INDEPENDENT metrics resources for one deliberation live in
  //     DIFFERENT documents and never cross-contaminate (an aggregate is only ever
  //     compared against ITS OWN strata).
  const byDoc = new Map<string, { aggregate?: number; strataSum: number }>();
  for (const m of metrics) {
    const doc = documentOf(m.id);
    const g = byDoc.get(doc) ?? { strataSum: 0 };
    if (m.tier === undefined) {
      // An aggregate node (no tier). Only a published total can leak by subtraction.
      // (Fail-closed on the malformed case of >1 aggregate in one document: keep the
      // SMALLEST total, so the strictest remainder is checked.)
      if (m.participantCount !== undefined) {
        g.aggregate =
          g.aggregate === undefined
            ? m.participantCount
            : Math.min(g.aggregate, m.participantCount);
      }
    } else if (m.participantCount !== undefined) {
      g.strataSum += m.participantCount;
    }
    byDoc.set(doc, g);
  }
  for (const g of byDoc.values()) {
    if (g.aggregate === undefined) continue; // no published total → nothing to subtract
    const remainder = g.aggregate - g.strataSum;
    if (remainder !== 0 && remainder < kThreshold) return false; // sub-k remainder leaks
  }
  return true;
}

/** The document IRI of a node (its IRI with any fragment stripped) — the grouping
 *  key that ties an aggregate to ITS OWN strata (same document). A non-parseable
 *  IRI falls back to itself (its own singleton group). */
function documentOf(iri: string): string {
  try {
    const u = new URL(iri);
    u.hash = "";
    return u.toString();
  } catch {
    return iri;
  }
}
