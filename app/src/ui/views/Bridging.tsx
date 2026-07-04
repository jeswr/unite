// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Common ground: unite's differentiator made visible. Three linked layers over
// the SAME clustering (design/03 §0 §2 §3):
//   • the opinion map — every participant positioned by how they voted
//     (deterministic PCA, lib/projection), coloured by opinion group;
//   • per-group cards — size + the statement each group received best;
//   • the ranked list — needs ordered by CROSS-GROUP agreement (never
//     engagement), each with its actual per-group reception distribution
//     (the design's perception-gap correction — never a bare rank) and an
//     honest common-ground / divisive label.
// Thin over src/lib (rankNeeds / projectParticipants / insights).

import { useMemo, useState } from "react";
import { characterizeReception, topForCluster } from "../../lib/insights.js";
import type { Need } from "../../lib/model.js";
import { projectParticipants } from "../../lib/projection.js";
import { type ClusterDistribution, rankNeeds } from "../../lib/ranking.js";
import type { AggregateState } from "../hooks.js";
import { displayName } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";

const GROUP_NAMES = ["Group A", "Group B", "Group C", "Group D"] as const;

function clusterColor(g: number): string {
  return `var(--u-cluster-${g % 4})`;
}

function DistributionBar({
  dist,
  index,
}: {
  dist: ClusterDistribution;
  index: number;
}): React.JSX.Element {
  const total = Math.max(dist.seen, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="dist">
      <span className="dist-label">
        <span className="swatch" style={{ background: clusterColor(index) }} aria-hidden="true" />
        {GROUP_NAMES[index] ?? `Group ${index + 1}`}
      </span>
      <div
        className="dist-bar"
        title={`resonates ${dist.resonates} · conflicts ${dist.conflicts} · unsure ${dist.unsure} · seen ${dist.seen} of ${dist.size}`}
      >
        <span className="seg seg-res" style={{ width: pct(dist.resonates) }} />
        <span className="seg seg-con" style={{ width: pct(dist.conflicts) }} />
        <span className="seg seg-uns" style={{ width: pct(dist.unsure) }} />
      </div>
      <span className="dist-counts">
        {dist.resonates}✓ {dist.conflicts}✕ {dist.unsure}? · {dist.seen}/{dist.size}
      </span>
    </div>
  );
}

