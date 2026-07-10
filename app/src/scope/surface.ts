// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The SURFACE dimension (design/v2 07 §2): unite is ONE build serving two
// presentation surfaces — the v1 instrument surface (ui/) and the v2
// conversational surface (v2/) — selected at runtime exactly like the scope
// dimension (./scopes.ts). A surface is a CONFIGURATION RECORD, never a fork
// of the machinery: both surfaces share src/lib, the demo pods, and the auth
// seam. Resolution is pure + FAIL-CLOSED: anything unrecognised resolves to
// the default (v1) surface, never a throw — so the v1 surface is what renders
// unless something explicitly, validly selects v2.

import type { ScopeId } from "./scopes.js";

/** The two surface ids. Stable — they appear in URLs (`?surface=`). */
export type SurfaceId = "v1" | "v2";

/** One surface's configuration (design/v2 07 §2). */
export interface SurfaceConfig {
  readonly id: SurfaceId;
  /** Rendered surface name. */
  readonly name: string;
  readonly tagline: string;
  /**
   * Hostname FIRST LABELS that select this surface (e.g. "chat" matches
   * `chat.unite.jeswr.org`). Compared case-insensitively against the first
   * dot-separated label only — the same rule scopes.ts uses.
   */
  readonly hosts: readonly string[];
  /**
   * The scope this surface FORCES (design/v2 07 §2: v2 initially binds to
   * scope C — `surface=v2` forces the society scope config). `null` = the
   * scope resolves normally (the v1 behaviour). Extending v2 to scopes A/B
   * later is a configuration change here, not a redesign.
   */
  readonly forcesScope: ScopeId | null;
}

/** The default surface — the v1 instrument client, byte-identical when v2 is off. */
export const DEFAULT_SURFACE: SurfaceId = "v1";

/** The two surfaces. */
export const SURFACES: Readonly<Record<SurfaceId, SurfaceConfig>> = {
  v1: {
    id: "v1",
    name: "unite",
    tagline: "The instrument surface: compose, resonate, converge.",
    // No dedicated host: v1 is the fail-closed default everywhere the v2
    // hosts don't match (unite.jeswr.org, apps., infra., society., …).
    hosts: [],
    forcesScope: null,
  },
  v2: {
    id: "v2",
    name: "unite",
    tagline: "The conversation is the interface.",
    hosts: ["chat", "v2"],
    forcesScope: "society",
  },
};

/** Type guard for a surface id. */
export function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "v1" || value === "v2";
}

/** Inputs to {@link resolveSurface} — all optional, all untrusted. */
export interface ResolveSurfaceInput {
  /** `location.hostname` (the SPA's own origin — not a request header). */
  readonly hostname?: string | null | undefined;
  /** `location.search` (may carry a `?surface=` override). */
  readonly search?: string | null | undefined;
  /** A build-time pin (`VITE_UNITE_SURFACE`) for dedicated single-surface deploys. */
  readonly env?: string | null | undefined;
}

/**
 * Resolve the active surface. Precedence: `?surface=` query → env pin →
 * hostname first label → {@link DEFAULT_SURFACE} (v1). Pure and FAIL-CLOSED:
 * malformed or unrecognised input at any layer falls through to the next,
 * never throws — mirroring `resolveScope` exactly.
 */
export function resolveSurface(input: ResolveSurfaceInput = {}): SurfaceConfig {
  const fromQuery = surfaceFromSearch(input.search);
  if (fromQuery) return SURFACES[fromQuery];
  const fromEnv = normaliseSurfaceToken(input.env);
  if (fromEnv) return SURFACES[fromEnv];
  const fromHost = surfaceFromHostname(input.hostname);
  if (fromHost) return SURFACES[fromHost];
  return SURFACES[DEFAULT_SURFACE];
}

/** Parse a `?surface=` value out of a search string; null when absent/invalid. */
function surfaceFromSearch(search: string | null | undefined): SurfaceId | null {
  if (typeof search !== "string" || search.length === 0 || search.length > 4096) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return null;
  }
  return normaliseSurfaceToken(params.get("surface"));
}

/** Match a hostname's FIRST label against the surfaces' host lists. */
function surfaceFromHostname(hostname: string | null | undefined): SurfaceId | null {
  if (typeof hostname !== "string" || hostname.length === 0 || hostname.length > 253) return null;
  const firstLabel = hostname.toLowerCase().split(".", 1)[0];
  if (!firstLabel) return null;
  for (const id of ["v1", "v2"] as const) {
    if (SURFACES[id].hosts.includes(firstLabel)) return id;
  }
  return null;
}

/**
 * Build a same-page href selecting surface `id`, PRESERVING every other query
 * param and the hash (the scopeHref discipline: auth callback state and return
 * routing must not be dropped by a surface switch). Fail-safe: a malformed
 * search degrades to just `?surface=<id>`, never a throw.
 */
export function surfaceHref(
  id: SurfaceId,
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
  params.set("surface", id);
  const fragment =
    typeof hash === "string" && hash.startsWith("#") && hash.length <= 4096 ? hash : "";
  return `?${params.toString()}${fragment}`;
}

/** Normalise a raw token to a SurfaceId, or null. Lenient on case/whitespace only. */
function normaliseSurfaceToken(raw: string | null | undefined): SurfaceId | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().toLowerCase();
  return isSurfaceId(token) ? token : null;
}
