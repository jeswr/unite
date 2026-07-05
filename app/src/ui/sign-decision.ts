// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.5 — the steward-signing GLUE between the scope-B Convergence Room's
// computed outcome and the LANDED S3.4 signing lib (docs/design/next-phases.md
// §1.5 (5)) — the scope-B governance analog of ui/sign-future (S5.4). This
// module INVOKES the verified enforcement in lib/adoption-decision +
// lib/dissent + lib/quorum — it never re-implements or routes around it:
//
//   • the artifact graph comes ONLY from `buildAdoptionDecisionQuads`, which
//     THROWS on every un-buildable state — unconsented lineage (INV-1), a
//     missing dissent annex (INV-2), inconsistent bridging counts, a
//     non-version IRI — and the UI surfaces those throws VERBATIM (the
//     refusal is the invariant working, a feature to show, never to hide);
//   • the dissent annex is materialised by lib/dissent's `materializeDissent`
//     (fail-closed aggregate-only; every standing critique carried, counted,
//     never erased), and this glue REFUSES when the annex would not account
//     for a critique standing NOW (the D2 discipline S5 enforces in-lib —
//     lib/adoption-decision enforces annex PRESENCE; this only refuses MORE,
//     never less);
//   • each steward signature is `issueStewardAttestation` (solid-vc Data
//     Integrity over the RDFC-1.0 content digest);
//   • the honest quorum / ratification state comes from the FULL
//     `verifyAdoptionDecision` path (the ≥2-steward quorum over the REQUIRED
//     registry-backed `trustedStewards` allowlist + parse-of-the-signed-quads
//     + the INV-1 re-check + the INV-3 status RECOMPUTE) — which throws
//     fail-closed without a non-empty allowlist, so a community with no
//     published steward registry cannot ratify.
//
// Two gates the glue itself holds (both STRICTER-than-lib refusals, never
// weaker, per design §1.3(d)):
//   • the §3.4 both-partitions endorsement gate: an AdoptionDecision may only
//     be assembled from a candidate whose reception cleared the bridging
//     threshold in BOTH the opinion partition AND the verified-role partition
//     (`InfraCandidateReception.bothCleared` — lib/convergence, S3.2);
//   • the design/04 §2 running-code gate: every infra proposal in the
//     candidate's lineage must carry a `fut:referenceImplementation` — the
//     mechanical enforcement the Room's visible chip has promised since S2.
//
// Pure + injectable (the steward key, allowlist and key resolver are the SAME
// StewardSigningContext ui/sign-future defines), so the whole flow is
// exhaustively unit-testable with no network and drives the REAL crypto.

import type { VerifiableCredential } from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { Store } from "n3";
import { type AdoptionObservation, DEFAULT_ADOPTION_BAR } from "../lib/adoption.js";
import {
  type AdoptionDecisionVerification,
  buildAdoptionDecisionQuads,
  type ClusterBridgingEvidence,
  type DissentRecordInput,
  issueStewardAttestation,
  parseAdoptionDecisions,
  verifyAdoptionDecision,
} from "../lib/adoption-decision.js";
import type { InfraCandidateReception } from "../lib/convergence.js";
import { materializeDissent } from "../lib/dissent.js";
import { AS_CONTENT, DCT_CREATOR } from "../lib/fut.js";
import {
  FUT_DISSENT,
  FUT_NO_DISSENT_RECORDED,
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
  ROLE_PARTICIPANT,
  type StakeholderRole,
} from "../lib/fut-draft.js";
import type { InfraProposal } from "../lib/infra.js";
import type { Critique, SynthesisCandidate } from "../lib/model.js";
import {
  bridgingEvidenceFor,
  type StewardSigningContext,
  sameBridgingEvidence,
  sameCandidateMaterial,
  sameReception,
} from "./sign-future.js";

// ── Pure mappers from room state to the lib's build inputs ────────────────────

