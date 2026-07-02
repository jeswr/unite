// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// UI-side deliberation configuration + the seam constructors. Kept out of the
// views so the views stay thin over src/lib.

import { type MembershipVerifier, StubMembershipVerifier } from "../lib/membership.js";
import { type DeliberationRegistry, StaticRegistry } from "../lib/registry.js";

/** A participant row as edited in the Join form. */
export interface ParticipantConfig {
  readonly webId: string;
  readonly base: string;
}

/** The Stage-1 deliberation the client is joined to (dev/local config). */
export interface DeliberationConfig {
  /** The deliberation IRI. */
  readonly deliberation: string;
  /** The signed-in participant's OWN unite container for this deliberation. */
  readonly ownBase: string;
  /** The registry of participants (webId + their unite container base). */
  readonly participants: readonly ParticipantConfig[];
}

/** A sensible local-dev default (points at a local Solid server). */
export const DEFAULT_CONFIG: DeliberationConfig = {
  deliberation: "https://community.example/deliberations/apps",
  ownBase: "https://alice.example/unite/apps/",
  participants: [
    { webId: "https://alice.example/profile/card#me", base: "https://alice.example/unite/apps/" },
  ],
};

/**
 * Build the participant-listing registry from the config. Throws (validated) on
 * a malformed entry — the caller surfaces the message.
 */
export function buildRegistry(config: DeliberationConfig): DeliberationRegistry {
  return new StaticRegistry(config.deliberation, [...config.participants]);
}

/**
 * Build the Stage-1 membership verifier: the dev stub vouches every configured
 * participant WebID (tier T1), fail-closed for anyone else. Production swaps in
 * a @jeswr/federation-trust credential verifier (see decisions/0001).
 */
export function buildVerifier(config: DeliberationConfig): MembershipVerifier {
  return new StubMembershipVerifier(config.participants.map((p) => p.webId));
}
