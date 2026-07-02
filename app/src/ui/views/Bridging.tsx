// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Bridging view: needs ranked by CROSS-CLUSTER agreement (design/03 §0 §3), not
// engagement. Always shows the actual per-cluster distribution (the design's
// perception-gap correction — never a bare rank). Thin over src/lib (rankNeeds).

import { useMemo } from "react";
import type { Need } from "../../lib/model.js";
import { type ClusterDistribution, rankNeeds } from "../../lib/ranking.js";
import type { AggregateState } from "../hooks.js";

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
        Cluster {index + 1} (n={dist.size})
      </span>
      <div
        className="dist-bar"
        title={`resonates ${dist.resonates} · conflicts ${dist.conflicts} · unsure ${dist.unsure} · seen ${dist.seen}`}
      >
        <span className="seg seg-res" style={{ width: pct(dist.resonates) }} />
        <span className="seg seg-con" style={{ width: pct(dist.conflicts) }} />
        <span className="seg seg-uns" style={{ width: pct(dist.unsure) }} />
      </div>
      <span className="dist-counts small muted">
        {dist.resonates}✓ {dist.conflicts}✗ {dist.unsure}? · {dist.seen} seen
      </span>
    </div>
  );
}

export function Bridging({ aggregate }: { aggregate: AggregateState }): React.JSX.Element {
  const { result } = aggregate;

  const ranking = useMemo(() => {
    if (!result) return null;
    const participants = result.verified.map((v) => v.webId);
    const statements = result.needs.map((n) => n.id);
    return rankNeeds(participants, statements, result.resonances);
  }, [result]);

  const needById = useMemo(() => {
    const m = new Map<string, Need>();
    for (const n of result?.needs ?? []) m.set(n.id, n);
    return m;
  }, [result]);

  if (!result) {
    return (
      <section className="view">
        <h2>Bridging view</h2>
        <p className="muted">Load the needs board first — bridging ranks the aggregated needs.</p>
      </section>
    );
  }

  return (
    <section className="view">
      <h2>Bridging view</h2>
      <p className="muted">
        Ranked by cross-cluster agreement — a need rises only when it earns positive reception in
        every opinion cluster. The distribution is always shown.
      </p>

      <ol className="ranked">
        {ranking?.ranked.map((r) => (
          <li key={r.statement} className="card">
            <div className="row-between">
              <p className="need-content">{needById.get(r.statement)?.content ?? r.statement}</p>
              <span className="score" title="bridging score">
                {r.score.toFixed(3)}
              </span>
            </div>
            <div className="dists">
              {r.perCluster.map((dist, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cluster order is stable — the index IS the cluster identity.
                <DistributionBar key={`${r.statement}-${i}`} dist={dist} index={i} />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {ranking && ranking.ranked.length === 0 && (
        <p className="muted">No ranked needs yet — aggregate some needs and resonances first.</p>
      )}
    </section>
  );
}
