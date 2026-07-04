// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-mode module: unite is ONE codebase serving three nested,
// progressively-trusted scopes (docs/PLATFORM-PLAN.md §1–2). A scope is a
// CONFIGURATION RECORD — copy, artifact naming, enabled surfaces, governance
// hooks — never a fork of the machinery. Resolution is pure + fail-closed:
// anything unrecognised resolves to the default scope, never a throw.

import type { IdentityTier } from "../lib/trust.js";

/** The three scope ids (PLATFORM-PLAN §1). Stable — they appear in URLs. */
export type ScopeId = "apps" | "infrastructure" | "society";

/** Identity tiers from design/02 §5 — canonically defined in lib/trust.ts. */
export type { IdentityTier } from "../lib/trust.js";

// ── The S0 scope-differentiation seams (docs/SCOPE-DIFFERENTIATION.md §5.3) ──
// Differentiation stays CONFIGURATION + a small set of pluggable pipelines,
// never view forks (PLATFORM-PLAN §2). Every field has a safe default — the
// apps values — and resolution stays pure + fail-closed.

/**
 * Which compose wizard the Compose view mounts (SCOPE-DIFFERENTIATION §1 row 1
 * — the compose grammar). Only "need-first" is implemented today; the
 * structured-infra wizard lands in S2 and the narrative-decompose wizard in S4
 * — until then Compose falls back to need-first with an honest phase note.
 */
export type ComposeFlow = "need-first" | "structured-infra" | "narrative-decompose";

/**
 * A statement kind the aggregator collects and the board renders
 * (SCOPE-DIFFERENTIATION §5.3). "need" is universal; "app-proposal" is scope
 * A's proposal layer (S1); the rest flip on with their scopes (S2 / S4).
 */
export type ArtifactKind =
  | "need"
  | "app-proposal"
  | "infra-proposal"
  | "vision"
  | "claim"
  | "value";

/**
 * A bridging partition the Common-ground view computes/requires
 * (SCOPE-DIFFERENTIATION §3.4). "opinion" (computed clusters) is always on;
 * "role" is scope B's declared-stakeholder lens (S3); "tier" is scope C's
 * identity-tier stratification (S4).
 */
export type CohortLens = "opinion" | "role" | "tier";

/**
 * Which output pipeline the Convergence Room hands an endorsed candidate to
 * (SCOPE-DIFFERENTIATION §1 row 5): A commissions a build; B recommends a
 * spec version whose ratification is MEASURED adoption on the wire; C
 * publishes an advisory synthesis with a mandatory dissent annex.
 */
export type OutputKind = "build-commission" | "adoption-decision" | "advisory-synthesis";

/**
 * The extra (non-base) views a scope enables (SCOPE-DIFFERENTIATION §5.3).
 * The base five (overview/compose/board/bridge/trust) are in every scope; an
 * enabled extra view that is not yet built renders an HONEST phase-labelled
 * preview (ui/views/registry), never a silently-missing tab.
 */
export type ScopeViewId =
  | "proposals"
  | "room"
  | "adoption-board"
  | "deck"
  | "futures-gallery"
  | "published-futures";

/**
 * The endorsement-gate floors for the Convergence Room's output stage
 * (SCOPE-DIFFERENTIATION §5.3; PLATFORM-PLAN §4.4 — communities may raise
 * floors, never lower them). Composes the Phase-2 roles strictly as
 * interfaces: nothing here re-specifies issuance or vouching.
 */
export interface EndorsementGate {
  /** Partitions that must EACH clear the bridging threshold (§3.4). */
  readonly crossCohort: readonly ("opinion" | "role")[];
  /** Whether moving a candidate into endorsement needs a reviewer role (B). */
  readonly reviewerRoleRequired: boolean;
  /** Steward signatures required on the published output (floor 2). */
  readonly stewardSignatures: number;
}

