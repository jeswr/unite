// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The participant-listing seam (decisions/0001). Aggregation needs to know WHO
// is in a deliberation and WHERE each participant's unite container lives, so it
// can read their needs/resonances from their own pod.
//
// PRODUCTION wiring (follow-up): a DeliberationRegistry over
// @jeswr/federation-registry `fedreg:Registry` memberships — the community's
// registry of vouched participants + their storage descriptions.

import { isHttpIri } from "./model.js";

/** A participant in a deliberation. */
export interface Participant {
  /** The participant's WebID (the identity + the dct:creator match key). */
  readonly webId: string;
  /** The participant's unite container URL for this deliberation (ends "/"). */
  readonly base: string;
}

/** The swappable participant-listing seam. */
export interface DeliberationRegistry {
  /** The deliberation IRI this registry serves. */
  readonly deliberation: string;
  /** List the deliberation's participants. */
  listParticipants(): Promise<Participant[]>;
}

/** True for an https container URL that ends in "/" (a valid pod base). */
function isValidBase(base: string): boolean {
  if (!base.endsWith("/")) return false;
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return false;
  }
  return u.protocol === "https:";
}

/**
 * A static, config-driven registry. Entries are validated on construction:
 * an https WebID + an https base ending in "/". An invalid entry throws (a
 * misconfiguration should be loud, not silently dropped).
 */
export class StaticRegistry implements DeliberationRegistry {
  readonly deliberation: string;
  readonly #participants: ReadonlyArray<Participant>;

  constructor(deliberation: string, participants: ReadonlyArray<Participant>) {
    if (!isHttpIri(deliberation)) {
      throw new Error(`StaticRegistry: deliberation is not an http(s) IRI: ${deliberation}`);
    }
    for (const p of participants) {
      // WebIDs must be https (a credential identity; no http downgrade).
      if (!isHttpIri(p.webId) || !p.webId.startsWith("https:")) {
        throw new Error(`StaticRegistry: invalid participant webId: ${p.webId}`);
      }
      if (!isValidBase(p.base)) {
        throw new Error(
          `StaticRegistry: invalid participant base (need https, trailing "/"): ${p.base}`,
        );
      }
    }
    this.deliberation = deliberation;
    this.#participants = [...participants];
  }

  listParticipants(): Promise<Participant[]> {
    return Promise.resolve([...this.#participants]);
  }
}
