// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B proposals board (S2 — SCOPE-DIFFERENTIATION §3.4): scope A's
// Proposals spine pointed at fut:InfraProposal cards — kind / target /
// blast-radius / breaking badges, the migration story, the running-code link
// (displayed as a link, NEVER fetched or executed by the client — the §7
// security posture), and the same need-portfolio filter. Composing happens in
// the structured wizard on Compose (§3.3); this board reads. Thin over src/lib.

import { useMemo, useState } from "react";
import { PROPOSAL_KIND_LABELS, STAKEHOLDER_ROLE_LABELS } from "../../lib/infra.js";
import type { Need } from "../../lib/model.js";
import { meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName } from "../hooks.js";
import { configReady, type DeliberationConfig } from "../state.js";
import { StanceButtons } from "./StanceButtons.js";
import { TIER_MEANING } from "./Trust.js";

/** Compact display of a target IRI (the last meaningful path segment(s)). */
function targetLabel(iri: string): string {
  try {
    const u = new URL(iri);
    const path = u.pathname.split("/").filter(Boolean);
    const tail = path.slice(-2).join("/");
    return tail ? `${u.hostname}/…/${tail}` : u.hostname;
  } catch {
    return iri;
  }
}

export function InfraProposals({
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
  const [needFilter, setNeedFilter] = useState<string | null>(null);

  const floor = config.participationFloor;
  const mayParticipate = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  const needById = useMemo(() => {
    const m = new Map<string, Need>();
    for (const n of result?.needs ?? []) m.set(n.id, n);
    return m;
  }, [result]);

  const proposals = useMemo(() => {
    const list = [...(result?.infraProposals ?? [])];
    list.sort((a, b) => {
      const d = Date.parse(b.created) - Date.parse(a.created);
      if (!Number.isNaN(d) && d !== 0) return d;
      return a.id < b.id ? -1 : 1;
    });
    return list;
  }, [result]);

  // Needs that ≥1 proposal serves, with counts — the portfolio filter chips.
  const servedNeeds = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of proposals) {
      for (const n of p.motivatedBy) m.set(n, (m.get(n) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }, [proposals]);

  const activeFilter =
    needFilter && servedNeeds.some(([iri]) => iri === needFilter) ? needFilter : null;
  const visible = activeFilter
    ? proposals.filter((p) => p.motivatedBy.includes(activeFilter))
    : proposals;

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <div className="row-between">
        <div>
          <h2 className="view-title">Infrastructure proposals</h2>
          <p className="view-lede">
            Structured changes to shared systems: each names its <em>target</em>, its <em>kind</em>,
            its <em>blast radius</em>, and whether it breaks running implementations — and carries
            running code before it can be endorsed. Endorsement is advisory;{" "}
            <strong>the wire is the ballot box</strong> (see the{" "}
            <a href="#/adoption-board">Adoption board</a>).
          </p>
        </div>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}

      {!mayParticipate && trust.profile !== null && (
        <p className="notice info">
          Reading is open to everyone; <strong>proposing and reacting</strong> here requires a
          vouched membership (tier T{floor} — {TIER_MEANING[floor]}). See the{" "}
          <a href="#/trust">Trust</a> view for how vouching works.
        </p>
      )}

      {mayParticipate && (
        <div>
          <a className="btn primary" href="#/compose">
            Propose an {scope.artifactNoun}
          </a>{" "}
          <span className="muted small">— the structured wizard on Compose</span>
        </div>
      )}

      {/* ── The portfolio filter ────────────────────────────────────────── */}
      {servedNeeds.length > 0 && (
        <fieldset className="chip-row" aria-label="filter by need served">
          <button
            type="button"
            className="chip"
            aria-pressed={activeFilter === null}
            onClick={() => setNeedFilter(null)}
          >
            All <span className="count">{proposals.length}</span>
          </button>
          {servedNeeds.map(([iri, count]) => {
            const need = needById.get(iri);
            const label = need
              ? need.content.length > 48
                ? `${need.content.slice(0, 45)}…`
                : need.content
              : iri;
            return (
              <button
                type="button"
                key={iri}
                className="chip"
                aria-pressed={activeFilter === iri}
                onClick={() => setNeedFilter(activeFilter === iri ? null : iri)}
                title={need?.content ?? iri}
              >
                {label} <span className="count">{count}</span>
              </button>
            );
          })}
        </fieldset>
      )}

      {activeFilter && (
        <p className="notice info">
          <strong>Portfolio:</strong> {visible.length} proposal{visible.length === 1 ? "" : "s"}{" "}
          answering “{needById.get(activeFilter)?.content ?? activeFilter}” — different satisfiers
          for the same need, side by side.
        </p>
      )}

      {/* ── The board ───────────────────────────────────────────────────── */}
      {showSkeletons && (
        <ul className="cards" aria-hidden="true">
          <li className="skel" />
          <li className="skel" />
        </ul>
      )}

      {!showSkeletons && !configReady(config) && (
        <div className="empty">
          <span className="empty-title">Not connected yet</span>
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or switch to the
            demo deliberation to explore how unite works.
          </p>
        </div>
      )}

      {!showSkeletons && result && configReady(config) && proposals.length === 0 && (
        <div className="empty">
          <span className="empty-title">No infrastructure proposals yet</span>
          <p>
            A proposal answers the shared needs on the <a href="#/board">needs board</a>. Be the
            first to propose an {scope.artifactNoun} — the structured wizard is on{" "}
            <a href="#/compose">Compose</a>.
          </p>
        </div>
      )}

      <ul className="cards">
        {visible.map((p) => {
          const author = displayName(p.creator);
          return (
            <li key={p.id} className="card">
              <div className="row-between">
                <strong>{p.title}</strong>
              </div>
              <div className="chip-row">
                {p.proposalKind && (
                  <span className="badge">{PROPOSAL_KIND_LABELS[p.proposalKind]}</span>
                )}
                {p.breakingChange === true && <span className="badge con">breaking</span>}
                {p.breakingChange === false && <span className="badge">non-breaking</span>}
                {p.affectsRole.map((r) => (
                  <span key={r} className="badge" title="blast radius">
                    {STAKEHOLDER_ROLE_LABELS[r]}
                  </span>
                ))}
              </div>
              <p className="need-content">{p.content}</p>
              <div className="chip-row">
                <span className="muted small">targets:</span>
                {p.targetsSystem.map((t) => (
                  <span key={t} className="data" title={t}>
                    {targetLabel(t)}
                  </span>
                ))}
              </div>
              {p.breakingChange === true && p.migrationPath && (
                <p className="muted small">
                  <strong>Migration:</strong> {p.migrationPath}
                </p>
              )}
              {p.referenceImplementation ? (
                <p className="muted small">
                  Running code:{" "}
                  {/* Displayed as a LINK only — the client never fetches or
                      executes a reference implementation (§7). */}
                  <a href={p.referenceImplementation} rel="noopener noreferrer" target="_blank">
                    {targetLabel(p.referenceImplementation)}
                  </a>
                </p>
              ) : (
                <p className="muted small">
                  No running code yet — required before this proposal can be endorsed.
                </p>
              )}
              <div className="chip-row">
                <span className="muted small">serves:</span>
                {p.motivatedBy.map((n) => {
                  const need = needById.get(n);
                  return (
                    <button
                      type="button"
                      key={n}
                      className="chip"
                      title={need?.content ?? n}
                      onClick={() => setNeedFilter(n)}
                    >
                      {need
                        ? need.content.length > 40
                          ? `${need.content.slice(0, 37)}…`
                          : need.content
                        : "a need outside this board"}
                    </button>
                  );
                })}
              </div>
              {p.indirectStakeholders && (
                <p className="muted small">Also affects: {p.indirectStakeholders}</p>
              )}
              <div className="card-meta">
                <span className="avatar" style={{ background: avatarColor(p.creator) }}>
                  {initials(author)}
                </span>
                <span className="who">{author}</span>
                <span className="when">{formatDate(p.created)}</span>
              </div>
              <StanceButtons
                statement={p.id}
                config={config}
                webId={webId}
                trust={trust}
                aggregate={aggregate}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