/** One scope mode's configuration (PLATFORM-PLAN §2). */
export interface ScopeConfig {
  readonly id: ScopeId;
  /** Rendered scope name ("Co-designing Solid apps"). */
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  /** What a proposal is called in this scope ("app proposal", …). */
  readonly artifactNoun: string;
  /**
   * Hostname FIRST LABELS that select this scope (e.g. "apps" matches
   * `apps.unite.jeswr.org`). Compared case-insensitively against the first
   * dot-separated label only.
   */
  readonly hosts: readonly string[];
  /** Whether the agentic build layer (PLATFORM-PLAN §5) exists in this scope. */
  readonly buildLayer: boolean;
  /**
   * Honest maturity: "live" = the working Stage-1 deliberation client;
   * "preview" = the scope's own machinery is progressively unlocking.
   */
  readonly status: "live" | "preview";
  /**
   * The design/04 §4.1 PARTICIPANT floor (PLATFORM-PLAN §4.1): the minimum
   * identity tier to compose/propose AND resonate in this scope — enforced by
   * the Compose/board gates and the aggregation-side TierParticipationGate.
   * Scope C keeps floor 0 (pseudonymous voice is a G3 requirement).
   */
  readonly minTierToPropose: IdentityTier;
  /** Which compose wizard Compose mounts (§5.3 seam). */
  readonly composeFlow: ComposeFlow;
  /** Statement kinds the aggregator collects + the board renders (§5.3 seam). */
  readonly artifactKinds: readonly ArtifactKind[];
  /** Bridging partitions computed/required — "opinion" is always on (§5.3 seam). */
  readonly cohortLenses: readonly CohortLens[];
  /** Which output pipeline the Convergence Room hands an endorsed candidate to. */
  readonly outputKind: OutputKind;
  /** Extra views this scope enables (adoption-board, futures-gallery, deck, …). */
  readonly views: readonly ScopeViewId[];
  /** Endorsement gate floors (composes Phase-2 roles; communities may raise). */
  readonly endorsementGate: EndorsementGate;
}

/** The default scope — the live Stage-1 instance (PLATFORM-PLAN §3). */
export const DEFAULT_SCOPE: ScopeId = "apps";

/** The three scope modes, in progressive (nested) order A → B → C. */
export const SCOPES: Readonly<Record<ScopeId, ScopeConfig>> = {
  apps: {
    id: "apps",
    name: "Co-designing Solid apps",
    tagline: "Propose the apps you want; converge on shared specs; agents build them.",
    description:
      "The Stage-1 instance: propose an app, articulate the needs it serves, " +
      "resonate across the community, converge on an endorsed spec — then the " +
      "agent suite implements it under full engineering gates.",
    artifactNoun: "app proposal",
    hosts: ["apps"],
    buildLayer: true,
    status: "live",
    minTierToPropose: 1,
    // The reference lifecycle (SCOPE-DIFFERENTIATION §2). S1 lands scope A's
    // artifact spine: the proposal layer + the Convergence Room. composeFlow
    // stays "need-first" — these remain the safe defaults every scope falls
    // back to; the proposal compose lives on the Proposals board itself.
    composeFlow: "need-first",
    artifactKinds: ["need", "app-proposal"],
    cohortLenses: ["opinion"],
    outputKind: "build-commission",
    views: ["proposals", "room"],
    endorsementGate: {
      crossCohort: ["opinion"],
      reviewerRoleRequired: false,
      stewardSignatures: 2,
    },
  },
  infrastructure: {
    id: "infrastructure",
    name: "Co-designing digital infrastructure",
    tagline: "Co-design the protocols and systems underneath — adoption-ratified, no single owner.",
    description:
      "The same convergence machinery pointed at digital infrastructure: " +
      "vocabularies, protocols, federation machinery, the unite spec itself. " +
      "Changes become Current only on measured adoption (design/04 §2).",
    artifactNoun: "infrastructure proposal",
    hosts: ["infra", "infrastructure"],
    buildLayer: true,
    // S2 flipped B live (SCOPE-DIFFERENTIATION §6): propose (the structured
    // wizard) → resonate → converge (the shared room) with ratification
    // VISIBLE on the Adoption board. The S3 ratification machinery (verified
    // role lens, reviewer/steward endorsement gating, the SIGNED
    // fut:AdoptionDecision) remains a documented follow-up — the config's
    // endorsementGate names those floors; the UI says what arrives in S3.
    status: "live",
    minTierToPropose: 1,
    composeFlow: "structured-infra",
    artifactKinds: ["need", "infra-proposal"], // S2 landed the model + parser
    cohortLenses: ["opinion", "role"],
    outputKind: "adoption-decision",
    views: ["proposals", "room", "adoption-board"],
    endorsementGate: {
      crossCohort: ["opinion", "role"], // §3.4 — both partitions must clear
      reviewerRoleRequired: true, // spec-review is the reviewer role's scope-B meaning
      stewardSignatures: 2,
    },
  },
  society: {
    id: "society",
    name: "Co-designing society",
    tagline:
      "Describe the future you want; surface shared futures — dissent carried, never smoothed.",
    description:
      "The open participatory-democracy core: visions, needs and values from " +
      "people's own pods, converged into signed shared futures legible to " +
      "government and industry — with mandatory dissent annexes.",
    artifactNoun: "vision statement",
    hosts: ["society"],
    buildLayer: false,
    // S4 flipped voice + mapping LIVE (SCOPE-DIFFERENTIATION §6): the
    // narrative→decompose→adopt wizard, the vision/claim/value expression
    // layer, the Resonance deck and the Futures gallery are real. The OUTPUT
    // pipeline (steward signing, published futures) lands in S5 — the room
    // computes + presents the outcome honestly until then.
    status: "live",
    minTierToPropose: 0,
    composeFlow: "narrative-decompose",
    artifactKinds: ["need", "vision", "claim", "value"],
    cohortLenses: ["opinion", "tier"],
    outputKind: "advisory-synthesis",
    // "room" enables the shared Convergence Room (the §4.4 scope-C row): the
    // candidate SharedFuture's outcome — endorsed OR the co-equal disagreement
    // map — is computed there; S5 adds signing/publication.
    views: ["room", "deck", "futures-gallery", "published-futures"],
    endorsementGate: {
      crossCohort: ["opinion"],
      reviewerRoleRequired: false,
      stewardSignatures: 2,
    },
  },
};

