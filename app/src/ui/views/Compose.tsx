// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Compose view: write a Max-Neef-classified fut:Need to YOUR OWN pod. Thin over
// src/lib (writeNeed uses the session-bound authenticatedFetch — own pod only).

import { useState } from "react";
import { MAXNEEF_CONCEPTS } from "../../lib/fut.js";
import { MAX_CONTENT_LENGTH, type Need } from "../../lib/model.js";
import { writeNeed } from "../../lib/pod.js";
import { useController } from "../auth.js";
import type { DeliberationConfig } from "../state.js";

const FIRST_CONCEPT = MAXNEEF_CONCEPTS[0]?.iri ?? "";

export function Compose({
  config,
  webId,
}: {
  config: DeliberationConfig;
  webId: string | null;
}): React.JSX.Element {
  const controller = useController();
  const [content, setContent] = useState("");
  const [concept, setConcept] = useState(FIRST_CONCEPT);
  const [intensity, setIntensity] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    setStatus(null);
    if (!webId) {
      setError("Sign in first — a need is written to your own pod under your WebID.");
      return;
    }
    if (!content.trim()) {
      setError("Describe the need.");
      return;
    }
    const need: Omit<Need, "id"> = {
      content: content.trim(),
      needConcept: concept,
      created: new Date().toISOString(),
      creator: webId,
      inDeliberation: config.deliberation,
      ...(intensity === "" ? {} : { intensity }),
    };
    setSaving(true);
    try {
      const { url } = await writeNeed(controller.authenticatedFetch, config.ownBase, need);
      setStatus(`Saved to your pod: ${url}`);
      setContent("");
      setIntensity("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view">
      <h2>Submit a need</h2>
      <p className="muted">
        Stored in <strong>YOUR pod</strong>, under your WebID. Others read it only if your pod
        grants them access.
      </p>

      <label className="field">
        <span>
          What do you need?{" "}
          <em>
            ({content.length}/{MAX_CONTENT_LENGTH})
          </em>
        </span>
        <textarea
          rows={3}
          maxLength={MAX_CONTENT_LENGTH}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Reliable transit so I can reach work without a car."
        />
      </label>

      <label className="field">
        <span>Which fundamental need does this serve? (Max-Neef)</span>
        <select value={concept} onChange={(e) => setConcept(e.target.value)}>
          {MAXNEEF_CONCEPTS.map((c) => (
            <option key={c.iri} value={c.iri}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Intensity (optional, 1–5)</span>
        <select
          value={String(intensity)}
          onChange={(e) => setIntensity(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="primary" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Submit need"}
      </button>

      {error && <p className="error">{error}</p>}
      {status && <p className="ok">{status}</p>}
    </section>
  );
}
