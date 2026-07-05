// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Convergence Room v1 (S1 — SCOPE-DIFFERENTIATION §2; design/03 §4): the
// shared deliberation→synthesis surface every scope's output stage reuses.
// A candidate synthesis (fut:SpecSynthesis, prov:wasDerivedFrom ≥1 input) →
// the critique round (fut:Critique — the only threaded surface; standing
// critiques are the dissent-annex raw material) → a cross-cluster endorsement
// round (ordinary fut:Resonances on the candidate) → an outcome COMPUTED
// against the bridging threshold, never asserted: endorsed, or an honest
// disagreement map (the co-equal outcome), or still open. Bounded revision
// via prov:wasRevisionOf. Thin over src/lib (convergence.ts does the math).

import { useEffect, useMemo, useState } from "react";
import { type AggregateResult, aggregateDeliberation } from "../../lib/aggregate.js";
import { candidateReception, orderCandidates, standingCritiques } from "../../lib/convergence.js";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE } from "../../lib/fut.js";
import type { Critique, SynthesisCandidate } from "../../lib/model.js";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "../../lib/model.js";
import { writeCandidate, writeCritique } from "../../lib/pod.js";
import { writeSocietyCandidate, writeSocietyCritique } from "../../lib/pod-society.js";
import { describeSensitiveHit, screenSensitiveDomain } from "../../lib/sensitive.js";
import { hasRole, meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import {
  EmptyState,
  LoadingRows,
  Notice,
  Panel,
  SectionHeader,
  ViewHeader,
} from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName, readFetchFor, writeSessionFor } from "../hooks.js";
import {
  contributorCountFor,
  sameReception,
  type SignedSharedFuture,
  type StewardSigningContext,
  signRoomCandidate,
} from "../sign-future.js";
import {
  buildRegistry,
  collectionKinds,
  configReady,
  type DeliberationConfig,
  deliberationTrust,
  sessionIdentity,
} from "../state.js";
import { DistributionBar } from "./Bridging.js";
import { SharedFutureOutcome } from "./SharedFutureOutcome.js";
import { StanceButtons } from "./StanceButtons.js";
import { TIER_MEANING } from "./Trust.js";

/** The room's stance labels: an endorsement round, not a mood poll. */
const ENDORSE_LABELS = {
  [STANCE_RESONATES]: "Endorse",
  [STANCE_CONFLICTS]: "Object",
  [STANCE_UNSURE]: "Unsure",
} as const;

/** What happens to an ENDORSED candidate in this scope (the outputKind seam). */
function outputCopy(scope: ScopeConfig): string {
  switch (scope.outputKind) {
    case "adoption-decision":
      return (
        "In this scope an endorsed candidate is an adoption RECOMMENDATION — advisory by " +
        "design. Ratification is measured on the wire: watch the Adoption board for who " +
        "actually advertises the version (fedreg:acceptsSpec); Current is computed from those " +
        "observations, never asserted. Reviewer/steward gating and the SIGNED " +
        "fut:AdoptionDecision arrive in S3."
      );
    case "advisory-synthesis":
      return (
        "In this scope an endorsed candidate becomes a signed advisory synthesis with a " +
        "mandatory dissent annex, handed to human decision-makers — nothing executes. The " +
        "outcome is computed below, and a steward signs it there (≥2 distinct steward " +
        "signatures publish it to Published futures)."
      );
    default:
      return (
        "In this scope an endorsed synthesis is the input to a build commission — a signed " +
        "delegation naming this exact synthesis, executed by the agent suite under full " +
        "engineering gates (PLATFORM-PLAN §4.3). The commissioning chain arrives with " +
        "Phases 3–6; endorsed syntheses queue here until it lands."
      );
  }
}

