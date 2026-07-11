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

import type { CircleReason } from "../lib/circles.js";
import type { DeckEntry } from "../lib/deck.js";
import { DEFAULT_K_THRESHOLD, MAXNEEF_BY_IRI } from "../lib/fut.js";
import { NEED_PHRASES } from "../lib/mirror-draft.js";

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

/** Humanize need-concept IRIs into plain phrases (never a taxonomy label). */
export function humanizeNeedConcepts(iris: readonly string[]): string {
  const phrases = iris
    .map((iri) => {
      const name = MAXNEEF_BY_IRI.get(iri)?.name;
      return name !== undefined ? (NEED_PHRASES[name] ?? name) : null;
    })
    .filter((p): p is string => p !== null)
    .slice(0, 2);
  return phrases.length > 0 ? phrases.join(" and ") : "some of the same things";
}

/**
 * The "why this circle?" seam (03 §6 + 04 §2): a LITERAL restatement of the
 * composition record's reason discriminant — diverse / overflow / cold-start /
 * starter, each honestly labeled. Only the diverse variant may claim
 * diversity (the vacuous-diversity guard is upstream, in lib/circles.ts —
 * this renderer is total over the reason type, so it cannot claim a property
 * the composer didn't record).
 */
export function circleInvitationSeam(reason: CircleReason): string {
  switch (reason.kind) {
    case "diverse":
      return (
        "This circle was put together to span the community's different ways of seeing this — " +
        `you were invited because together you cover it, and you already share ` +
        `${humanizeNeedConcepts(reason.sharedNeedConcepts)}.`
      );
    case "overflow":
      return (
        "Right now this circle is people who see the street pretty similarly — we didn't have " +
        "enough differing voices to pair everyone yet. There are open seats held for people who " +
        "read it differently; the notetaker will route their stories here in the meantime, and " +
        "re-pair when the seats fill."
      );
    case "cold-start":
      return (
        "Nobody here has reacted to anything yet, so there is no opinion map to span — this " +
        `circle was drawn together on what you already care about: ` +
        `${humanizeNeedConcepts(reason.sharedNeedConcepts)}. No diversity is claimed that the ` +
        "composer couldn't check."
      );
    case "starter":
      return (
        "This circle is everyone so far — composition starts when there are enough people to " +
        "compose. It claims nothing it can't yet deliver."
      );
  }
}

/** The story-introduction seam (03 §6 row 2 — the gallery's contact prior). */
export function gallerySeam(
  authorName: string,
  sharedNeedConcepts: readonly string[],
  acrossTheDivide: boolean,
): string {
  const shared = humanizeNeedConcepts(sharedNeedConcepts);
  return acrossTheDivide
    ? `Because ${authorName} cares about some of the same things you do — ${shared} — and sees the street from a different place on the map.`
    : `Because ${authorName} cares about some of the same things you do — ${shared}. Opinion groups aren't established yet, so no divide is claimed.`;
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
