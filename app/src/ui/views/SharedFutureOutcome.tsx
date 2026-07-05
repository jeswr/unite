// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C output presentation + the S5.4 STEWARD SIGNING surface
// (docs/SCOPE-DIFFERENTIATION.md §4.5; docs/design/next-phases.md §2.6 (5)):
// COMPUTE + PRESENT what publication is, and — for a steward — INVOKE the
// landed S5 signing lib on it. Everything here is computed, never asserted
// (the Convergence Room's posture):
//
//   • ENDORSED → a fut:SharedFuture: mandatory dissent annex (the standing
//     critiques ARE its raw material; an empty annex requires the EXPLICIT
//     fut:noDissentRecorded assertion — silence is never consensus), a
//     method-provenance label, and the ≥2-steward quorum progress shown
//     honestly (unmet is unmet; the floor is never silently lowered).
//   • DISAGREEMENT → the CO-EQUAL outcome: the disagreement map gets the SAME
//     publication framing AND the same signing surface, not a failure banner
//     (design/03 §4 (5)).
//   • The SIGN ACTION is steward-gated (hasRole(profile,"steward")) and
//     fail-closed: a non-steward sees an honestly-labelled locked state; a
//     steward without a session signing key, or a community without a
//     registry-backed steward allowlist, stays locked too. The enforcement
//     (dissent-completeness D2, k-anonymity, INV-1 consent, the ≥2 quorum
//     over trustedStewards) lives in lib/shared-future — this surface only
//     invokes it and shows its refusals VERBATIM (an un-signable outcome is
//     the invariant working, a state to surface, never to hide).
//   • No executor either way: publication is the output; institutions and
//     humans decide (critique C8).

import type { CandidateReception } from "../../lib/convergence.js";
import { type DissentRecord, materializeDissent } from "../../lib/dissent.js";
import type { Critique } from "../../lib/model.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { groupName, LockedGate, Notice, SectionHeader } from "../components.js";
import type { SignedSharedFuture, StewardSigningContext } from "../sign-future.js";

/** The §4.4 method-provenance label for the Stage-1 method (resonance mapping). */
export const METHOD_PROVENANCE_LABEL =
  "method: resonance mapping — a self-selected resonance map; it informs, it is not a representative sample";

/** The S5.4 signing wiring the Room passes down (absent = presentation only). */
export interface OutcomeSigning {
  /** Whether the SESSION holds the steward role (hasRole(profile,"steward")).
   *  A null/unresolved profile must be passed as false — fail-closed. */
  readonly isSteward: boolean;
  /** The resolved signing context (null while resolving / unavailable). */
  readonly context: StewardSigningContext | null;
  /** The signed artifact for THIS candidate, once this session signed. */
  readonly signed: SignedSharedFuture | null;
  /** A sign is in flight. */
  readonly busy: boolean;
  /** The lib's fail-closed refusal, verbatim (the un-signable state). */
  readonly error: string | null;
  readonly onSign: () => void;
}

/** The materialised annex preview, or the honest reason it cannot be built. */
function annexPreview(
  critiques: readonly Critique[],
): { records: readonly DissentRecord[] } | { unbuildable: string } {
  try {
    // Fail-closed aggregate-only: the aggregate surfaces no per-critique
    // fut:quoteVerbatim consent yet, and verbatim requires the affirmative
    // grant (lib/dissent) — so the preview mirrors exactly what a sign would
    // carry: every standing critique, in aggregate, never erased.
    return { records: materializeDissent(critiques).records };
  } catch (e) {
    return { unbuildable: e instanceof Error ? e.message : String(e) };
  }
}

/** The steward's pre-sign review: EXACTLY what the signature will attest —
 *  the dissent annex as it will be carried, the recomputable bridging
 *  evidence, and the method-provenance label. */