/** The AdoptionDecision artifact IRI for a candidate — DETERMINISTIC (re-signing
 *  the same candidate addresses the same artifact) AND UNIQUE per candidate. It
 *  preserves the candidate's fragment in a single, valid decision fragment, so
 *  two candidate resources in the SAME RDF document produce DISTINCT decision
 *  IRIs (otherwise `App`'s dedup-by-id would let one decision overwrite the
 *  other). A fragment-less candidate yields the bare `#adoption-decision`. */
export function adoptionDecisionIriFor(candidateId: string): string {
  const hash = candidateId.indexOf("#");
  if (hash === -1) return `${candidateId}#adoption-decision`;
  const doc = candidateId.slice(0, hash);
  const fragment = candidateId.slice(hash + 1);
  return fragment.length === 0
    ? `${doc}#adoption-decision`
    : `${doc}#adoption-decision-${encodeURIComponent(fragment)}`;
}

/** Human labels for the coded stakeholder roles (display + cluster labels). */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  [ROLE_IMPLEMENTER]: "implementers",
  [ROLE_OPERATOR]: "operators",
  [ROLE_PARTICIPANT]: "participants",
};

/** The display label of one stakeholder-role cohort. */
export function roleLabel(role: StakeholderRole): string {
  return `role: ${ROLE_LABELS[role] ?? role}`;
}

/**
 * The role-cohort labels for a participant set + verified-role map, in the
 * EXACT canonical order lib/convergence's `roleClustering` builds its cohorts
 * (dedupe+sort the participants, map to verified roles fail-closed to
 * ParticipantRole, distinct roles in sorted-IRI order) — so index `i` here
 * labels `perCluster[i]` of a role-partition reception. The alignment is
 * PINNED against `roleClustering` itself in sign-decision.test.ts, so this
 * presentational mirror cannot silently diverge from the lib's ordering.
 */
export function roleCohortLabels(
  participants: readonly string[],
  roleMap: ReadonlyMap<string, StakeholderRole>,
): string[] {
  const parts = [...new Set(participants)].sort();
  const roleOf = (p: string): StakeholderRole => roleMap.get(p) ?? ROLE_PARTICIPANT;
  const cohorts = [...new Set(parts.map(roleOf))].sort();
  return cohorts.map(roleLabel);
}

/**
 * The decision's `fut:bridgingEvidence` — the recomputable common-ground proof
 * over BOTH required partitions (design §1.2: "per-cohort endorsement
 * evidence, incl. the role partition"): the opinion clusters (the same rows
 * sign-future emits) followed by the verified-role cohorts, labelled via
 * {@link roleCohortLabels}. Count inconsistencies are NOT patched here —
 * `buildAdoptionDecisionQuads` re-checks `seen = resonates + conflicts +
 * unsure` and throws.
 */
export function decisionBridgingEvidence(
  infra: InfraCandidateReception,
  participants: readonly string[],
  roleMap: ReadonlyMap<string, StakeholderRole>,
): ClusterBridgingEvidence[] {
  const roleLabels = roleCohortLabels(participants, roleMap);
  const roleRows = infra.role.perCluster.map((dist, i) => ({
    clusterLabel: roleLabels[i] ?? `role cohort ${i + 1}`,
    resonatesCount: dist.resonates,
    conflictsCount: dist.conflicts,
    unsureCount: dist.unsure,
    seenCount: dist.seen,
  }));
  return [...bridgingEvidenceFor(infra.opinion), ...roleRows];
}

/**
 * The mandatory dissent annex (INV-2) as the lib's build input: one record per
 * standing critique via lib/dissent's `materializeDissent` (fail-closed
 * aggregate-only — verbatim quotation requires the affirmative
 * `fut:quoteVerbatim` grant, which the aggregate does not surface yet; every
 * record is carried in aggregate, counted, never erased). Attribution
 * (`creator`) is carried ONLY on a verbatim record — never on an
 * aggregate-only one (it must not re-identify the withholding critic).
 */
export function decisionDissent(reviewedCritiques: readonly Critique[]): {
  readonly dissent: readonly DissentRecordInput[];
  readonly accountedFor: ReadonlySet<string>;
} {
  const annex = materializeDissent(reviewedCritiques);
  return {
    dissent: annex.records.map((r) => ({
      content: r.content,
      ...(r.verbatim && r.creator !== undefined ? { creator: r.creator } : {}),
    })),
    accountedFor: annex.accountedFor,
  };
}

