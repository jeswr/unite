// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// IN-CONTEXT CONSENT MOMENTS (design/v2 02 §7, 07 §3 V4): nothing is asked at
// signup; the moment a context CHANGE would happen (here: a circle question +
// consented synthesis flowing to an expert), the person is asked THEN, about
// THAT — and the answer is written into their own pod as an ODRL policy
// (lib/consent.ts consentQuads — the same typed builder the v1 compose path
// uses), alongside the plain-words ask it answered.
//
// ENFORCEMENT HONESTY (scope of what is wired TODAY): the standing consent
// gates (the aggregate's ODRL checks, the letter's isQuotable) parse the
// policy INLINE ON the statement resource itself — they do not read this
// `consents/` record. What ENFORCES an expert-moment decision today is the
// asking surface: a declined ExpertMoment renders nothing of the decliner's
// and stages the introduction on others' consented content only (the demo's
// expert is client-side staged; no machine path ships anything to a real
// expert). This record is the person's AUDITABLE decision trail — their pod,
// their words, their answer. Folding it into the statement's own inline
// policy (so the engine-level gates see it too) is flagged follow-up work
// for the live expert pipeline; the surface copy says exactly this and does
// not overclaim.
//
// A "no" is respected structurally: it is recorded the same way, and the
// session memory ensures it is never re-asked as though it were a mistake.

import { DataFactory } from "n3";
import { type ConsentPolicy, consentQuads, DEFAULT_CONSENT, ODRL_NS } from "../lib/consent.js";
import { serializeTurtle } from "../lib/model.js";
import { assertWithinBase, childUrl, putTurtle, slug } from "../lib/pod.js";

const { namedNode, quad, literal } = DataFactory;

/** The pod container consent-moment records live under. */
export const CONSENTS_DIR = "consents";

/** One consent decision, as the surface records it. */
export interface ConsentDecision {
  /** What the moment was about (the statement/question IRI). */
  readonly about: string;
  /** The plain-words ask that was answered (audit honesty). */
  readonly asked: string;
  /** The person's answer. */
  readonly granted: boolean;
  readonly creator: string;
  readonly created: string;
}

const DCT_DESCRIPTION = "http://purl.org/dc/terms/description";

/**
 * Record a consent decision to the person's OWN pod: the ODRL policy for the
 * `about` resource (granted → synthesize permitted per the v1 default shape;
 * declined → synthesize prohibited), plus the plain-words ask it answered.
 * Typed quads, fail-closed scope guard. This is the auditable decision
 * record — see the header for what enforces the decision today.
 */
export async function recordConsentDecision(
  fetchFn: typeof fetch,
  base: string,
  decision: ConsentDecision,
): Promise<{ url: string }> {
  const url = assertWithinBase(base, childUrl(base, CONSENTS_DIR, slug()));
  const policy: ConsentPolicy = {
    ...DEFAULT_CONSENT,
    // The expert moment shares the consented SYNTHESIS, never the chat:
    // a grant permits synthesis; a decline prohibits it for this resource.
    synthesize: decision.granted,
  };
  const quads = [
    ...consentQuads(decision.about, policy, decision.creator),
    // The ask itself, kept with the answer (the notebook can restate it).
    quad(namedNode(url), namedNode(DCT_DESCRIPTION), literal(decision.asked)),
  ];
  await putTurtle(fetchFn, url, await serializeTurtle(quads, { odrl: ODRL_NS }));
  return { url };
}

// ── Session memory: a consent moment is asked ONCE (02 §7's frequency rule;
//    a "no" is never re-asked as though it were wrong). ─────────────────────

const decided = new Map<string, boolean>();

/** The session's remembered decision for a moment key, if any. */
export function decisionFor(key: string): boolean | undefined {
  return decided.get(key);
}

export function rememberDecision(key: string, granted: boolean): void {
  decided.set(key, granted);
}

/** TEST-ONLY: reset the session memory. */
export function resetConsentMemory(): void {
  decided.clear();
}
