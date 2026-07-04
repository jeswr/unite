// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-mode module: unite is ONE codebase serving three nested,
// progressively-trusted scopes (docs/PLATFORM-PLAN.md §1–2). A scope is a
// CONFIGURATION RECORD — copy, artifact naming, enabled surfaces, governance
// hooks — never a fork of the machinery. Resolution is pure + fail-closed:
// anything unrecognised resolves to the default scope, never a throw.

/** The three scope ids (PLATFORM-PLAN §1). Stable — they appear in URLs. */
export type ScopeId = "apps" | "infrastructure" | "society";

/** Identity tiers from design/02 §5 (T0 pseudonymous, T1 vouched, T2 person). */
export type IdentityTier = 0 | 1 | 2;

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
  /** Governance hook (PLATFORM-PLAN §4.1): minimum tier to compose/propose. */
  readonly minTierToPropose: IdentityTier;
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
    status: "preview",
    minTierToPropose: 1,
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
    status: "preview",
    minTierToPropose: 0,
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

/** Normalise a raw token to a ScopeId, or null. Lenient on case/whitespace only. */
function normaliseScopeToken(raw: string | null | undefined): ScopeId | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().toLowerCase();
  return isScopeId(token) ? token : null;
}
