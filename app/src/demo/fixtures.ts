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

import type { Role } from "../lib/trust.js";
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

// ── The S1 artifact spine seed (SCOPE-DIFFERENTIATION §2): proposals, the
//    Convergence Room's candidates + critiques. S2 added the infrastructure
//    scope's own artifacts; S4 the society scope's. ──────────────────────────

/** One seeded proposal + the votes it received. */
export interface ProposalSpec {
  readonly slug: string;
  readonly author: string;
  readonly title: string;
  readonly content: string;
  /** Need SLUGS this proposal serves (resolved to IRIs at seed time; ≥1). */
  readonly serves: readonly string[];
  /** The VSD indirect-stakeholders prompt (optional). */
  readonly stakeholders?: string;
  readonly created: string;
  readonly votes: Readonly<Record<string, VoteCode>>;
}

/** One seeded Convergence-Room candidate + its endorsement votes. */
export interface CandidateSpec {
  readonly slug: string;
  readonly author: string;
  readonly title?: string;
  readonly content: string;
  /** Input refs: `need:<slug>` or `proposal:<slug>` (resolved at seed time; ≥1). */
  readonly derivedFrom: readonly string[];
  readonly created: string;
  readonly votes: Readonly<Record<string, VoteCode>>;
}

/** One seeded standing critique on a candidate. */
export interface CritiqueSpec {
  readonly slug: string;
  readonly author: string;
  readonly content: string;
  /** The candidate SLUG this critique stands on. */
  readonly on: string;
  readonly created: string;
}

// ── The S4 scope-C expression layer (SCOPE-DIFFERENTIATION §4): whole vision
//    narratives, the atomic claims adopted out of them, and value statements —
//    society scope only. ─────────────────────────────────────────────────────

/** One seeded whole-narrative vision (the Futures gallery's content). */
export interface VisionSpec {
  readonly slug: string;
  readonly author: string;
  readonly title?: string;
  readonly content: string;
  /** Scope-ladder short name (fut:<name> — self/household/community/nation/humanity). */
  readonly scope?: string;
  /** Target year (4 digits). */
  readonly horizon?: string;
  readonly created: string;
}

/** One seeded atomic claim (adopted by its author) + the votes it received. */
export interface ClaimSpec {
  readonly slug: string;
  readonly author: string;
  /** ≤ 500 chars (the SHACL atomicity cap). */
  readonly content: string;
  /** The vision SLUG it was decomposed from (omit = authored directly). */
  readonly from?: string;
  readonly created: string;
  readonly votes: Readonly<Record<string, VoteCode>>;
}

/** One seeded value statement. */
export interface ValueSpec {
  readonly slug: string;
  readonly author: string;
  readonly content: string;
  /** Schwartz value short name (fut:schwartz-<name>). */
  readonly value: string;
  readonly created: string;
}

// The apps proposals demonstrate the PORTFOLIO framing: two rival proposals
// both answering offline-first, presented as answers to the need — plus a
// usability-cluster favourite that the privacy cluster is lukewarm on.
const APPS_PROPOSALS: readonly ProposalSpec[] = [
  {
    slug: "pocket-pod-notes",
    author: "amara",
    title: "Pocket Pod Notes",
    content:
      "An offline-first notes app: everything you write lands in your pod and keeps working with no signal — sync is a background detail, never a gate.",
    serves: ["offline-first", "data-portability-check"],
    stakeholders:
      "People on unreliable rural connections; anyone whose commute cuts through tunnels.",
    created: "2026-06-18T10:20:00Z",
    votes: {
      amara: "r",
      ben: "r",
      chidi: "r",
      dana: "u",
      efe: "r",
      farah: "r",
      hana: "r",
      you: "r",
    },
  },
  {
    slug: "one-key-suite",
    author: "dana",
    title: "One-Key Suite Login",
    content:
      "A shared sign-in shell for the whole app suite: one WebID entry, one passkey, and every app inherits the session silently.",
    serves: ["one-login", "forever-session"],
    created: "2026-06-19T09:05:00Z",
    votes: {
      amara: "u",
      ben: "r",
      chidi: "c",
      dana: "r",
      efe: "u",
      farah: "r",
      gus: "r",
      hana: "u",
      you: "r",
    },
  },
  {
    slug: "tunnel-docs",
    author: "ben",
    title: "Tunnel-proof Docs",
    content:
      "A collaborative docs app with a local-first CRDT core, so edits made offline merge cleanly whenever the pod is reachable again.",
    serves: ["offline-first"],
    created: "2026-06-20T15:45:00Z",
    votes: { amara: "r", ben: "r", efe: "u", farah: "r", hana: "u" },
  },
];

