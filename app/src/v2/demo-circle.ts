// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded demo circle (design/v2 02 §2, 06 §2): the small warm room a
// visitor lands in. A circle is a CONFIGURATION RECORD over the shared demo
// deliberation — its members are seeded demo people spanning BOTH opinion
// clusters (P: chidi/hana · U: farah/gus · plus "you"), so the deck's
// cross-cluster routing and the summary's community-scale verdicts all have
// honest material. Circle COMPOSITION (lib/circles.ts) renders live on
// #/circles (V3); this hand-seeded circle stays the demo's one STANDING room
// — relational continuity (04 §2): composition never reshuffles a live room.
//
// The seeded conversation is written through the PRODUCTION write path
// (writeCircleMessage → the sandboxed in-memory pod fetch) — nothing is
// short-circuited: what the circle shows is what the read fold returns.

import { DEMO_ORIGIN, demoBase, demoWebId } from "../demo/fixtures.js";
import type { DemoDeliberation } from "../demo/pods.js";
import { writeCircleMessage } from "./circle-data.js";

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

/** One seeded circle message (author key + stable name + stamp + words). */
interface SeedMessage {
  readonly author: string;
  readonly name: string;
  readonly published: string;
  readonly content: string;
}

// The warm conversation already in the room when the visitor arrives — the
// personas talking about the standing prompt in their own registers, echoing
// the claims they have already adopted into the shared deliberation (the
// demo/fixtures society seed), so the summary and the deck have real threads
// to pull. Timestamps precede the visitor's session.
const SEED_MESSAGES: readonly SeedMessage[] = [
  {
    author: "farah",
    name: "cm-farah-drive",
    published: "2026-06-20T08:05:00Z",
    content:
      "Confession: I drive my kids 900 metres to school. Every single morning. Not because I want to — because the main road has no safe crossing and I'm not gambling with them.",
  },
  {
    author: "chidi",
    name: "cm-chidi-ratrun",
    published: "2026-06-20T08:12:00Z",
    content:
      "That's the same corner where my street turns into a rat-run at half eight. The cut-through traffic is doing forty past front doors. I've stopped letting my nephew scoot ahead.",
  },
  {
    author: "gus",
    name: "cm-gus-evening",
    published: "2026-06-20T18:40:00Z",
    content:
      "I'll be honest, I worry when this turns into 'shut the street down'. Mornings matter, but the same street has to be alive at night — venues, later buses, people about. A dead street isn't a safe one either.",
  },
  {
    author: "hana",
    name: "cm-hana-assembly",
    published: "2026-06-21T09:30:00Z",
    content:
      "What gets me is nobody asked the people who actually walk it. The ones deciding don't do the school run. I want us to have a real say before the next repaving, not after.",
  },
  {
    author: "farah",
    name: "cm-farah-wish",
    published: "2026-06-21T09:45:00Z",
    content:
      "For me it's simple. I want to hear kids on bikes, not brakes. Wide pavements, one zebra crossing at the shop corner, drivers who expect children. I'd still drive to the supermarket — this isn't anti-car.",
  },
  {
    author: "gus",
    name: "cm-gus-agree",
    published: "2026-06-21T10:02:00Z",
    content:
      "Kids on bikes, not brakes — alright, that one I can stand behind. Get the crossing right and you get more people on the street at all hours, which is my whole thing anyway.",
  },
  // The recurring QUESTION-shaped need (05 §1): the same cost/crossing
  // question across two distinct turns — the question-inbox's stable-question
  // floor, which is what summons the expert affordance (v2/expert.ts).
  {
    author: "farah",
    name: "cm-farah-cost",
    published: "2026-06-22T08:20:00Z",
    content:
      "What would a raised crossing actually cost? And has any council near here actually built one?",
  },
  {
    author: "chidi",
    name: "cm-chidi-cost",
    published: "2026-06-22T18:05:00Z",
    content:
      "I keep coming back to the money side of it. What does a proper crossing cost, and who pays for it?",
  },
  // The corner-garden READINESS theme (05 §3): two people with genuine
  // self-offers plus recurrence — the action-team nudge's detection input
  // (lib/readiness.ts). The personas qualify; the visitor joins the named
  // recipients only if their own turns do.
  {
    author: "farah",
    name: "cm-farah-garden",
    published: "2026-06-23T09:10:00Z",
    content: "About the corner garden by the shop — I could bring tools and I'm free this weekend.",
  },
  {
    author: "gus",
    name: "cm-gus-garden",
    published: "2026-06-23T12:30:00Z",
    content: "I've built planters before, so count me in for the corner garden.",
  },
  {
    author: "farah",
    name: "cm-farah-garden2",
    published: "2026-06-24T08:15:00Z",
    content: "That corner garden would make the school run feel different too.",
  },
  {
    author: "gus",
    name: "cm-gus-garden2",
    published: "2026-06-24T17:45:00Z",
    content: "The corner garden would be good for the shop as well, honestly.",
  },
];

/** The demo circle's participant rows (webId + pod base), incl. "you". */
export function demoCircleParticipants(
  demo: DemoDeliberation,
): { readonly webId: string; readonly base: string }[] {
  return DEMO_CIRCLE.members.map((key) => ({
    webId: demoWebId(key),
    base: demoBase(key, demo.scope),
  }));
}

// One seeding run per session (StrictMode double-mounts effects; two
// concurrent runs would race the create-only PUTs into 412s).
let seeding: Promise<void> | null = null;

/**
 * Seed the circle conversation into the demo pods, once (idempotent: keyed on
 * the first seeded resource existing, deduped in-flight). Writes through the
 * PRODUCTION writeCircleMessage path against the sandboxed demo fetch — the
 * same code a live visitor message uses.
 */
export function ensureDemoCircleSeeded(demo: DemoDeliberation): Promise<void> {
  if (seeding === null) {
    seeding = seedOnce(demo).catch((e) => {
      seeding = null; // a failed seed may be retried
      throw e;
    });
  }
  return seeding;
}

async function seedOnce(demo: DemoDeliberation): Promise<void> {
  const first = SEED_MESSAGES[0];
  if (first === undefined) return;
  const firstUrl = new URL(
    `circle-messages/${first.name}.ttl`,
    demoBase(first.author, demo.scope),
  ).toString();
  const probe = await demo.fetch(firstUrl, { method: "HEAD" });
  if (probe.ok) return; // already seeded this session
  for (const m of SEED_MESSAGES) {
    await writeCircleMessage(demo.fetch, demoBase(m.author, demo.scope), {
      author: demoWebId(m.author),
      content: m.content,
      circle: DEMO_CIRCLE.id,
      published: m.published,
      name: m.name,
    });
  }
}

/** TEST-ONLY: forget the in-flight seed (fresh demo instances per test). */
export function resetDemoCircleSeed(): void {
  seeding = null;
}
