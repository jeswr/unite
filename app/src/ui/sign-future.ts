// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.4 — the steward-signing GLUE between the Convergence Room's computed
// outcome and the LANDED S5 signing lib (docs/design/next-phases.md §2.6 (5)).
// This module INVOKES the verified enforcement in lib/shared-future +
// lib/dissent + lib/quorum — it never re-implements or routes around it:
//
//   • the artifact graph comes ONLY from `buildSharedFutureQuads`, which
//     THROWS on every un-signable state — a dropped standing critique (D2),
//     a missing dissent annex (D1), missing bridging evidence (D3), missing
//     method-provenance (D4), unconsented lineage (INV-1), a sub-k cohort —
//     and the UI surfaces those throws VERBATIM (the refusal is the invariant
//     working, a feature to show, never to hide);
//   • the dissent annex is materialised by `materializeDissent` (fail-closed
//     aggregate-only: the aggregate does not yet surface per-critique
//     `fut:quoteVerbatim` consent, and verbatim quoting requires the
//     affirmative grant — so every record is carried in aggregate, counted,
//     never erased);
//   • each steward signature is `issueSharedFutureAttestation` (solid-vc
//     Data Integrity over the RDFC-1.0 content digest);
//   • the honest quorum / ratification state comes from the FULL
//     `verifySharedFuture` path (≥2-steward quorum over the REQUIRED
//     registry-backed `trustedStewards` allowlist + parse + INV-1 + k-anon +
//     the D2 re-check) — which throws fail-closed without an allowlist, so a
//     pod-mode community with no published steward registry cannot sign.
//
// Pure + injectable (the steward key, the allowlist and the key resolver are
// a context object), so the whole flow is exhaustively unit-testable with no
// network and drives the REAL crypto.

import {
  type KeyPair,
  type VerifiableCredential,
  type VerificationResult,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClusterBridgingEvidence } from "../lib/adoption-decision.js";
import type { AggregateResult } from "../lib/aggregate.js";
import type { CandidateReception } from "../lib/convergence.js";
import { normalizeKThreshold } from "../lib/convergence-metrics.js";
import { type MaterializedDissent, materializeDissent } from "../lib/dissent.js";
import { METHOD_RESONANCE_MAPPING } from "../lib/fut-society.js";
import type { Critique, SynthesisCandidate } from "../lib/model.js";
import type { ResolveKey } from "../lib/quorum.js";
import {
  buildSharedFutureQuads,
  issueSharedFutureAttestation,
  type SharedFutureVerification,
  verifySharedFuture,
} from "../lib/shared-future.js";
import { groupName } from "./components.js";
import { type DeliberationConfig, deliberationKey, deliberationTrust } from "./state.js";
import type { PublishedFutureView } from "./views/PublishedFutures.js";

/** The design-default k-anonymity threshold (lib/convergence-metrics: 5). */
export const K_THRESHOLD = normalizeKThreshold();

// ── The signing context (who may sign, and how signatures verify) ────────────

/**
 * The resolved steward-signing context for one deliberation — the INV-5
 * quorum inputs. `steward` is the SESSION's signing key (null = this session
 * holds none: the surface stays locked, honestly labelled); `trustedStewards`
 * is the community's REGISTRY-BACKED steward allowlist (empty = no published
 * registry: `verifySharedFutureQuorum` throws fail-closed, the surface stays
 * locked). Nothing here decides trust — it only carries what the community
 * published into the lib's verifier.
 */
export interface StewardSigningContext {
  /** The session steward's WebID + signing key, when the session holds one. */
  readonly steward: { readonly webId: string; readonly key: KeyPair } | null;
  /** The registry-backed steward allowlist (anchor authorities, INV-5). */
  readonly trustedStewards: readonly string[];
  /** Resolve a proof `verificationMethod` to the community's published key. */
  readonly resolveKey: ResolveKey;
  /** Verify ONE steward credential (solid-vc, over `resolveKey`). */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
}

// ── Pure mappers from room state to the lib's build inputs ────────────────────

/**
 * The DISTINCT contributor count feeding a candidate synthesis — the
 * k-anonymity input `buildSharedFutureQuads` gates on: the candidate's
 * author, the authors of its `derivedFrom` lineage statements, everyone who
 * voted on the candidate, and the standing critics. Deduped WebIDs.
 */
