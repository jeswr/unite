// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C compose inversion (S4 — docs/SCOPE-DIFFERENTIATION.md §4.3):
// narrative FIRST, decomposition second, adoption third — the opposite of
// A/B's atom-first grammars. The person tells the whole story
// (fut:VisionStatement — psychologically load-bearing, design/03 §1), splits
// it into voteable atoms (claims ≤500 chars, Max-Neef needs, Schwartz values)
// MANUALLY (the §8 Q4 manual-first default; the DecompositionAssistant seam
// is injectable and documented, lib/decompose.ts), then ADOPTS each atom
// explicitly — adopt / edit / discard. Nothing is written without adoption
// (the C6 consent invariant; also unrepresentable in the serialiser).
//
// Scope C's floor is 0: pseudonymous voice composes here (T0, honestly
// labelled). The C4 sensitive-domain launch gate is enforced fail-closed in
// the write chokepoints (lib/pod-society.ts) and pre-checked here for a
// friendly refusal before anything is attempted.

import { useMemo, useRef, useState } from "react";
import { type ConsentPolicy, DEFAULT_CONSENT } from "../../lib/consent.js";
import {
  type AtomKind,
  type DecompositionAssistant,
  MANUAL_DECOMPOSITION,
} from "../../lib/decompose.js";
import { MAXNEEF_CONCEPTS } from "../../lib/fut.js";
import { MAX_CLAIM_LENGTH, SCHWARTZ_CONCEPTS, VISION_SCOPES } from "../../lib/fut-society.js";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, type Need } from "../../lib/model.js";
import type { Claim, ValueStatement, VisionStatement } from "../../lib/model-society.js";
import { writeNeed } from "../../lib/pod.js";
import { writeClaim, writeValueStatement, writeVision } from "../../lib/pod-society.js";
import { describeSensitiveHit, screenSensitiveDomain } from "../../lib/sensitive.js";
import { meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import type { SessionTrust } from "../hooks.js";
import { writeSessionFor } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";
import { ConsentPanel } from "./ConsentPanel.js";
import { TIER_MEANING } from "./Trust.js";

/** The wizard steps, in order (§4.3; voice + consent share the final step). */
type Step = "tell" | "split" | "adopt" | "consent";
const STEP_ORDER: readonly Step[] = ["tell", "split", "adopt", "consent"];
const STEP_LABELS: Record<Step, string> = {
  tell: "1 · Tell it",
  split: "2 · Split it",
  adopt: "3 · Adopt each",
  consent: "4 · Voice & consent",
};

/** One draft atom in the adopt/edit/discard list. */
interface DraftAtomState {
  readonly key: number;
  readonly kind: AtomKind;
  readonly content: string;
  readonly needConcept: string;
  readonly valueConcept: string;
  /** Adoption is an EXPLICIT act — atoms start unadopted (the C6 invariant). */
  readonly adopted: boolean;
  /**
   * The decomposition prov:Activity IRI, present ONLY on assistant-proposed
   * atoms whose run disclosed one (DecompositionPlan.activity) — carried onto
   * an adopted claim as `fut:decomposedBy` so assisted decomposition is never
   * invisible. Manual atoms never carry it.
   */
  readonly decomposedBy?: string;
}

const FIRST_NEED_CONCEPT = MAXNEEF_CONCEPTS[0]?.iri ?? "";
const FIRST_VALUE_CONCEPT = SCHWARTZ_CONCEPTS[0]?.iri ?? "";

const KIND_LABELS: Record<AtomKind, string> = {
  claim: "claim",
  need: "need",
  value: "value",
};

export function NarrativeCompose({
  scope,
  config,
  webId,
  trust,
  onComposed,
  assistant = MANUAL_DECOMPOSITION,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  onComposed?: () => Promise<void> | void;
  /** The decomposition seam (lib/decompose.ts) — manual-first by default. */
  assistant?: DecompositionAssistant;
}): React.JSX.Element {
  const controller = useController();
  const [step, setStep] = useState<Step>("tell");
  // Step 1 — the narrative.
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [visionScope, setVisionScope] = useState<string | "">("");
  const [horizon, setHorizon] = useState("");
  // Step 2/3 — the atoms.
  const [atoms, setAtoms] = useState<readonly DraftAtomState[]>([]);
  const nextKey = useRef(0);
  const [selection, setSelection] = useState("");
  const [assistantNote, setAssistantNote] = useState<string | null>(null);
  // Step 4 — consent + submit.
  const [consent, setConsent] = useState<ConsentPolicy>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;
  const tier = trust.profile?.tier ?? 0;

  // Scope C's floor is 0 (pseudonymous voice), so this gate normally passes —
  // it exists for a community that RAISES the floor (raise-only, §4.4).
  const mayCompose = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  const adopted = useMemo(() => atoms.filter((a) => a.adopted), [atoms]);

  function addAtom(
    kind: AtomKind,
    content: string,
    proposed?: { needConcept?: string; valueConcept?: string; decomposedBy?: string },
  ): void {
    const atom: DraftAtomState = {
      key: nextKey.current++,
      kind,
      content,
      // An assistant's proposed concepts pre-fill the pickers (the author may
      // still change them in the adopt step); manual atoms take the defaults.
      needConcept: proposed?.needConcept ?? FIRST_NEED_CONCEPT,
      valueConcept: proposed?.valueConcept ?? FIRST_VALUE_CONCEPT,
      adopted: false,
      ...(proposed?.decomposedBy !== undefined ? { decomposedBy: proposed.decomposedBy } : {}),
    };
    setAtoms((prev) => [...prev, atom]);
  }

  function updateAtom(key: number, patch: Partial<DraftAtomState>): void {
    setAtoms((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  function discardAtom(key: number): void {
    setAtoms((prev) => prev.filter((a) => a.key !== key));
  }

  async function suggestSplit(): Promise<void> {
    setAssistantNote(null);
    try {
      const result = await assistant.decompose(narrative);
      if (result.atoms.length === 0) {
        setAssistantNote(
          "No assistant is wired into this build — the split is yours to make (manual-first; " +
            "the DecompositionAssistant seam is where an assisted splitter plugs in later, with " +
            "its model + prompt recorded as provenance). Select a span of your story below and " +
            "turn it into a claim, need or value.",
        );
        return;
      }
      // Carry the assistant's FULL proposal through: its concept suggestions
      // pre-fill the pickers, and its disclosed prov:Activity IRI travels onto
      // adopted claims as fut:decomposedBy (assisted splits are never invisible).
      const decomposedBy = result.provenance?.activity;
      for (const a of result.atoms) {
        addAtom(a.kind, a.content, {
          ...(a.needConcept !== undefined ? { needConcept: a.needConcept } : {}),
          ...(a.valueConcept !== undefined ? { valueConcept: a.valueConcept } : {}),
          ...(decomposedBy !== undefined ? { decomposedBy } : {}),
        });
      }
      setAssistantNote(
        `The assistant proposed ${result.atoms.length} atom${result.atoms.length === 1 ? "" : "s"} — ` +
          "each is only a SUGGESTION until you adopt it in the next step (adopt / edit / discard).",
      );
    } catch (e) {
      setAssistantNote(
        `The assistant failed (${e instanceof Error ? e.message : String(e)}) — split manually below.`,
      );
    }
  }

  async function submit(): Promise<void> {
    setError(null);
    setSavedUrl(null);
    if (!identity) {
      setError("Sign in first — your vision is written to your own pod under your WebID.");
      return;
    }
    if (!mayCompose) {
      setError(`Composing here requires identity tier T${floor} — see the Trust view.`);
      return;
    }
    if (!narrative.trim()) {
      setError("Tell the story first.");
      return;
    }
    // Pre-check the C4 launch gate for a friendly refusal; the write
    // chokepoints (lib/pod-society.ts) enforce it fail-closed regardless.
    // Screen ONLY what will actually be written — the vision + the ADOPTED
    // atoms; an unadopted (discarded-by-intent) draft never blocks the share.
    for (const text of [`${title}\n${narrative}`, ...adopted.map((a) => a.content)]) {
      const hit = screenSensitiveDomain(text);
      if (hit) {
        setError(describeSensitiveHit(hit));
        return;
      }
    }
    for (const a of adopted) {
      if (!a.content.trim()) {
        setError(`An adopted ${KIND_LABELS[a.kind]} is empty — edit or discard it.`);
        return;
      }
      if (a.kind === "claim" && a.content.trim().length > MAX_CLAIM_LENGTH) {
        setError(`A claim must stay atomic — ≤ ${MAX_CLAIM_LENGTH} characters (split it further).`);
        return;
      }
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const created = new Date().toISOString();
      const vision: Omit<VisionStatement, "id"> = {
        content: narrative.trim(),
        created,
        creator: identity,
        inDeliberation: config.deliberation,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(visionScope ? { scope: visionScope } : {}),
        ...(/^\d{4}$/.test(horizon.trim()) ? { horizon: horizon.trim() } : {}),
      };
      const { url } = await writeVision(session.fetch, session.ownBase, vision, consent);
      // Only ADOPTED atoms are written — adoption is what confers authorship.
      // The chosen consent policy travels with the vision AND every atom.
      for (const a of adopted) {
        const content = a.content.trim();
        if (a.kind === "claim") {
          const claim: Omit<Claim, "id"> = {
            content,
            adoptedBy: identity,
            derivedFrom: url,
            created,
            creator: identity,
            inDeliberation: config.deliberation,
            // Assistant-proposed claims carry the disclosed decomposition
            // activity (fut:decomposedBy); manual claims carry none.
            ...(a.decomposedBy !== undefined ? { decomposedBy: a.decomposedBy } : {}),
          };
          await writeClaim(session.fetch, session.ownBase, claim, consent);
        } else if (a.kind === "need") {
          const need: Omit<Need, "id"> = {
            content,
            needConcept: a.needConcept,
            created,
            creator: identity,
            inDeliberation: config.deliberation,
          };
          await writeNeed(session.fetch, session.ownBase, need, consent);
        } else {
          const value: Omit<ValueStatement, "id"> = {
            content,
            valueConcept: a.valueConcept,
            created,
            creator: identity,
            inDeliberation: config.deliberation,
          };
          await writeValueStatement(session.fetch, session.ownBase, value, consent);
        }
      }
      setSavedUrl(url);
      setTitle("");
      setNarrative("");
      setVisionScope("");
      setHorizon("");
      setAtoms([]);
      setConsent(DEFAULT_CONSENT);
      setStep("tell");
      try {
        await onComposed?.(); // refresh — the writes themselves already succeeded
      } catch {
        // aggregation errors surface through the boards' own error surfaces
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!mayCompose && trust.profile === null) {
    return (
      <section className="view">
        <h2 className="view-title">Share a vision</h2>
        <div className="empty" aria-live="polite">
          <span className="empty-title">Checking your standing…</span>
          <p>Verifying your membership credential for this deliberation.</p>
        </div>
      </section>
    );
  }
  if (!mayCompose) {
    return (
      <section className="view">
        <h2 className="view-title">Share a vision</h2>
        <div className="empty locked">
          <span className="empty-title">Composing here needs tier T{floor}</span>
          <p>
            This community raised its participation floor to T{floor} ({TIER_MEANING[floor]}). See
            the <a href="#/trust">Trust</a> view for how vouching works.
          </p>
        </div>
      </section>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <section className="view">
      <h2 className="view-title">Share a vision</h2>
      <p className="view-lede">
        Tell the whole story first — your current life, the future you want. Then split it into
        atoms others can resonate with, and <strong>adopt</strong> each one: nothing enters the
        deliberation as yours without your explicit adoption.
      </p>

      <nav className="chip-row" aria-label="compose steps">
        {STEP_ORDER.map((s, i) => (
          <button
            type="button"
            key={s}
            className="chip"
            aria-pressed={step === s}
            // Backwards always; forwards only to visited-adjacent steps.
            disabled={i > stepIndex + 1 || (i > stepIndex && !narrative.trim())}
            onClick={() => setStep(s)}
          >
            {STEP_LABELS[s]}
          </button>
        ))}
      </nav>

      {/* ── Step 1 — Tell it ──────────────────────────────────────────────── */}
      {step === "tell" && (
        <div className="panel">
          <label className="field">
            <span>
              A short name for this future <span className="hint">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Streets my kids can cross alone"
            />
          </label>
          <label className="field">
            <span>
              The story — your life now, the future you want{" "}
              <span className="char-count">
                {narrative.length}/{MAX_CONTENT_LENGTH}
              </span>
            </span>
            <textarea
              rows={8}
              maxLength={MAX_CONTENT_LENGTH}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Write it whole — concretely, from your own life. The next step splits it into pieces others can respond to; this narrative itself is what the Futures gallery shows."
            />
          </label>
          <div className="field">
            <span>
              Whom is this future for? <span className="hint">(the scope ladder — optional)</span>
            </span>
            <fieldset className="chip-row" aria-label="vision scope">
              {VISION_SCOPES.map((s) => (
                <button
                  type="button"
                  key={s.iri}
                  className="chip"
                  aria-pressed={visionScope === s.iri}
                  onClick={() => setVisionScope(visionScope === s.iri ? "" : s.iri)}
                >
                  {s.label}
                </button>
              ))}
            </fieldset>
          </div>
          <label className="field">
            <span>
              Target year <span className="hint">(optional, e.g. 2035)</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value.replace(/\D/g, ""))}
              placeholder="2035"
              style={{ maxWidth: "8rem" }}
            />
          </label>
          <div>
            <button
              type="button"
              className="primary"
              disabled={!narrative.trim()}
              onClick={() => setStep("split")}
            >
              Next: split it
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Split it ─────────────────────────────────────────────── */}
      {step === "split" && (
        <div className="panel">
          <p className="muted small">
            Select a span of your story, then turn it into an atom — an atomic{" "}
            <strong>claim</strong> (one voteable idea, ≤ {MAX_CLAIM_LENGTH} chars), a{" "}
            <strong>need</strong> (what it serves, Max-Neef), or a <strong>value</strong> you hold.
            You can also add atoms from scratch. Adoption happens in the next step.
          </p>
          <textarea
            rows={6}
            readOnly
            value={narrative}
            aria-label="your story (select text to split)"
            onSelect={(e) => {
              const t = e.currentTarget;
              setSelection(t.value.slice(t.selectionStart ?? 0, t.selectionEnd ?? 0));
            }}
          />
          <div className="chip-row">
            <button
              type="button"
              className="btn"
              disabled={!selection.trim()}
              onClick={() => addAtom("claim", selection.trim())}
            >
              Claim from selection
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selection.trim()}
              onClick={() => addAtom("need", selection.trim())}
            >
              Need from selection
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selection.trim()}
              onClick={() => addAtom("value", selection.trim())}
            >
              Value from selection
            </button>
          </div>
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => addAtom("claim", "")}>
              + blank claim
            </button>
            <button type="button" className="btn" onClick={() => addAtom("need", "")}>
              + blank need
            </button>
            <button type="button" className="btn" onClick={() => addAtom("value", "")}>
              + blank value
            </button>
            <button type="button" className="btn" onClick={suggestSplit}>
              Suggest a split
            </button>
          </div>
          {assistantNote && <p className="notice info">{assistantNote}</p>}
          <p className="muted small">
            {atoms.length} atom{atoms.length === 1 ? "" : "s"} drafted.
          </p>
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => setStep("tell")}>
              Back
            </button>
            <button type="button" className="primary" onClick={() => setStep("adopt")}>
              Next: adopt each
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Adopt each ───────────────────────────────────────────── */}
      {step === "adopt" && (
        <div className="panel">
          <p className="muted small">
            Per atom: <strong>adopt</strong> it (it becomes yours and enters the deliberation), edit
            it first, or discard it. Unadopted atoms are never written — adoption is the consent
            gate, identical whether you or an assistant proposed the split.
          </p>
          {atoms.length === 0 && (
            <p className="notice info">
              No atoms drafted — you can share the narrative alone (it appears in the Futures
              gallery), but only atoms are voteable on the deck. Go back to split some out.
            </p>
          )}
          <ul className="cards">
            {atoms.map((a) => (
              <li key={a.key} className="card">
                <div className="row-between">
                  <span className="badge">{KIND_LABELS[a.kind]}</span>
                  <button type="button" className="btn" onClick={() => discardAtom(a.key)}>
                    Discard
                  </button>
                </div>
                <label className="field">
                  <span>
                    Text{" "}
                    <span className="char-count">
                      {a.content.length}/
                      {a.kind === "claim" ? MAX_CLAIM_LENGTH : MAX_CONTENT_LENGTH}
                    </span>
                  </span>
                  <textarea
                    rows={2}
                    maxLength={a.kind === "claim" ? MAX_CLAIM_LENGTH : MAX_CONTENT_LENGTH}
                    value={a.content}
                    onChange={(e) => updateAtom(a.key, { content: e.target.value })}
                  />
                </label>
                {a.kind === "need" && (
                  <label className="field">
                    <span>Fundamental need (Max-Neef)</span>
                    <select
                      value={a.needConcept}
                      onChange={(e) => updateAtom(a.key, { needConcept: e.target.value })}
                    >
                      {MAXNEEF_CONCEPTS.map((c) => (
                        <option key={c.iri} value={c.iri}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {a.kind === "value" && (
                  <label className="field">
                    <span>Value (Schwartz)</span>
                    <select
                      value={a.valueConcept}
                      onChange={(e) => updateAtom(a.key, { valueConcept: e.target.value })}
                    >
                      {SCHWARTZ_CONCEPTS.map((c) => (
                        <option key={c.iri} value={c.iri}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field" style={{ flexDirection: "row", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={a.adopted}
                    onChange={(e) => updateAtom(a.key, { adopted: e.target.checked })}
                  />
                  <span>
                    <strong>Adopt this {KIND_LABELS[a.kind]}</strong> — it becomes yours
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {adopted.length} of {atoms.length} adopted.
          </p>
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => setStep("split")}>
              Back
            </button>
            <button type="button" className="primary" onClick={() => setStep("consent")}>
              Next: voice &amp; consent
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4 — Voice & consent ──────────────────────────────────────── */}
      {step === "consent" && (
        <div className="panel">
          <div className="field">
            <span>Your voice</span>
            <p className="muted small">
              Publishing as <strong>{identity ?? "not signed in"}</strong> —{" "}
              <span className="badge">{`T${tier} · ${TIER_MEANING[tier as 0 | 1 | 2]}`}</span>
              {tier === 0 && (
                <>
                  {" "}
                  Your contributions carry an honest <strong>pseudonymous voice</strong> label: they
                  count, and aggregates disclose the tier mix (stratify-and-disclose). To speak
                  pseudonymously, sign in with a WebID not linked to your primary identity — the
                  linkage never needs to leave your own pod.
                </>
              )}
            </p>
          </div>
          <ConsentPanel value={consent} onChange={setConsent} deliberation={config.deliberation} />
          <p className="notice info">
            <strong>Government / policy use is OFF by default</strong> — grant it above only if you
            want derived results forwarded into governance reporting. And honestly:{" "}
            <strong>signed aggregates may persist after you delete a statement</strong> — deleting
            from your pod removes it from every future aggregation, but a shared future already
            signed and published cannot be unsigned.
          </p>
          <p className="muted small">
            This scope launches on low-sensitivity civic topics only — personal health and
            income-grade details are refused (the C4 launch gate).
          </p>
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => setStep("adopt")}>
              Back
            </button>
            <button type="button" className="primary" onClick={submit} disabled={saving}>
              {saving
                ? "Saving…"
                : `Share this ${scope.artifactNoun}${adopted.length > 0 ? ` + ${adopted.length} atom${adopted.length === 1 ? "" : "s"}` : ""}`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="notice error">{error}</p>}
      {savedUrl && (
        <p className="notice ok">
          Saved to {config.mode === "demo" ? "the demo pod" : "your pod"} — the narrative appears in
          the <a href="#/futures-gallery">Futures gallery</a>; adopted claims deal onto the{" "}
          <a href="#/deck">Resonance deck</a>. <span className="data">{savedUrl}</span>
        </p>
      )}
    </section>
  );
}
