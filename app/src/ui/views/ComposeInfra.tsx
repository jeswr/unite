// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B structured compose wizard (S2 — SCOPE-DIFFERENTIATION §3.3),
// mounted by Compose when the scope's `composeFlow` is "structured-infra":
// target system → change (kind / description / breaking → migration story) →
// blast radius by role (+ the VSD indirect-stakeholders prompt) → needs trace
// (≥1 — inherited; what keeps scope B value-centric) → running code (optional
// at compose, REQUIRED before endorsement) → consent. One page, numbered
// sections — the structure IS the grammar. Thin over src/lib
// (writeInfraProposal / buildInfraProposalQuads do the validation twice over).

import { useState } from "react";
import { GOVERNED_SYSTEMS } from "../../lib/adoption.js";
import { type ConsentPolicy, DEFAULT_CONSENT } from "../../lib/consent.js";
import {
  KIND_DEPRECATION,
  KIND_NEW_SPEC,
  KIND_SERVICE_OPERATION,
  KIND_SPEC_CHANGE,
  PROPOSAL_KINDS,
  type ProposalKind,
  STAKEHOLDER_ROLES,
  type StakeholderRole,
} from "../../lib/fut-draft.js";
import {
  type InfraProposal,
  PROPOSAL_KIND_LABELS,
  STAKEHOLDER_ROLE_LABELS,
} from "../../lib/infra.js";
import { isHttpIri, MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "../../lib/model.js";
import { writeInfraProposal } from "../../lib/pod.js";
import { meetsTier } from "../../lib/trust.js";
import { useController } from "../auth.js";
import { Notice, ViewHeader } from "../components.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { writeSessionFor } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";
import { ConsentPanel } from "./ConsentPanel.js";

/** One-line explanations of the coded change kinds (§3.3 step 2). */
const KIND_DESC: Readonly<Record<ProposalKind, string>> = {
  [KIND_SPEC_CHANGE]: "Change an existing spec / vocabulary version.",
  [KIND_NEW_SPEC]: "Introduce a new spec, profile or vocabulary.",
  [KIND_SERVICE_OPERATION]: "Operate / change a shared service.",
  [KIND_DEPRECATION]: "Retire something the network still runs.",
} as Record<ProposalKind, string>;

export function ComposeInfra({
  config,
  webId,
  trust,
  aggregate,
  onSwitchToNeed,
}: {
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
  /** Escape hatch to the shared need-first form (needs feed the trace step). */
  onSwitchToNeed: () => void;
}): React.JSX.Element {
  const controller = useController();
  const { result, refresh } = aggregate;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targets, setTargets] = useState<readonly string[]>([]);
  const [freeTarget, setFreeTarget] = useState("");
  const [kind, setKind] = useState<ProposalKind | null>(null);
  const [roles, setRoles] = useState<readonly StakeholderRole[]>([]);
  const [breaking, setBreaking] = useState(false);
  const [migration, setMigration] = useState("");
  const [refImpl, setRefImpl] = useState("");
  const [serves, setServes] = useState<readonly string[]>([]);
  const [stakeholders, setStakeholders] = useState("");
  const [consent, setConsent] = useState<ConsentPolicy>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;

  const toggle =
    <T,>(set: (fn: (prev: readonly T[]) => readonly T[]) => void) =>
    (v: T) =>
      set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleTarget = toggle(setTargets);
  const toggleRole = toggle(setRoles);
  const toggleServes = toggle(setServes);

  function addFreeTarget(): void {
    const iri = freeTarget.trim();
    if (!isHttpIri(iri)) {
      setFormError("A governed-system target must be an absolute http(s) IRI.");
      return;
    }
    setFormError(null);
    if (!targets.includes(iri)) setTargets([...targets, iri]);
    setFreeTarget("");
  }

  async function submit(): Promise<void> {
    setFormError(null);
    setSavedUrl(null);
    if (!identity) {
      setFormError("Sign in first — a proposal is written to your own pod under your WebID.");
      return;
    }
    // Defence in depth: Compose's gate already blocks this path, but a stale
    // render must never write past the floor (the S1 discipline, unchanged).
    if (floor > 0 && (trust.profile === null || !meetsTier(trust.profile, floor))) {
      setFormError(`Proposing here requires identity tier T${floor} — see the Trust view.`);
      return;
    }
    if (targets.length === 0) {
      setFormError("Name the governed system this change targets (step 1) — ≥1 required.");
      return;
    }
    if (kind === null) {
      setFormError("Pick the change kind (step 2).");
      return;
    }
    if (!title.trim()) {
      setFormError("Give the change a short name (step 2).");
      return;
    }
    if (!content.trim()) {
      setFormError("Describe the change in plain language (step 2).");
      return;
    }
    if (breaking && !migration.trim()) {
      setFormError(
        "A breaking change must carry a migration story (step 2) — interop honesty is not optional.",
      );
      return;
    }
    if (roles.length === 0) {
      setFormError("Declare who the change touches (step 3) — ≥1 stakeholder role.");
      return;
    }
    if (serves.length === 0) {
      setFormError(
        "Trace the proposal to at least one shared need (step 4) — infrastructure proposals stay value-centric; this is what stops the board becoming a feature-request tracker.",
      );
      return;
    }
    const ref = refImpl.trim();
    if (ref.length > 0 && !isHttpIri(ref)) {
      setFormError("The reference implementation must be an absolute http(s) IRI (step 5).");
      return;
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const proposal: Omit<InfraProposal, "id"> = {
        title: title.trim(),
        content: content.trim(),
        targetsSystem: targets,
        proposalKind: kind,
        affectsRole: roles,
        motivatedBy: serves,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
        breakingChange: breaking,
        ...(breaking ? { migrationPath: migration.trim() } : {}),
        ...(ref.length > 0 ? { referenceImplementation: ref } : {}),
        ...(stakeholders.trim() ? { indirectStakeholders: stakeholders.trim() } : {}),
      };
      const { url } = await writeInfraProposal(session.fetch, session.ownBase, proposal, consent);
      setSavedUrl(url);
      setTitle("");
      setContent("");
      setTargets([]);
      setKind(null);
      setRoles([]);
      setBreaking(false);
      setMigration("");
      setRefImpl("");
      setServes([]);
      setStakeholders("");
      setConsent(DEFAULT_CONSENT);
      try {
        await refresh(); // the write itself already succeeded
      } catch {
        // aggregation errors surface through the boards' own error states
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const needs = result?.needs ?? [];

  return (
    <section className="view">
      <ViewHeader
        title="Propose an infrastructure change"
        lede={
          <>
            Scope B changes <em>running systems</em>, so a proposal here is structured: what it
            targets, what kind of change, who it touches, whether it breaks anything — and running
            code before it can be endorsed. Your proposal is stored in{" "}
            <strong>{config.mode === "demo" ? "the sandboxed demo pod" : "your own pod"}</strong>{" "}
            with your consent policy attached.
          </>
        }
      />
      <p className="muted small">
        Want to surface a shared need instead of a concrete change?{" "}
        <button type="button" className="chip" onClick={onSwitchToNeed}>
          Share an infrastructure need
        </button>
      </p>

      {/* 1 — Target */}
      <div className="field">
        <span>
          <strong>1 · Target system</strong>{" "}
          <span className="hint">— the governed artifact being changed (≥1)</span>
        </span>
        <fieldset className="chip-row" aria-label="governed systems">
          {GOVERNED_SYSTEMS.map((sys) => (
            <button
              type="button"
              key={sys.id}
              className="chip"
              aria-pressed={targets.includes(sys.id)}
              title={sys.id}
              onClick={() => toggleTarget(sys.id)}
            >
              {sys.label}
            </button>
          ))}
          {targets
            .filter((t) => !GOVERNED_SYSTEMS.some((sys) => sys.id === t))
            .map((t) => (
              <button
                type="button"
                key={t}
                className="chip"
                aria-pressed={true}
                title="remove"
                onClick={() => toggleTarget(t)}
              >
                {t}
              </button>
            ))}
        </fieldset>
        <div className="chip-row">
          <input
            type="url"
            value={freeTarget}
            onChange={(e) => setFreeTarget(e.target.value)}
            placeholder="…or any governed IRI (spec lineage, protocol profile, registry)"
            aria-label="free target IRI"
          />
          <button type="button" className="btn" onClick={addFreeTarget}>
            Add target
          </button>
        </div>
      </div>

      {/* 2 — Change */}
      <div className="field">
        <span>
          <strong>2 · The change</strong>
        </span>
        <fieldset className="chip-row" aria-label="change kind">
          {PROPOSAL_KINDS.map((k) => (
            <button
              type="button"
              key={k}
              className="chip"
              aria-pressed={kind === k}
              title={KIND_DESC[k]}
              onClick={() => setKind(kind === k ? null : k)}
            >
              {PROPOSAL_KIND_LABELS[k]}
            </button>
          ))}
        </fieldset>
        <label className="field">
          <span>
            Short name{" "}
            <span className="char-count">
              {title.length}/{MAX_TITLE_LENGTH}
            </span>
          </span>
          <input
            type="text"
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Adopt futures sector 0.2.0"
          />
        </label>
        <label className="field">
          <span>
            Plain-language description{" "}
            <span className="char-count">
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </span>
          <textarea
            rows={4}
            maxLength={MAX_CONTENT_LENGTH}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What changes, and why the network should want it."
          />
        </label>
        <label className="field" style={{ flexDirection: "row", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={breaking}
            onChange={(e) => setBreaking(e.target.checked)}
          />
          <span>
            This is a <strong>breaking change</strong> — running implementations would have to
            migrate
          </span>
        </label>
        {breaking && (
          <label className="field">
            <span>
              Migration story <span className="hint">— required for a breaking change</span>{" "}
              <span className="char-count">
                {migration.length}/{MAX_CONTENT_LENGTH}
              </span>
            </span>
            <textarea
              rows={3}
              maxLength={MAX_CONTENT_LENGTH}
              value={migration}
              onChange={(e) => setMigration(e.target.value)}
              placeholder="How the installed base gets from here to there (e.g. a dual-advertisement window — fedreg:acceptsSpec carries both versions while everyone migrates)."
            />
          </label>
        )}
      </div>

      {/* 3 — Blast radius */}
      <div className="field">
        <span>
          <strong>3 · Who is affected</strong>{" "}
          <span className="hint">— the blast radius, by stakeholder role (≥1)</span>
        </span>
        <fieldset className="chip-row" aria-label="affected roles">
          {STAKEHOLDER_ROLES.map((r) => (
            <button
              type="button"
              key={r}
              className="chip"
              aria-pressed={roles.includes(r)}
              onClick={() => toggleRole(r)}
            >
              {STAKEHOLDER_ROLE_LABELS[r]}
            </button>
          ))}
        </fieldset>
        <label className="field">
          <span>
            Who is affected that isn't in the room? <span className="hint">(optional)</span>
          </span>
          <textarea
            rows={2}
            maxLength={MAX_CONTENT_LENGTH}
            value={stakeholders}
            onChange={(e) => setStakeholders(e.target.value)}
            placeholder="Indirect stakeholders — people and communities the change would touch who aren't participating here."
          />
        </label>
      </div>

      {/* 4 — Needs trace */}
      <div className="field">
        <span>
          <strong>4 · Which shared needs does it serve?</strong>{" "}
          <span className="hint">
            — ≥1 required; the needs trace is what keeps infrastructure co-design value-centric
          </span>
        </span>
        {needs.length === 0 ? (
          <p className="muted small">
            No shared needs yet —{" "}
            <button type="button" className="chip" onClick={onSwitchToNeed}>
              share an infrastructure need
            </button>{" "}
            first; proposals answer needs.
          </p>
        ) : (
          <fieldset className="chip-row" aria-label="needs served">
            {needs.map((n) => (
              <button
                type="button"
                key={n.id}
                className="chip"
                aria-pressed={serves.includes(n.id)}
                onClick={() => toggleServes(n.id)}
                title={n.content}
              >
                {n.content.length > 60 ? `${n.content.slice(0, 57)}…` : n.content}
              </button>
            ))}
          </fieldset>
        )}
      </div>

      {/* 5 — Running code */}
      <label className="field">
        <span>
          <strong>5 · Running code</strong>{" "}
          <span className="hint">
            — a repo/commit IRI. Optional now; REQUIRED before this proposal can be endorsed (rough
            consensus AND running code). Shown as a link, never fetched.
          </span>
        </span>
        <input
          type="url"
          value={refImpl}
          onChange={(e) => setRefImpl(e.target.value)}
          placeholder="https://github.com/…/commit/…"
        />
      </label>

      {/* 6 — Consent */}
      <ConsentPanel value={consent} onChange={setConsent} deliberation={config.deliberation} />

      <button type="button" className="primary" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Put this change to the deliberation"}
      </button>

      {formError && <Notice tone="error">{formError}</Notice>}
      {savedUrl && (
        <Notice tone="ok">
          Saved to {config.mode === "demo" ? "the demo pod" : "your pod"} —{" "}
          <a href="#/proposals">see it on the proposals board</a>.{" "}
          <span className="data">{savedUrl}</span>
        </Notice>
      )}
    </section>
  );
}
