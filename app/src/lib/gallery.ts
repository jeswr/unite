// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Futures-gallery routing (S4 — docs/SCOPE-DIFFERENTIATION.md §4.4): whole
// vision narratives routed by the CONTACT PRIOR (design/03 §2; Allport 1954,
// Pettigrew & Tropp 2006 — contact through shared needs): prefer visions from
// OUTSIDE the viewer's opinion neighbourhood whose authors OVERLAP the
// viewer's need profile — shared needs first, the narrative second.
// Deliberately NEVER engagement-ranked; deterministic throughout. Flagged
// honest-speculative in the doc's §9 (Mutz 2006's participation/exposure
// trade-off — measure, don't assume).
//
// The need-profile overlap is computed over Max-Neef/scheme CONCEPTS (the
// needs/satisfiers split): two people share a need profile when the needs
// they authored or resonated with instantiate the same fundamental-need
// concepts — exactly the "shared needs" the gallery leads with.

import { STANCE_RESONATES } from "./fut.js";
import type { Need, Resonance } from "./model.js";
import type { VisionStatement } from "./model-society.js";
import { buildMatrix, cluster } from "./ranking.js";

/** One routed gallery entry: the vision + the contact evidence to lead with. */
export interface GalleryEntry {
  readonly vision: VisionStatement;
  /** True when the author sits in a DIFFERENT opinion cluster than the viewer. */
  readonly acrossTheDivide: boolean;
  /** The need-concept IRIs the viewer and the author share (may be empty). */
  readonly sharedNeedConcepts: readonly string[];
}

/** Options for {@link routeGallery}. */
export interface RouteGalleryOptions {
  readonly viewer: string;
  /** The VERIFIED participant WebIDs (the aggregate's set). */
  readonly participants: readonly string[];
  /** The aggregated needs (profile + clustering universe). */
  readonly needs: readonly Need[];
  /** The aggregated visions to route. */
  readonly visions: readonly VisionStatement[];
  /** ALL deduped resonances (need votes → clusters + profiles). */
  readonly resonances: readonly Resonance[];
  readonly k?: number;
}

/**
 * A participant's need-concept profile: the concepts of needs they AUTHORED
 * plus needs they RESONATED with (a positive stance is endorsement of the
 * need — conflict/unsure do not put a concept in your profile).
 */
export function needProfile(
  webId: string,
  needs: readonly Need[],
  resonances: readonly Resonance[],
): ReadonlySet<string> {
  const byId = new Map(needs.map((n) => [n.id, n]));
  const out = new Set<string>();
  for (const n of needs) {
    if (n.creator === webId) out.add(n.needConcept);
  }
  for (const r of resonances) {
    if (r.creator !== webId) continue;
    if (r.stance !== STANCE_RESONATES) continue;
    const n = byId.get(r.onStatement);
    if (n) out.add(n.needConcept);
  }
  return out;
}

/**
 * Route the gallery for a viewer. Pure + deterministic ordering:
 *
 *  1. The viewer's OWN visions are excluded (the gallery is for meeting others).
 *  2. Entries sort by:
 *       a. across-the-divide DESC — outside your opinion neighbourhood first;
 *       b. shared-need-concept count DESC — the contact prior's overlap;
 *       c. created DESC (newest), then vision IRI ASC — total tie-breaks.
 *  3. A viewer outside the clustering still gets (b)+(c) — overlap-led order —
 *     with `acrossTheDivide` false for every entry (no cluster to differ from,
 *     honestly rendered by the view as "opinion groups not established yet").
 */
export function routeGallery(options: RouteGalleryOptions): GalleryEntry[] {
  const k = options.k ?? 2;
  const { viewer, participants, needs, visions, resonances } = options;

  const needsMatrix = buildMatrix(
    participants,
    needs.map((n) => n.id),
    resonances,
  );
  const clustering = cluster(needsMatrix, k);
  const clusterOf = (webId: string): number | null => {
    const i = needsMatrix.participants.indexOf(webId);
    if (i < 0) return null;
    return clustering.assignments[i] ?? null;
  };
  const viewerCluster = clusterOf(viewer);
  const viewerProfile = needProfile(viewer, needs, resonances);

  const entries: GalleryEntry[] = [];
  for (const vision of visions) {
    if (vision.creator === viewer) continue;
    const authorCluster = clusterOf(vision.creator);
    const acrossTheDivide =
      viewerCluster !== null && authorCluster !== null && authorCluster !== viewerCluster;
    const authorProfile = needProfile(vision.creator, needs, resonances);
    const sharedNeedConcepts = [...viewerProfile].filter((c) => authorProfile.has(c)).sort();
    entries.push({ vision, acrossTheDivide, sharedNeedConcepts });
  }

  entries.sort((a, b) => {
    if (a.acrossTheDivide !== b.acrossTheDivide) return a.acrossTheDivide ? -1 : 1;
    if (b.sharedNeedConcepts.length !== a.sharedNeedConcepts.length) {
      return b.sharedNeedConcepts.length - a.sharedNeedConcepts.length;
    }
    const at = Date.parse(a.vision.created);
    const bt = Date.parse(b.vision.created);
    const aMs = Number.isNaN(at) ? 0 : at;
    const bMs = Number.isNaN(bt) ? 0 : bt;
    if (bMs !== aMs) return bMs - aMs;
    return a.vision.id < b.vision.id ? -1 : a.vision.id > b.vision.id ? 1 : 0;
  });
  return entries;
}