/** A stable, order-independent key for one dissent record's SIGNED content —
 *  its `as:content` plus its `dct:creator` (present only on a verbatim record).
 *  The MULTISET of these keys is the annex's identity: two annexes carry the
 *  same dissent iff their key multisets match. Aggregate-only records collapse
 *  to the same key (they are deliberately non-identifying), so swapping two
 *  aggregate critiques is correctly treated as equivalent — the count is
 *  preserved and no verbatim content differs; a VERBATIM swap changes the key. */
function dissentKey(content: string, creator?: string): string {
  // A JSON tuple — unambiguous (no delimiter a value could contain) and free of
  // control characters, so two records collide iff their (content, creator) are
  // genuinely equal.
  return JSON.stringify([content, creator ?? null]);
}

/** The sorted multiset of dissent-record keys carried in a signed decision
 *  graph — read from the raw quads (blank-node records matched by label within
 *  the one graph). Used to prove a REUSED prior graph still carries EXACTLY the
 *  currently-materialised annex before it is co-signed. */
function priorAnnexKeys(quads: readonly Quad[]): string[] {
  const recIds = new Set<string>();
  for (const q of quads) if (q.predicate.value === FUT_DISSENT) recIds.add(q.object.value);
  const contentByRec = new Map<string, string>();
  const creatorByRec = new Map<string, string>();
  for (const q of quads) {
    if (!recIds.has(q.subject.value)) continue;
    if (q.predicate.value === AS_CONTENT && q.object.termType === "Literal") {
      contentByRec.set(q.subject.value, q.object.value);
    } else if (q.predicate.value === DCT_CREATOR && q.object.termType === "NamedNode") {
      creatorByRec.set(q.subject.value, q.object.value);
    }
  }
  const keys: string[] = [];
  for (const rec of recIds) {
    const content = contentByRec.get(rec);
    if (content === undefined) continue; // a record with no content is not a valid dissent
    keys.push(dissentKey(content, creatorByRec.get(rec)));
  }
  return keys.sort();
}

/** Outcome + per-cohort-distribution equality over BOTH partitions — the
 *  "did the scope-B room move since the steward reviewed this?" test. */
export function sameInfraReception(
  a: InfraCandidateReception,
  b: InfraCandidateReception,
): boolean {
  return (
    a.outcome === b.outcome &&
    a.bothCleared === b.bothCleared &&
    sameReception(a.opinion, b.opinion) &&
    sameReception(a.role, b.role)
  );
}

// ── The sign action ───────────────────────────────────────────────────────────

