// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Circle chat over pods (design/v2 03 §2 top of pipeline): a circle message is
// an ORDINARY pod resource — the suite's canonical AS2.0 chat shape
// (@jeswr/solid-chat-interop CanonicalMessage; typed accessors, never
// hand-built triples) under the author's own `circle-messages/` container,
// with `as:context` naming the circle. UNGATED on write (the §2a gate split:
// a person's own words in their own room are NOT screened — the C4 screen
// runs where the machine layer begins: the drafter pre-screen + the
// pod-society adoption chokepoints, both untouched here).
//
// The read is a small creator-verified, fail-isolated, base-scoped fold in
// the lib/channel.ts mold (structurally simpler: circles have no threads, no
// agent turns, no edit pointers in V1) — reused verbatim by the notebook's
// "your words" section.

import { parseRdf } from "@jeswr/fetch-rdf";
import {
  as2MessageSubject,
  type CanonicalMessage,
  parseAs2Message,
  serializeAs2,
} from "@jeswr/solid-chat-interop";
import {
  assertWithinBase,
  childUrl,
  DEFAULT_MAX_BODY_BYTES,
  isWithinBase,
  listContainer,
  putTurtle,
  readBodyCapped,
  slug,
} from "../lib/pod.js";

/** The pod container circle messages live under (per participant). */
export const CIRCLE_MESSAGES_DIR = "circle-messages";

/** One verified circle message. */
export interface CircleMessage {
  /** The message subject IRI (`${resource}#it`). */
  readonly id: string;
  /** The pod resource URL it was read from (strictly within its author's base). */
  readonly resource: string;
  /** The verified authoring WebID (== the pod owner). */
  readonly author: string;
  readonly content: string;
  /** `as:published` ISO-8601 stamp (drives ordering; absent sorts oldest). */
  readonly published: string | undefined;
  /** The message this replies to, when present. */
  readonly inReplyTo: string | undefined;
}

/** What {@link writeCircleMessage} needs. */
export interface CircleMessageWrite {
  readonly author: string;
  readonly content: string;
  /** The circle IRI (`as:context`). */
  readonly circle: string;
  /** ISO-8601 stamp. */
  readonly published: string;
  readonly inReplyTo?: string;
  /** Stable resource name (seeding); default a crypto-random slug. */
  readonly name?: string;
}

/**
 * Write one circle message to the author's own pod at
 * `<base>circle-messages/<name>.ttl`. Fail-closed scope guard BEFORE any
 * request; the canonical AS2.0 serializer (typed accessors) builds the body.
 * DELIBERATELY no sensitive-domain screen (the §2a split — see the header).
 */
export async function writeCircleMessage(
  fetchFn: typeof fetch,
  base: string,
  msg: CircleMessageWrite,
): Promise<{ url: string; id: string }> {
  const url = assertWithinBase(base, childUrl(base, CIRCLE_MESSAGES_DIR, msg.name ?? slug()));
  const id = as2MessageSubject(url);
  const canonical: CanonicalMessage = {
    content: msg.content,
    mediaType: "text/plain",
    author: msg.author,
    room: msg.circle,
    published: msg.published,
    ...(msg.inReplyTo !== undefined ? { inReplyTo: msg.inReplyTo } : {}),
  };
  const body = await serializeAs2(canonical, id);
  await putTurtle(fetchFn, url, body);
  return { url, id };
}

/**
 * Read a circle's messages from its participants' pods. Creator-verified
 * (a message counts only when its `as:attributedTo` is the pod owner —
 * cross-pod attribution refused), base-scoped (a container member outside the
 * participant's own base is skipped), tombstone-filtered, fail-isolated (a
 * broken member skips, siblings survive), and deterministically ordered
 * (published ASC, id tie-break).
 */
export async function readCircleMessages(
  fetchFn: typeof fetch,
  participants: ReadonlyArray<{ readonly webId: string; readonly base: string }>,
  circle: string,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<CircleMessage[]> {
  const out: CircleMessage[] = [];
  const seen = new Set<string>();
  for (const p of participants) {
    let members: string[];
    try {
      members = await listContainer(fetchFn, new URL(`${CIRCLE_MESSAGES_DIR}/`, p.base).toString());
    } catch {
      continue; // fail-isolated: this participant's listing degrades, others survive
    }
    for (const member of members) {
      if (!isWithinBase(p.base, member)) continue; // hostile listing → skip
      try {
        const res = await fetchFn(member, {
          headers: { accept: "text/turtle, application/ld+json;q=0.9" },
        });
        if (!res.ok) continue;
        const text = await readBodyCapped(res, maxBytes);
        const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: member });
        const id = as2MessageSubject(member);
        const msg = parseAs2Message(id, ds);
        if (msg === undefined) continue;
        if (msg.author !== p.webId) continue; // creator-owns-the-pod
        if (msg.room !== circle) continue; // this circle only
        if (msg.deletedAt !== undefined) continue; // tombstoned
        if (msg.content.length === 0) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          resource: member,
          author: p.webId,
          content: msg.content,
          published: msg.published,
          inReplyTo: msg.inReplyTo,
        });
      } catch {
        // fail-isolated: a broken member never aborts the read
      }
    }
  }
  out.sort((a, b) => {
    const at = a.published === undefined ? 0 : Date.parse(a.published);
    const bt = b.published === undefined ? 0 : Date.parse(b.published);
    const am = Number.isNaN(at) ? 0 : at;
    const bm = Number.isNaN(bt) ? 0 : bt;
    if (am !== bm) return am - bm;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}
