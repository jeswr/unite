// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Common ground: unite's differentiator made visible. Three linked layers over
// the SAME clustering (design/03 §0 §2 §3):
//   • the opinion map — every participant positioned by how they voted
//     (deterministic PCA, lib/projection), coloured by opinion group, with a
//     translucent hull drawn per group so the groups read as regions, not a
//     scatter of loose dots;
//   • per-group cards — size + the statement each group received best;
//   • the ranked list — needs ordered by CROSS-GROUP agreement (never
//     engagement), each with its actual per-group reception distribution
//     (the design's perception-gap correction — never a bare rank) and an
//     honest common-ground / divisive label.
// Thin over src/lib (rankNeeds / projectParticipants / insights). The shared
// DistributionBar / GROUP_NAMES / clusterColor live in ../components and are
// re-exported here so the Convergence Room's `import … from "./Bridging.js"`
// keeps working.

import { useMemo, useState } from "react";
import { characterizeReception, topForCluster } from "../../lib/insights.js";
import type { Need } from "../../lib/model.js";
import { projectParticipants } from "../../lib/projection.js";
import { rankNeeds } from "../../lib/ranking.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import {
  clusterColor,
  DistributionBar,
  EmptyState,
  GROUP_NAMES,
  groupName,
  LoadingRows,
  Panel,
  Segmented,
  ViewHeader,
} from "../components.js";
import type { AggregateState } from "../hooks.js";
import { displayName } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";

// Re-exported for the Convergence Room (`import { DistributionBar } from
// "./Bridging.js"`) and any older importer — the canonical implementations now
// live in ../components.
export { clusterColor, DistributionBar, GROUP_NAMES };

/** Format a bridging score to 2 significant figures — analytical, but inviting. */
function formatScore(n: number): string {
  if (n === 0) return "0";
  if (n >= 1) return n.toFixed(1);
  // 2 sig-figs on a (0,1) product: keep it compact (0.42, 0.058, 0.0071).
  return n.toPrecision(2).replace(/0+$/, "").replace(/\.$/, "");
}

interface XY {
  readonly x: number;
  readonly y: number;
}

const crossZ = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** One monotone chain (used for both the lower and upper hull). */
function halfHull(seq: readonly XY[]): XY[] {
  const h: XY[] = [];
  for (const p of seq) {
    while (h.length >= 2) {
      const a = h[h.length - 2] as XY;
      const b = h[h.length - 1] as XY;
      if (crossZ(a, b, p) > 0) break;
      h.pop();
    }
    h.push(p);
  }
  h.pop(); // drop the last point (it's the first of the other chain)
  return h;
}

/** Andrew's monotone-chain convex hull (deterministic; screen coordinates). */
function convexHull(pts: readonly XY[]): XY[] {
  if (pts.length <= 2) return pts.slice();
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const reversed = [...sorted].reverse();
  return halfHull(sorted).concat(halfHull(reversed));
}

/** The hull polygon points, expanded outward from the centroid by `pad`. */
function hullPolygon(pts: readonly XY[], pad: number): string | null {
  if (pts.length < 3) return null;
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull
    .map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return `${(p.x + (dx / len) * pad).toFixed(1)},${(p.y + (dy / len) * pad).toFixed(1)}`;
    })
    .join(" ");
}

/** For a 1–2 point group, the blob circle {cx, cy, r} covering the points + pad. */
function hullBlob(pts: readonly XY[], pad: number): { cx: number; cy: number; r: number } | null {
  if (pts.length === 0 || pts.length >= 3) return null;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + pad + 4;
  return { cx, cy, r };
}