/** All scopes in progressive order (A → B → C). */
export const SCOPE_ORDER: readonly ScopeId[] = ["apps", "infrastructure", "society"];

/** Type guard for a scope id. */
export function isScopeId(value: unknown): value is ScopeId {
  return value === "apps" || value === "infrastructure" || value === "society";
}

/** Inputs to {@link resolveScope} — all optional, all untrusted. */
export interface ResolveScopeInput {
  /** `location.hostname` (the SPA's own origin — not a request header). */
  readonly hostname?: string | null | undefined;
  /** `location.search` (may carry a `?scope=` override). */
  readonly search?: string | null | undefined;
  /** A build-time pin (`VITE_UNITE_SCOPE`) for dedicated single-scope deploys. */
  readonly env?: string | null | undefined;
}

/**
 * Resolve the active scope. Precedence: `?scope=` query → env pin → hostname
 * first label → {@link DEFAULT_SCOPE}. Pure and FAIL-CLOSED: malformed or
 * unrecognised input at any layer falls through to the next, never throws.
 */
export function resolveScope(input: ResolveScopeInput = {}): ScopeConfig {
  const fromQuery = scopeFromSearch(input.search);
  if (fromQuery) return SCOPES[fromQuery];
  const fromEnv = normaliseScopeToken(input.env);
  if (fromEnv) return SCOPES[fromEnv];
  const fromHost = scopeFromHostname(input.hostname);
  if (fromHost) return SCOPES[fromHost];
  return SCOPES[DEFAULT_SCOPE];
}

/** Parse a `?scope=` value out of a search string; null when absent/invalid. */
function scopeFromSearch(search: string | null | undefined): ScopeId | null {
  if (typeof search !== "string" || search.length === 0 || search.length > 4096) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return null;
  }
  return normaliseScopeToken(params.get("scope"));
}

/** Match a hostname's FIRST label against the scopes' host lists. */
function scopeFromHostname(hostname: string | null | undefined): ScopeId | null {
  if (typeof hostname !== "string" || hostname.length === 0 || hostname.length > 253) return null;
  const firstLabel = hostname.toLowerCase().split(".", 1)[0];
  if (!firstLabel) return null;
  for (const id of SCOPE_ORDER) {
    if (SCOPES[id].hosts.includes(firstLabel)) return id;
  }
  return null;
}

/**
 * Build a same-page href selecting `id`, PRESERVING every other query param and
 * the hash (auth callback state, community selectors, return routing must not
 * be dropped by a scope switch). Fail-safe: a malformed search degrades to just
 * `?scope=<id>`, never a throw.
 */
export function scopeHref(
  id: ScopeId,
  search?: string | null | undefined,
  hash?: string | null | undefined,
): string {
  let params: URLSearchParams;
  try {
    const raw = typeof search === "string" && search.length <= 4096 ? search : "";
    params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  } catch {
    params = new URLSearchParams();
  }
  params.set("scope", id);
  const fragment =
    typeof hash === "string" && hash.startsWith("#") && hash.length <= 4096 ? hash : "";
  return `?${params.toString()}${fragment}`;
}

/** Normalise a raw token to a ScopeId, or null. Lenient on case/whitespace only. */
function normaliseScopeToken(raw: string | null | undefined): ScopeId | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().toLowerCase();
  return isScopeId(token) ? token : null;
}
