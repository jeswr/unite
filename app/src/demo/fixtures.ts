// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded demo deliberation — realistic content for each scope, exercised
// through the REAL pipeline: these specs are serialised with the production
// serialisers (model.ts), stored in an in-memory pod (pods.ts), listed as LDP
// containers, aggregated by aggregateDeliberation, and ranked by rankNeeds.
// Nothing is short-circuited: what the demo shows is what the engine computes.
//
// The vote pattern is CRAFTED to be honest about what bridging does: two
// opinion clusters (privacy-first vs everyday-usability in the apps scope),
// a few statements each cluster loves and the other rejects (divisive), and a
// few that earn support in BOTH (common ground) — so the Common-ground view
// demonstrably ranks cross-cluster agreement above raw popularity.

import type { ScopeId } from "../scope/scopes.js";

/** Deterministic demo origin (reserved .example TLD; never a real host). */
export const DEMO_ORIGIN = "https://demo.unite.example";

/** A demo participant. */
export interface DemoPerson {
  /** Stable key used in vote specs. */
  readonly key: string;
  readonly name: string;
}

/** The eight seeded voices + "you" (the demo session identity). */
export const DEMO_PEOPLE: readonly DemoPerson[] = [
  { key: "amara", name: "Amara" },
  { key: "ben", name: "Ben" },
  { key: "chidi", name: "Chidi" },
  { key: "dana", name: "Dana" },
  { key: "efe", name: "Efe" },
  { key: "farah", name: "Farah" },
  { key: "gus", name: "Gus" },
  { key: "hana", name: "Hana" },
  { key: "you", name: "You" },
];

export const DEMO_YOU_KEY = "you";

export function demoWebId(personKey: string): string {
  return `${DEMO_ORIGIN}/people/${personKey}/profile#me`;
}

export function demoBase(personKey: string, scope: ScopeId): string {
  return `${DEMO_ORIGIN}/pods/${personKey}/unite/${scope}/`;
}

export function demoDeliberationIri(scope: ScopeId): string {
  return `${DEMO_ORIGIN}/deliberations/${scope}`;
}

/** name lookup for rendering (webId → display name). */
export const DEMO_NAMES: ReadonlyMap<string, string> = new Map(
  DEMO_PEOPLE.map((p) => [demoWebId(p.key), p.name]),
);

/** A vote: r = resonates, c = conflicts, u = unsure. Missing = unseen. */
export type VoteCode = "r" | "c" | "u";

/** One seeded need + the votes it received. */
export interface NeedSpec {
  /** Stable slug — becomes the resource name (deterministic ids for tests). */
  readonly slug: string;
  /** The author's person key. */
  readonly author: string;
  readonly content: string;
  /** Max-Neef concept short name (fut:maxneef-<name>). */
  readonly concept: string;
  readonly intensity?: number;
  /** ISO date (time is normalised); spread over June 2026. */
  readonly created: string;
  readonly votes: Readonly<Record<string, VoteCode>>;
}

// Cluster P (privacy-first): amara, chidi, efe, hana
// Cluster U (everyday-usability): ben, dana, farah, gus
// "you" starts mildly bridging (votes with both groups on the consensus items).