/** Inputs to {@link signAdoptionCandidate} — all from the room's live state. */
export interface SignAdoptionDecisionArgs {
  /** The active candidate (from the lineage-gated aggregate, FRESH). */
  readonly candidate: SynthesisCandidate;
  /** The FRESH both-partitions reception (lib/convergence S3.2). Only a
   *  `bothCleared` candidate is an adoption recommendation (§3.4). */
  readonly infra: InfraCandidateReception;
  /** The verified participant WebIDs (the reception's axis — role labels). */
  readonly participants: readonly string[];
  /** The verified-role map the role partition was computed over. */
  readonly roleMap: ReadonlyMap<string, StakeholderRole>;
  /** The standing critiques the steward REVIEWED — the annex raw material. */
  readonly reviewedCritiques: readonly Critique[];
  /** The critique IRIs standing NOW (recomputed at sign time). A critique that
   *  landed after review makes the annex incomplete → REFUSE (the D2
   *  discipline): un-signable until the new dissent is reviewed. */
  readonly standingCritiqueIds: ReadonlySet<string>;
  /** The aggregate's consent gate (INV-1 — re-checked by the lib at build AND
   *  at verify). */
  readonly synthesizable: ReadonlySet<string>;
  /** The infra proposals IN THE CANDIDATE'S LINEAGE (fresh) — the design/04 §2
   *  running-code gate refuses when any lacks a reference implementation. */
  readonly lineageProposals: readonly InfraProposal[];
  /** The CURRENT `fut:AdoptionObservation` set (observed at sign time — the
   *  re-checkable evidence the decision carries; the status is recomputed from
   *  it, never asserted, INV-3). */
  readonly adoptionEvidence: readonly AdoptionObservation[];
  /** `fut:proposesVersion` — the immutable version IRI being recommended. */
  readonly proposesVersion: string;
  /** `fut:adoptionBar` (default {@link DEFAULT_ADOPTION_BAR}; design/04 §2). */
  readonly adoptionBar?: number;
  /** The deliberation IRI. */
  readonly deliberation: string;
  /** The steward-signing context (session key + allowlist + resolver) — the
   *  SAME shape S5.4 uses (ui/sign-future). */
  readonly context: StewardSigningContext;
  /**
   * The artifact ALREADY assembled + signed for this candidate, when
   * co-signing. A co-signature MUST bind the SAME RDFC-1.0 digest the first
   * steward signed — re-assembling (with fresh evidence timestamps and a
   * different assembling steward as `dct:creator`) would fork the digest and
   * void every prior signature. The co-signed graph is still FULLY re-checked:
   * `verifyAdoptionDecision`'s parse mirrors every build invariant on the
   * signed quads, and INV-1 is re-checked against the CURRENT gate inputs.
   */
  readonly prior?: Pick<SignedAdoptionDecision, "quads" | "vcs">;
  /** The community's steward floor (the lib clamps UP to the ≥2 floor — a
   *  community may raise the bar, never lower it, INV-5). */
  readonly stewardFloor?: number;
  /** Clock seam (tests). */
  readonly now?: () => string;
}

/** A signed AdoptionDecision: the artifact, its credentials, and the FULL lib
 *  verification (quorum + parse + INV-1 + the INV-3 computed status). */
export interface SignedAdoptionDecision {
  /** The artifact IRI. */
  readonly id: string;
  /** The candidate it was signed from. */
  readonly candidate: string;
  /** The signed graph (exactly what every steward's digest binds). */
  readonly quads: readonly Quad[];
  /** Every collected steward attestation (prior + this session's). */
  readonly vcs: readonly VerifiableCredential[];
  /** The full lib verification — `decision` is the PARSE OF THE SIGNED QUADS
   *  (render from it, never from caller inputs); `computedStatus` is the
   *  INV-3 recompute from the signed evidence vs the bar; `ratified` is
   *  quorum AND parse AND consented lineage, never quorum alone. */
  readonly verification: AdoptionDecisionVerification;
}

/**
 * Sign the scope-B room's computed outcome as this session's steward: assemble
 * the `fut:AdoptionDecision` graph through the lib's throwing build gate,
 * issue this steward's Data-Integrity attestation over its digest, and
 * re-verify the whole artifact (quorum + invariants + the computed status) for
 * the honest progress display.
 *
 * THROWS (and the caller surfaces the message verbatim) on every un-signable
 * state. Unlike S5.4 (where a disagreement map publishes co-equally), an
 * AdoptionDecision RECOMMENDS a version — only a candidate endorsed in BOTH
 * partitions is signable; a disagreement or open round is refused with the
 * honest reason naming which lens blocked.
 */
