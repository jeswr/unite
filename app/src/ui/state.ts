// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// UI-side deliberation configuration + the seam constructors. Kept out of the
// views so the views stay thin over src/lib.
//
// Two modes:
//   • "demo" — the seeded in-memory deliberation (src/demo): populated on first
//     paint, writable, sandboxed to the reserved demo origin. The DEFAULT, so
//     the product demonstrates itself before anyone signs in.
//   • "pod"  — a real deliberation over live participant pods; requires the
//     user to configure the deliberation IRI, their own container, and the
//     participant registry (until the fedreg registry wiring lands).

import type { KeyPair } from "@jeswr/federation-trust";
import {
  DEMO_PEOPLE,
  DEMO_YOU_KEY,
  demoBase,
  demoDeliberationIri,
  demoWebId,
} from "../demo/fixtures.js";
import { demoForDeliberation } from "../demo/pods.js";
import type { StatementKind } from "../lib/aggregate.js";
import type { MembershipVerifier } from "../lib/membership.js";
import { isHttpIri } from "../lib/model.js";
import { type DeliberationRegistry, isValidParticipant, StaticRegistry } from "../lib/registry.js";
import { AllowlistTrustResolver, TierParticipationGate, type TrustResolver } from "../lib/trust.js";
import { type IdentityTier, SCOPES, type ScopeConfig, type ScopeId } from "../scope/scopes.js";

/** A participant row as edited in the Overview form. */
export interface ParticipantConfig {
  readonly webId: string;
  readonly base: string;
}

/** How the deliberation is backed. */
export type ConfigMode = "demo" | "pod";

/** The deliberation the client is joined to. */
export interface DeliberationConfig {
  readonly mode: ConfigMode;
  /** The deliberation IRI. */
  readonly deliberation: string;
  /** The signed-in participant's OWN unite container for this deliberation. */
  readonly ownBase: string;
  /** The registry of participants (webId + their unite container base). */
  readonly participants: readonly ParticipantConfig[];
  /**
   * The design/04 §4.1 participant floor for this deliberation (from the
   * scope's `minTierToPropose`): the minimum identity tier to compose AND
   * react. Enforced by the view gates and the aggregation-side
   * TierParticipationGate; floor 0 = pseudonymous voice admitted (scope C).
   */
  readonly participationFloor: IdentityTier;
}

/** The seeded demo deliberation for a scope (the default on load). */
export function demoConfig(scopeId: ScopeId): DeliberationConfig {
  return {
    mode: "demo",
    deliberation: demoDeliberationIri(scopeId),
    ownBase: demoBase("you", scopeId),
    participants: DEMO_PEOPLE.map((p) => ({
      webId: demoWebId(p.key),
      base: demoBase(p.key, scopeId),
    })),
    participationFloor: SCOPES[scopeId].minTierToPropose,
  };
}

/** An empty pod-mode config — the Overview view guides the user to fill it. */
export function podConfig(scope: ScopeConfig): DeliberationConfig {
  return {
    mode: "pod",
    deliberation: "",
    ownBase: "",
    participants: [],
    participationFloor: scope.minTierToPropose,
  };
}

/**
 * The scope-mode default deliberation (docs/PLATFORM-PLAN.md §2): each scope
 * opens its OWN seeded demo deliberation, so `?scope=society` never reads or
 * writes the apps deliberation.
 */
export function scopedDefaultConfig(scope: ScopeConfig): DeliberationConfig {
  return demoConfig(scope.id);
}

/**
 * The statement kinds aggregation collects for a scope (the S1 kinds seam,
 * SCOPE-DIFFERENTIATION §5.1): the scope's board artifacts (`artifactKinds`,
 * a subset of the aggregator's kinds) plus — when the scope's Convergence
 * Room is enabled — the room's own artifacts (candidates + critiques).
 * Pure; deterministic order (the aggregator treats kinds as a set).
 */
export function collectionKinds(scope: ScopeConfig): readonly StatementKind[] {
  const kinds: StatementKind[] = [...scope.artifactKinds];
  if (scope.views.includes("room")) kinds.push("synthesis", "critique");
  return kinds;
}

/**
 * The identity statements are AUTHORED as under this config: the demo "you" in
 * demo mode; the signed-in WebID (or null — not signed in) in pod mode.
 */
