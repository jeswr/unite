// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Needs board: the deliberation's aggregated needs (client-side aggregation
// over participant pods) with per-need tri-state resonance, live reaction
// counts, your current stance, and filter/search/sort. A resonance is written
// to YOUR OWN pod (or the sandboxed demo pod) then the board refreshes. Thin
// over src/lib.

import { useMemo, useState } from "react";
import {
  MAXNEEF_BY_IRI,
  STANCE_CONFLICTS,
  STANCE_RESONATES,
  STANCE_UNSURE,
  type Stance,
} from "../../lib/fut.js";
import type { Need, Resonance } from "../../lib/model.js";
import { writeResonance } from "../../lib/pod.js";
import { meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName, writeSessionFor } from "../hooks.js";
import { configReady, type DeliberationConfig, sessionIdentity } from "../state.js";

const STANCE_META: { stance: Stance; label: string; glyph: string; cls: string }[] = [
  { stance: STANCE_RESONATES, label: "Resonates", glyph: "✓", cls: "res" },
  { stance: STANCE_CONFLICTS, label: "Conflicts", glyph: "✕", cls: "con" },
  { stance: STANCE_UNSURE, label: "Unsure", glyph: "?", cls: "uns" },
];

function conceptLabel(iri: string): string {
  return MAXNEEF_BY_IRI.get(iri)?.label ?? iri.split(/[#/]/).pop() ?? iri;
}

/** Per-statement reaction tallies + the viewer's own stance. */
export interface NeedTally {
  readonly resonates: number;
  readonly conflicts: number;
  readonly unsure: number;
  readonly yours?: Stance;
}

/** Tally deduped resonances by statement (and mark the viewer's own stance). */
export function tallyResonances(
  resonances: readonly Resonance[],
  viewer: string | null,
): Map<string, NeedTally> {
  const out = new Map<
    string,
    { resonates: number; conflicts: number; unsure: number; yours?: Stance }
  >();
  for (const r of resonances) {
    let t = out.get(r.onStatement);
    if (!t) {
      t = { resonates: 0, conflicts: 0, unsure: 0 };
      out.set(r.onStatement, t);
    }
    if (r.stance === STANCE_RESONATES) t.resonates++;
    else if (r.stance === STANCE_CONFLICTS) t.conflicts++;
    else t.unsure++;
    if (viewer !== null && r.creator === viewer) t.yours = r.stance;
  }
  return out;
}

type SortKey = "newest" | "intensity" | "reactions";

export function NeedsBoard({
  scope,
  config,
  webId,
  trust,
  aggregate,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
}): React.JSX.Element {
  const controller = useController();
  const { result, loading, error, refresh } = aggregate;
  const [busy, setBusy] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [conceptFilter, setConceptFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");

  const identity = sessionIdentity(config, webId);
  // The design/04 §4.1 participant gate also covers REACTING in floor-1 scopes
  // (the aggregate would silently drop an unvouched reaction — better an honest
  // lock than a vote that never counts). Fail-closed while resolving (null).
  const floor = config.participationFloor;
  const canReact = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));
  const tallies = useMemo(
    () => tallyResonances(result?.resonances ?? [], identity),
    [result, identity],
  );

  // Concepts present on the board, with counts (the filter chips).
  const concepts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of result?.needs ?? []) m.set(n.needConcept, (m.get(n.needConcept) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }, [result]);

  // The EFFECTIVE filter: a stale selection (its concept vanished from the live
  // data) is treated as no-filter, so the board can never stick on an
  // un-clearable "Nothing matches" after a live update removes a concept.
  const activeFilter =
    conceptFilter && concepts.some(([iri]) => iri === conceptFilter) ? conceptFilter : null;

  const visible = useMemo(() => {
    let needs = [...(result?.needs ?? [])];
    if (activeFilter) needs = needs.filter((n) => n.needConcept === activeFilter);
    const q = query.trim().toLowerCase();
    if (q) needs = needs.filter((n) => n.content.toLowerCase().includes(q));
    needs.sort((a, b) => {
      if (sort === "intensity") {
        const d = (b.intensity ?? 0) - (a.intensity ?? 0);
        if (d !== 0) return d;
      }
      if (sort === "reactions") {
        const ta = tallies.get(a.id);
        const tb = tallies.get(b.id);
        const d =
          (tb ? tb.resonates + tb.conflicts + tb.unsure : 0) -
          (ta ? ta.resonates + ta.conflicts + ta.unsure : 0);
        if (d !== 0) return d;
      }
      const d = Date.parse(b.created) - Date.parse(a.created);
      if (!Number.isNaN(d) && d !== 0) return d;
      return a.id < b.id ? -1 : 1;
    });
    return needs;
  }, [result, activeFilter, query, sort, tallies]);

  async function resonate(need: Need, stance: Stance): Promise<void> {
    setWriteError(null);
    if (!identity) {
      setWriteError("Sign in to react — your resonance is stored in your own pod.");
      return;
    }
    if (!canReact) {
      setWriteError(
        `Reacting here requires identity tier T${floor} (a vouched membership) — see the Trust view.`,
      );
      return;
    }
    setBusy(need.id);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const resonance: Omit<Resonance, "id"> = {
        onStatement: need.id,
        stance,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
      };
      await writeResonance(session.fetch, session.ownBase, resonance);
      await refresh();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <div className="row-between">
        <div>
          <h2 className="view-title">Needs board</h2>
          <p className="view-lede">
            Every card is read live from its author's own pod. React honestly — one voice per person
            per statement; changing your mind replaces your earlier reaction.
          </p>
        </div>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="board-toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search needs…"
          aria-label="search needs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label
          className="field"
          style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}
        >
          <span className="muted small">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Newest</option>
            <option value="intensity">Intensity</option>
            <option value="reactions">Most reactions</option>
          </select>
        </label>
      </div>

      {concepts.length > 1 && (
        <fieldset className="chip-row" aria-label="filter by need">
          <button
            type="button"
            className="chip"
            aria-pressed={activeFilter === null}
            onClick={() => setConceptFilter(null)}
          >
            All <span className="count">{result?.needs.length ?? 0}</span>
          </button>
          {concepts.map(([iri, count]) => (
            <button
              type="button"
              key={iri}
              className="chip"
              aria-pressed={activeFilter === iri}
              onClick={() => setConceptFilter(activeFilter === iri ? null : iri)}
            >
              {conceptLabel(iri)} <span className="count">{count}</span>
            </button>
          ))}
        </fieldset>
      )}

      {error && <p className="notice error">{error}</p>}
      {writeError && <p className="notice error">{writeError}</p>}

      {!canReact && trust.profile !== null && (
        <p className="notice info">
          Reading is open to everyone; <strong>reacting</strong> in this scope requires a vouched
          membership (tier T{floor}) so tallies stay attributable. See the{" "}
          <a href="#/trust">Trust</a> view for how vouching works.
        </p>
      )}

      {result && result.errors.length > 0 && (
        <details className="sources">
          <summary>
            {result.errors.length} source{result.errors.length === 1 ? "" : "s"} could not be read
            (skipped — one broken pod never sinks the board)
          </summary>
          <ul>
            {result.errors.map((e) => (
              <li key={`${e.webId}-${e.stage}-${e.resource ?? ""}`}>
                <code>{e.resource ?? e.base}</code> — {e.stage}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {showSkeletons && (
        <ul className="cards" aria-hidden="true">
          <li className="skel" />
          <li className="skel" />
          <li className="skel" />
        </ul>
      )}

      {/* An incomplete pod config clears `result` to null (fail-closed refresh),
          so this guidance must NOT require an aggregate result to render. */}
      {!showSkeletons && !configReady(config) && (
        <div className="empty">
          <span className="empty-title">Not connected yet</span>
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or switch to the
            demo deliberation to explore how unite works.
          </p>
        </div>
      )}

      {!showSkeletons && result && configReady(config) && result.needs.length === 0 && (
        <div className="empty">
          <span className="empty-title">No needs shared yet</span>
          <p>
            Be the first voice: share a {scope.artifactNoun} and it appears here for every
            participant, straight from your pod.
          </p>
          <a className="btn primary" href="#/compose">
            Add your voice
          </a>
        </div>
      )}

      {!showSkeletons && visible.length === 0 && (result?.needs.length ?? 0) > 0 && (
        <div className="empty">
          <span className="empty-title">Nothing matches</span>
          <p>No needs match the current search/filter.</p>
        </div>
      )}

      <ul className="cards">
        {visible.map((need) => {
          const tally = tallies.get(need.id);
          const author = displayName(need.creator);
          return (
            <li key={need.id} className="card">
              <p className="need-content">{need.content}</p>
              <div className="card-meta">
                <span className="avatar" style={{ background: avatarColor(need.creator) }}>
                  {initials(author)}
                </span>
                <span className="who">{author}</span>
                <span className="badge concept">{conceptLabel(need.needConcept)}</span>
                {need.intensity !== undefined && (
                  <span
                    className="intensity-dots"
                    role="img"
                    title={`intensity ${need.intensity}/5`}
                    aria-label={`intensity ${need.intensity} of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i key={n} className={n <= (need.intensity ?? 0) ? "on" : ""} />
                    ))}
                  </span>
                )}
                <span className="when">{formatDate(need.created)}</span>
              </div>
              <div className="stances">
                {STANCE_META.map(({ stance, label, glyph, cls }) => (
                  <button
                    type="button"
                    key={stance}
                    className={`stance ${cls}`}
                    aria-pressed={tally?.yours === stance}
                    disabled={busy === need.id || !canReact}
                    title={
                      canReact
                        ? undefined
                        : `Reacting requires a vouched membership (T${floor}) in this scope`
                    }
                    onClick={() => resonate(need, stance)}
                  >
                    <span aria-hidden="true">{glyph}</span> {label}
                    <span className="n">
                      {stance === STANCE_RESONATES
                        ? (tally?.resonates ?? 0)
                        : stance === STANCE_CONFLICTS
                          ? (tally?.conflicts ?? 0)
                          : (tally?.unsure ?? 0)}
                    </span>
                  </button>
                ))}
                {tally?.yours && <span className="yours">your current reaction is marked</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
