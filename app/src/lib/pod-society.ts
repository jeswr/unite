// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Own-pod writes for the scope-C expression layer (S4 —
// docs/SCOPE-DIFFERENTIATION.md §4.3): fut:VisionStatement / fut:Claim /
// fut:ValueStatement, written under the participant's unite container with
// the SAME discipline as lib/pod.ts (whose reviewed primitives this module
// reuses): injectable fetch, fail-closed scope guard BEFORE any request,
// crypto-random slugs, create-only PUT.
//
// Two scope-C-specific chokepoint guards live HERE (not only in UI):
//   • The C4 sensitive-domain launch gate (lib/sensitive.ts): a statement
//     that reads as personal health/finance disclosure is REFUSED —
//     fail-closed, before serialisation, so no UI path can write past it.
//   • The adoption invariant is already unrepresentable in the serialiser
//     (model-society.buildClaimQuads throws on adoptedBy ≠ creator).
//
// Expression-layer resources carry the author's inline ODRL consent policy
// (design/01) exactly like needs/proposals — consent gates what the
// federation may DO with a statement (aggregate/synthesize/quote/govern).

import { type ConsentPolicy, consentQuads, ODRL_NS } from "./consent.js";
import { NS } from "./fut.js";
import { type Critique, type SynthesisCandidate, serializeTurtle } from "./model.js";
import {
  buildClaimQuads,
  buildValueQuads,
  buildVisionQuads,
  type Claim,
  type ValueStatement,
  type VisionStatement,
} from "./model-society.js";
import {
  assertWithinBase,
  childUrl,
  putTurtle,
  slug,
  type WriteResult,
  writeCandidate,
  writeCritique,
} from "./pod.js";
import { assertNotSensitive } from "./sensitive.js";

/** The subdirectory each scope-C statement type is written under. */
const VISIONS_DIR = "visions";
const CLAIMS_DIR = "claims";
const VALUES_DIR = "values";

/**
 * Write a {@link VisionStatement} to the author's own pod at
 * `<base>visions/<slug>.ttl`. Fail-closed: scope guard first, then the C4
 * sensitive-domain screen over the narrative (title included) — a hit refuses
 * the write with a plain-language explanation.
 */
export async function writeVision(
  fetchFn: typeof fetch,
  base: string,
  vision: Omit<VisionStatement, "id">,
  consent?: ConsentPolicy,
): Promise<WriteResult<VisionStatement>> {
  const url = assertWithinBase(base, childUrl(base, VISIONS_DIR, slug()));
  assertNotSensitive(`${vision.title ?? ""}\n${vision.content}`);
  const resource: VisionStatement = { ...vision, id: url };
  const quads = buildVisionQuads(resource);
  if (consent) quads.push(...consentQuads(url, consent, resource.creator));
  const body = await serializeTurtle(quads, consent ? { odrl: ODRL_NS } : undefined);
  const response = await putTurtle(fetchFn, url, body);
  return { url, resource, response };
}

/**
 * Write a {@link Claim} to the author's own pod at `<base>claims/<slug>.ttl`.
 * The adoption invariant is enforced by the serialiser (adoptedBy must equal
 * creator — an unadopted claim is unwritable); the C4 screen runs first.
 */
export async function writeClaim(
  fetchFn: typeof fetch,
  base: string,
  claim: Omit<Claim, "id">,
  consent?: ConsentPolicy,
): Promise<WriteResult<Claim>> {
  const url = assertWithinBase(base, childUrl(base, CLAIMS_DIR, slug()));
  assertNotSensitive(claim.content);
  const resource: Claim = { ...claim, id: url };
  const quads = buildClaimQuads(resource);
  if (consent) quads.push(...consentQuads(url, consent, resource.creator));
  const body = await serializeTurtle(quads, {
    prov: NS.prov,
    ...(consent ? { odrl: ODRL_NS } : {}),
  });
  const response = await putTurtle(fetchFn, url, body);
  return { url, resource, response };
}

/**
 * Write a Convergence-Room candidate IN THE SOCIETY SCOPE: the C4 screen runs
 * at THIS write boundary (title + content) before delegating to the shared
 * {@link writeCandidate} — a non-UI caller cannot write sensitive society Room
 * text past the gate. Scope A/B rooms keep calling writeCandidate directly
 * (the C4 gate is scope C's launch constraint, not platform moderation).
 */
export async function writeSocietyCandidate(
  fetchFn: typeof fetch,
  base: string,
  candidate: Omit<SynthesisCandidate, "id">,
): Promise<WriteResult<SynthesisCandidate>> {
  assertNotSensitive(`${candidate.title ?? ""}\n${candidate.content}`);
  return writeCandidate(fetchFn, base, candidate);
}

/**
 * Write a Convergence-Room critique IN THE SOCIETY SCOPE: C4-screened at the
 * write boundary (dissent-annex material may publish verbatim under
 * quoteVerbatim, so it must not carry personal disclosure), then delegates to
 * the shared {@link writeCritique}.
 */
export async function writeSocietyCritique(
  fetchFn: typeof fetch,
  base: string,
  critique: Omit<Critique, "id">,
  consent?: ConsentPolicy,
): Promise<WriteResult<Critique>> {
  assertNotSensitive(critique.content);
  return writeCritique(fetchFn, base, critique, consent);
}

/**
 * Write a {@link ValueStatement} to the author's own pod at
 * `<base>values/<slug>.ttl`. Same guards as {@link writeClaim}.
 */
export async function writeValueStatement(
  fetchFn: typeof fetch,
  base: string,
  value: Omit<ValueStatement, "id">,
  consent?: ConsentPolicy,
): Promise<WriteResult<ValueStatement>> {
  const url = assertWithinBase(base, childUrl(base, VALUES_DIR, slug()));
  assertNotSensitive(value.content);
  const resource: ValueStatement = { ...value, id: url };
  const quads = buildValueQuads(resource);
  if (consent) quads.push(...consentQuads(url, consent, resource.creator));
  const body = await serializeTurtle(quads, consent ? { odrl: ODRL_NS } : undefined);
  const response = await putTurtle(fetchFn, url, body);
  return { url, resource, response };
}
