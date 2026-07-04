// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Compose: a guided form for a Max-Neef-classified fut:Need, written to the
// author's OWN pod (or the sandboxed demo pod in demo mode) via writeNeed. The
// form surfaces the design's needs↔satisfiers split (design/01): the statement
// articulates the satisfier; the picker names the fundamental need it serves.

import { useState } from "react";
import { type ConsentPolicy, DEFAULT_CONSENT } from "../../lib/consent.js";
import { MAXNEEF_CONCEPTS } from "../../lib/fut.js";
import { MAX_CONTENT_LENGTH, type Need } from "../../lib/model.js";
import { writeNeed } from "../../lib/pod.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import { writeSessionFor } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";
import { ConsentPanel } from "./ConsentPanel.js";

const FIRST_CONCEPT = MAXNEEF_CONCEPTS[0]?.iri ?? "";

/** One-line descriptions of the nine Max-Neef needs (Human Scale Development). */
const CONCEPT_DESC: Record<string, string> = {
  subsistence: "Health, food, shelter, work — the material floor.",
  protection: "Safety, care, security — being able to rely on things.",
  affection: "Friendship, family, love — being close to people.",
  understanding: "Learning, curiosity, making sense of the world.",
  participation: "Having a real say — rights, responsibilities, voice.",
  idleness: "Rest, play, daydreaming — time that is truly yours.",
  creation: "Making things — skills, work, invention, expression.",
  identity: "Belonging and sense of self — knowing who you are.",
  freedom: "Autonomy and equal rights — including the right to dissent.",
};

/** Scope-specific compose framing. */
function composeCopy(scope: ScopeConfig): { title: string; prompt: string; placeholder: string } {
  switch (scope.id) {
    case "infrastructure":
      return {
        title: "Propose an infrastructure need",
        prompt: "What should the shared systems underneath do — or stop doing?",
        placeholder: "e.g. Every pod server should speak the same live-notification channel…",
      };
    case "society":
      return {
        title: "Share a vision",
        prompt: "Describe a piece of the future you want — concretely, from your own life.",
        placeholder: "e.g. I want my children to reach school, a park and a shop on foot…",
      };
    default:
      return {
        title: "Propose an app need",
        prompt: "What's missing? What should exist, or work differently?",
        placeholder:
          "e.g. Reliable offline access, so a train tunnel can't lock me out of my notes…",
      };
  }
}

export function Compose({
  scope,
  config,
  webId,
  onComposed,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  onComposed?: () => Promise<void> | void;
}): React.JSX.Element {
  const controller = useController();
  const [content, setContent] = useState("");
  const [concept, setConcept] = useState(FIRST_CONCEPT);
  const [intensity, setIntensity] = useState<number | "">("");
  const [consent, setConsent] = useState<ConsentPolicy>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = composeCopy(scope);
  const identity = sessionIdentity(config, webId);

  async function submit(): Promise<void> {
    setError(null);
    setSavedUrl(null);
    if (!identity) {
      setError("Sign in first — a statement is written to your own pod under your WebID.");
      return;
    }
    if (!content.trim()) {
      setError("Describe the need first.");
      return;
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const need: Omit<Need, "id"> = {
        content: content.trim(),
        needConcept: concept,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
        ...(intensity === "" ? {} : { intensity }),
      };
      const { url } = await writeNeed(session.fetch, session.ownBase, need, consent);
      setSavedUrl(url);
      setContent("");
      setIntensity("");
      setConsent(DEFAULT_CONSENT);
      try {
        await onComposed?.(); // board refresh — the write itself already succeeded
      } catch {
        // A refresh failure must not report the (successful) save as an error;
        // the board's own error surface reports aggregation problems.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view">
      <h2 className="view-title">{copy.title}</h2>
      <p className="view-lede">
        Your statement is stored in{" "}
        <strong>{config.mode === "demo" ? "the sandboxed demo pod" : "your own pod"}</strong>, under
        your identity, with your consent policy attached. Others read it only because you let them.
      </p>

      <label className="field">
        <span>
          {copy.prompt}{" "}
          <span className="char-count">
            {content.length}/{MAX_CONTENT_LENGTH}
          </span>
        </span>
        <textarea
          rows={4}
          maxLength={MAX_CONTENT_LENGTH}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={copy.placeholder}
        />
      </label>

      <div className="field">
        <span>
          Which fundamental need does this serve?{" "}
          <span className="hint">
            — the statement is the <em>satisfier</em>; this names the underlying <em>need</em>{" "}
            (Max-Neef), so different proposals for the same need can meet each other.
          </span>
        </span>
        <fieldset className="concept-grid" aria-label="fundamental need">
          {MAXNEEF_CONCEPTS.map((c) => (
            <button
              type="button"
              key={c.iri}
              className="concept-chip"
              aria-pressed={concept === c.iri}
              onClick={() => setConcept(c.iri)}
            >
              <span className="c-label">{c.label}</span>
              <span className="c-desc">{CONCEPT_DESC[c.name] ?? ""}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="field">
        <span>
          How strongly does this weigh on you? <span className="hint">(optional)</span>
        </span>
        <fieldset className="segmented" aria-label="intensity">
          <button type="button" aria-pressed={intensity === ""} onClick={() => setIntensity("")}>
            —
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={intensity === n}
              onClick={() => setIntensity(n)}
            >
              {n}
            </button>
          ))}
        </fieldset>
      </div>

      <ConsentPanel value={consent} onChange={setConsent} deliberation={config.deliberation} />

      <button type="button" className="primary" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : `Share this ${scope.artifactNoun}`}
      </button>

      {error && <p className="notice error">{error}</p>}
      {savedUrl && (
        <p className="notice ok">
          Saved to {config.mode === "demo" ? "the demo pod" : "your pod"} —{" "}
          <a href="#/board">see it on the needs board</a>. <span className="data">{savedUrl}</span>
        </p>
      )}
    </section>
  );
}