export async function signAdoptionCandidate(
  args: SignAdoptionDecisionArgs,
): Promise<SignedAdoptionDecision> {
  const { context, infra } = args;
  if (context.steward === null) {
    throw new Error(
      "signing requires a steward signing key in this session — the steward role alone is not a key",
    );
  }

  // The §3.4 both-partitions endorsement gate (design §1.3(d) precondition b),
  // enforced STRICTLY and FAIL-CLOSED: an adoption RECOMMENDATION must be
  // common ground across the opinion clusters AND the verified stakeholder-role
  // cohorts — BOTH must independently reach "endorsed" (`infra.bothCleared`).
  // The role partition's "open" (insufficient verified role cohorts) BLOCKS
  // just like a disagreement does: signing never proceeds without CONFIRMED
  // cross-role endorsement (the safe default for a governance signature — a
  // signed recommendation must not outrun the cross-stakeholder consensus it
  // claims).
  //
  // KNOWN LIMITATION (honest, not silent — the UI says so, and it is tracked):
  // the cross-participant verified-role DATA FLOW is S3.6 (only a session's OWN
  // declaration is folded in today), so until S3.6 lands the role partition
  // cannot form the ≥2 cohorts needed to reach "endorsed" and this signing path
  // is intentionally gated CLOSED for infrastructure candidates. This is a
  // reachability limitation, deliberately resolved toward fail-safe (do not
  // sign) rather than toward a weaker gate; the role lens is computed + shown +
  // labelled "confirmation pending (S3.6)". This never weakens a LIB invariant
  // (adoption-decision.ts never enforced the role partition; the §3.4
  // composition lives here) and never signs an unconfirmed recommendation.
  if (!infra.bothCleared) {
    const blockers = [
      infra.opinion.outcome !== "endorsed" ? `the opinion lens is ${infra.opinion.outcome}` : null,
      infra.role.outcome !== "endorsed"
        ? `the verified-role lens is ${infra.role.outcome}` +
          (infra.role.outcome === "open"
            ? " (too few verified role cohorts — the cross-participant verified-role data flow " +
              "lands with S3.6; until then this gate stays closed, fail-safe)"
            : " (a verified stakeholder cohort actively opposes it — carry the objection into a " +
              "revision that cohort can endorse)")
        : null,
    ].filter((b): b is string => b !== null);
    throw new Error(
      `an AdoptionDecision needs the endorsement gate cleared in BOTH partitions (§3.4): ${blockers.join("; ")}`,
    );
  }

  // The design/04 §2 running-code gate — "rough consensus AND running code":
  // the mechanical enforcement the Room's chip has promised since S2. An
  // adoption decision RECOMMENDS a spec version, and a version is only
  // recommendable when running code for it exists. That requires TWO things,
  // both fail-closed:
  //   (a) the candidate's lineage carries ≥1 infra proposal at all — a
  //       candidate derived ONLY from needs (aspirations) has nothing that
  //       could carry a reference implementation, so it can never satisfy the
  //       running-code bar and must not become an AdoptionDecision; and
  //   (b) EVERY lineage infra proposal carries a fut:referenceImplementation.
  if (args.lineageProposals.length === 0) {
    throw new Error(
      "an adoption decision recommends a spec version backed by RUNNING CODE (design/04 §2), but " +
        "this candidate's lineage carries no infra proposal — nothing provides a " +
        "fut:referenceImplementation, so there is no running code to recommend adopting; it " +
        "cannot become an AdoptionDecision",
    );
  }
  const missingCode = args.lineageProposals.filter((p) => p.referenceImplementation === undefined);
  if (missingCode.length > 0) {
    throw new Error(
      `running code missing on ${missingCode.length} of ${args.lineageProposals.length} lineage ` +
        `proposal${args.lineageProposals.length === 1 ? "" : "s"} — a recommendation whose lineage ` +
        "lacks a fut:referenceImplementation cannot become an AdoptionDecision (design/04 §2)",
    );
  }

  // The mandatory annex (INV-2), materialised by the lib — and the D2
  // discipline: the annex must account for every critique standing NOW. A
  // critique that landed after the steward's review makes the candidate
  // un-signable until it is reviewed (refused, never silently dropped).
  const { dissent, accountedFor } = decisionDissent(args.reviewedCritiques);
  for (const id of args.standingCritiqueIds) {
    if (!accountedFor.has(id)) {
      throw new Error(
        "the dissent annex DROPS a standing critique (dissent landed after it was reviewed) — " +
          "un-signable until the new dissent is reviewed and a fresh decision is assembled",
      );
    }
  }

  const id = adoptionDecisionIriFor(args.candidate.id);
  const evidence = decisionBridgingEvidence(infra, args.participants, args.roleMap);

  // CO-SIGN FRESHNESS GUARD (pre-signature, fail-closed): the prior artifact
  // must still be THE artifact for this candidate — same reviewed material,
  // same recommended version, same recomputable bridging evidence as the
  // room's CURRENT reception. Parsed with the LIB's own parser (which mirrors
  // every build invariant); nothing is re-implemented.
  let quads: readonly Quad[];
  if (args.prior !== undefined) {
    const parsedPrior = parseAdoptionDecisions(new Store([...args.prior.quads]));
    const prior = parsedPrior.length === 1 ? parsedPrior[0] : undefined;
    if (prior === undefined) {
      throw new Error(
        "the prior artifact graph does not parse as exactly one valid fut:AdoptionDecision — it cannot be co-signed",
      );
    }
    if (prior.id !== id) {
      throw new Error(
        "the prior artifact does not address this candidate — assemble a fresh decision",
      );
    }
    if (
      !sameCandidateMaterial(prior, {
        content: args.candidate.content,
        ...(args.candidate.title !== undefined ? { title: args.candidate.title } : {}),
        derivedFrom: args.candidate.derivedFrom,
        inDeliberation: args.deliberation,
      })
    ) {
      throw new Error(
        "the prior artifact does not match this candidate's reviewed content/lineage " +
          "(the candidate changed, or the artifact belongs to another candidate in the same " +
          "document) — assemble a fresh decision",
      );
    }
    if (prior.proposesVersion !== args.proposesVersion) {
      throw new Error(
        "the prior artifact recommends a DIFFERENT version — a co-signature must attest the " +
          "same recommendation; assemble a fresh decision for the new version",
      );
    }
    if (!sameBridgingEvidence(prior.bridgingEvidence, evidence)) {
      throw new Error(
        "the room's endorsement evidence moved since this decision was assembled (votes or " +
          "verified roles changed) — the prior artifact no longer reflects the current " +
          "reception; review the current outcome and assemble a fresh decision",
      );
    }
    // CO-SIGN DISSENT-ANNEX FRESHNESS (fail-closed): the standingCritiqueIds
    // check above only proves the CURRENT reviewedCritiques account for every
    // critique standing NOW — it does NOT prove the REUSED prior graph does.
    // A critique that landed / was edited / was withdrawn after the first
    // signature would leave `args.prior.quads` (which the co-signature binds
    // verbatim) carrying a STALE annex, so the second steward could ratify a
    // graph whose dissent no longer matches the room. Guard it by CONTENT, not
    // just count: the prior graph's dissent-record key MULTISET + no-dissent
    // flag must exactly equal what the current standing critiques materialise
    // (`dissent`). A same-count swap of a VERBATIM record changes a key and is
    // caught; an aggregate-only swap collapses to the same key (correctly
    // equivalent — count preserved, no verbatim content differs).
    const priorKeys = priorAnnexKeys(args.prior.quads);
    const wantKeys = dissent.map((d) => dissentKey(d.content, d.creator)).sort();
    const sameAnnex =
      priorKeys.length === wantKeys.length && priorKeys.every((k, i) => k === wantKeys[i]);
    const priorNoDissent = args.prior.quads.some(
      (q) => q.predicate.value === FUT_NO_DISSENT_RECORDED,
    );
    if (!sameAnnex || priorNoDissent !== (dissent.length === 0)) {
      throw new Error(
        "the dissent annex changed since this decision was assembled (dissent landed, was edited, " +
          "or was withdrawn after the first signature) — the prior artifact no longer carries the " +
          "current annex, and its digest can no longer be co-signed; assemble a fresh decision",
      );
    }
    // CO-SIGN EVIDENCE FRESHNESS (fail-closed): the co-signature binds the SAME
    // artifact digest — i.e. the FIRST steward's re-checkable evidence SNAPSHOT.
    // But the sign path re-OBSERVES the wire at co-sign time, so the second
    // steward would attest the OLD snapshot while having just swept a DIFFERENT
    // wire. Guard it: the prior artifact's evidence SET (party+version+source,
    // ignoring the observedAt timestamp which legitimately ticks each sweep) and
    // its bar must still equal what was observed NOW — else the wire moved and
    // the recommendation must be re-assembled (not stale-ratified).
    const evidenceKey = (o: AdoptionObservation) => JSON.stringify([o.party, o.version, o.source]);
    const priorEvidenceKeys = prior.adoptionEvidence.map(evidenceKey).sort();
    const currentEvidenceKeys = args.adoptionEvidence.map(evidenceKey).sort();
    const sameEvidence =
      priorEvidenceKeys.length === currentEvidenceKeys.length &&
      priorEvidenceKeys.every((k, i) => k === currentEvidenceKeys[i]);
    if (!sameEvidence || prior.adoptionBar !== (args.adoptionBar ?? DEFAULT_ADOPTION_BAR)) {
      throw new Error(
        "the observed adoption evidence (or the bar) moved since this decision was assembled — a " +
          "co-signature binds the first steward's evidence snapshot, but you just observed a " +
          "different wire; review the current evidence and assemble a fresh decision",
      );
    }
    // The SAME digest is what the co-signature must bind: reuse the exact
    // signed quads (the adoption evidence inside them is the first steward's
    // re-checkable snapshot; the LIVE wire state is separately recomputed and
    // rendered — the signature never attests a status, INV-3).
    quads = args.prior.quads;
  } else {
    // Assemble FRESH through the lib's THROWING gate. Never caught here:
    // unconsented lineage (INV-1), a missing/contradictory annex (INV-2),
    // inconsistent counts, malformed IRIs all throw out of
    // buildAdoptionDecisionQuads and surface verbatim. INV-3: the build emits
    // NO status triple — deliberately.
    quads = buildAdoptionDecisionQuads(
      {
        id,
        content: args.candidate.content,
        ...(args.candidate.title !== undefined && args.candidate.title.length > 0
          ? { title: args.candidate.title }
          : {}),
        proposesVersion: args.proposesVersion,
        adoptionBar: args.adoptionBar ?? DEFAULT_ADOPTION_BAR,
        adoptionEvidence: args.adoptionEvidence,
        derivedFrom: args.candidate.derivedFrom,
        bridgingEvidence: evidence,
        dissent,
        ...(dissent.length === 0 ? { noDissentRecorded: true } : {}),
        created: (args.now ?? (() => new Date().toISOString()))(),
        creator: context.steward.webId,
        inDeliberation: args.deliberation,
      },
      { synthesizable: args.synthesizable },
    );
  }

  // This steward's independent Data-Integrity attestation over the digest.
  const vc = await issueStewardAttestation({
    subject: id,
    decisionQuads: quads,
    webId: context.steward.webId,
    key: context.steward.key,
  });
  const vcs = [...(args.prior?.vcs ?? []), vc];

  // The FULL verify path over exactly what was signed — throws fail-closed
  // without a non-empty registry-backed trustedStewards allowlist (INV-5),
  // parses the decision FROM THE SIGNED QUADS (INV-3: no status is ever
  // read), re-checks INV-1 against the CURRENT synthesizable set, and
  // RECOMPUTES the adoption status from the signed evidence vs the bar.
  const verification = await verifyAdoptionDecision(quads, vcs, {
    verifyVc: context.verifyVc,
    resolveKey: context.resolveKey,
    trustedStewards: context.trustedStewards,
    synthesizable: args.synthesizable,
    ...(args.stewardFloor !== undefined ? { threshold: args.stewardFloor } : {}),
  });

  // Surface the lib's verify verdicts as REFUSALS (the fresh path already
  // threw at build; this guards the co-sign path): a signed graph that no
  // longer parses as exactly one valid AdoptionDecision, or whose lineage is
  // no longer consented, must not be presented as signed.
  if (verification.decision === undefined) {
    throw new Error(
      "the artifact graph does not parse as exactly one valid fut:AdoptionDecision — it cannot be signed",
    );
  }
  if (verification.lineageConsented === false) {
    throw new Error(
      "the decision's lineage is no longer fully consented to synthesis (an author revoked " +
        "fut:synthesize) — a decision may derive ONLY from consented statements (INV-1); it " +
        "cannot be signed",
    );
  }

  return { id, candidate: args.candidate.id, quads, vcs, verification };
}
