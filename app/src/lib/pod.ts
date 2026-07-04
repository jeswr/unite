// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Own-pod writes with an INJECTABLE fetch (never globalThis.fetch — the
// credential-leak boundary: the authenticated session-bound fetch is used ONLY
// for the participant's own pod). A fail-closed scope guard (assertWithinBase)
// rejects any computed target outside the pod container BEFORE any request
// fires — a mis-computed slug can never escape the container or downgrade
// scheme, and no user input ever reaches a URL path (slugs are crypto-random).

import { parseRdf } from "@jeswr/fetch-rdf";
import { assertWithinPodScope } from "@jeswr/guarded-fetch";
import { ContainerDataset } from "@solid/object";
import { DataFactory } from "n3";
import { type ConsentPolicy, consentQuads, ODRL_NS } from "./consent.js";
import {
  buildNeedQuads,
  isHttpIri,
  type Need,
  type Resonance,
  serializeNeed,
  serializeResonance,
  serializeTurtle,
} from "./model.js";

/** The subdirectory each statement type is written under. */
const NEEDS_DIR = "needs";
const RESONANCES_DIR = "resonances";

/** Default cap on a single resource/container body (bytes/characters). */
export const DEFAULT_MAX_BODY_BYTES = 1_000_000;

/**
 * Read a response body as text with an INCREMENTAL byte cap: aborts the stream
 * the moment the accumulated bytes exceed `maxBytes`, so a hostile pod with no
 * (or a lying) content-length cannot force unbounded memory. Also short-circuits
 * on a declared content-length over the cap.
 */
export async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`resource too large (declared ${declared} > ${maxBytes})`);
  }
  const body = res.body;
  if (!body) {
    const t = await res.text();
    if (t.length > maxBytes) throw new Error(`resource too large (> ${maxBytes})`);
    return t;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`resource too large (> ${maxBytes} bytes)`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // reader already released/closed — nothing to do.
    }
  }
}

/**
 * Fail-closed scope guard. Delegates the generic same-origin / path-prefix /
 * traversal (raw + `%2e`-encoded) / scheme-relative / credential / encoded-delimiter
 * checks to the suite's ONE reviewed pod-scope primitive
 * ({@link assertWithinPodScope}), and layers unite's protections on top, which that
 * primitive deliberately does NOT enforce (or only enforces when asked):
 *
 *   1. **https-only.** `assertWithinPodScope` accepts either `http:` or `https:` as
 *      long as base+target share an origin. unite requires https specifically, so we
 *      reject a non-https `base` up front. Because an origin includes the scheme, the
 *      primitive's same-origin check then transitively guarantees any accepted target
 *      is https too — the explicit target-side re-check below is provably redundant
 *      once the base is confirmed https, kept only for a clearer error message /
 *      defence in depth.
 *   2. **fail-loud "base must end in `/`" — checked on the PARSED `pathname`, not the
 *      raw string.** `assertWithinPodScope`/`normalizePodBase` SILENTLY append a
 *      trailing slash to a slashless base; unite's public contract instead FAILS LOUD
 *      on a malformed (slashless) base so a caller mistake surfaces rather than being
 *      papered over. This must check `URL#pathname`, not `base.endsWith("/")` on the
 *      raw string — a raw-string check is fooled by a slashless PATH whose query or
 *      fragment happens to end in "/" (e.g. `https://alice.example/unite/d1?x=/`: the
 *      string ends in "/" but the actual container path does not) — so a query/hash on
 *      `base` is rejected outright rather than silently ignored.
 *   3. **`allowRoot: false` — this is exclusively a WRITE-TARGET guard.** Both
 *      production callers ({@link writeNeed}, {@link writeResonance}) mint documents
 *      STRICTLY UNDER `base` (`<base><dir>/<slug>.ttl`), never the container document
 *      itself, so the base itself (with OR without its trailing slash) must never be
 *      accepted as a target — accepting the slashless form widened the boundary vs.
 *      the pre-consolidation guard (`t.pathname.startsWith(b.pathname)`, which a
 *      shorter slashless target can never satisfy). `allowRoot: true` here would
 *      re-open exactly that regression.
 *
 * Returns the CANONICAL (WHATWG-normalised) resolved URL — callers MUST use this
 * return value as the request target, not the raw `target`, so the URL that was
 * checked is the URL that is fetched.
 */