export function sessionIdentity(config: DeliberationConfig, webId: string | null): string | null {
  return config.mode === "demo" ? demoWebId(DEMO_YOU_KEY) : webId;
}

/**
 * True when the config is complete enough to aggregate: a demo config always
 * is; a pod config needs a valid deliberation IRI and ≥1 valid participant.
 * Fail-closed — a half-filled pod form never fires requests.
 */
export function configReady(config: DeliberationConfig): boolean {
  if (config.mode === "demo") return true;
  if (!isHttpIri(config.deliberation)) return false;
  if (config.participants.length === 0) return false;
  return config.participants.every((p) => isValidParticipant(p));
}

/**
 * Build the participant-listing registry from the config. Throws (validated) on
 * a malformed entry — the caller surfaces the message.
 */
export function buildRegistry(config: DeliberationConfig): DeliberationRegistry {
  return new StaticRegistry(config.deliberation, [...config.participants]);
}

/**
 * A VALUE key identifying a config (plus optionally the session identity) for
 * keyed async state: two structurally-equal configs key identically, so a
 * caller re-creating an equal config object per render cannot wedge (or
 * stale-expose) state keyed by object identity.
 */
export function deliberationKey(config: DeliberationConfig, webId?: string | null): string {
  return JSON.stringify([
    config.mode,
    config.deliberation,
    config.ownBase,
    config.participants,
    config.participationFloor,
    webId ?? null,
  ]);
}

/**
 * The steward-issuance seam surfaced to the Trust view. Present only when the
 * session identity actually holds a steward signing key (the demo sandbox
 * today; a live steward console once the community-registry wiring lands) —
 * absent means the UI shows its fail-closed locked state.
 */
export interface StewardIssuance {
  /** The issuing steward's WebID (the session identity). */
  readonly steward: string;
  /** The steward's signing key. */
  readonly key: KeyPair;
  /** The write fetch reaching the holders' credential containers. */
  readonly writeFetch: typeof fetch;
  /** WebID → the holder's pod base (where the credential is written). */
  readonly baseFor: (webId: string) => string | undefined;
  /** Drop cached trust for a holder after issuing to them. */
  readonly invalidate: (webId: string) => void;
}

/** The trust machinery resolved for a config (the Q1 seam, Phase-2 form). */
export interface DeliberationTrust {
  /** Tier + role resolution (the extended membership-verifier seam). */
  readonly resolver: TrustResolver;
  /** The floor-aware participation gate the aggregation uses. */
  readonly gate: MembershipVerifier;
  /** Steward issuance, when the session holds a steward key (else null). */
  readonly issuance: StewardIssuance | null;
}

/**
 * Resolve the trust machinery for a config.
 *
 * - **demo** — the seeded community's CredentialTrustResolver: REAL
 *   federation-trust verification over credentials read back from the
 *   sandboxed pods, against the seeded steward anchors. Fail-closed: a demo
 *   config with a non-demo IRI throws rather than degrading to an allowlist.
 * - **pod** — the hand-typed participant list IS the membership decision
 *   (AllowlistTrustResolver, tier 1, NEVER roles) until the fedreg community
 *   registry wiring lands (Phase 5) — then published steward anchors +
 *   PodCredentialSource replace it here, behind the same seam.
 */
export async function deliberationTrust(config: DeliberationConfig): Promise<DeliberationTrust> {
  if (config.mode === "demo") {
    const demo = await demoForDeliberation(config.deliberation);
    if (!demo) {
      throw new Error(`demo mode requires a demo deliberation IRI: ${config.deliberation}`);
    }
    const { resolver, sessionSteward, bases } = demo.trust;
    return {
      resolver,
      gate: new TierParticipationGate(resolver, config.participationFloor),
      issuance: sessionSteward
        ? {
            steward: sessionSteward.webId,
            key: sessionSteward.key,
            writeFetch: demo.fetch,
            baseFor: (webId) => bases.get(webId),
            invalidate: (webId) => resolver.invalidate(webId),
          }
        : null,
    };
  }
  const resolver = new AllowlistTrustResolver(config.participants.map((p) => p.webId));
  return {
    resolver,
    gate: new TierParticipationGate(resolver, config.participationFloor),
    issuance: null,
  };
}