function PreSignReview({
  reception,
  critiques,
}: {
  reception: CandidateReception;
  critiques: readonly Critique[];
}): React.JSX.Element {
  const annex = annexPreview(critiques);
  return (
    <div className="field">
      <span>
        What your signature attests{" "}
        <span className="hint">— review before signing; the digest binds exactly this</span>
      </span>
      {"unbuildable" in annex ? (
        <Notice tone="error">Un-signable: {annex.unbuildable}</Notice>
      ) : annex.records.length === 0 ? (
        <p className="muted small">
          Dissent annex: <code>fut:noDissentRecorded true</code> — no critique stands; the absence
          is asserted explicitly, never assumed.
        </p>
      ) : (
        <ul className="participant-list">
          {annex.records.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the annex is a fixed ordered list — the index IS the record identity within this render.
            <li key={`presign-dissent-${i}`} className="small">
              {d.verbatim ? (
                <>
                  <span className="badge">quoted (author consented)</span> {d.content}
                </>
              ) : (
                <>
                  <span className="badge">in aggregate</span> {d.content}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Bridging evidence (recomputable):{" "}
        {reception.perCluster.map((dist, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — the index IS the cluster identity.
          <span key={`presign-cluster-${i}`} className="badge">
            {groupName(i)}: {dist.resonates}✓ {dist.conflicts}✕ {dist.unsure}? of {dist.seen}
          </span>
        ))}
      </p>
      <p className="muted small">
        <span className="badge">{METHOD_PROVENANCE_LABEL}</span>
      </p>
    </div>
  );
}

export function SharedFutureOutcome({
  scope,
  reception,
  critiques,
  signing,
}: {
  scope: ScopeConfig;
  reception: CandidateReception;
  critiques: readonly Critique[];
  /** The S5.4 signing wiring (absent = compute-and-present only). */
  signing?: OutcomeSigning;
}): React.JSX.Element | null {
  if (reception.outcome === "open") return null; // the round is still running
  const stewardFloor = scope.endorsementGate.stewardSignatures;
  const endorsed = reception.outcome === "endorsed";

  const signed = signing?.signed ?? null;
  // The honest progress: the lib's verified attestation once signed (its
  // threshold is clamped up to the ≥2 floor — never lowerable), else 0.
  const distinct = signed?.view.distinctStewards ?? 0;
  const floor = signed?.view.stewardFloor ?? Math.max(stewardFloor, 2);
  const quorumMet = signed?.view.quorumMet === true;
  // The community-level bootstrapping reality: only ONE registry-backed
  // steward exists. The floor STAYS ≥2 — publication waits for a second
  // steward; it is never met by silently lowering the bar (INV-5).
  const singleStewardCommunity = signing?.context?.trustedStewards.length === 1;

  const canSign =
    signing?.isSteward &&
    signing.context !== null &&
    signing.context.steward !== null &&
    signing.context.trustedStewards.length > 0;

  return (
    <section className="panel" aria-label="what publication will be">
      <SectionHeader
        title={
          endorsed
            ? "What publishes: a shared future"
            : "What publishes: the disagreement map — a first-class outcome"
        }
      />
      <p className="muted small">
        {endorsed ? (
          <>
            Every opinion group leaned positive, so this candidate is publishable as a{" "}
            <strong>shared future</strong> — with its dissent carried permanently, never smoothed
            away.
          </>
        ) : (
          <>
            The groups divide here — and that map is{" "}
            <strong>published with the same care as any endorsement</strong>: exactly where the
            community divides is a success output of the deliberation, not a failure (dissent is
            data).
          </>
        )}
      </p>

      {/* The mandatory dissent annex (SHACL: fut:dissent, or the explicit
          fut:noDissentRecorded true — an annex is never silently absent). */}
      <div className="field">
        <span>
          Dissent annex <span className="hint">— mandatory on every published output</span>
        </span>
        {critiques.length > 0 ? (
          <p className="muted small">
            {critiques.length} standing critique{critiques.length === 1 ? "" : "s"} (listed below)
            travel{critiques.length === 1 ? "s" : ""} with the publication as its dissent annex —
            whatever stands at signing time is carried verbatim only where its author consented
            (fut:quoteVerbatim), in aggregate otherwise.
          </p>
        ) : (
          <p className="muted small">
            No standing critiques: publication carries the EXPLICIT assertion{" "}
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
              vouched before this can publish
            </span>
          )}{" "}
          A shared future (or disagreement map) publishes only with at least {floor} distinct
          steward Data-Integrity signatures over its exact content digest — never by silently
          lowering the floor.
        </p>
      </div>

      {/* ── The S5.4 sign action — steward-gated, fail-closed, honest. ──── */}
      {signing !== undefined && !signing.isSteward && (
        <LockedGate title="Signing is steward-gated">
          <p className="muted small">
            Only a steward of this community can sign this outcome — a signature is a personal,
            verifiable attestation (a solid-vc Data-Integrity proof over the artifact's digest),
            counted toward the ≥{floor}-steward quorum. Your session does not hold the steward role
            here; reading, drafting, critiquing and voting stay open per the participation floor.
          </p>
        </LockedGate>
      )}
      {signing?.isSteward && !canSign && (
        <LockedGate title="Signing is locked (fail-closed)">
          <p className="muted small">
            {signing.context === null
              ? "The community's signing context has not resolved — no key material or steward allowlist is available to this session."
              : signing.context.trustedStewards.length === 0
                ? "This community publishes no registry-backed steward allowlist yet, and an S5 quorum never runs without one (INV-5) — signing stays locked until the community registry wiring lands."
                : "You hold the steward role, but this session holds no steward signing key — signing needs the key, not just the role."}
          </p>
        </LockedGate>
      )}
      {signing !== undefined && canSign && (
        <>
          <PreSignReview reception={reception} critiques={critiques} />
          <div className="chip-row">
            <button
              type="button"
              className="primary"
              onClick={signing.onSign}
              disabled={signing.busy}
            >
              {signing.busy
                ? "Signing…"
                : endorsed
                  ? "Sign this shared future as steward"
                  : "Sign this disagreement map as steward"}
            </button>
          </div>
        </>
      )}
      {signing?.error !== null && signing?.error !== undefined && (
        <Notice tone="error">
          Un-signable: {signing.error} — this refusal is the invariant working (a synthesis that
          drops dissent, lacks its evidence, or covers a sub-k cohort must not be signed); it is
          shown, never worked around.
        </Notice>
      )}
      {signed !== null && signing?.error == null && (
        <Notice tone="ok">
          Signed. {distinct} of ≥{floor} steward signature{distinct === 1 ? "" : "s"} collected
          {quorumMet
            ? " — the quorum is met and the artifact is ratified"
            : " — the artifact publishes once the quorum is met"}
          . See <a href="#/published-futures">Published futures</a>.
        </Notice>
      )}

      <p className="muted small">
        <span className="badge">{METHOD_PROVENANCE_LABEL}</span>
      </p>
      <p className="muted small">
        Nothing executes from this scope: publication <em>is</em> the output — institutions and
        humans decide. The per-group reception above is the bridging evidence any consumer can
        recompute from the votes.
      </p>
    </section>
  );
}
