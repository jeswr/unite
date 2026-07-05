// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Futures gallery (S4 — docs/SCOPE-DIFFERENTIATION.md §4.4): whole vision
// narratives, routed by the CONTACT PRIOR (lib/gallery.ts; design/03 §2 —
// Allport 1954, Pettigrew & Tropp 2006): visions from OUTSIDE your opinion
// neighbourhood whose authors share your need profile come first — the
// SHARED NEEDS lead, the narrative follows. Deliberately never
// engagement-ranked. Reading is open; there is nothing to "like" here — the
// gallery is for meeting a person's whole story, reactions happen on the
// atoms (the deck). Thin over src/lib.

import { useMemo } from "react";
import { MAXNEEF_BY_IRI } from "../../lib/fut.js";
import { VISION_SCOPE_BY_IRI } from "../../lib/fut-society.js";
import { routeGallery } from "../../lib/gallery.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { EmptyState, LoadingRows, Notice, ViewHeader } from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState } from "../hooks.js";
import { displayName } from "../hooks.js";
import { configReady, type DeliberationConfig, sessionIdentity } from "../state.js";
import { TierStrip } from "./Deck.js";

function conceptLabel(iri: string): string {
  return MAXNEEF_BY_IRI.get(iri)?.label ?? iri.split(/[#/]/).pop() ?? iri;
}

export function FuturesGallery({
  scope,
  config,
  webId,
  aggregate,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  aggregate: AggregateState;
}): React.JSX.Element {
  const { result, loading, error, refresh } = aggregate;
  const identity = sessionIdentity(config, webId);

  const entries = useMemo(() => {
    if (!result || !identity) return [];
    return routeGallery({
      viewer: identity,
      participants: result.verified.map((v) => v.webId),
      needs: result.needs,
      visions: result.visions,
      resonances: result.resonances,
    });
  }, [result, identity]);

  const tierOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of result?.verified ?? []) m.set(v.webId, v.tier);
    return m;
  }, [result]);

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <ViewHeader
        title="Futures gallery"
        lede={
          <>
            Whole stories, not soundbites — routed by <em>contact</em>: futures from outside your
            opinion neighbourhood, written by people who share your needs. The shared needs come
            first; the narrative second. Never ranked by engagement.
          </>
        }
        actions={
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {result && <TierStrip verified={result.verified} />}

      {showSkeletons && <LoadingRows count={2} />}

      {!showSkeletons && !configReady(config) && (
        <EmptyState title="Not connected yet">
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or explore the
            seeded demo deliberation.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && configReady(config) && result.visions.length === 0 && (
        <EmptyState title="No shared futures yet">
          <p>
            The gallery shows whole vision narratives — <a href="#/compose">share yours</a>; only
            what its author chose to share leaves a pod, under the author's consent policy.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && entries.length === 0 && result.visions.length > 0 && (
        <EmptyState title="Only your own visions are here so far">
          <p>The gallery routes you to OTHER people's futures — none have been shared yet.</p>
        </EmptyState>
      )}

      <ul className="cards">
        {entries.map(({ vision, acrossTheDivide, sharedNeedConcepts }) => {
          const author = displayName(vision.creator);
          const scopeConcept = vision.scope ? VISION_SCOPE_BY_IRI.get(vision.scope) : undefined;
          return (
            <li key={vision.id} className="card">
              {/* Shared needs FIRST (the contact prior's whole point). */}
              <div className="chip-row">
                {acrossTheDivide && (
                  <span
                    className="badge gold"
                    title="This author sits in a different opinion group than you"
                  >
                    across the divide
                  </span>
                )}
                {sharedNeedConcepts.length > 0 ? (
                  <>
                    <span className="muted small">you both need:</span>
                    {sharedNeedConcepts.map((c) => (
                      <span key={c} className="chip" title={c}>
                        {conceptLabel(c)}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="muted small">no shared needs mapped yet</span>
                )}
              </div>
              {vision.title && <strong>{vision.title}</strong>}
              <p className="need-content">{vision.content}</p>
              <div className="card-meta">
                <span className="avatar" style={{ background: avatarColor(vision.creator) }}>
                  {initials(author)}
                </span>
                <span className="who">{author}</span>
                {tierOf.get(vision.creator) === "T0" && (
                  <span
                    className="badge"
                    title="An unvouched, honestly-labelled pseudonymous voice"
                  >
                    pseudonymous voice (T0)
                  </span>
                )}
                {scopeConcept && <span className="badge">for {scopeConcept.label}</span>}
                {vision.horizon && <span className="badge">by {vision.horizon}</span>}
                <span className="when">{formatDate(vision.created)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {entries.length > 0 && (
        <p className="muted small">
          Routing is deterministic and engagement-blind: different-group first, then shared-need
          overlap ({scope.artifactNoun}s you already told the deliberation about). Your own map
          position is visible only to you.
        </p>
      )}
    </section>
  );
}