export function assertWithinBase(base: string, target: string): string {
  let b: URL;
  try {
    b = new URL(base);
  } catch {
    throw new Error(`assertWithinBase: invalid base URL: ${base}`);
  }
  if (b.protocol !== "https:") {
    throw new Error(`assertWithinBase: base must be https: ${base}`);
  }
  // Reject a query/fragment on the base BEFORE the trailing-slash check below: a
  // raw-string `base.endsWith("/")` check (the pre-existing form) can be fooled by
  // a slashless path whose query/fragment happens to end in "/" (e.g.
  // `https://alice.example/unite/d1?x=/`) — the string ends in "/" but the actual
  // container path does not, so a downstream normaliser would silently paper over
  // the malformed base instead of this wrapper failing loud as documented.
  if (b.search !== "" || b.hash !== "") {
    throw new Error(`assertWithinBase: base must not carry a query or fragment: ${base}`);
  }
  if (!b.pathname.endsWith("/")) {
    throw new Error(`assertWithinBase: base must be a container ending in "/": ${base}`);
  }
  const scoped = assertWithinPodScope(base, target, { allowRoot: false });
  // Provably redundant once `base` is confirmed https (same-origin transitively
  // guarantees a scheme match, since origin includes the scheme) — kept for a
  // clearer error message / defence in depth.
  if (new URL(scoped).protocol !== "https:") {
    throw new Error(`assertWithinBase: target must be https (no downgrade): ${target}`);
  }
  return scoped;
}

/** Non-throwing form of {@link assertWithinBase} — true iff `target` is in scope. */
export function isWithinBase(base: string, target: string): boolean {
  try {
    assertWithinBase(base, target);
    return true;
  } catch {
    return false;
  }
}

/** A collision-free, no-user-input resource slug. */
function slug(): string {
  return crypto.randomUUID();
}

/** Compute the child resource URL `<base><dir>/<slug>.ttl`. */
function childUrl(base: string, dir: string, name: string): string {
  return new URL(`${dir}/${name}.ttl`, base).toString();
}

/** The outcome of a write: the created resource + the raw response. */
export interface WriteResult<T> {
  readonly url: string;
  readonly resource: T;
  readonly response: Response;
}

async function putTurtle(fetchFn: typeof fetch, url: string, body: string): Promise<Response> {
  const response = await fetchFn(url, {
    method: "PUT",
    headers: {
      "content-type": "text/turtle",
      // create-only: fail if the (random) slug somehow already exists.
      "if-none-match": "*",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`pod write failed: ${response.status} ${response.statusText} (${url})`);
  }
  return response;
}

/**
 * Write a {@link Need} to the participant's own pod at `<base>needs/<slug>.ttl`.
 * `base` must be the participant's unite container (ends "/"). The `fetchFn` is
 * the session-bound authenticated fetch (own-origin only). Returns the created
 * Need (with its assigned `id`).
 */
export async function writeNeed(
  fetchFn: typeof fetch,
  base: string,
  need: Omit<Need, "id">,
  consent?: ConsentPolicy,
): Promise<WriteResult<Need>> {
  // fail-closed BEFORE serialise/fetch; use the CANONICAL returned URL for everything
  // downstream (the id, the body, and the PUT target) — never the raw computed string.
  const url = assertWithinBase(base, childUrl(base, NEEDS_DIR, slug()));
  const resource: Need = { ...need, id: url };
  let body: string;
  if (consent) {
    // Write the need + its inline ODRL consent policy in ONE resource, linked by
    // odrl:hasPolicy (design/01 — the author's standing consent record).
    const quads = [...buildNeedQuads(resource), ...consentQuads(url, consent, resource.creator)];
    body = await serializeTurtle(quads, { odrl: ODRL_NS });
  } else {
    body = await serializeNeed(resource);
  }
  const response = await putTurtle(fetchFn, url, body);
  return { url, resource, response };
}

/**
 * Write a {@link Resonance} to the participant's own pod at
 * `<base>resonances/<slug>.ttl`. See {@link writeNeed}.
 */
export async function writeResonance(
  fetchFn: typeof fetch,
  base: string,
  resonance: Omit<Resonance, "id">,
): Promise<WriteResult<Resonance>> {
  // fail-closed BEFORE serialise/fetch; use the CANONICAL returned URL downstream.
  const url = assertWithinBase(base, childUrl(base, RESONANCES_DIR, slug()));
  const resource: Resonance = { ...resonance, id: url };
  const body = await serializeResonance(resource);
  const response = await putTurtle(fetchFn, url, body);
  return { url, resource, response };
}

/**
 * List the http(s) member IRIs of an LDP container (via `ldp:contains`, read
 * through the @solid/object ContainerDataset — never hand-parsed). A 404
 * (container not yet created) resolves to an empty list; other errors throw.
 * `fetchFn` should be `publicFetch` for a foreign participant's container and
 * the authenticated fetch for the user's own.
 */
export async function listContainer(
  fetchFn: typeof fetch,
  url: string,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<string[]> {
  const res = await fetchFn(url, {
    headers: { accept: "text/turtle, application/ld+json;q=0.9" },
  });
  if (res.status === 404) return []; // container not yet created
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const text = await readBodyCapped(res, maxBytes);
  const dataset = await parseRdf(text, res.headers.get("content-type"), { baseIRI: url });
  const container = new ContainerDataset(dataset, DataFactory).container;
  if (!container) return [];
  const out: string[] = [];
  for (const resource of container.contains) {
    // Resource.id is a string; keep only absolute http(s) member IRIs.
    if (isHttpIri(resource.id)) out.push(resource.id);
  }
  return out;
}