export function Bridging({
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

  // Screen-space points per cluster, for the hull regions.
  const clusterCount = ranking?.clustering.centres.length ?? 0;
  const byCluster = useMemo(() => {
    const groups: XY[][] = Array.from({ length: clusterCount }, () => []);
    for (const p of points) {
      const g = groups[p.cluster];
      if (g) g.push({ x: p.x * 100, y: -p.y * 100 });
    }
    return groups;
  }, [points, clusterCount]);

  if (!result) {
    return (
      <section className="view">
        <ViewHeader title="Common ground" />
        {loading ? (
          <LoadingRows count={2} />
        ) : (
          <EmptyState title="Nothing to map yet">
            <p>
              Common ground ranks the aggregated needs — connect a deliberation on the{" "}
              <a href="#/overview">Overview</a> first.
            </p>
          </EmptyState>
        )}
      </section>
    );
  }

  return (
    <section className="view">
      <ViewHeader
        title="Common ground"
        lede={
          <>
            A need rises here only when it earns positive reception in <em>every</em> opinion group
            — cross-group agreement, not engagement. The actual distribution is always shown, and
            disagreement is labelled, never hidden.
          </>
        }
        actions={
          <div className="u-inline-field">
            <span className="muted small">Opinion groups</span>
            <Segmented
              options={[2, 3, 4] as const}
              value={k}
              onChange={setK}
              label="number of opinion groups"
            />
          </div>
        }
      >
        {/* The cohortLenses seam (S0): only the computed-opinion partition is
            built; a scope whose extra lens hasn't landed says so honestly. */}
        {scope.cohortLenses.includes("role") && (
          <p className="notice info">
            This scope additionally requires the <strong>stakeholder-role lens</strong>{" "}
            (implementers / operators / participants — the same bridging math over the declared role
            partition). It arrives in <strong>S3</strong>; today the map shows computed opinion
            groups only.
          </p>
        )}
        {scope.cohortLenses.includes("tier") && (
          <p className="notice info">
            This scope additionally shows <strong>identity-tier stratified distributions</strong> on
            every ranked statement (T0/T1/T2 — stratify-and-disclose). They arrive in{" "}
            <strong>S4</strong>; today the map shows computed opinion groups only.
          </p>
        )}
      </ViewHeader>

      <div className="bridge-grid">
        <div className="u-ranked-col">
          <h3 className="u-section-title u-col-title">
            Ranked by cross-group agreement
            <span className="muted small u-col-title-note">
              highest bridging score first · not engagement
            </span>
          </h3>
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
                        title={`bridging score ${r.score} — the product over groups of the smoothed per-group agreement`}
                      >
                        {formatScore(r.score)}
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
            <EmptyState title="No ranked needs yet">
              <p>Share some needs and reactions first — the map draws itself from real votes.</p>
            </EmptyState>
          )}
        </div>

        <div className="u-map-col">
          <Panel className="u-map-panel">
            <h3 className="u-section-title u-col-title">The opinion map</h3>
            <p className="muted small u-map-caption">
              Each dot is a participant, placed by how they voted — the closer two dots, the more
              alike their votes; the shaded regions are the opinion groups
              {identity ? ", and the gold ring is you" : ""}.
            </p>
            <div className="u-map-frame">
              <svg
                className="opinion-map"
                viewBox="-130 -130 260 260"
                role="img"
                aria-label={`opinion map of ${points.length} participants in ${clusterCount} groups`}
              >
                <title>opinion map</title>
                {/* Neutral reference crosshair (the PCA axes are abstract — no
                    fake semantic labels; proximity is what carries meaning). */}
                <line className="grid-line" x1="-122" y1="0" x2="122" y2="0" />
                <line className="grid-line" x1="0" y1="-122" x2="0" y2="122" />

                {/* Group regions, drawn under the dots. */}
                {byCluster.map((pts, g) => {
                  const poly = hullPolygon(pts, 13);
                  const blob = hullBlob(pts, 13);
                  const fill = clusterColor(g);
                  if (poly) {
                    return (
                      <polygon
                        // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — index is identity.
                        key={g}
                        className="hull"
                        points={poly}
                        style={{ fill, stroke: fill }}
                      />
                    );
                  }
                  if (blob) {
                    return (
                      <circle
                        // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — index is identity.
                        key={g}
                        className="hull"
                        cx={blob.cx}
                        cy={blob.cy}
                        r={blob.r}
                        style={{ fill, stroke: fill }}
                      />
                    );
                  }
                  return null;
                })}

                {points.map((p) => (
                  <circle
                    key={p.participant}
                    className={p.participant === identity ? "pt you" : "pt"}
                    cx={p.x * 100}
                    cy={-p.y * 100}
                    r="7.5"
                    fill={clusterColor(p.cluster)}
                  >
                    <title>
                      {displayName(p.participant)} · {groupName(p.cluster)}
                    </title>
                  </circle>
                ))}
              </svg>
            </div>
            <ul className="map-legend" aria-label="opinion groups">
              {Array.from({ length: clusterCount }, (_, g) => (
                <li key={groupName(g)} className="u-legend-item">
                  <span className="swatch" style={{ background: clusterColor(g) }} />
                  {groupName(g)} · {ranking?.clustering.sizes[g] ?? 0}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="u-received-panel">
            <h3 className="u-section-title u-received-title">Received best in each group</h3>
            <div className="cluster-cards">
              {Array.from({ length: clusterCount }, (_, g) => {
                const top = ranking ? topForCluster(ranking.ranked, g) : null;
                return (
                  <div
                    key={groupName(g)}
                    className="cluster-card"
                    style={{ "--cluster-color": clusterColor(g) } as React.CSSProperties}
                  >
                    <span className="cc-name">{groupName(g)}</span>
                    <span className="cc-size">
                      {ranking?.clustering.sizes[g] ?? 0} participant
                      {(ranking?.clustering.sizes[g] ?? 0) === 1 ? "" : "s"}
                    </span>
                    {top ? (
                      <p className="cc-top">
                        {needById.get(top.statement)?.content ?? top.statement}
                      </p>
                    ) : (
                      <p className="cc-top muted small">no clear favourite yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