// Two candidates so BOTH room outcomes demo honestly: one broad synthesis the
// whole room endorses, one protection-first candidate the clusters divide on
// (the disagreement map as a first-class outcome, with standing critiques).
const APPS_CANDIDATES: readonly CandidateSpec[] = [
  {
    slug: "spine-v1",
    author: "hana",
    title: "The offline-first common spine",
    content:
      "Every suite app ships offline-first on a shared local cache, signs in once through one shared login shell, and asks for pod access in plain language. Three needs both groups endorsed, folded into one buildable spine — Pocket Pod Notes is its first proving ground.",
    derivedFrom: [
      "need:offline-first",
      "need:one-login",
      "need:plain-language-access",
      "proposal:pocket-pod-notes",
    ],
    created: "2026-06-21T11:00:00Z",
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
    slug: "lockdown-default",
    author: "chidi",
    title: "Lockdown by default",
    content:
      "All suite apps ship with every network destination blocked except the user's own pod; each external call needs an explicit, audited allow. Protection first — convenience is negotiated per destination, never assumed.",
    derivedFrom: ["need:network-lockdown", "need:read-audit-log"],
    created: "2026-06-22T14:30:00Z",
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
];

const APPS_CRITIQUES: readonly CritiqueSpec[] = [
  {
    slug: "cr-lockdown-calendar",
    author: "dana",
    content:
      "A blanket block breaks the household calendar and the photo backup this same board asked for. Ship allowlists with sane defaults, or ordinary people lose the tools they came here to get.",
    on: "lockdown-default",
    created: "2026-06-23T09:10:00Z",
  },
  {
    slug: "cr-lockdown-onboarding",
    author: "farah",
    content:
      "Every “allow this destination?” prompt is a wall for a non-technical person. If the default posture is fear, the suite stays a hobbyist toy.",
    on: "lockdown-default",
    created: "2026-06-23T16:40:00Z",
  },
  {
    slug: "cr-spine-session",
    author: "gus",
    content:
      "The spine says nothing about staying signed in. If my session dies every day, offline-first is theatre — fold the forever-session need in before this is commissioned.",
    on: "spine-v1",
    created: "2026-06-24T08:25:00Z",
  },
];

// ── The S2 scope-B artifact spine (SCOPE-DIFFERENTIATION §3): infrastructure
//    proposals — the SELF-HOSTING first deliberation (§3.1, milestone B4): the
//    seeded deliberation IS the futures-sector-0.2.0 change, run through the
//    real machinery in the sandbox. ─────────────────────────────────────────────

/** One seeded infrastructure proposal + the votes it received (S2, scope B). */
export interface InfraProposalSpec {
  readonly slug: string;
  readonly author: string;
  readonly title: string;
  readonly content: string;
  /** Governed-system IRIs (fut:targetsSystem, ≥1). */
  readonly targets: readonly string[];
  /** The coded kind's LOCAL NAME ("SpecChange" | "NewSpec" | "ServiceOperation" | "Deprecation"). */
  readonly kind: string;
  /** Coded role LOCAL NAMES ("ImplementerRole" | "OperatorRole" | "ParticipantRole", ≥1). */
  readonly roles: readonly string[];
  readonly breaking?: boolean;
  readonly migration?: string;
  /** Running code (repo/commit IRI) — optional at compose. */
  readonly referenceImplementation?: string;
  /** Need SLUGS this proposal serves (resolved to IRIs at seed time; ≥1). */
  readonly serves: readonly string[];
  readonly stakeholders?: string;
  readonly created: string;
  readonly votes: Readonly<Record<string, VoteCode>>;
}

/** The futures-sector lineage IRI (the governed system of the B4 deliberation). */
export const FUTURES_LINEAGE = "https://w3id.org/jeswr/sectors/futures";

const INFRA_PROPOSALS: readonly InfraProposalSpec[] = [
  {
    // The self-hosting proposal (§3.1): adopt the futures sector 0.2.0 — the
    // very vocabulary that makes scope B expressible. Its running code is the
    // real formalising commit in solid-federation-vocab.
    slug: "futures-020",
    author: "hana",
    title: "Adopt futures sector 0.2.0",
    content:
      "Version 0.2.0 adds the scope-B layer this deliberation itself runs on: fut:InfraProposal with targets/kind/blast-radius/migration honesty, the AdoptionDecision + AdoptionObservation output shapes, and the Convergence-Room critique unit. Additive over 0.1.0 — no term changes, dual-advertised during migration.",
    targets: [FUTURES_LINEAGE],
    kind: "SpecChange",
    roles: ["ImplementerRole", "ParticipantRole"],
    breaking: false,
    referenceImplementation:
      "https://github.com/jeswr/solid-federation-vocab/commit/67b00beda1a05963842de75f72b9968ddca990e3",
    serves: ["spec-versioning", "vocab-registry"],
    stakeholders:
      "Every future deliberation community that inherits these shapes without having sat in this room.",
    created: "2026-06-15T10:00:00Z",
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
    slug: "one-notification-profile",
    author: "dana",
    title: "One live-notification channel profile",
    content:
      "Profile the Solid notifications protocol so every conforming pod server speaks the same live-update channel — apps drop their per-server workarounds.",
    targets: ["https://solidproject.org/TR/notifications-protocol"],
    kind: "NewSpec",
    roles: ["ImplementerRole", "OperatorRole"],
    breaking: false,
    serves: ["notification-interop"],
    created: "2026-06-16T14:30:00Z",
    votes: { amara: "r", ben: "r", chidi: "u", dana: "r", farah: "r", gus: "r", hana: "u" },
  },
  {
    // A breaking proposal, so the migration-honesty machinery (badge + story)
    // demos live — and the clusters genuinely divide on it (the e2e split).
    slug: "e2e-by-default",
    author: "efe",
    title: "Require end-to-end encryption by default",
    content:
      "Server operators should never be able to read pod contents: make E2E encryption the storage default rather than an extension.",
    targets: [FUTURES_LINEAGE],
    kind: "Deprecation",
    roles: ["ImplementerRole", "OperatorRole", "ParticipantRole"],
    breaking: true,
    migration:
      "A dual-read window: storages advertise both plaintext and encrypted profiles while apps migrate; server-side search degrades to client-side indexes before the plaintext profile is retired.",
    serves: ["mandatory-e2e-crypto"],
    created: "2026-06-17T09:45:00Z",
    votes: { amara: "r", ben: "c", chidi: "r", dana: "c", efe: "r", gus: "c", hana: "r" },
  },
];

// One candidate so the room's adoption-decision output stage demos: the room
// recommends 0.2.0; the Adoption board shows what the wire actually did.
const INFRA_CANDIDATES: readonly CandidateSpec[] = [
  {
    slug: "recommend-020",
    author: "hana",
    title: "Recommend futures 0.2.0 for adoption",
    content:
      "This room recommends the futures-sector 0.2.0 version for adoption: it is additive, carries running code, and its blast radius is declared. The recommendation is advisory — a version becomes Current only when the network's storages actually advertise it (fedreg:acceptsSpec); watch the Adoption board, not this room, for ratification.",
    derivedFrom: ["infra:futures-020", "need:spec-versioning"],
    created: "2026-06-20T11:00:00Z",
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
];

const INFRA_CRITIQUES: readonly CritiqueSpec[] = [
  {
    slug: "cr-020-closed-kinds",
    author: "gus",
    content:
      "0.2.0's proposal kinds are a closed set — extending them needs another sector bump. Fine for interop, but the recommendation should say so out loud: communities wanting richer change taxonomies wait on 0.3.0.",
    on: "recommend-020",
    created: "2026-06-21T08:30:00Z",
  },
];

// The society expression layer (S4): the seed topic is deliberately a
// LOW-SENSITIVITY CIVIC one (neighbourhood streets/transport — the C4 launch
// gate's recommended default, §8 Q5), with the same two-cluster shape as the
// needs: P (amara/chidi/efe/hana — calm-streets/safety-first) vs
// U (ben/dana/farah/gus — keep-it-moving/town-vitality). One claim both
// clusters endorse, one they divide on — so the deck's cross-cluster routing
// and the room's co-equal outcomes all demo honestly. "you" authors nothing
// (the T0 pseudonymous-visitor demo) — your deck starts full.

const SOCIETY_VISIONS: readonly VisionSpec[] = [
  {
    slug: "school-run-on-foot",
    author: "farah",
    title: "The school run without a car",
    content:
      "Right now I drive my kids 900 metres to school because the main road has no safe " +
      "crossing. In the future I want, they walk with their friends: pavements wide enough " +
      "for a buggy and a wheelchair side by side, a zebra crossing at the shop corner, and " +
      "drivers who expect children on the street. I'd still drive to the supermarket — this " +
      "isn't about banning cars, it's about not needing one for 900 metres.",
    scope: "community",
    horizon: "2032",
    created: "2026-06-14T09:00:00Z",
  },
  {
    slug: "quiet-streets",
    author: "chidi",
    title: "Streets that belong to the people on them",
    content:
      "My street is a rat-run. In my ideal future, through-traffic uses the ring road and " +
      "residential streets are for the people who live there — kids playing out, neighbours " +
      "talking, deliveries still arriving. Traffic calming that actually calms, not paint.",
    scope: "community",
    created: "2026-06-15T18:30:00Z",
  },
  {
    slug: "alive-after-eight",
    author: "gus",
    title: "A town that's alive after eight",
    content:
      "I want a town centre that doesn't shut at 8pm: later buses, venues that can afford " +
      "their licences, streets that feel safe because they're full of people rather than " +
      "empty and locked down. The evening economy is part of a living street, not its enemy.",
    scope: "community",
    horizon: "2030",
    created: "2026-06-16T20:15:00Z",
  },
];

const SOCIETY_CLAIMS: readonly ClaimSpec[] = [
  {
    slug: "safe-crossing",
    author: "farah",
    content: "Every child should be able to cross the high street safely on foot.",
    from: "school-run-on-foot",
    created: "2026-06-14T09:30:00Z",
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
    slug: "ban-through-traffic",
    author: "chidi",
    content: "Through-traffic should be banned from residential streets entirely.",
    from: "quiet-streets",
    created: "2026-06-15T19:00:00Z",
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
    slug: "later-buses",
    author: "gus",
    content: "Buses should run until at least midnight, every day of the week.",
    from: "alive-after-eight",
    created: "2026-06-16T20:45:00Z",
    votes: { ben: "r", dana: "r", farah: "r", gus: "r", hana: "u" },
  },
  {
    slug: "pavement-priority",
    author: "farah",
    content:
      "Pavement space should be wide enough for a buggy and a wheelchair side by side before any street gets a parking lane.",
    from: "school-run-on-foot",
    created: "2026-06-14T10:00:00Z",
    votes: { amara: "r", chidi: "r", efe: "r", hana: "r", dana: "u" },
  },
  {
    slug: "not-anti-car",
    author: "farah",
    content: "Making short trips walkable is not the same thing as banning cars.",
    from: "school-run-on-foot",
    created: "2026-06-14T10:15:00Z",
    votes: { ben: "r", dana: "r", farah: "r", gus: "r" },
  },
];

const SOCIETY_VALUES: readonly ValueSpec[] = [
  {
    slug: "welfare-of-all",
    author: "efe",
    content: "Streets should be judged by how they treat the most vulnerable person using them.",
    value: "universalism",
    created: "2026-06-15T11:00:00Z",
  },
  {
    slug: "town-vitality",
    author: "gus",
    content: "A good town is a lively one — energy and novelty are worth some noise.",
    value: "stimulation",
    created: "2026-06-16T21:00:00Z",
  },
];

// Two society candidates so BOTH room outcomes demo (like apps): one synthesis
// both clusters endorse, one absolutist candidate they divide on — with the
// standing critiques that become the dissent annex.
const SOCIETY_CANDIDATES: readonly CandidateSpec[] = [
  {
    slug: "streets-for-people",
    author: "hana",
    title: "Streets for people, roads for through-traffic",
    content:
      "Short trips become walkable — safe crossings on the high street, pavements sized for " +
      "buggies and wheelchairs — while through-traffic is carried by the ring road, deliveries " +
      "and blue-badge access stay, and later buses keep the centre alive in the evening. " +
      "Walkability is not a ban on cars; it is not needing one for 900 metres.",
    derivedFrom: [
      "claim:safe-crossing",
      "claim:pavement-priority",
      "claim:later-buses",
      "claim:not-anti-car",
      "need:walkable-neighbourhood",
    ],
    created: "2026-06-20T10:00:00Z",
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
    slug: "car-free-everything",
    author: "amara",
    title: "Car-free, everywhere, now",
    content:
      "The town centre and every residential street go car-free outright: through-traffic " +
      "banned, parking removed, deliveries by cargo bike, blue-badge access only. The street " +
      "is public space first.",
    derivedFrom: ["claim:ban-through-traffic", "need:car-free-centre"],
    created: "2026-06-21T14:00:00Z",
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
];

const SOCIETY_CRITIQUES: readonly CritiqueSpec[] = [
  {
    slug: "cr-carfree-carer",
    author: "dana",
    content:
      "I carry a week of shopping and an elderly parent's wheelchair. 'Blue-badge only' doesn't " +
      "cover carers who don't hold the badge — this trades my mobility for your quiet street.",
    on: "car-free-everything",
    created: "2026-06-22T09:20:00Z",
  },
  {
    slug: "cr-carfree-trades",
    author: "gus",
    content:
      "A plumber cannot bring a boiler on a cargo bike. Without a workable trades-access story " +
      "this empties the high street it claims to save.",
    on: "car-free-everything",
    created: "2026-06-22T17:40:00Z",
  },
  {
    slug: "cr-streets-funding",
    author: "ben",
    content:
      "Nothing here says who pays. If 'later buses' lands as an unfunded wish, the synthesis " +
      "over-promises — name the funding mechanism before this goes to anyone as a shared future.",
    on: "streets-for-people",
    created: "2026-06-23T08:05:00Z",
  },
];

/** The seeded proposals per scope (S1: apps only). */
export const DEMO_PROPOSALS: Readonly<Record<ScopeId, readonly ProposalSpec[]>> = {
  apps: APPS_PROPOSALS,
  infrastructure: [],
  society: [],
};

/** The seeded INFRASTRUCTURE proposals (S2, scope B only — its own spec shape). */
export const DEMO_INFRA_PROPOSALS: Readonly<Record<ScopeId, readonly InfraProposalSpec[]>> = {
  apps: [],
  infrastructure: INFRA_PROPOSALS,
  society: [],
};

/** The seeded Convergence-Room candidates per scope (S1 apps; S2 infrastructure; S4 society). */
export const DEMO_CANDIDATES: Readonly<Record<ScopeId, readonly CandidateSpec[]>> = {
  apps: APPS_CANDIDATES,
  infrastructure: INFRA_CANDIDATES,
  society: SOCIETY_CANDIDATES,
};

/** The seeded standing critiques per scope (S1 apps; S2 infrastructure; S4 society). */
export const DEMO_CRITIQUES: Readonly<Record<ScopeId, readonly CritiqueSpec[]>> = {
  apps: APPS_CRITIQUES,
  infrastructure: INFRA_CRITIQUES,
  society: SOCIETY_CRITIQUES,
};

// ── The S2 adoption-board seed: sandboxed fedreg:StorageDescription documents
//    the demo Adoption board reads through the REAL fedreg pipeline. The story
//    they tell is the honest one: 0.1.0 is advertised by two demo storages
//    (bar met → computed Current); 0.2.0 — the version the room recommends —
//    is advertised by NOBODY yet (Proposed: published ≠ adopted; the wire
//    hasn't voted). ────────────────────────────────────────────────────────────

/** One seeded demo storage advertisement. */
export interface DemoStorageSpec {
  /** Resource name under `<DEMO_ORIGIN>/registry/` (becomes the source IRI). */
  readonly name: string;
  /** The advertising storage IRI (fedreg:storage / fut:observedParty). */
  readonly storage: string;
  /** Spec-version IRIs advertised (fedreg:acceptsSpec). */
  readonly acceptsSpec: readonly string[];
  /** Sector IRIs supported (fedreg:supportsSector). */
  readonly supportsSector?: readonly string[];
}

export const DEMO_STORAGES: readonly DemoStorageSpec[] = [
  {
    name: "storage-alpha",
    storage: `${DEMO_ORIGIN}/storages/alpha/`,
    acceptsSpec: [`${FUTURES_LINEAGE}/0.1.0`],
    supportsSector: [`${FUTURES_LINEAGE}#`],
  },
  {
    name: "storage-beta",
    storage: `${DEMO_ORIGIN}/storages/beta/`,
    acceptsSpec: [`${FUTURES_LINEAGE}/0.1.0`],
    supportsSector: [`${FUTURES_LINEAGE}#`],
  },
];

/** The demo Adoption board's observation sources (served by the sandbox fetch). */
export const DEMO_ADOPTION_SOURCES: readonly string[] = DEMO_STORAGES.map(
  (s) => `${DEMO_ORIGIN}/registry/${s.name}.ttl`,
);

/** The seeded whole-narrative visions per scope (S4: society only). */
export const DEMO_VISIONS: Readonly<Record<ScopeId, readonly VisionSpec[]>> = {
  apps: [],
  infrastructure: [],
  society: SOCIETY_VISIONS,
};

/** The seeded adopted claims per scope (S4: society only). */
export const DEMO_CLAIMS: Readonly<Record<ScopeId, readonly ClaimSpec[]>> = {
  apps: [],
  infrastructure: [],
  society: SOCIETY_CLAIMS,
};

/** The seeded value statements per scope (S4: society only). */
export const DEMO_VALUES: Readonly<Record<ScopeId, readonly ValueSpec[]>> = {
  apps: [],
  infrastructure: [],
  society: SOCIETY_VALUES,
};

// ── The Phase-2 governance seed (docs/PLATFORM-PLAN.md §4) ────────────────────

/** The seeded trust standing for one scope's demo community. */
export interface DemoTrustSpec {
  /** Person keys holding a T1 membership credential. Everyone else is T0. */
  readonly members: readonly string[];
  /** Person key → role credentials issued (each MUST also be a member). */
  readonly roles: Readonly<Record<string, readonly Role[]>>;
}

const EVERYONE = DEMO_PEOPLE.map((p) => p.key);
const EVERYONE_BUT_YOU = EVERYONE.filter((k) => k !== DEMO_YOU_KEY);

/**
 * The seeded personas deliberately SPAN the tiers so every trust path demos
 * live (PLATFORM-PLAN §4.1; design/04 §4.1):
 *
 * - **apps** — "you" hold a STEWARD role (≥2 stewards with hana), so the
 *   issuance UI round-trips for real: issue efe a reviewer credential and
 *   watch the roll change. Everyone is a vouched member; the floor-1 gate
 *   and the full role spread (builder/reviewer/steward) all exercise.
 * - **infrastructure** — "you" are an UNVOUCHED VISITOR (T0): the floor-1
 *   Compose/react gates show their explanatory LOCKED state live, and the
 *   steward panel shows its not-a-steward state. (You author nothing in the
 *   infra fixtures, so the seeded board is unaffected.)
 * - **society** — floor 0: "you" participate as PSEUDONYMOUS VOICE (T0,
 *   honestly labelled), demonstrating the G3 open-participation requirement;
 *   two stewards exist to sign eventual SharedFutures.
 *
 * Every role-holder is also a member (design/04 §4.1 — roles presume T1);
 * seeding asserts this. Each community has ≥2 stewards (design/04 §4.4).
 */
export const DEMO_TRUST: Readonly<Record<ScopeId, DemoTrustSpec>> = {
  apps: {
    members: EVERYONE,
    roles: {
      you: ["steward"],
      hana: ["steward", "reviewer"],
      amara: ["builder"],
      ben: ["builder"],
      chidi: ["reviewer"],
      dana: ["reviewer"],
    },
  },
  infrastructure: {
    members: EVERYONE_BUT_YOU,
    roles: {
      hana: ["steward"],
      farah: ["steward"],
      chidi: ["builder"],
      efe: ["reviewer"],
    },
  },
  society: {
    members: EVERYONE_BUT_YOU,
    roles: {
      hana: ["steward"],
      farah: ["steward"],
    },
  },
};