export function Bridging({
  config,
  webId,
  aggregate,
}: {
  config: DeliberationConfig;
  webId: string | null;
  aggregate: AggregateState;
}): React.JSX.Element {
  const { result, loading } = aggregate;
  const [k, setK] = useState(2);
  const identity = sessionIdentity(config, webId);

  const ranking = useMemo(() => {
    if (!result) return null;
    const participants = result.verified.map((v) => v.webId);
    const statements = result.needs.map((n) => n.id);
    return rankNeeds(participants, statements, result.resonances, { k });
  }, [result, k]);

  const points = useMemo(
    () => (ranking ? projectParticipants(ranking.matrix, ranking.clustering) : []),
    [ranking],
  );

  const needById = useMemo(() => {
    const m = new Map<string, Need>();
    for (const n of result?.needs ?? []) m.set(n.id, n);
    return m;
  }, [result]);

  if (!result) {
    return (
      <section className="view">
        <h2 className="view-title">Common ground</h2>
        {loading ? (
          <ul className="cards" aria-hidden="true">
            <li className="skel" />
            <li className="skel" />
          </ul>
        ) : (
          <div className="empty">
            <span className="empty-title">Nothing to map yet</span>
            <p>
              Common ground ranks the aggregated needs — connect a deliberation on the{" "}
              <a href="#/overview">Overview</a> first.
            </p>
          </div>
        )}
      </section>
    );
  }

  const clusterCount = ranking?.clustering.centres.length ?? 0;

  return (
    <section className="view">
      <div className="row-between">
        <div>
          <h2 className="view-title">Common ground</h2>
          <p className="view-lede">
            A need rises here only when it earns positive reception in <em>every</em> opinion group
            — cross-group agreement, not engagement. The actual distribution is always shown, and
            disagreement is labelled, never hidden.
          </p>
        </div>
        <div className="field">
          <span className="muted small">Opinion groups</span>
          <fieldset className="segmented" aria-label="number of opinion groups">
            {[2, 3, 4].map((n) => (
              <button type="button" key={n} aria-pressed={k === n} onClick={() => setK(n)}>
                {n}
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      <div className="bridge-grid">
        <div>
          <ol className="ranked">
            {ranking?.ranked.map((r) => {
              const verdict = characterizeReception(r.perCluster);
              return (
                <li key={r.statement} className={r.rank <= 3 ? "card top-ranked" : "card"}>
                  <span className="rank-badge" role="img" aria-label={`rank ${r.rank}`}>
                    {r.rank}
                  </span>
                  <div className="rank-body">
                    <div className="row-between">
                      <p className="need-content">
                        {needById.get(r.statement)?.content ?? r.statement}
                      </p>
                      <span
                        className="score"
                        title="bridging score — the product over groups of the smoothed per-group agreement"
                      >
                        {r.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="chip-row">
                      {verdict === "common-ground" && (
                        <span className="badge gold">common ground</span>
                      )}
                      {verdict === "divisive" && <span className="badge con">divisive</span>}
                      {r.totalSeen === 0 && <span className="badge">no reactions yet</span>}
                    </div>
                    <div className="dists">
                      {r.perCluster.map((dist, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — the index IS the cluster identity.
                        <DistributionBar key={`${r.statement}-${i}`} dist={dist} index={i} />
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {ranking && ranking.ranked.length === 0 && (
            <div className="empty">
              <span className="empty-title">No ranked needs yet</span>
              <p>Share some needs and reactions first — the map draws itself from real votes.</p>
            </div>
          )}
        </div>

        <div className="view" style={{ gap: "0.75rem" }}>
          <div className="panel">
            <h3 className="view-title" style={{ fontSize: "1rem", margin: 0 }}>
              The opinion map
            </h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0.5rem" }}>
              Each dot is a participant, positioned by how they voted (closer = more alike). Colour
              is their opinion group{identity ? " — the gold ring is you" : ""}.
            </p>
            <svg
              className="opinion-map"
              viewBox="-120 -120 240 240"
              role="img"
              aria-label={`opinion map of ${points.length} participants in ${clusterCount} groups`}
            >
              <line className="grid-line" x1="-115" y1="0" x2="115" y2="0" />
              <line className="grid-line" x1="0" y1="-115" x2="0" y2="115" />
              {points.map((p) => (
                <circle
                  key={p.participant}
                  className={p.participant === identity ? "pt you" : "pt"}
                  cx={p.x * 100}
                  cy={-p.y * 100}
                  r="7"
                  fill={clusterColor(p.cluster)}
                >
                  <title>
                    {displayName(p.participant)} ·{" "}
                    {GROUP_NAMES[p.cluster] ?? `Group ${p.cluster + 1}`}
                  </title>
                </circle>
              ))}
            </svg>
            <div className="map-legend">
              {Array.from({ length: clusterCount }, (_, g) => (
                <span key={GROUP_NAMES[g] ?? g}>
                  <span className="swatch" style={{ background: clusterColor(g) }} />
                  {GROUP_NAMES[g] ?? `Group ${g + 1}`} · {ranking?.clustering.sizes[g] ?? 0}
                </span>
              ))}
            </div>
          </div>

          <div className="cluster-cards">
            {Array.from({ length: clusterCount }, (_, g) => {
              const top = ranking ? topForCluster(ranking.ranked, g) : null;
              return (
                <div
                  key={GROUP_NAMES[g] ?? g}
                  className="cluster-card"
                  style={{ "--cluster-color": clusterColor(g) } as React.CSSProperties}
                >
                  <span className="cc-name">{GROUP_NAMES[g] ?? `Group ${g + 1}`}</span>
                  <span className="cc-size">
                    {ranking?.clustering.sizes[g] ?? 0} participant
                    {(ranking?.clustering.sizes[g] ?? 0) === 1 ? "" : "s"}
                  </span>
                  {top && (
                    <p className="cc-top">
                      <span className="muted small">received best:</span>{" "}
                      {needById.get(top.statement)?.content ?? top.statement}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
