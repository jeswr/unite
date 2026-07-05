// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Resonance deck (S4 — docs/SCOPE-DIFFERENTIATION.md §4.4): scope C's
// PRIMARY reaction surface. One claim at a time — resonates / conflicts /
// unsure — dealt by the deterministic cross-cluster router (lib/deck.ts):
// statements your opinion group hasn't assessed that neighbouring groups
// resonated with come first. NO REPLIES ANYWHERE — reactions, not threads
// (Sunstein 2002); critique happens only in the Convergence Room, on
// candidates. Tier composition is disclosed honestly (stratify-and-disclose,
// critique C3). Thin over src/lib.

import { useMemo } from "react";
import { routeDeck } from "../../lib/deck.js";
import type { Claim } from "../../lib/model-society.js";
import { meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { EmptyState, LoadingRows, Notice, ViewHeader } from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName } from "../hooks.js";
import { configReady, type DeliberationConfig, sessionIdentity } from "../state.js";
import { StanceButtons } from "./StanceButtons.js";
import { TIER_MEANING } from "./Trust.js";

/**
 * The tier-composition strip (stratify-and-disclose — critique C3): how many
 * verified voices sit at each identity tier. Scope C admits T0, so the mix is
 * ALWAYS shown where reactions happen — pseudonymous voice counts, labelled.
 */
export function TierStrip({
  verified,
}: {
  verified: readonly { readonly tier: string }[];
}): React.JSX.Element {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of verified) m.set(v.tier, (m.get(v.tier) ?? 0) + 1);
    return ["T0", "T1", "T2"].map((t) => ({ tier: t, count: m.get(t) ?? 0 }));
  }, [verified]);
  return (
    <p className="muted small" role="note" aria-label="tier composition">
      Voices by identity tier:{" "}
      {counts.map((c, i) => (
        <span key={c.tier}>
          {i > 0 && " · "}
          <strong>
            {c.tier}: {c.count}
          </strong>{" "}
          ({TIER_MEANING[Number(c.tier.slice(1)) as 0 | 1 | 2]})
        </span>
      ))}{" "}
      — pseudonymous voice counts, and it is disclosed, never hidden.
    </p>
  );
}

export function Deck({
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
  const { result, loading, error, refresh } = aggregate;
  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;
  const mayReact = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  const claimById = useMemo(() => {
    const m = new Map<string, Claim>();
    for (const c of result?.claims ?? []) m.set(c.id, c);
    return m;
  }, [result]);

  // The routed queue: claims the viewer hasn't reacted to, cross-cluster first.
  const queue = useMemo(() => {
    if (!result || !identity) return [];
    return routeDeck({
      viewer: identity,
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      deckStatements: result.claims.map((c) => c.id),
      resonances: result.resonances,
    });
  }, [result, identity]);

  const top = queue[0];
  const card = top ? claimById.get(top.statement) : undefined;
  const tierOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of result?.verified ?? []) m.set(v.webId, v.tier);
    return m;
  }, [result]);

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <ViewHeader
        title="Resonance deck"
        lede={
          <>
            One claim at a time. The deck deals you what your opinion group hasn't assessed yet —
            preferring claims <em>other</em> groups resonated with, so potential common ground
            surfaces instead of each group's own favourites. Reactions only —{" "}
            <strong>no replies anywhere</strong>.
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

      {showSkeletons && <LoadingRows count={1} />}

      {!showSkeletons && !configReady(config) && (
        <EmptyState title="Not connected yet">
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or explore the
            seeded demo deliberation.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && configReady(config) && (result.claims.length ?? 0) === 0 && (
        <EmptyState title="No claims yet">
          <p>
            Claims are split out of whole visions — <a href="#/compose">share a vision</a> and adopt
            its atoms; each adopted claim deals onto everyone's deck.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && configReady(config) && result.claims.length > 0 && !card && (
        <EmptyState title="Deck cleared — you've seen every claim">
          <p>
            You reacted to all {result.claims.length} claim
            {result.claims.length === 1 ? "" : "s"} here. See where the groups stand on{" "}
            <a href="#/bridge">Common ground</a>, or <a href="#/compose">add your own vision</a>.
          </p>
        </EmptyState>
      )}

      {card && top && (
        <article className="card" aria-label="the dealt claim">
          <p className="need-content" style={{ fontSize: "1.15rem" }}>
            {card.content}
          </p>
          <div className="card-meta">
            <span className="avatar" style={{ background: avatarColor(card.creator) }}>
              {initials(displayName(card.creator))}
            </span>
            <span className="who">{displayName(card.creator)}</span>
            {tierOf.get(card.creator) === "T0" && (
              <span className="badge" title="An unvouched, honestly-labelled pseudonymous voice">
                pseudonymous voice (T0)
              </span>
            )}
            <span className="when">{formatDate(card.created)}</span>
          </div>
          {top.neighbourResonance > 0.5 && top.ownClusterSeen === 0 && (
            <p className="muted small">
              Dealt to you because another opinion group resonated with this and yours hasn't
              assessed it yet.
            </p>
          )}
          <StanceButtons
            statement={card.id}
            config={config}
            webId={webId}
            trust={trust}
            aggregate={aggregate}
          />
          <p className="muted small">
            {queue.length - 1} more in your deck ·{" "}
            {mayReact
              ? "reacting writes to your own pod, one voice per person"
              : `reacting requires tier T${floor} in this ${scope.id} community`}
          </p>
        </article>
      )}
    </section>
  );
}
