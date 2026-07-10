// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded demo circle (design/v2 02 §2, 06 §2): the small warm room a
// visitor lands in. A circle is a CONFIGURATION RECORD over the shared demo
// deliberation — its members are seeded demo people spanning BOTH opinion
// clusters (P: chidi/hana · U: farah/gus · plus "you"), so the deck's
// cross-cluster routing and the summary's community-scale verdicts all have
// honest material. Circle COMPOSITION (lib/circles.ts) lands in V3; until
// then this one hand-seeded circle is the demo's only room, and its seam says
// so honestly (a starter circle claims no computed diversity).

import { DEMO_ORIGIN } from "../demo/fixtures.js";

/** One demo circle record. */
export interface DemoCircle {
  /** The route slug (#/circle/<slug>) — an opaque selector, never fetched. */
  readonly slug: string;
  /** The circle IRI (the `as:context` room every circle message names). */
  readonly id: string;
  readonly name: string;
  /** Member person keys (demo/fixtures DEMO_PEOPLE keys), incl. "you". */
  readonly members: readonly string[];
  /** The standing prompt the notetaker opens with (aspirational, 02 §2 beat 1). */
  readonly prompt: string;
}

/** The one seeded circle (V1–V2; V3 brings composed multi-circle demos). */
export const DEMO_CIRCLE: DemoCircle = {
  slug: "maple-mornings",
  id: `${DEMO_ORIGIN}/circles/society/maple-mornings`,
  name: "Maple mornings",
  members: ["farah", "chidi", "gus", "hana", "you"],
  prompt: "What should mornings be like on this street in five years?",
};

/** Fail-closed lookup: a route slug resolves to a KNOWN circle or null. */
export function demoCircleFor(slug: string): DemoCircle | null {
  return slug === DEMO_CIRCLE.slug ? DEMO_CIRCLE : null;
}