const APPS_NEEDS: readonly NeedSpec[] = [
  {
    slug: "offline-first",
    author: "amara",
    content:
      "Apps must keep working when I'm offline — my data is in my pod, so a train tunnel shouldn't lock me out of my own notes.",
    concept: "subsistence",
    intensity: 5,
    created: "2026-06-02T09:15:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "u",
      hana: "r",
      you: "r",
    },
  },
  {
    slug: "one-login",
    author: "dana",
    content:
      "One sign-in that works across every app in the suite. I should never have to re-enter my WebID because I opened a different tool.",
    concept: "participation",
    intensity: 4,
    created: "2026-06-03T14:40:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "u",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "r",
      hana: "r",
      you: "r",
    },
  },
  {
    slug: "plain-language-access",
    author: "hana",
    content:
      "Before an app touches my pod, show me in plain language what it wants to read and write — not a wall of technical scopes.",
    concept: "understanding",
    intensity: 5,
    created: "2026-06-04T11:05:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "u",
      efe: "r",
      farah: "r",
      gus: "r",
      hana: "r",
      you: "r",
    },
  },
  {
    slug: "network-lockdown",
    author: "chidi",
    content:
      "Apps should be blocked from calling any server except my pod unless I explicitly allow each destination.",
    concept: "protection",
    intensity: 4,
    created: "2026-06-05T16:20:00Z",
    votes: {
      amara: "r",
      ben: "c",
      chidi: "r",
      dana: "c",
      efe: "r",
      farah: "c",
      gus: "c",
      hana: "r",
    },
  },
  {
    slug: "forever-session",
    author: "gus",
    content:
      "Remember me forever on my own devices — I never want to see a login screen twice on my own laptop.",
    concept: "idleness",
    intensity: 3,
    created: "2026-06-06T08:30:00Z",
    votes: {
      amara: "c",
      ben: "r",
      chidi: "c",
      dana: "r",
      efe: "c",
      farah: "r",
      gus: "r",
      hana: "u",
    },
  },
  {
    slug: "household-calendar",
    author: "farah",
    content:
      "A shared household calendar where each family member's events stay in their own pod but merge into one view.",
    concept: "affection",
    intensity: 4,
    created: "2026-06-08T19:45:00Z",
    votes: {
      amara: "u",
      ben: "r",
      chidi: "u",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "r",
      hana: "u",
    },
  },
  {
    slug: "read-audit-log",
    author: "efe",
    content:
      "An audit view of every read another app or agent performed on my pod, so trust is verifiable rather than assumed.",
    concept: "protection",
    intensity: 5,
    created: "2026-06-10T10:00:00Z",
    votes: {
      amara: "r",
      ben: "u",
      chidi: "r",
      dana: "u",
      efe: "r",
      farah: "u",
      gus: "c",
      hana: "r",
      you: "r",
    },
  },
  {
    slug: "phone-photo-backup",
    author: "ben",
    content:
      "Photo backup from my phone to my pod that just works in the background — no manual exports, no cables.",
    concept: "creation",
    intensity: 4,
    created: "2026-06-12T13:25:00Z",
    votes: {
      amara: "u",
      ben: "r",
      chidi: "c",
      dana: "r",
      efe: "u",
      farah: "r",
      gus: "r",
      hana: "u",
    },
  },
  {
    slug: "data-portability-check",
    author: "amara",
    content:
      "A one-click check that everything an app wrote about me is readable by other apps — no quiet lock-in formats.",
    concept: "freedom",
    intensity: 4,
    created: "2026-06-14T15:10:00Z",
    votes: {
      amara: "r",
      ben: "u",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "u",
      gus: "u",
      hana: "r",
      you: "u",
    },
  },
  {
    slug: "starter-templates",
    author: "you",
    content:
      "Starter templates for common pod layouts, so a new person's first five minutes aren't an empty folder and a manual.",
    concept: "understanding",
    intensity: 3,
    created: "2026-06-16T09:55:00Z",
    votes: { ben: "r", dana: "r", farah: "u", hana: "r", you: "r" },
  },
];

