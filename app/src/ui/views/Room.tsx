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
import { DEMO_ADOPTION_SOURCES } from "../../demo/fixtures.js";
import { observeAdoption } from "../../lib/adoption.js";
import { reviewerEndorsementGate, stewardSigningGate } from "../../lib/adoption-decision.js";
import { type AggregateResult, aggregateDeliberation } from "../../lib/aggregate.js";
import {
  candidateReception,
  infraCandidateReception,
  orderCandidates,
  standingCritiques,
} from "../../lib/convergence.js";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE } from "../../lib/fut.js";
import type { Critique, SynthesisCandidate } from "../../lib/model.js";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "../../lib/model.js";
import { writeCandidate, writeCritique } from "../../lib/pod.js";
import { writeSocietyCandidate, writeSocietyCritique } from "../../lib/pod-society.js";
import { type VerifiedStakeholderRole, verifiedRoleMap } from "../../lib/roles.js";
import { describeSensitiveHit, screenSensitiveDomain } from "../../lib/sensitive.js";
import { hasRole, meetsTier, UNTRUSTED } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import {
  EmptyState,
  LoadingRows,
  LockedGate,
  Notice,
  Panel,
  SectionHeader,
  ViewHeader,
} from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName, readFetchFor, writeSessionFor } from "../hooks.js";
import {
  roleCohortLabels,
  type SignedAdoptionDecision,
  sameInfraReception,
  signAdoptionCandidate,
} from "../sign-decision.js";
import {
  contributorCountFor,
  type SignedSharedFuture,
  type StewardSigningContext,
  sameCandidateMaterial,
  sameReception,
  signRoomCandidate,
} from "../sign-future.js";
import {
  buildRegistry,
  collectionKinds,
  configReady,
  type DeliberationConfig,
  deliberationKey,
  deliberationTrust,
  sessionIdentity,
} from "../state.js";
import { AdoptionDecisionOutcome } from "./AdoptionDecisionOutcome.js";
import { DistributionBar } from "./Bridging.js";
import { RoleDeclarationPanel } from "./RoleDeclaration.js";
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
        "observations, never asserted. The S3 machinery is live below: the endorsement gate " +
        "must clear BOTH the opinion and verified-role partitions, and ≥2 stewards sign the " +
        "fut:AdoptionDecision — whose status is still recomputed from evidence, never signed."
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
  onDecisionSigned,
  signedDecisions = [],
  verifiedRoles = [],
  aggregateForSign,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
  /** The steward-signing context (App-resolved; null = locked/unavailable).
   *  Shared by the S5.4 SharedFuture surface (scope C) and the S3.5
   *  AdoptionDecision surface (scope B) — the same INV-5 quorum inputs. */
  signing?: StewardSigningContext | null;
  /** The S5.5 hand-off: a signed SharedFuture flows to Published futures. */
  onSigned?: (signed: SignedSharedFuture) => void;
  /** The S3.6 hand-off: a signed AdoptionDecision flows to the Adoption
   *  board (its live evidence column). */
  onDecisionSigned?: (signed: SignedAdoptionDecision) => void;
  /** The App-lifted signed AdoptionDecisions (CONTROLLED — the single source
   *  of truth). Lifting them out of Room means a co-signature survives a tab
   *  switch that unmounts the Room: the prior artifact is looked up here, so a
   *  second steward EXTENDS the existing quorum instead of restarting it. */
  signedDecisions?: readonly SignedAdoptionDecision[];
  /** The verified stakeholder declarations known to this client BEYOND the
   *  session's own (scope B's role lens input). Each MUST come from
   *  lib/roles.verifyStakeholderRole — a declaration is only ever a COMPUTED,
   *  fail-closed fact; today the app passes none (the session verifies only
   *  its own standing), and every verifier recomputes independently. */
  verifiedRoles?: readonly VerifiedStakeholderRole[];
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
  // The S3.5 sign action (scope B's output stage): the in-flight/refusal state
  // + the session's verified stakeholder standing (computed, never persisted —
  // it feeds the role lens) + the sign-time observation sources (keyed to the
  // config, the AdoptionBoard pattern, so a demo↔pod switch never leaks a
  // source list). The signed decisions themselves are CONTROLLED by App (the
  // `signedDecisions` prop) so a co-signature survives a Room unmount.
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  // The session's verified stakeholder standing, KEYED to (config, identity)
  // and DERIVED AT RENDER: a declaration verified for one session/deliberation
  // must never feed the role gate for a DIFFERENT one (a login or deliberation
  // switch exposes null synchronously — no stale role state, not even for a
  // frame; the useTrustProfile pattern).
  const [declaredRoleState, setDeclaredRoleState] = useState<{
    readonly key: string;
    readonly role: VerifiedStakeholderRole;
  } | null>(null);
  const [editedSources, setEditedSources] = useState<{ key: string; text: string } | null>(null);
  const sourcesKey = JSON.stringify([config.mode, config.deliberation]);
  const decisionSources =
    editedSources !== null && editedSources.key === sourcesKey
      ? editedSources.text
      : config.mode === "demo"
        ? DEMO_ADOPTION_SOURCES.join("\n")
        : "";

  const identity = sessionIdentity(config, webId);
  // The verified stakeholder standing, derived at render for the CURRENT
  // (config, identity): a declaration from another session/deliberation resolves
  // to null and never feeds this session's role gate.
  const roleKey = deliberationKey(config, webId);
  const declaredRole: VerifiedStakeholderRole | null =
    declaredRoleState !== null && declaredRoleState.key === roleKey ? declaredRoleState.role : null;
  const floor = config.participationFloor;
  const mayParticipate = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));
  const infraScope = scope.outputKind === "adoption-decision";
  // The S3.5 reviewer gate (design §1.3(c), lib/adoption-decision): moving a
  // candidate INTO the endorsement round — drafting/putting a synthesis to
  // this room — needs a verified reviewer role where the scope requires it
  // (infrastructure). Fail-closed on an unresolved profile; scopes with
  // reviewerRoleRequired=false are untouched (the gate allows).
  const reviewerGate = reviewerEndorsementGate(trust.profile ?? UNTRUSTED, scope.endorsementGate);
  const mayDraft = mayParticipate && reviewerGate.allowed;

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

  // The S3.2 verified-role partition inputs (scope B): the session's verified
  // stakeholder standing (declared → verified by lib/roles, fail-closed) folds
  // into the role map; every WebID absent from it is the base ParticipantRole.
  // Declarations are COMPUTED facts — this client can only fold in what it has
  // verified itself; every verifier recomputes independently from the wire.
  const roleMap = useMemo(
    () => verifiedRoleMap([...verifiedRoles, ...(declaredRole !== null ? [declaredRole] : [])]),
    [verifiedRoles, declaredRole],
  );
  const roleLabels = useMemo(
    () =>
      result
        ? roleCohortLabels(
            result.verified.map((v) => v.webId),
            roleMap,
          )
        : [],
    [result, roleMap],
  );
  // The scope-B both-partitions reception (§3.4): the endorsement gate is met
  // only when the opinion partition AND the verified-role partition EACH clear
  // the bridging threshold (lib/convergence infraCandidateReception, S3.2).
  const infraReception = useMemo(() => {
    if (!infraScope || !result || !active) return null;
    return infraCandidateReception(
      result.verified.map((v) => v.webId),
      result.needs.map((n) => n.id),
      result.resonances,
      active.id,
      roleMap,
    );
  }, [infraScope, result, active, roleMap]);

  // The signed-decision lookup by candidate (from the CONTROLLED App-lifted
  // list) — the co-sign prior + the panel's rendered state both read it, so a
  // quorum survives a Room unmount and a second steward extends it, never
  // restarts it.
  const decisionByCandidate = useMemo(() => {
    const m = new Map<string, SignedAdoptionDecision>();
    for (const d of signedDecisions) m.set(d.candidate, d);
    return m;
  }, [signedDecisions]);

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
    // Defence in depth for the S3.5 reviewer gate (the button is hidden; the
    // refusal here only makes a forced submit friendly — same posture as the
    // tier pre-check above).
    if (!reviewerGate.allowed) {
      setFormError(
        reviewerGate.reason ??
          "moving a candidate into endorsement requires a verified reviewer role credential",
      );
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

  // A candidate switch clears the previous candidate's sign refusals (both
  // the S5.4 SharedFuture one and the S3.5 AdoptionDecision one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed to the ACTIVE CANDIDATE identity on purpose — the refusal belongs to the candidate it was raised for.
  useEffect(() => {
    setSignError(null);
    setDecisionError(null);
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
      // The SAME id can carry EDITED material (a pod owner can overwrite the
      // resource): what gets signed must be exactly what the steward REVIEWED.
      if (!sameCandidateMaterial(freshCandidate, active)) {
        throw new Error(
          "this candidate's text, title or lineage changed since you reviewed it — " +
            "refresh, review the current candidate, and sign again",
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

  /**
   * The S3.5 sign action: invoke the LANDED signing lib on the scope-B room's
   * computed outcome (ui/sign-decision → lib/adoption-decision). Every
   * un-signable state (unconsented lineage INV-1, a missing/incomplete dissent
   * annex INV-2, an uncleared partition §3.4, missing running code design/04
   * §2, no steward allowlist INV-5) THROWS in the lib/glue and is surfaced
   * verbatim — never caught-and-retried, never routed around. No artifact
   * exists on a throw.
   *
   * FRESHNESS (the S5.4 discipline): the gate inputs are RE-AGGREGATED at sign
   * time, the adoption evidence is OBSERVED at sign time (credential-free,
   * capped, fail-isolated), and moved votes / edited material / late dissent
   * all refuse with an explicit review-again message.
   */
  async function signDecision(proposesVersion: string): Promise<void> {
    setDecisionError(null);
    if (!active || !infraReception || !result) return;
    if (!signing || signing.steward === null) {
      // The gate upstream keeps the button locked; this is defence in depth.
      setDecisionError("no steward signing key is available to this session (fail-closed)");
      return;
    }
    setDecisionBusy(true);
    try {
      // Re-aggregate NOW: the CURRENT room state gates the sign.
      const fresh = await currentAggregate();
      const freshCandidate = fresh.candidates.find((c) => c.id === active.id);
      if (freshCandidate === undefined) {
        throw new Error(
          "this candidate is no longer in the current aggregate — refresh and re-review",
        );
      }
      if (!sameCandidateMaterial(freshCandidate, active)) {
        throw new Error(
          "this candidate's text, title or lineage changed since you reviewed it — " +
            "refresh, review the current candidate, and sign again",
        );
      }
      const freshCritiques = standingCritiques(fresh.critiques, active.id);
      const freshParticipants = fresh.verified.map((v) => v.webId);
      const freshInfra = infraCandidateReception(
        freshParticipants,
        fresh.needs.map((n) => n.id),
        fresh.resonances,
        active.id,
        roleMap,
      );
      // The steward reviewed the RENDERED both-partitions outcome; if the
      // votes (or the verified-role partition) moved it, refuse and refresh.
      if (!sameInfraReception(infraReception, freshInfra)) {
        throw new Error(
          "the endorsement round moved since you reviewed this outcome (votes or verified " +
            "roles changed) — refresh, review the current outcome, and sign again",
        );
      }
      // The dissent annex is built from the RENDERED activeCritiques (what the
      // steward reviewed). If the standing critiques moved since then — one
      // ADDED, EDITED (same id, new content), or WITHDRAWN — the annex would
      // publish content the steward never reviewed (or omit new dissent). The
      // glue's D2 ID check catches additions, but not edits or withdrawals, so
      // refuse here on ANY (id, content) divergence: the steward signs exactly
      // the dissent they reviewed, or reviews again.
      const critiqueKey = (c: Critique) => `${c.id} ${c.content}`;
      const reviewedCritiqueKeys = activeCritiques.map(critiqueKey).sort();
      const freshCritiqueKeys = freshCritiques.map(critiqueKey).sort();
      if (
        reviewedCritiqueKeys.length !== freshCritiqueKeys.length ||
        reviewedCritiqueKeys.some((k, i) => k !== freshCritiqueKeys[i])
      ) {
        throw new Error(
          "the standing critiques changed since you reviewed them (one was added, edited, or " +
            "withdrawn) — refresh, review the current dissent, and sign again",
        );
      }
      // The re-checkable fut:AdoptionObservation evidence, observed NOW.
      const fetchFn = await readFetchFor(config, controller);
      const sources = decisionSources
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const snapshot = await observeAdoption(sources, { fetch: fetchFn });
      const prior = decisionByCandidate.get(active.id);
      const signed = await signAdoptionCandidate({
        candidate: freshCandidate,
        infra: freshInfra,
        participants: freshParticipants,
        roleMap,
        // What the steward REVIEWED is the annex material; the glue refuses
        // when a critique standing NOW is not accounted for (D2 discipline).
        reviewedCritiques: activeCritiques,
        standingCritiqueIds: new Set(freshCritiques.map((c) => c.id)),
        synthesizable: fresh.synthesizable,
        lineageProposals: fresh.infraProposals.filter((p) =>
          freshCandidate.derivedFrom.includes(p.id),
        ),
        adoptionEvidence: snapshot.observations,
        proposesVersion,
        deliberation: config.deliberation,
        context: signing,
        ...(prior !== undefined ? { prior } : {}),
        stewardFloor: scope.endorsementGate.stewardSignatures,
      });
      // App owns the signed-decision list (controlled): the hand-off updates
      // it, and Room re-renders from the new prop — no Room-local copy to drift.
      onDecisionSigned?.(signed);
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : String(e));
      // A refusal usually means the room moved — re-aggregate the panel so
      // the steward reviews the CURRENT state (best-effort).
      void refresh().catch(() => {});
    } finally {
      setDecisionBusy(false);
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

      {/* The S3.5 reviewer gate (design §1.3(c)): in a reviewerRoleRequired
          scope, putting a candidate to the room — moving it INTO the
          endorsement round — is the spec-review act and needs the verified
          reviewer role. Honest locked state; everything else stays open. */}
      {mayParticipate && !reviewerGate.allowed && (
        <LockedGate title="Moving a candidate into endorsement is reviewer-gated">
          <p className="muted small">
            {reviewerGate.reason ??
              "moving a candidate into endorsement requires a verified reviewer role credential"}{" "}
            — in this scope, putting a candidate synthesis to the room is the spec-review act.
            Reading, critiquing and endorsing stay open per the participation floor; see the{" "}
            <a href="#/trust">Trust</a> view for role credentials.
          </p>
        </LockedGate>
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
          {mayDraft && (
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
          {mayDraft && !drafting && (
            <button type="button" className="btn" onClick={() => setDrafting(true)}>
              Draft a candidate
            </button>
          )}
        </div>
      )}

      {/* ── Draft form ──────────────────────────────────────────────────── */}
      {drafting && mayDraft && (
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
              {/* The scope-B output presentation + the S3.5 steward signing
                  surface: the §3.4 both-partitions gate shown honestly, the
                  mandatory dissent annex, the ≥2-steward quorum progress, and
                  the steward-gated sign action that invokes the landed
                  lib/adoption-decision — whose status is always RECOMPUTED
                  from evidence, never signed (INV-3). */}
              {infraScope && infraReception && (
                <AdoptionDecisionOutcome
                  scope={scope}
                  infra={infraReception}
                  critiques={activeCritiques}
                  roleLabels={roleLabels}
                  signing={{
                    isSteward: trust.profile !== null && hasRole(trust.profile, "steward"),
                    gate: stewardSigningGate(trust.profile ?? UNTRUSTED),
                    context: signing,
                    signed: decisionByCandidate.get(active.id) ?? null,
                    busy: decisionBusy,
                    error: decisionError,
                    onSign: (version) => void signDecision(version),
                    sources: decisionSources,
                    onSourcesChange: (text) => setEditedSources({ key: sourcesKey, text }),
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

      {/* ── The S3.5 role-declaration control (scope B) ──────────────────── */}
      {infraScope && (
        <RoleDeclarationPanel
          config={config}
          webId={webId}
          verified={declaredRole}
          onVerified={(role) => setDeclaredRoleState({ key: roleKey, role })}
          onCleared={() => setDeclaredRoleState(null)}
        />
      )}
    </section>
  );
}
