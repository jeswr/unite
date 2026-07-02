// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Own-pod writes with an INJECTABLE fetch (never globalThis.fetch — the
// credential-leak boundary: the authenticated session-bound fetch is used ONLY
// for the participant's own pod). A fail-closed scope guard (assertWithinBase)
// rejects any computed target outside the pod container BEFORE any request
// fires — a mis-computed slug can never escape the container or downgrade
// scheme, and no user input ever reaches a URL path (slugs are crypto-random).

import { parseRdf } from "@jeswr/fetch-rdf";
import { ContainerDataset } from "@solid/object";
import { DataFactory } from "n3";
import {
  isHttpIri,
  type Need,
  type Resonance,
  serializeNeed,
  serializeResonance,
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
 * Fail-closed scope guard. Throws unless `target` is an https URL strictly
 * within the https container `base` (same origin + path-prefix). Rejects
 * traversal (`..`), encoded traversal (`%2e%2e`), scheme downgrade, and
 * cross-origin / scheme-relative targets. `base` MUST end in "/".
 */
export function assertWithinBase(base: string, target: string): void {
  const loweredTarget = target.toLowerCase();
  if (
    target.includes("..") ||
    loweredTarget.includes("%2e%2e") ||
    loweredTarget.includes("%2e.") ||
    loweredTarget.includes(".%2e")
  ) {
    throw new Error(`assertWithinBase: traversal rejected: ${target}`);
  }
  if (!base.endsWith("/")) {
    throw new Error(`assertWithinBase: base must be a container ending in "/": ${base}`);
  }
  let b: URL;
  let t: URL;
  try {
    b = new URL(base);
  } catch {
    throw new Error(`assertWithinBase: invalid base URL: ${base}`);
  }
  try {
    // Parsing WITHOUT a base: a scheme-relative or relative `target` throws here.
    t = new URL(target);
  } catch {
    throw new Error(`assertWithinBase: invalid absolute target URL: ${target}`);
  }
  if (b.protocol !== "https:") {
    throw new Error(`assertWithinBase: base must be https: ${base}`);
  }
  if (t.protocol !== "https:") {
    throw new Error(`assertWithinBase: target must be https (no downgrade): ${target}`);
  }
  if (t.origin !== b.origin) {
    throw new Error(`assertWithinBase: cross-origin target rejected: ${target}`);
  }
  if (!t.pathname.startsWith(b.pathname)) {
    throw new Error(`assertWithinBase: target escapes base path: ${target}`);
  }
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
): Promise<WriteResult<Need>> {
  const url = childUrl(base, NEEDS_DIR, slug());
  assertWithinBase(base, url); // fail-closed BEFORE serialise/fetch
  const resource: Need = { ...need, id: url };
  const body = await serializeNeed(resource);
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
  const url = childUrl(base, RESONANCES_DIR, slug());
  assertWithinBase(base, url);
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
