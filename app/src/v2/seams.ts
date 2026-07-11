// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE WHY-SEAM (design/v2 03 §6): every machine-made object carries exactly
// one quiet "why this? ›" affordance, and its answer is a LITERAL RESTATEMENT
// of engine fields — the determinism makes seams exact, not narrative. These
// are the sentence templates for the V0–V2 surfaces (circle invitation /
// expert / nudge seams arrive with their phases). Every seam ends with the
// long-version pointer to How-unite-listens (in-flow stays one sentence —
// Kizilcec's inverted-U; depth is one deliberate tap away).
//
// The k rule rides here too (P11): the summary-line seam names a number ONLY
// at/above k; below it the honest count-free line renders instead. And at
// circle scale the differ seam carries NO headcounts at all (03 §4).

import type { DeckEntry } from "../lib/deck.js";
import { DEFAULT_K_THRESHOLD } from "../lib/fut.js";

/** The standing long-version suffix — the view links it to #/how. */
export const LONG_VERSION_LABEL = "the long version";

/** The seam for a peer-statement beat (DeckEntry's fields, restated). */
export function deckBeatSeam(
  entry: Pick<DeckEntry, "ownClusterSeen" | "neighbourResonance">,
): string {
  const first =
    entry.ownClusterSeen === 0
      ? "Because people in your part of the map haven't weighed in on this"
      : "Because few in your part of the map have weighed in on this";
  const second =
    entry.neighbourResonance > 0.5
      ? ", and people who usually read the street differently found it rang true."
      : ".";
  return `${first}${second}`;
}

/** The seam for a summary line (k-gated: numbers only at/above k). */
export function summaryLineSeam(seen: number, k: number = DEFAULT_K_THRESHOLD): string {
  if (seen >= k) {
    return `Said in different ways by ${seen} people across both parts of the map — tap to read the words it came from.`;
  }
  return "A few people have spoken to this — it stays uncounted until enough have.";
}

/** The differ-block seam — no headcounts at circle scale (03 §4). */
export function differSeam(): string {
  return (
    "This circle holds two sincere readings of this — both shown in their own words; " +
    "nobody's view was averaged away."
  );
}

/** The "still forming" seam — the engine's null verdict, glossed honestly. */
export function stillFormingSeam(): string {
  return "Not enough said yet to know how this lands — no direction is implied by that.";
}

/** The garden's seam (community-scale, non-numeric by design). */
export function gardenSeam(): string {
  return (
    "Each glow is a group of people who tend to read the street the same way; a bridge is " +
    "something both groups stood behind. No counts, no trends, no individual positions — " +
    "your own place on the map is in your notebook, visible only to you."
  );
}

/** The notebook's "where you sit" seam (k-gated, community-scale only). */
export function whereYouSitSeam(communitySize: number, k: number = DEFAULT_K_THRESHOLD): string {
  const base =
    "Computed fresh from your reactions each time you look — it is stored nowhere. " +
    "Not you? Revise any reaction below and this moves with it.";
  if (communitySize < k) {
    return `${base} The community is still too small to say how many read it differently.`;
  }
  return base;
}
