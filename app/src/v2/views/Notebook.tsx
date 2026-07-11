// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/notebook — "what unite has heard from you" (design/v2 02 §8, 03 §7): the
// scrutability + contestability + exit surface. Everything here is read from
// the person's OWN pod on render — there is no server record to show. Edit =
// a superseding write (latest-wins); REMOVE = the pod resource is deleted and
// every downstream artifact recomputes on next read. "Where you sit" is
// computed fresh, community-scale, k-gated, shown only to you.

import { useCallback, useEffect, useMemo, useState } from "react";
import { demoForDeliberation } from "../../demo/pods.js";
import { MAXNEEF_BY_IRI } from "../../lib/fut.js";
import { NEED_PHRASES } from "../../lib/mirror-draft.js";
import type { AggregateState } from "../../ui/hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../../ui/state.js";
import { type CircleMessage, readCircleMessages } from "../circle-data.js";
import { DEMO_CIRCLE } from "../demo-circle.js";
import { deleteOwnResource, type OwnStatements, readOwnStatements } from "../notebook-data.js";
import { REACTION_LABELS } from "../script.js";
import { whereYouSitSeam } from "../seams.js";
import { whereYouSit as computeWhereYouSit } from "../where-you-sit.js";

const STANCE_WORDS: Record<string, string> = {
  Resonates: REACTION_LABELS.resonates,
  Conflicts: REACTION_LABELS.conflicts,
  Unsure: REACTION_LABELS.unsure,
};

function stanceWord(stanceIri: string): string {
  const local = stanceIri.split("#").pop() ?? stanceIri;
  return STANCE_WORDS[local] ?? local;
}

export function Notebook({
  aggregate,
  config,
}: {
  aggregate: AggregateState;
  config: DeliberationConfig;
}): React.JSX.Element {
  const identity = sessionIdentity(config, null);
  const [own, setOwn] = useState<OwnStatements | null>(null);
  const [words, setWords] = useState<readonly CircleMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) throw new Error("the v2 notebook runs on the demo deliberation (V0–V2)");
      setOwn(await readOwnStatements(demo.fetch, demo.you.base));
      setWords(await readCircleMessages(demo.fetch, [demo.you], DEMO_CIRCLE.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [config.deliberation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(resource: string): Promise<void> {
    setBusy(true);
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) return;
      // The subject IRI may carry a fragment; the pod resource is the document.
      const doc = resource.split("#")[0] ?? resource;
      await deleteOwnResource(demo.fetch, demo.you.base, doc);
      await refresh();
      await aggregate.refresh(); // recompute-on-read, demonstrated live
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Statement words for restating reactions ("you said X to …").
  const statementWords = useMemo(() => {
    const m = new Map<string, string>();
    const result = aggregate.result;
    if (!result) return m;
    for (const s of [...result.claims, ...result.needs, ...result.values]) {
      m.set(s.id, s.content);
    }
    return m;
  }, [aggregate.result]);

  // "Where you sit" — computed fresh from the community matrix, never stored;
  // the P11 k-floor on the split percentage lives in the pure helper.
  const whereYouSit = useMemo(() => {
    const result = aggregate.result;
    if (!result || !identity) return null;
    return computeWhereYouSit({
      viewer: identity,
      participants: result.verified.map((v) => v.webId),
      needs: result.needs,
      resonances: result.resonances,
    });
  }, [aggregate.result, identity]);

  return (
    <section className="view">
      <h2>Your notebook</h2>
      <p className="muted small">
        Everything unite has heard from you — in your own pod, in plain language. Fix it or remove
        it anytime; what you remove is gone from the shared picture the next time anyone looks.
      </p>
      {error && <p className="notice error">{error}</p>}

      <div className="v2-summary">
        <h3>Your words</h3>
        {words.length === 0 ? (
          <p className="muted small">Nothing yet — your circle messages will appear here.</p>
        ) : (
          <ul>
            {words.map((m) => (
              <li key={m.id}>
                “{m.content}” <span className="muted small">· shared with your circle</span>
                <p className="v2-seam-text">lives at {m.resource}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="v2-summary">
        <h3>What I took from them</h3>
        {own !== null && own.claims.length === 0 && own.needs.length === 0 ? (
          <p className="muted small">
            Nothing adopted yet — when you tap “that's it” on a mirror, it appears here, editable.
          </p>
        ) : (
          <ul>
            {(own?.claims ?? []).map((c) => (
              <li key={c.id}>
                “{c.content}” <span className="muted small">· in the shared picture</span>{" "}
                <button
                  type="button"
                  className="v2-chip"
                  disabled={busy}
                  onClick={() => void remove(c.id)}
                >
                  Remove
                </button>
              </li>
            ))}
            {(own?.needs ?? []).map((n) => {
              const name = MAXNEEF_BY_IRI.get(n.needConcept)?.name;
              const phrase = name !== undefined ? NEED_PHRASES[name] : undefined;
              return (
                <li key={n.id}>
                  you care about {phrase ?? "this"}: “{n.content}”{" "}
                  <button
                    type="button"
                    className="v2-chip"
                    disabled={busy}
                    onClick={() => void remove(n.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
            {(own?.values ?? []).map((v) => (
              <li key={v.id}>
                a value you named: “{v.content}”{" "}
                <button
                  type="button"
                  className="v2-chip"
                  disabled={busy}
                  onClick={() => void remove(v.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="v2-seam-text">
          Removing deletes the resource from your pod; every summary and letter recomputes from what
          pods hold, so deletion actually propagates. <a href="#/how">the long version →</a>
        </p>
      </div>

      <div className="v2-summary">
        <h3>Your reactions</h3>
        {own !== null && own.resonances.length === 0 ? (
          <p className="muted small">None yet — reactions you give in the circle appear here.</p>
        ) : (
          <ul>
            {(own?.resonances ?? []).map((r) => (
              <li key={r.id}>
                you said “{stanceWord(r.stance)}” to{" "}
                {statementWords.has(r.onStatement)
                  ? `“${statementWords.get(r.onStatement)}”`
                  : "a statement that has since been removed"}
                <span className="muted small"> · react again anytime — the newest counts</span>{" "}
                <button
                  type="button"
                  className="v2-chip"
                  disabled={busy}
                  onClick={() => void remove(r.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="v2-summary">
        <h3>Where you sit</h3>
        {whereYouSit === null ? (
          <p className="muted small">
            Not on the map yet — the map places you only after you've reacted to something.
          </p>
        ) : (
          <p className="muted small">
            Right now you're in a part of the map that tends to weigh{" "}
            {whereYouSit.top.length > 0 ? whereYouSit.top.join(" and ") : "several things"} together
            {whereYouSit.fraction !== null
              ? ` — about ${whereYouSit.fraction}% of the community reads the street differently.`
              : "."}
          </p>
        )}
        <p className="v2-seam-text">
          {whereYouSitSeam(aggregate.result?.verified.length ?? 0)}{" "}
          <a href="#/how">the long version →</a>
        </p>
      </div>

      <div className="v2-summary">
        <h3>Leave</h3>
        <p className="muted small">
          Everything above lives in your own pod — leaving takes it with you, and the export is real
          because there is nothing else to export. In this demo, closing the tab erases it all:
          nothing you typed left this browser. Anything already carried into a signed shared future
          stays in that record — that is said before it happens, never discovered after.
        </p>
      </div>
    </section>
  );
}
