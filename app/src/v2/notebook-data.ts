// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The NOTEBOOK's data layer (design/v2 02 §8, 03 §7): everything unite has
// heard FROM YOU, read from YOUR OWN pod — the same read path any aggregation
// uses, because there is no server record to show. Edit = a superseding
// write (latest-wins is already the aggregate's dedupe rule); DELETE = the
// pod resource goes, and every downstream artifact recomputes on next read —
// deletion propagation is architectural, not a compliance feature
// (fixture-pinned in notebook-data.test.ts).
//
// Also here: the QUOTABILITY read the letter needs — a statement's inline
// ODRL consent, parsed by the v1 consent layer, FAIL-CLOSED (no policy /
// unparseable policy / prohibition ⇒ not quotable).

import { parseRdf } from "@jeswr/fetch-rdf";
import { parseConsent } from "../lib/consent.js";
import type { Need, Resonance } from "../lib/model.js";
import { parseNeeds, parseResonances } from "../lib/model.js";
import type { Claim, ValueStatement } from "../lib/model-society.js";
import { parseClaims, parseValueStatements } from "../lib/model-society.js";
import {
  assertWithinBase,
  DEFAULT_MAX_BODY_BYTES,
  isWithinBase,
  listContainer,
  readBodyCapped,
} from "../lib/pod.js";

/** Everything the notebook lists from the person's own pod. */
export interface OwnStatements {
  readonly claims: readonly Claim[];
  readonly needs: readonly Need[];
  readonly values: readonly ValueStatement[];
  readonly resonances: readonly Resonance[];
}

async function readMembers<T>(
  fetchFn: typeof fetch,
  base: string,
  dir: string,
  parse: (ds: Awaited<ReturnType<typeof parseRdf>>) => T[],
  maxBytes: number,
): Promise<T[]> {
  const out: T[] = [];
  let members: string[];
  try {
    members = await listContainer(fetchFn, new URL(`${dir}/`, base).toString());
  } catch {
    return out; // fail-isolated: an unreadable container lists as empty
  }
  for (const member of members) {
    if (!isWithinBase(base, member)) continue;
    try {
      const res = await fetchFn(member, {
        headers: { accept: "text/turtle, application/ld+json;q=0.9" },
      });
      if (!res.ok) continue;
      const text = await readBodyCapped(res, maxBytes);
      const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: member });
      out.push(...parse(ds));
    } catch {
      // fail-isolated: a broken member never hides the rest of the notebook
    }
  }
  return out;
}

/** Read the person's own expression-layer statements + reactions. */
export async function readOwnStatements(
  fetchFn: typeof fetch,
  base: string,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<OwnStatements> {
  return {
    claims: await readMembers(fetchFn, base, "claims", parseClaims, maxBytes),
    needs: await readMembers(fetchFn, base, "needs", parseNeeds, maxBytes),
    values: await readMembers(fetchFn, base, "values", parseValueStatements, maxBytes),
    resonances: await readMembers(fetchFn, base, "resonances", parseResonances, maxBytes),
  };
}

/**
 * Delete one of the person's OWN pod resources (fail-closed scope guard:
 * only within their own base). The engine forgets it on the next read.
 */
export async function deleteOwnResource(
  fetchFn: typeof fetch,
  base: string,
  resource: string,
): Promise<void> {
  const url = assertWithinBase(base, resource);
  const res = await fetchFn(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete failed: ${res.status} ${res.statusText} (${url})`);
  }
}

/**
 * Is a statement QUOTABLE (ODRL fut:quoteVerbatim permitted by its author's
 * inline consent)? FAIL-CLOSED: a missing resource, a parse failure, or an
 * absent/prohibiting policy all answer false — the letter then carries the
 * theme without the words.
 */
export async function isQuotable(
  fetchFn: typeof fetch,
  resource: string,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<boolean> {
  try {
    const res = await fetchFn(resource, {
      headers: { accept: "text/turtle, application/ld+json;q=0.9" },
    });
    if (!res.ok) return false;
    const text = await readBodyCapped(res, maxBytes);
    const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: resource });
    const policy = parseConsent(ds, resource);
    return policy?.quoteVerbatim === true;
  } catch {
    return false;
  }
}