export function contributorCountFor(
  result: AggregateResult,
  candidate: SynthesisCandidate,
  critiques: readonly Critique[],
): number {
  const contributors = new Set<string>([candidate.creator]);
  const authorOf = new Map<string, string>();
  for (const s of result.needs) authorOf.set(s.id, s.creator);
  for (const s of result.proposals) authorOf.set(s.id, s.creator);
  for (const s of result.infraProposals) authorOf.set(s.id, s.creator);
  for (const s of result.visions) authorOf.set(s.id, s.creator);
  for (const s of result.claims) authorOf.set(s.id, s.creator);
  for (const s of result.values) authorOf.set(s.id, s.creator);
  for (const input of candidate.derivedFrom) {
    const author = authorOf.get(input);
    if (author !== undefined) contributors.add(author);
  }
  for (const r of result.resonances) {
    if (r.onStatement === candidate.id) contributors.add(r.creator);
  }
  for (const c of critiques) contributors.add(c.creator);
  return contributors.size;
}

/**
 * The room's computed per-cluster reception as the `fut:bridgingEvidence`
 * the lib requires (D3 — the recomputable common-ground proof). A count
 * inconsistency is NOT patched here: `buildSharedFutureQuads` re-checks
 * `seen = resonates + conflicts + unsure` and throws.
 */
export function bridgingEvidenceFor(reception: CandidateReception): ClusterBridgingEvidence[] {
  return reception.perCluster.map((dist, i) => ({
    clusterLabel: groupName(i),
    resonatesCount: dist.resonates,
    conflictsCount: dist.conflicts,
    unsureCount: dist.unsure,
    seenCount: dist.seen,
  }));
}

/** The SharedFuture artifact IRI for a candidate (deterministic: re-signing
 *  the same candidate addresses the same artifact). */
export function sharedFutureIriFor(candidateId: string): string {
  const hash = candidateId.indexOf("#");
  const doc = hash === -1 ? candidateId : candidateId.slice(0, hash);
  return `${doc}#shared-future`;
}

// ── The sign action ───────────────────────────────────────────────────────────

/** Inputs to {@link signRoomCandidate} — all from the room's live state. */
export interface SignRoomCandidateArgs {
  /** The active candidate (from the lineage-gated aggregate). */
  readonly candidate: SynthesisCandidate;
  /** The room's computed reception (must NOT be an open round). */
  readonly reception: CandidateReception;
  /**
   * The standing critiques the steward REVIEWED — the dissent-annex raw
   * material ({@link materializeDissent} carries each one, verbatim only with
   * consent, in aggregate otherwise; never erased).
   */
  readonly reviewedCritiques: readonly Critique[];
  /**
   * The critique IRIs standing NOW (recomputed at sign time). If a critique
   * landed after the steward's review, `buildSharedFutureQuads` THROWS (D2 —
   * the annex would drop a standing critique): the candidate is un-signable
   * until the new dissent is reviewed. That refusal is surfaced, not caught.
   */
  readonly standingCritiqueIds: ReadonlySet<string>;
  /** The aggregate's consent gate (INV-1 — re-checked by the lib at build). */
  readonly synthesizable: ReadonlySet<string>;
  /** The distinct-contributor count ({@link contributorCountFor}). */
  readonly contributorCount: number;
  /** The deliberation IRI. */
  readonly deliberation: string;
  /** The steward-signing context (session key + allowlist + resolver). */
  readonly context: StewardSigningContext;
  /**
   * The artifact ALREADY assembled + signed for this candidate, when
   * co-signing. A co-signature MUST bind the SAME RDFC-1.0 digest the first
   * steward signed — re-assembling the graph (with a different assembling
   * steward as `dct:creator`) would fork the digest and void every prior
   * signature. The co-signed graph is still FULLY re-checked by the lib:
   * `verifySharedFuture`'s parse mirrors every build invariant on the signed
   * quads, and INV-1 / k-anonymity / D2 are re-checked against the CURRENT
   * gate inputs — a stale or tampered artifact never ratifies, and a D2
   * shortfall (a critique landed after assembly) REFUSES the co-sign.
   */
  readonly prior?: Pick<SignedSharedFuture, "quads" | "vcs">;
  /** k-anonymity threshold (default {@link K_THRESHOLD}; lib clamps ≥1). */
  readonly kThreshold?: number;
  /** The community's steward floor (the lib clamps UP to the ≥2 floor —
   *  a community may raise the bar, never lower it, INV-5). */
  readonly stewardFloor?: number;
  /** Clock seam (tests). */
  readonly now?: () => string;
}