export function Room({
  scope,
  config,
  webId,
  trust,
  aggregate,
  signing = null,
  onSigned,
  aggregateForSign,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
  /** The S5.4 steward-signing context (App-resolved; null = locked/unavailable). */
  signing?: StewardSigningContext | null;
  /** The S5.5 hand-off: a signed SharedFuture flows to Published futures. */
  onSigned?: (signed: SignedSharedFuture) => void;
  /** TEST SEAM for the sign-time re-aggregation; defaults to a LIVE re-read
   *  of the configured deliberation (the freshness gate below). */
  aggregateForSign?: () => Promise<AggregateResult>;
}): React.JSX.Element {
  const controller = useController();
  const { result, loading, error, refresh } = aggregate;

  const [selected, setSelected] = useState<string | null>(null);
  // Draft form
  const [drafting, setDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftInputs, setDraftInputs] = useState<readonly string[]>([]);
  const [draftRevises, setDraftRevises] = useState(false);
  // Critique form
  const [critique, setCritique] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // The S5.4 sign action (scope C's output stage): per-candidate signed
  // artifacts + the in-flight/refusal state. The refusal message is the
  // lib's throw, verbatim — the un-signable state is surfaced, never hidden.
  const [signedFutures, setSignedFutures] = useState<ReadonlyMap<string, SignedSharedFuture>>(
    new Map(),
  );
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;
  const mayParticipate = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  // Scope C routes Room writes through the C4-screened chokepoints
  // (lib/pod-society.ts) — the write BOUNDARY enforces the gate, the UI
  // pre-checks below only make the refusal friendly. A/B rooms are untouched.
  const societyRoom = scope.outputKind === "advisory-synthesis";
  const writeRoomCandidate = societyRoom ? writeSocietyCandidate : writeCandidate;
  const writeRoomCritique = societyRoom ? writeSocietyCritique : writeCritique;

  const candidates = useMemo(() => orderCandidates(result?.candidates ?? []), [result]);
  // The active candidate: the selected one if it still exists, else the newest.
  const active: SynthesisCandidate | null =
    candidates.find((c) => c.id === selected) ?? candidates[0] ?? null;

  const reception = useMemo(() => {
    if (!result || !active) return null;
    return candidateReception(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
      active.id,
    );
  }, [result, active]);

  const activeCritiques = useMemo(
    () => (active ? standingCritiques(result?.critiques ?? [], active.id) : []),
    [result, active],
  );

  // The scope-B running-code gate chip (S2 — SCOPE-DIFFERENTIATION §3.4):
  // design/04 §2 requires running code before ENDORSEMENT — the SHACL binds it
  // on an AdoptionDecision's derivation inputs, and the S3 signing path will
  // enforce it mechanically. Until then the room makes the check VISIBLE:
  // which infra proposals in the active candidate's lineage still lack a
  // reference implementation. null = not an adoption-decision scope, or the
  // lineage carries no infra proposals (nothing to gate).
  const runningCode = useMemo(() => {
    if (scope.outputKind !== "adoption-decision" || !active || !result) return null;
    const inLineage = result.infraProposals.filter((p) => active.derivedFrom.includes(p.id));
    if (inLineage.length === 0) return null;
    return {
      total: inLineage.length,
      missing: inLineage.filter((p) => p.referenceImplementation === undefined),
    };
  }, [scope, active, result]);

  /** Resolve a statement IRI to a display snippet (need/proposal content). */
  const statementText = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of result?.needs ?? []) m.set(n.id, n.content);
    for (const p of result?.proposals ?? []) m.set(p.id, `${p.title} — ${p.content}`);
    for (const p of result?.infraProposals ?? []) m.set(p.id, `${p.title} — ${p.content}`);
    for (const c of result?.candidates ?? []) m.set(c.id, c.title ?? c.content);
    return m;
  }, [result]);

  // The derivable inputs: ONLY statements whose author's ODRL consent permits
  // fut:synthesize (the aggregate's fail-closed set — design/01: deriving a
  // synthesis is exactly the act the consent layer governs). Statements the
  // authors did NOT consent to synthesis for are never offered, and the count
  // withheld is surfaced honestly below.
  const inputPool = useMemo(() => {
    const ok = result?.synthesizable ?? new Set<string>();
    return [
      ...(result?.proposals ?? [])
        .filter((p) => ok.has(p.id))
        .map((p) => ({ id: p.id, label: `proposal · ${p.title}` })),
      ...(result?.infraProposals ?? [])
        .filter((p) => ok.has(p.id))
        .map((p) => ({ id: p.id, label: `proposal · ${p.title}` })),
      ...(result?.needs ?? [])
        .filter((n) => ok.has(n.id))
        .map((n) => ({
          id: n.id,
          label: `need · ${n.content.length > 60 ? `${n.content.slice(0, 57)}…` : n.content}`,
        })),
    ];
  }, [result]);

  const withheldCount =
    (result ? result.proposals.length + result.infraProposals.length + result.needs.length : 0) -
    inputPool.length;

  // A fresh aggregate may SHRINK the consented set (an author revoked their
  // fut:synthesize consent): prune stale draft selections so the form never
  // holds an invisible, un-deselectable, non-consented input.
  useEffect(() => {
    const ok = result?.synthesizable;
    if (!ok) return;
    setDraftInputs((prev) =>
      prev.every((id) => ok.has(id)) ? prev : prev.filter((id) => ok.has(id)),
    );
  }, [result]);

  function toggleInput(id: string): void {
    setDraftInputs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submitDraft(): Promise<void> {
    setFormError(null);
    if (!identity) {
      setFormError("Sign in first — a candidate is written to your own pod under your WebID.");
      return;
    }
    if (!mayParticipate) {
      setFormError(`Drafting here requires identity tier T${floor} — see the Trust view.`);
      return;
    }
    if (!draftContent.trim()) {
      setFormError("Write the candidate synthesis first.");
      return;
    }
    if (draftInputs.length === 0) {
      setFormError(
        "Select at least one input — a synthesis must name what it derives from (prov:wasDerivedFrom), so its lineage is checkable.",
      );
      return;
    }
    // The C4 sensitive-domain launch gate covers scope C's Room text too
    // (SCOPE-DIFFERENTIATION §4.5): a candidate in the society scope must not
    // carry personal health/finance disclosure. Same screen as the wizard +
    // the pod-society chokepoints; scope-gated so A/B rooms are untouched.
    if (scope.outputKind === "advisory-synthesis") {
      const hit = screenSensitiveDomain(`${draftTitle}\n${draftContent}`);
      if (hit) {
        setFormError(describeSensitiveHit(hit));
        return;
      }
    }
    // Defence in depth (fail-closed): every input must STILL be consented to
    // synthesis at submit time — a stale selection (e.g. the author revoked
    // consent and the aggregate refreshed) must never be derived from.
    if (!draftInputs.every((id) => result?.synthesizable.has(id))) {
      setFormError(
        "A selected input's author has not consented to synthesis (fut:synthesize) — deselect it; only consented statements may be derived from.",
      );
      return;
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const body: Omit<SynthesisCandidate, "id"> = {
        content: draftContent.trim(),
        derivedFrom: draftInputs,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
        ...(draftTitle.trim() ? { title: draftTitle.trim() } : {}),
        ...(draftRevises && active ? { revisionOf: active.id } : {}),
      };
      const { url } = await writeRoomCandidate(session.fetch, session.ownBase, body);
      setDraftTitle("");
      setDraftContent("");
      setDraftInputs([]);
      setDraftRevises(false);
      setDrafting(false);
      setSelected(url);
      try {
        await refresh();
      } catch {
        // aggregation errors surface through the room's own error state
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function submitCritique(): Promise<void> {
    setFormError(null);
    if (!active) return;
    if (!identity) {
      setFormError("Sign in first — a critique is written to your own pod under your WebID.");
      return;
    }
    if (!mayParticipate) {
      setFormError(`Critiquing here requires identity tier T${floor} — see the Trust view.`);
      return;
    }
    if (!critique.trim()) {
      setFormError("Write the critique first.");
      return;
    }
    // The C4 gate covers society critiques too (dissent-annex material may be
    // published verbatim under quoteVerbatim — it must not carry disclosure).
    if (scope.outputKind === "advisory-synthesis") {
      const hit = screenSensitiveDomain(critique);
      if (hit) {
        setFormError(describeSensitiveHit(hit));
        return;
      }
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const body: Omit<Critique, "id"> = {
        content: critique.trim(),
        onStatement: active.id,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
      };
      await writeRoomCritique(session.fetch, session.ownBase, body);
      setCritique("");
      try {
        await refresh();
      } catch {
        // aggregation errors surface through the room's own error state
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // A candidate switch clears the previous candidate's sign refusal.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed to the ACTIVE CANDIDATE identity on purpose — the refusal belongs to the candidate it was raised for.
  useEffect(() => {
    setSignError(null);
  }, [active?.id]);

  /** The sign-time re-aggregation: a LIVE re-read of the deliberation (the
   *  same seams useAggregate runs over), or the injected test seam. */
  async function currentAggregate(): Promise<AggregateResult> {
    if (aggregateForSign !== undefined) return aggregateForSign();
    const registry = buildRegistry(config);
    const { gate } = await deliberationTrust(config);
    const fetchFn = await readFetchFor(config, controller);
    return aggregateDeliberation({
      registry,
      verifier: gate,
      fetch: fetchFn,
      kinds: collectionKinds(scope),
    });
  }

  /**
   * The S5.4 sign action: invoke the LANDED signing lib on the room's
   * computed outcome (ui/sign-future → lib/shared-future). Every un-signable
   * state (dropped dissent D2, missing evidence D3/D4, unconsented lineage
   * INV-1, sub-k cohort, no steward allowlist INV-5) THROWS in the lib and is
   * surfaced verbatim — never caught-and-retried, never routed around.
   *
   * FRESHNESS: the gate inputs are RE-AGGREGATED at sign time — the rendered
   * snapshot is what the steward REVIEWED, never what gates the signature. A
   * critique that landed after the panel loaded makes the lib's D2 gate throw
   * (the fresh standing set exceeds the reviewed annex), and votes that moved
   * the reception refuse with an explicit review-again message — a stale
   * client can never sign around current dissent or unreviewed evidence.
   */
  async function signOutcome(): Promise<void> {
    setSignError(null);
    if (!active || !reception || !result) return;
    if (!signing || signing.steward === null) {
      // The gate upstream keeps the button locked; this is defence in depth.
      setSignError("no steward signing key is available to this session (fail-closed)");
      return;
    }
    setSignBusy(true);
    try {
      // Re-aggregate NOW: the CURRENT room state gates the sign.
      const fresh = await currentAggregate();
      const freshCandidate = fresh.candidates.find((c) => c.id === active.id);
      if (freshCandidate === undefined) {
        throw new Error(
          "this candidate is no longer in the current aggregate — refresh and re-review",
        );
      }
      const freshCritiques = standingCritiques(fresh.critiques, active.id);
      const freshReception = candidateReception(
        fresh.verified.map((v) => v.webId),
        fresh.needs.map((n) => n.id),
        fresh.resonances,
        active.id,
      );
      // The steward reviewed the RENDERED outcome; if the votes moved it,
      // refuse and refresh — evidence that was not reviewed is never signed.
      if (!sameReception(reception, freshReception)) {
        throw new Error(
          "the endorsement round moved since you reviewed this outcome (votes changed) — " +
            "refresh, review the current outcome, and sign again",
        );
      }
      const prior = signedFutures.get(active.id);
      const signed = await signRoomCandidate({
        candidate: freshCandidate,
        reception: freshReception,
        // What the steward REVIEWED is the annex material; the D2 gate runs
        // over the critiques standing NOW — a gap throws in the lib.
        reviewedCritiques: activeCritiques,
        standingCritiqueIds: new Set(freshCritiques.map((c) => c.id)),
        synthesizable: fresh.synthesizable,
        contributorCount: contributorCountFor(fresh, freshCandidate, freshCritiques),
        deliberation: config.deliberation,
        context: signing,
        ...(prior !== undefined ? { prior } : {}),
        stewardFloor: scope.endorsementGate.stewardSignatures,
      });
      setSignedFutures((prev) => new Map(prev).set(active.id, signed));
      onSigned?.(signed);
    } catch (e) {
      setSignError(e instanceof Error ? e.message : String(e));
      // A refusal usually means the room moved — re-aggregate the panel so
      // the steward reviews the CURRENT state (best-effort; errors surface
      // through the room's own error state).
      void refresh().catch(() => {});
    } finally {
      setSignBusy(false);
    }
  }

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <ViewHeader
        title="Convergence room"
        lede={
          <>
            A candidate synthesis is endorsed only when <em>every</em> opinion group leans positive
            — computed live from the votes, never declared. Standing critiques travel with the
            outcome as its dissent annex, and a split room publishes an honest{" "}
            <strong>disagreement map</strong> instead of a forced consensus.
          </>
        }
        actions={
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {formError && <Notice tone="error">{formError}</Notice>}

      {!mayParticipate && trust.profile !== null && (
        <Notice tone="info">
          Reading is open to everyone; <strong>drafting, critiquing and endorsing</strong> here
          requires a vouched membership (tier T{floor} — {TIER_MEANING[floor]}). See the{" "}
          <a href="#/trust">Trust</a> view.
        </Notice>
      )}

      {showSkeletons && <LoadingRows count={2} />}

      {!showSkeletons && !configReady(config) && (
        <EmptyState title="Not connected yet">
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or switch to the
            demo deliberation to explore how the room works.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && configReady(config) && candidates.length === 0 && !drafting && (
        <EmptyState title="No candidate synthesis yet">
          <p>
            When the <a href="#/bridge">common ground</a> is visible, someone drafts a candidate:
            one text that tries to carry what every group needs — naming exactly which needs and
            proposals it derives from.
          </p>
          {mayParticipate && (
            <button type="button" className="btn primary" onClick={() => setDrafting(true)}>
              Draft the first candidate
            </button>
          )}
        </EmptyState>
      )}

      {/* ── Candidate strip ─────────────────────────────────────────────── */}
      {candidates.length > 0 && (
        <div className="row-between">
          <fieldset className="chip-row" aria-label="candidates">
            {candidates.map((c) => (
              <button
                type="button"
                key={c.id}
                className="chip"
                aria-pressed={active?.id === c.id}
                onClick={() => setSelected(c.id)}
                title={c.content}
              >
                {c.title ?? `${c.content.slice(0, 32)}…`}
                {c.revisionOf && <span className="muted small"> (revision)</span>}
              </button>
            ))}
          </fieldset>
          {mayParticipate && !drafting && (
            <button type="button" className="btn" onClick={() => setDrafting(true)}>
              Draft a candidate
            </button>
          )}
        </div>
      )}

      {/* ── Draft form ──────────────────────────────────────────────────── */}
      {drafting && mayParticipate && (
        <Panel>
          <SectionHeader title="Draft a candidate synthesis" />
          <label className="field">
            <span>
              Short name <span className="hint">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="e.g. The offline-first common spine"
            />
          </label>
          <label className="field">
            <span>
              The synthesis{" "}
              <span className="char-count">
                {draftContent.length}/{MAX_CONTENT_LENGTH}
              </span>
            </span>
            <textarea
              rows={5}
              maxLength={MAX_CONTENT_LENGTH}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="One text that tries to carry what every group needs — not a compromise nobody wants, a synthesis the room can endorse."
            />
          </label>
          <div className="field">
            <span>
              Derived from{" "}
              <span className="hint">
                — the needs and proposals this synthesis carries (≥1; its checkable lineage)
              </span>
            </span>
            {inputPool.length === 0 ? (
              <p className="muted small">
                Nothing to derive from yet —{" "}
                {withheldCount > 0
                  ? "the shared statements here do not carry consent to synthesis (fut:synthesize), so none may be derived from."
                  : "the deliberation needs shared statements first."}{" "}
                <a href="#/board">See the needs board</a>.
              </p>
            ) : (
              <fieldset className="chip-row" aria-label="synthesis inputs">
                {inputPool.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className="chip"
                    aria-pressed={draftInputs.includes(s.id)}
                    onClick={() => toggleInput(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </fieldset>
            )}
            {inputPool.length > 0 && withheldCount > 0 && (
              <p className="muted small">
                {withheldCount} statement{withheldCount === 1 ? " is" : "s are"} not offered: their
                authors' consent does not permit synthesis (fut:synthesize) — consent gates
                derivation, fail-closed.
              </p>
            )}
          </div>
          {active && (
            <label className="field" style={{ flexDirection: "row", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={draftRevises}
                onChange={(e) => setDraftRevises(e.target.checked)}
              />
              <span>
                This revises “{active.title ?? active.content.slice(0, 40)}” (bounded revision
                rounds — the lineage is recorded, prov:wasRevisionOf)
              </span>
            </label>
          )}
          <div className="chip-row">
            <button type="button" className="primary" onClick={submitDraft} disabled={saving}>
              {saving ? "Saving…" : "Put it to the room"}
            </button>
            <button type="button" className="btn" onClick={() => setDrafting(false)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {/* ── The active candidate ────────────────────────────────────────── */}
      {active && result && (
        <div className="card">
          {active.title && <strong>{active.title}</strong>}
          <p className="need-content">{active.content}</p>
          <div className="card-meta">
            <span className="avatar" style={{ background: avatarColor(active.creator) }}>
              {initials(displayName(active.creator))}
            </span>
            <span className="who">{displayName(active.creator)}</span>
            <span className="when">{formatDate(active.created)}</span>
            {active.revisionOf && (
              <button
                type="button"
                className="chip"
                onClick={() => setSelected(active.revisionOf ?? null)}
                title={active.revisionOf}
              >
                revises: {statementText.get(active.revisionOf)?.slice(0, 40) ?? "an earlier round"}
              </button>
            )}
          </div>

          {/* The visible running-code gate (§3.4): rough consensus AND running
              code — a recommendation whose lineage lacks a reference
              implementation cannot become an AdoptionDecision (S3 enforces
              this mechanically at signing; the room shows it now). */}
          {runningCode && (
            <div className="chip-row">
              {runningCode.missing.length === 0 ? (
                <span className="badge">
                  running code ✓ — every proposal in this lineage carries a reference implementation
                </span>
              ) : (
                <span className="badge con">
                  running code missing on {runningCode.missing.length} of {runningCode.total}{" "}
                  lineage proposal{runningCode.total === 1 ? "" : "s"} — required before this
                  recommendation can be endorsed (design/04 §2)
                </span>
              )}
            </div>
          )}

          <details className="sources">
            <summary>
              Derived from {active.derivedFrom.length} input
              {active.derivedFrom.length === 1 ? "" : "s"} (the checkable lineage)
            </summary>
            <ul>
              {active.derivedFrom.map((s) => (
                <li key={s}>{statementText.get(s) ?? <code>{s}</code>}</li>
              ))}
            </ul>
          </details>

          {/* Outcome — computed, never asserted */}
          {reception && (
            <div>
              <div className="chip-row">
                {reception.outcome === "endorsed" && (
                  <span className="badge gold">endorsed — every group leans positive</span>
                )}
                {reception.outcome === "disagreement" && (
                  <span className="badge con">disagreement map — the groups divide here</span>
                )}
                {reception.outcome === "open" && (
                  <span className="badge">round open — not enough cross-group signal yet</span>
                )}
                <span className="muted small">
                  {reception.totalSeen} endorsement vote{reception.totalSeen === 1 ? "" : "s"}{" "}
                  across {reception.clusterCount} opinion group
                  {reception.clusterCount === 1 ? "" : "s"} · bridging score{" "}
                  {reception.score.toFixed(3)}
                </span>
              </div>
              <div className="dists">
                {reception.perCluster.map((dist, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — the index IS the cluster identity.
                  <DistributionBar key={`${active.id}-${i}`} dist={dist} index={i} />
                ))}
              </div>
              {reception.outcome === "disagreement" && (
                <Notice tone="info">
                  This split is a first-class outcome, not a failure: the map of exactly where the
                  groups divide is published alongside any endorsement — dissent is data, never
                  smoothed away. A drafter can put a revision to the room that tries to carry the
                  objecting group too.
                </Notice>
              )}
              {reception.outcome === "endorsed" && <Notice tone="info">{outputCopy(scope)}</Notice>}
              {/* The scope-C output presentation (S4) + the S5.4 steward
                  signing surface: mandatory dissent annex, method-provenance
                  label, the ≥2-steward quorum progress shown honestly, and
                  the steward-gated sign action that invokes the landed
                  signing lib. The disagreement map gets the SAME panel (a
                  co-equal outcome), never a failure. */}
              {scope.outputKind === "advisory-synthesis" && (
                <SharedFutureOutcome
                  scope={scope}
                  reception={reception}
                  critiques={activeCritiques}
                  signing={{
                    isSteward: trust.profile !== null && hasRole(trust.profile, "steward"),
                    context: signing,
                    signed: signedFutures.get(active.id) ?? null,
                    busy: signBusy,
                    error: signError,
                    onSign: () => void signOutcome(),
                  }}
                />
              )}
            </div>
          )}

          <StanceButtons
            statement={active.id}
            config={config}
            webId={webId}
            trust={trust}
            aggregate={aggregate}
            labels={ENDORSE_LABELS}
          />

          {/* ── Critique round ───────────────────────────────────────────── */}
          <Panel>
            <SectionHeader
              title={
                <>
                  Standing critiques{" "}
                  <span className="muted small">
                    — the dissent-annex material; whatever stands at endorsement travels with the
                    outcome
                  </span>
                </>
              }
            />
            {activeCritiques.length === 0 && (
              <p className="muted small">No standing critiques on this candidate.</p>
            )}
            <ul className="cards">
              {activeCritiques.map((c) => (
                <li key={c.id} className="card">
                  <p className="need-content">{c.content}</p>
                  <div className="card-meta">
                    <span className="avatar" style={{ background: avatarColor(c.creator) }}>
                      {initials(displayName(c.creator))}
                    </span>
                    <span className="who">{displayName(c.creator)}</span>
                    <span className="when">{formatDate(c.created)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {mayParticipate && (
              <div className="field">
                <label className="field">
                  <span>
                    Add a critique{" "}
                    <span className="char-count">
                      {critique.length}/{MAX_CONTENT_LENGTH}
                    </span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={MAX_CONTENT_LENGTH}
                    value={critique}
                    onChange={(e) => setCritique(e.target.value)}
                    placeholder="What does this synthesis miss, distort, or trade away?"
                  />
                </label>
                <div>
                  <button type="button" className="btn" onClick={submitCritique} disabled={saving}>
                    {saving ? "Saving…" : "Stand this critique"}
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
