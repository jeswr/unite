// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// "WHERE YOU SIT" (design/v2 02 §8 notebook §4, 03 §7): the viewer's own map
// position — computed fresh from the community matrix, stored nowhere, shown
// only to them. Extracted pure so the P11 k-floor on the comparison
// percentage is fixture-tested:
//
//   • the viewer's cluster is characterized by its members' TOP need concepts
//     (never a label, never politics — 03 §4);
//   • the "how many read it differently" percentage is a split characterization,
//     so it deanonymizes the viewer if EITHER their own cluster OR its
//     complement is sub-k. It renders ONLY when BOTH clear k (a "80% differ"
//     line over a 2-person own-cluster fingers the viewer's tiny group).

import { DEFAULT_K_THRESHOLD, MAXNEEF_BY_IRI } from "../lib/fut.js";
import { needProfile } from "../lib/gallery.js";
import { NEED_PHRASES } from "../lib/mirror-draft.js";
import type { Need, Resonance } from "../lib/model.js";
import { buildMatrix, cluster } from "../lib/ranking.js";

/** The viewer's map position (community-scale, k-gated, viewer-private). */
export interface WhereYouSit {
  /** Plain-talk phrases for the cluster's top ≤2 need concepts. */
  readonly top: readonly string[];
  /**
   * Percentage of the community in a DIFFERENT cluster — null unless BOTH the
   * viewer's cluster AND its complement clear k (the P11 floor).
   */
  readonly fraction: number | null;
  /** The verified community size (drives the notebook's seam wording). */
  readonly communitySize: number;
}

/** Compute {@link WhereYouSit} for a viewer, or null (not yet on the map). */
export function whereYouSit(options: {
  readonly viewer: string;
  readonly participants: readonly string[];
  readonly needs: readonly Need[];
  readonly resonances: readonly Resonance[];
  readonly k?: number;
}): WhereYouSit | null {
  const k = options.k ?? DEFAULT_K_THRESHOLD;
  const matrix = buildMatrix(
    options.participants,
    options.needs.map((n) => n.id),
    options.resonances,
  );
  const clustering = cluster(matrix, 2);
  const i = matrix.participants.indexOf(options.viewer);
  if (i < 0) return null;
  const g = clustering.assignments[i];
  if (g === undefined) return null;

  const concepts = new Map<string, number>();
  for (let j = 0; j < matrix.participants.length; j++) {
    if (clustering.assignments[j] !== g) continue;
    const who = matrix.participants[j];
    if (who === undefined) continue;
    for (const c of needProfile(who, options.needs, options.resonances)) {
      concepts.set(c, (concepts.get(c) ?? 0) + 1);
    }
  }
  const top = [...concepts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .slice(0, 2)
    .map(([iri]) => {
      const name = MAXNEEF_BY_IRI.get(iri)?.name;
      return name !== undefined ? (NEED_PHRASES[name] ?? name) : null;
    })
    .filter((p): p is string => p !== null);

  const size = clustering.sizes[g] ?? 0;
  const others = matrix.participants.length - size;
  // P11: BOTH sides must clear k or no split percentage renders.
  const fraction =
    size >= k && others >= k ? Math.round((others / matrix.participants.length) * 100) : null;
  return { top, fraction, communitySize: matrix.participants.length };
}