/** A signed SharedFuture: the artifact, its credentials, the FULL verify
 *  result, and the render view-model the Published-futures view consumes. */
export interface SignedSharedFuture {
  /** The artifact IRI. */
  readonly id: string;
  /** The candidate it was signed from. */
  readonly candidate: string;
  /** The signed graph (exactly what every steward's digest binds). */
  readonly quads: readonly Quad[];
  /** Every collected steward attestation (prior + this session's). */
  readonly vcs: readonly VerifiableCredential[];
  /** The materialised dissent annex the artifact carries. */
  readonly dissent: MaterializedDissent;
  /** The full lib verification (quorum + parse + INV-1 + k-anon + D2). */
  readonly verification: SharedFutureVerification;
  /** The Published-futures render view-model (the S5.5 hand-off). */
  readonly view: PublishedFutureView;
}

/**
 * Sign the room's computed outcome as this session's steward: build the
 * `fut:SharedFuture` graph through the lib's throwing gate, issue this
 * steward's Data-Integrity attestation over its digest, and re-verify the
 * whole artifact (quorum + invariants) for the honest progress display.
 *
 * THROWS (and the caller surfaces the message verbatim) on every un-signable
 * state — all enforced by the lib, none re-implemented here. Both computed
 * outcomes are signable: an ENDORSED candidate publishes as a shared future,
 * a DISAGREEMENT map publishes co-equally (design/03 §4 (5)); an OPEN round
 * is not an outcome and is refused.
 */
export async function signRoomCandidate(args: SignRoomCandidateArgs): Promise<SignedSharedFuture> {
  const { context, reception } = args;
  if (context.steward === null) {
    throw new Error(
      "signing requires a steward signing key in this session — the steward role alone is not a key",
    );
  }
  if (reception.outcome === "open") {
    throw new Error(
      "the endorsement round is still open — only a computed outcome (an endorsed candidate or a disagreement map) is signable",
    );
  }

  // The mandatory annex, carried fail-closed in AGGREGATE (no per-critique
  // fut:quoteVerbatim consent is surfaced by the aggregate yet; verbatim
  // quoting requires the affirmative grant — lib/dissent).
  const dissent = materializeDissent(args.reviewedCritiques);
  const id = sharedFutureIriFor(args.candidate.id);
  const kThreshold = args.kThreshold ?? K_THRESHOLD;

  // Assemble the graph — EITHER fresh through the lib's THROWING gate (the
  // first signature), OR the EXACT graph already assembled + signed (a
  // co-signature must bind the SAME digest; see `prior`'s doc). Never caught
  // here: dropped dissent / unaccounted standing critique / missing annex /
  // missing bridging evidence / missing method / unconsented lineage / sub-k
  // all throw out of buildSharedFutureQuads and surface verbatim.
  const quads: readonly Quad[] =
    args.prior !== undefined
      ? args.prior.quads
      : buildSharedFutureQuads(
          {
            id,
            content: args.candidate.content,
            ...(args.candidate.title !== undefined && args.candidate.title.length > 0
              ? { title: args.candidate.title }
              : {}),
            derivedFrom: args.candidate.derivedFrom,
            bridgingEvidence: bridgingEvidenceFor(reception),
            dissent,
            ...(args.reviewedCritiques.length === 0 ? { noDissentRecorded: true } : {}),
            methodProvenance: METHOD_RESONANCE_MAPPING,
            contributorCount: args.contributorCount,
            created: (args.now ?? (() => new Date().toISOString()))(),
            creator: context.steward.webId,
            inDeliberation: args.deliberation,
          },
          {
            synthesizable: args.synthesizable,
            standingCritiqueIds: args.standingCritiqueIds,
            kThreshold,
          },
        );

  // This steward's independent Data-Integrity attestation over the digest.
  const vc = await issueSharedFutureAttestation({
    subject: id,
    futureQuads: quads,
    webId: context.steward.webId,
    key: context.steward.key,
  });
  const vcs = [...(args.prior?.vcs ?? []), vc];

  // The FULL verify path over exactly what was signed — throws fail-closed
  // without a non-empty registry-backed trustedStewards allowlist (INV-5),
  // and re-checks parse + INV-1 + k-anonymity + D2 on the SIGNED quads.
  const verification = await verifySharedFuture(quads, vcs, {
    verifyVc: context.verifyVc,
    resolveKey: context.resolveKey,
    trustedStewards: context.trustedStewards,
    synthesizable: args.synthesizable,
    kThreshold,
    standingCritiqueIds: args.standingCritiqueIds,
    ...(args.stewardFloor !== undefined ? { threshold: args.stewardFloor } : {}),
  });

  // Surface the lib's verify verdicts as REFUSALS on the co-sign path (the
  // fresh path already threw at build): a signed graph that no longer parses
  // as exactly one valid SharedFuture, or whose annex no longer accounts for
  // the critiques standing NOW (D2 — one landed after assembly), must not be
  // presented as signed. The verdict is the lib's; this only refuses on it.
  const sf = verification.sharedFuture;
  if (sf === undefined) {
    throw new Error(
      "the artifact graph does not parse as exactly one valid fut:SharedFuture — it cannot be signed",
    );
  }
  if (verification.dissentComplete === false) {
    throw new Error(
      "the signed artifact no longer accounts for every critique standing NOW (D2 — dissent " +
        "landed after it was assembled): un-signable until the new dissent is reviewed and a " +
        "fresh artifact is assembled",
    );
  }

  return {
    id,
    candidate: args.candidate.id,
    quads,
    vcs,
    dissent,
    verification,
    view: {
      // Rendered from the PARSED signed graph (what the stewards actually
      // signed), never from unchecked caller inputs.
      id: sf.id,
      ...(sf.title !== undefined ? { title: sf.title } : {}),
      content: sf.content,
      methodProvenance: sf.methodProvenance,
      bridgingEvidence: sf.bridgingEvidence,
      dissent: dissent.records,
      noDissentRecorded: sf.dissentRecordCount === 0,
      distinctStewards: verification.quorum.distinctStewards,
      stewardFloor: verification.quorum.threshold,
      quorumMet: verification.quorum.met,
      bootstrapping: verification.quorum.bootstrapping,
      kAnonymous: verification.kAnonymous,
      // COMPUTED from the votes (INV-3): the artifact asserts no status.
      kind: reception.outcome === "endorsed" ? "shared-future" : "disagreement-map",
    },
  };
}

