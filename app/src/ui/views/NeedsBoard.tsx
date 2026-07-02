// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Needs board: the deliberation's aggregated needs (client-side aggregation over
// participant pods) with per-need tri-state resonance. A resonance is written to
// YOUR OWN pod (authenticatedFetch) then the board refreshes. Thin over src/lib.

import { useState } from "react";
import {
  MAXNEEF_BY_IRI,
  STANCE_CONFLICTS,
  STANCE_RESONATES,
  STANCE_UNSURE,
  type Stance,
} from "../../lib/fut.js";
import type { Need, Resonance } from "../../lib/model.js";
import { writeResonance } from "../../lib/pod.js";
import { useController } from "../auth.js";
import type { AggregateState } from "../hooks.js";
import type { DeliberationConfig } from "../state.js";

const STANCE_LABEL: Record<Stance, string> = {
  [STANCE_RESONATES]: "Resonates",
  [STANCE_CONFLICTS]: "Conflicts",
  [STANCE_UNSURE]: "Unsure",
};

function conceptLabel(iri: string): string {
  return MAXNEEF_BY_IRI.get(iri)?.label ?? iri;
}

export function NeedsBoard({
  config,
  webId,
  aggregate,
}: {
  config: DeliberationConfig;
  webId: string | null;
  aggregate: AggregateState;
}): React.JSX.Element {
  const controller = useController();
  const { result, loading, error, refresh } = aggregate;
  const [busy, setBusy] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  async function resonate(need: Need, stance: Stance): Promise<void> {
    setWriteError(null);
    if (!webId) {
      setWriteError("Sign in to react — your resonance is stored in your own pod.");
      return;
    }
    const resonance: Omit<Resonance, "id"> = {
      onStatement: need.id,
      stance,
      created: new Date().toISOString(),
      creator: webId,
      inDeliberation: config.deliberation,
    };
    setBusy(need.id);
    try {
      await writeResonance(controller.authenticatedFetch, config.ownBase, resonance);
      await refresh();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="view">
      <div className="row-between">
        <h2>Needs board</h2>
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {writeError && <p className="error">{writeError}</p>}

      {result && result.errors.length > 0 && (
        <p className="muted">
          {result.errors.length} source(s) could not be read (skipped, not fatal).
        </p>
      )}

      {result && result.needs.length === 0 && !loading && (
        <p className="muted">No needs yet. Submit one, or press Refresh.</p>
      )}

      <ul className="cards">
        {result?.needs.map((need) => (
          <li key={need.id} className="card">
            <p className="need-content">{need.content}</p>
            <p className="muted small">
              {conceptLabel(need.needConcept)}
              {need.intensity !== undefined ? ` · intensity ${need.intensity}` : ""}
            </p>
            <div className="stances">
              {([STANCE_RESONATES, STANCE_CONFLICTS, STANCE_UNSURE] as Stance[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  disabled={busy === need.id}
                  onClick={() => resonate(need, st)}
                >
                  {STANCE_LABEL[st]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
