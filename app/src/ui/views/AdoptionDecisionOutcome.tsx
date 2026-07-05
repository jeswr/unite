// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B output presentation + the S3.5 STEWARD SIGNING surface for the
// fut:AdoptionDecision (docs/design/next-phases.md §1.3(d)/§1.5 (5)) — the
// governance analog of SharedFutureOutcome (S5.4). Everything here is
// computed, never asserted (the room's posture):
//
//   • The §3.4 BOTH-PARTITIONS gate is shown honestly: the opinion lens AND
//     the verified-role lens must EACH clear the bridging threshold before a
//     candidate is an adoption recommendation. A role lens that cannot
//     confirm ("open" — too few verified role cohorts) blocks signing and
//     says so; it only ever raises the bar (fail-safe).
//   • The SIGN ACTION is steward-gated (lib stewardSigningGate) and
//     fail-closed: a non-steward sees an honestly-labelled locked state; a
//     steward without a session key, or a community without a registry-backed
//     steward allowlist, stays locked too. The enforcement (INV-1 consent,
//     the INV-2 annex, the ≥2 quorum over trustedStewards, the INV-3
//     computed-status) lives in lib/adoption-decision — this surface only
//     invokes it (via ui/sign-decision) and shows its refusals VERBATIM.
//   • INV-3 — computed, never asserted: the signed decision's status is
//     RECOMPUTED from its evidence against its bar (the lib's
//     computedStatus); the signature attests the RECOMMENDATION + its bar +
//     its re-checkable evidence, NEVER the status. The Adoption board's live
//     wire reads stay the ratification instrument.

import { useState } from "react";
import { DEFAULT_ADOPTION_BAR, GOVERNED_SYSTEMS } from "../../lib/adoption.js";
import type { EndorsementAccess } from "../../lib/adoption-decision.js";
import type { CandidateReception, InfraCandidateReception } from "../../lib/convergence.js";
import type { Critique } from "../../lib/model.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { LockedGate, Notice, SectionHeader } from "../components.js";
import type { SignedAdoptionDecision } from "../sign-decision.js";
import type { StewardSigningContext } from "../sign-future.js";

/** The default recommended version: the NEWEST version of the first governed
 *  lineage (adoption.ts orders versions oldest-first). */
export function defaultProposedVersion(): string {
  const system = GOVERNED_SYSTEMS[0];
  const last = system?.versions[system.versions.length - 1];
  return last?.iri ?? "";
}

/** The S3.5 signing wiring the Room passes down (absent = presentation only). */
export interface DecisionSigning {
  /** Whether the SESSION holds the steward role. A null/unresolved profile
   *  must be passed as false — fail-closed. */
  readonly isSteward: boolean;
  /** The lib's steward gate verdict (stewardSigningGate) — its `reason` is
   *  the honest locked copy for a non-steward. */
  readonly gate: EndorsementAccess;
  /** The resolved signing context (null while resolving / unavailable). */
  readonly context: StewardSigningContext | null;
  /** The signed decision for THIS candidate, once this session signed. */
  readonly signed: SignedAdoptionDecision | null;
  /** A sign is in flight. */
  readonly busy: boolean;
  /** The lib's fail-closed refusal, verbatim (the un-signable state). */
  readonly error: string | null;
  /** Sign, recommending `proposesVersion` (an immutable version IRI). */
  readonly onSign: (proposesVersion: string) => void;
  /** The observation-source IRIs (one per line) the sign-time evidence sweep
   *  reads — the re-checkable `fut:AdoptionObservation` inputs. */
  readonly sources: string;
  readonly onSourcesChange: (value: string) => void;
}

/** One partition's honest outcome badge. */
function LensBadge({
  label,
  outcome,
}: {
  label: string;
  outcome: CandidateReception["outcome"];
}): React.JSX.Element {
  return outcome === "endorsed" ? (
    <span className="badge gold">{label}: endorsed</span>
  ) : outcome === "disagreement" ? (
    <span className="badge con">{label}: disagreement</span>
  ) : (
    <span className="badge">{label}: open — cannot confirm yet</span>
  );
}