// ── The context-resolution hook (App-side wiring) ─────────────────────────────

/**
 * Resolve the steward-signing context for the configured deliberation —
 * the view-side wiring of the community's published quorum inputs
 * (state.deliberationTrust: the issuance key seam + the steward anchors).
 * FAIL-CLOSED: while resolving, on any resolution failure, or when `enabled`
 * is false (a non-advisory-synthesis scope), the context is null and the
 * signing surface stays locked. Keyed to the exact config VALUE (the
 * useTrustProfile pattern) so a config switch exposes null in the same
 * render — a stale community's anchors are never used, not even one frame.
 */
export function useStewardSigning(
  config: DeliberationConfig,
  enabled: boolean,
): StewardSigningContext | null {
  const [resolved, setResolved] = useState<{
    readonly key: string;
    readonly context: StewardSigningContext;
  } | null>(null);
  const reqId = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;

  const key = deliberationKey(config);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by VALUE — load re-creates when the config VALUE changes; the render-synced ref carries the object.
  const load = useCallback(async () => {
    if (!enabled) return;
    const cfg = configRef.current;
    const k = deliberationKey(cfg);
    reqId.current += 1;
    const id = reqId.current;
    try {
      const trust = await deliberationTrust(cfg);
      const anchors = trust.stewardAnchors;
      const resolveKey: ResolveKey = (vm) =>
        anchors.find((a) => a.verificationMethod === vm)?.publicKey;
      const context: StewardSigningContext = {
        steward: trust.issuance ? { webId: trust.issuance.steward, key: trust.issuance.key } : null,
        trustedStewards: [...new Set(anchors.map((a) => a.authority))],
        resolveKey,
        verifyVc: (vc) => verifyCredential(vc, { resolveKey }),
      };
      if (id === reqId.current) setResolved({ key: k, context });
    } catch {
      // fail-closed: no context, the surface stays locked
      if (id === reqId.current) setResolved(null);
    }
  }, [key, enabled]);

  useEffect(() => {
    void load();
    return () => {
      reqId.current += 1; // supersede in-flight resolution on unmount/change
    };
  }, [load]);

  // Derived at render time: a context resolved for another config is never
  // returned (no stale-anchor window while the effect catches up).
  return enabled && resolved !== null && resolved.key === key ? resolved.context : null;
}
