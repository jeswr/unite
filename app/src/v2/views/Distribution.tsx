// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// ELICIT-BEFORE-EXPOSE (design/v2 02 §5, 03 §5 — P4/P11): the distribution
// component renders NOTHING before the viewer's own reaction (anti-herding:
// Muchnik 2013; Salganik 2006), and below the k-threshold it renders the
// honest count-free fallback instead of numbers. Once the viewer has reacted
// AND the statement's community-wide reception clears k, the REAL
// distribution renders (the v1 anti-false-polarization rule, sequenced).
// Fixture-pinned in Distribution.test.tsx (07 §5 P4 + P11 rows).

import { DEFAULT_K_THRESHOLD } from "../../lib/fut.js";

/** A community-scale reaction tally for one statement (latest-wins deduped). */
export interface ReactionTally {
  readonly resonates: number;
  readonly conflicts: number;
  readonly unsure: number;
}

/** The count-free sub-k fallback line (02 §5 — exact copy, test-pinned). */
export const BELOW_K_FALLBACK = "A few people have weighed in — numbers appear once enough have.";

export function Distribution({
  tally,
  viewerReacted,
  k = DEFAULT_K_THRESHOLD,
}: {
  /** The community-scale tally (never a circle-interior count — 03 §4). */
  tally: ReactionTally | null;
  /** Has THIS viewer voiced their own take on the statement? */
  viewerReacted: boolean;
  k?: number;
}): React.JSX.Element | null {
  // P4: elicit first — no group shape before the viewer's own signal.
  if (!viewerReacted || tally === null) return null;
  const total = tally.resonates + tally.conflicts + tally.unsure;
  // P11: below k, count-free honesty instead of fuzz-theater.
  if (total < k) {
    return <p className="muted small">{BELOW_K_FALLBACK}</p>;
  }
  const parts: string[] = [];
  parts.push(`${tally.resonates} resonate${tally.resonates === 1 ? "s" : ""}`);
  if (tally.conflicts > 0) {
    parts.push(`${tally.conflicts} ${tally.conflicts === 1 ? "sees" : "see"} it differently`);
  }
  if (tally.unsure > 0) parts.push(`${tally.unsure} not sure`);
  return <p className="muted small">Across the community: {parts.join(" · ")}.</p>;
}