const INFRA_NEEDS: readonly NeedSpec[] = [
  {
    slug: "spec-versioning",
    author: "chidi",
    content:
      "Protocol changes must be versioned and adoption-measured before they become 'current' — no decree upgrades that strand running pods.",
    concept: "protection",
    intensity: 5,
    created: "2026-06-03T10:00:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "u",
      efe: "r",
      farah: "r",
      gus: "u",
      hana: "r",
    },
  },
  {
    slug: "notification-interop",
    author: "dana",
    content:
      "Every pod server should speak the same live-notification channel so apps stop shipping per-server workarounds.",
    concept: "participation",
    intensity: 4,
    created: "2026-06-05T12:30:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "r",
      efe: "u",
      farah: "r",
      gus: "r",
      hana: "r",
    },
  },
  {
    slug: "vocab-registry",
    author: "amara",
    content:
      "A community registry of shared vocabularies with worked examples, so two apps describing the same thing pick the same terms.",
    concept: "understanding",
    intensity: 4,
    created: "2026-06-07T09:20:00Z",
    votes: {
      amara: "r",
      ben: "u",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "u",
      gus: "u",
      hana: "r",
    },
  },
  {
    slug: "mandatory-e2e-crypto",
    author: "efe",
    content:
      "Server operators should never be able to read pod contents — end-to-end encryption should be the default, not an extension.",
    concept: "protection",
    intensity: 5,
    created: "2026-06-09T17:45:00Z",
    votes: {
      amara: "r",
      ben: "c",
      chidi: "r",
      dana: "c",
      efe: "r",
      farah: "u",
      gus: "c",
      hana: "r",
    },
  },
  {
    slug: "zero-config-hosting",
    author: "gus",
    content:
      "Running your own pod server should be as easy as installing an app — one command, sane defaults, automatic TLS.",
    concept: "freedom",
    intensity: 4,
    created: "2026-06-11T14:15:00Z",
    votes: {
      amara: "u",
      ben: "r",
      chidi: "u",
      dana: "r",
      efe: "c",
      farah: "r",
      gus: "r",
      hana: "u",
    },
  },
  {
    slug: "conformance-badges",
    author: "hana",
    content:
      "Public, machine-readable conformance results for every server implementation, so communities can pick infrastructure on evidence.",
    concept: "understanding",
    intensity: 3,
    created: "2026-06-13T11:40:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "u",
      gus: "r",
      hana: "r",
    },
  },
];

const SOCIETY_NEEDS: readonly NeedSpec[] = [
  {
    slug: "walkable-neighbourhood",
    author: "farah",
    content:
      "I want my children to reach school, a park and a shop on foot — streets designed for people first, traffic second.",
    concept: "subsistence",
    intensity: 5,
    created: "2026-06-02T08:10:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "u",
      hana: "r",
    },
  },
  {
    slug: "third-places",
    author: "ben",
    content:
      "Free places to simply BE with other people — libraries, commons, courtyards — that don't require buying anything.",
    concept: "affection",
    intensity: 4,
    created: "2026-06-04T15:35:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "u",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "r",
      hana: "r",
    },
  },
  {
    slug: "car-free-centre",
    author: "amara",
    content:
      "Make the town centre car-free entirely — deliveries by cargo bike, blue-badge access only.",
    concept: "protection",
    intensity: 4,
    created: "2026-06-06T12:00:00Z",
    votes: {
      amara: "r",
      ben: "c",
      chidi: "r",
      dana: "c",
      efe: "r",
      farah: "u",
      gus: "c",
      hana: "r",
    },
  },
  {
    slug: "night-economy",
    author: "gus",
    content:
      "Keep the town alive after 8pm — later transit, licensed venues, streets that feel safe because they're busy.",
    concept: "idleness",
    intensity: 3,
    created: "2026-06-08T20:20:00Z",
    votes: {
      amara: "u",
      ben: "r",
      chidi: "c",
      dana: "r",
      efe: "u",
      farah: "r",
      gus: "r",
      hana: "c",
    },
  },
  {
    slug: "citizen-assembly",
    author: "hana",
    content:
      "A standing citizens' assembly with real agenda power, selected by lot, so decisions aren't only made by whoever shows up angriest.",
    concept: "participation",
    intensity: 5,
    created: "2026-06-10T09:30:00Z",
    votes: {
      amara: "r",
      ben: "u",
      chidi: "r",
      dana: "r",
      efe: "r",
      farah: "r",
      gus: "u",
      hana: "r",
    },
  },
  {
    slug: "repair-culture",
    author: "efe",
    content:
      "A repair café and tool library in every ward — owning less, fixing more, and learning the skills from neighbours.",
    concept: "creation",
    intensity: 4,
    created: "2026-06-12T16:50:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "u",
      efe: "r",
      farah: "r",
      gus: "r",
      hana: "r",
    },
  },
];

/** The seeded needs per scope. */
export const DEMO_NEEDS: Readonly<Record<ScopeId, readonly NeedSpec[]>> = {
  apps: APPS_NEEDS,
  infrastructure: INFRA_NEEDS,
  society: SOCIETY_NEEDS,
};