export function AdoptionDecisionOutcome({
  scope,
  infra,
  critiques,
  roleLabels,
  signing,
}: {
  scope: ScopeConfig;
  /** The both-partitions reception (lib/convergence S3.2). */
  infra: InfraCandidateReception;
  /** The standing critiques (the dissent-annex raw material). */
  critiques: readonly Critique[];
  /** Labels for `infra.role.perCluster`, index-aligned (ui/sign-decision
   *  roleCohortLabels — pinned to the lib's cohort order). */
  roleLabels: readonly string[];
  /** The S3.5 signing wiring (absent = compute-and-present only). */
  signing?: DecisionSigning;
}): React.JSX.Element | null {
  const [version, setVersion] = useState<string>(defaultProposedVersion());
  if (infra.opinion.outcome === "open") return null; // the round is still running

  const stewardFloor = scope.endorsementGate.stewardSignatures;
  const signed = signing?.signed ?? null;
  const quorum = signed?.verification.quorum ?? null;
  const distinct = quorum?.distinctStewards ?? 0;
  const floor = quorum?.threshold ?? Math.max(stewardFloor, 2);
  const quorumMet = quorum?.met === true;
  const singleStewardCommunity = signing?.context?.trustedStewards.length === 1;
  const decision = signed?.verification.decision;

  // The §3.4 sign gate (mirrors ui/sign-decision, in sync), STRICT + fail-safe:
  // BOTH the opinion partition AND the verified-role partition must reach
  // "endorsed" (`infra.bothCleared`). The role lens's "open" (insufficient
  // cross-participant verified-role data) BLOCKS — signing never outruns
  // confirmed cross-role consensus. KNOWN LIMITATION: the data flow that
  // populates the role partition is S3.6, so until it lands the gate stays
  // CLOSED for infrastructure candidates; this is shown honestly ("confirmation
  // pending (S3.6)"), never faked as cleared.
  const roleConfirmationPending = infra.role.outcome === "open";
  const gateOpenForSigning = infra.bothCleared;

  const canSign =
    signing?.isSteward &&
    signing.gate.allowed &&
    signing.context !== null &&
    signing.context.steward !== null &&
    signing.context.trustedStewards.length > 0;

  const versionOptions = GOVERNED_SYSTEMS.flatMap((s) =>
    s.versions.map((v) => ({ iri: v.iri, label: `${s.label} — ${v.label}` })),
  );

  return (
    <section className="panel" aria-label="what ratification will be">
      <SectionHeader
        title={
          gateOpenForSigning
            ? "What ratifies: a signed fut:AdoptionDecision — a recommendation, never a status"
            : "The §3.4 endorsement gate — both partitions must clear"
        }
      />
      <p className="muted small">
        An adoption decision is <strong>advisory by design</strong>: ≥{floor} stewards sign the{" "}
        <em>recommendation</em> (its version, its bar, its re-checkable evidence) — and{" "}
        <em>Current</em> stays computed from what the wire actually advertises, never decreed. A
        captured room can sign a recommendation; it cannot sign adoption.
      </p>

      {/* The both-partitions gate — opinion clusters AND verified roles. */}
      <div className="field">
        <span>
          Endorsement gate{" "}
          <span className="hint">
            — common ground across opinion clusters AND verified stakeholder roles (§3.4)
          </span>
        </span>
        <p className="muted small">
          <LensBadge label="opinion lens" outcome={infra.opinion.outcome} />{" "}
          <LensBadge label="verified-role lens" outcome={infra.role.outcome} />{" "}
          {infra.bothCleared ? (
            <span className="badge res">gate cleared — both partitions endorse</span>
          ) : infra.opinion.outcome === "endorsed" && roleConfirmationPending ? (
            <span className="badge gold">
              opinion cleared — verified-role confirmation pending (S3.6)
            </span>
          ) : (
            <span className="badge con">gate not cleared</span>
          )}
        </p>
        <p className="muted small">
          Role cohorts (verified standing, fail-closed to participant):{" "}
          {infra.role.perCluster.map((dist, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: cohort order is the lib's canonical cohort identity.
            <span key={`role-cohort-${i}`} className="badge">
              {roleLabels[i] ?? `role cohort ${i + 1}`}: {dist.resonates}✓ {dist.conflicts}✕{" "}
              {dist.unsure}? of {dist.seen} (cohort of {dist.size})
            </span>
          ))}
          {roleConfirmationPending && (
            <>
              {" "}
              The role lens cannot confirm yet — it needs ≥2 role cohorts of ≥2 verified members
              each. The cross-participant verified-role data flow that populates it lands with S3.6;
              until then the role lens is advisory and only ever <em>raises</em> the bar (fail-safe:
              a verified cohort actively opposing STILL blocks a signature).
            </>
          )}
        </p>
      </div>

      {/* The mandatory dissent annex (INV-2). */}
      <div className="field">
        <span>
          Dissent annex <span className="hint">— mandatory on every signed decision</span>
        </span>
        {critiques.length > 0 ? (
          <p className="muted small">
            {critiques.length} standing critique{critiques.length === 1 ? "" : "s"} travel
            {critiques.length === 1 ? "s" : ""} with the decision as its dissent annex — carried in
            aggregate (verbatim only with the author's fut:quoteVerbatim consent), never erased. A
            critique that lands after review makes the decision un-signable until it is reviewed.
          </p>
        ) : (
          <p className="muted small">
            No standing critiques: the decision carries the EXPLICIT assertion{" "}
            <code>fut:noDissentRecorded true</code> — silence is never treated as consensus.
          </p>
        )}
      </div>

      {/* The ≥2-steward quorum progress — honest when unmet, floor never lowered. */}
      <div className="field">
        <span>Steward signatures</span>
        <p className="muted small">
          {quorumMet ? (
            <span className="badge res">
              {distinct} of ≥{floor} — quorum met
            </span>
          ) : (
            <span className="badge con">
              {distinct} of ≥{floor} stewards — quorum not met
            </span>
          )}{" "}
          {singleStewardCommunity && (
            <span className="badge gold">
              bootstrapping: single-steward — the ≥{floor} floor stands; a second steward must be
              vouched before this can ratify
            </span>
          )}{" "}
          A decision ratifies only with at least {floor} distinct steward Data-Integrity signatures
          over its exact content digest, each verified against the community's registry-backed
          steward allowlist — never by silently lowering the floor.
        </p>
      </div>

      {/* ── The S3.5 sign action — steward-gated, fail-closed, honest. ──── */}
      {signing !== undefined && !signing.isSteward && (
        <LockedGate title="Signing is steward-gated">
          <p className="muted small">
            {signing.gate.reason ??
              "signing an adoption decision requires a verified steward role credential"}{" "}
            — a signature is a personal, verifiable attestation (a solid-vc Data-Integrity proof
            over the decision's digest), counted toward the ≥{floor}-steward quorum. Reading,
            critiquing and endorsing stay open per the participation floor.
          </p>
        </LockedGate>
      )}
      {signing?.isSteward && !canSign && (
        <LockedGate title="Signing is locked (fail-closed)">
          <p className="muted small">
            {signing.context === null
              ? "The community's signing context has not resolved — no key material or steward allowlist is available to this session."
              : signing.context.trustedStewards.length === 0
                ? "This community publishes no registry-backed steward allowlist yet, and an S3 quorum never runs without one (INV-5) — signing stays locked until the community registry wiring lands."
                : "You hold the steward role, but this session holds no steward signing key — signing needs the key, not just the role."}
          </p>
        </LockedGate>
      )}
      {signing !== undefined && canSign && !gateOpenForSigning && (
        <Notice tone="info">
          Un-signable — the §3.4 gate needs BOTH partitions endorsed:{" "}
          {infra.opinion.outcome !== "endorsed"
            ? `the opinion partition is ${infra.opinion.outcome} (it must be endorsed)`
            : roleConfirmationPending
              ? "the verified-role partition cannot confirm yet — the cross-participant role data flow lands with S3.6; until then this gate stays closed (fail-safe: a recommendation must not outrun confirmed cross-role consensus)"
              : "a verified stakeholder-role cohort actively opposes this (the role lens is a disagreement)"}
          . The gate is the invariant working; it is never routed around.
        </Notice>
      )}
      {signing !== undefined && canSign && gateOpenForSigning && (
        <>
          <div className="field">
            <span>
              What your signature attests{" "}
              <span className="hint">— review before signing; the digest binds exactly this</span>
            </span>
            <p className="muted small">
              The candidate text + lineage above, the per-cohort endorsement evidence from BOTH
              partitions, the dissent annex, the recommended version and its adoption bar (≥
              {DEFAULT_ADOPTION_BAR} advertising parties, design/04 §2), and the re-checkable{" "}
              <span className="data">fut:AdoptionObservation</span> set observed at sign time from
              the sources below. NO status triple is emitted — the status is recomputed by every
              consumer (INV-3).
            </p>
            <label className="field">
              <span>
                Recommended version <span className="hint">(fut:proposesVersion)</span>
              </span>
              <select value={version} onChange={(e) => setVersion(e.target.value)}>
                {versionOptions.map((v) => (
                  <option key={v.iri} value={v.iri}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                Observation sources{" "}
                <span className="hint">
                  — one <span className="data">fedreg:StorageDescription</span> IRI per line
                  (https-only; read credential-free at sign time)
                </span>
              </span>
              <textarea
                rows={2}
                value={signing.sources}
                onChange={(e) => signing.onSourcesChange(e.target.value)}
                placeholder="https://storage.example/.well-known/fedreg.ttl"
              />
            </label>
          </div>
          <div className="chip-row">
            <button
              type="button"
              className="primary"
              onClick={() => signing.onSign(version)}
              disabled={signing.busy}
            >
              {signing.busy ? "Signing…" : "Sign this adoption decision as steward"}
            </button>
          </div>
        </>
      )}
      {signing?.error !== null && signing?.error !== undefined && (
        <Notice tone="error">
          Un-signable: {signing.error} — this refusal is the invariant working (a decision that
          derives from unconsented statements, drops standing dissent, lacks running code, or skips
          a partition of the endorsement gate must not be signed); it is shown, never worked around.
        </Notice>
      )}
      {signed !== null && decision !== undefined && signing?.error == null && (
        <Notice tone="ok">
          Signed. {distinct} of ≥{floor} steward signature{distinct === 1 ? "" : "s"} collected
          {/* "ratified" is the lib's FULL verdict (quorum AND a parseable
              decision AND consented lineage) — never quorum alone. */}
          {signed.verification.ratified
            ? " — the quorum is met and the recommendation is ratified"
            : quorumMet
              ? " — the quorum is met, but the artifact does not fully verify (not ratified)"
              : " — the recommendation ratifies once the quorum is met"}
          . It recommends <span className="data">{decision.proposesVersion}</span> against a bar of{" "}
          {decision.adoptionBar} advertising part{decision.adoptionBar === 1 ? "y" : "ies"},
          carrying {decision.adoptionEvidence.length} re-checkable observation
          {decision.adoptionEvidence.length === 1 ? "" : "s"}.{" "}
          <strong>
            Computed status from that evidence: {signed.verification.computedStatus ?? "proposed"}
          </strong>{" "}
          — recomputed, never asserted (INV-3); the signature attests the recommendation only. The
          live wire state is on the <a href="#/adoption-board">Adoption board</a>.
        </Notice>
      )}

      <p className="muted small">
        Ratification is settled on the wire, not declared in the room: a version becomes{" "}
        <em>Current</em> only when independent storages actually advertise it (
        <span className="data">fedreg:acceptsSpec</span>) — the{" "}
        <a href="#/adoption-board">Adoption board</a> recomputes that live, and any consumer can
        re-check every observation at its source.
      </p>
    </section>
  );
}
