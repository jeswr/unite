// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE PRIVATE "ACTUALLY, I DON'T" TAP (design/v2 03 §4, 04 §4 — the
// Abilene/spiral-of-silence guard, FINDING-3-routed). The load-bearing
// property is STRUCTURAL INVISIBILITY AT CIRCLE SCALE:
//
//   • a tap is written to a SEPARATE SIGNAL STORE — its own pod container
//     (`private-taps/`) and its own type (`fut:PrivateTap`), OUTSIDE the
//     ordinary `fut:Resonance` universe — so the unchanged engine's
//     buildMatrix/livingSummary/candidateReception can never see it on any
//     circle read path BY CONSTRUCTION (no engine edit; the routing is
//     surface composition);
//   • it renders NOTHING below the ≥k batch threshold (DEFAULT_K_THRESHOLD
//     distinct tappers on the same statement) — `foldCommunityTaps` simply
//     returns no entry;
//   • it NEVER enters its originating circle's summary at any count —
//     structurally true, because the summary computes over resonances only;
//   • its only within-circle trace is the notetaker's missing-voice
//     invitation, which in this build is a PURE FUNCTION OF (circle id,
//     message count) and takes NO tap input at all — the rendered output is
//     therefore not merely statistically but LITERALLY indistinguishable
//     between tap and no-tap (the strongest form of 03 §4's seeded-jitter
//     rule, and the fixture pins it).
//
// Writes go through the same typed-quads + fail-closed scope-guard path as
// every other v2 pod write (the adopt.ts pattern: DataFactory quads →
// serializeTurtle → assertWithinBase → putTurtle; never hand-concat strings).

import { parseRdf } from "@jeswr/fetch-rdf";
import { DataFactory } from "n3";
import {
  DCT_CREATED,
  DCT_CREATOR,
  DEFAULT_K_THRESHOLD,
  FUT_ON_STATEMENT,
  fut,
  NS,
  RDF_TYPE,
} from "../lib/fut.js";
import { serializeTurtle } from "../lib/model.js";
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

const { namedNode, quad, literal } = DataFactory;

/** The pod container private taps live under (per participant). */
export const PRIVATE_TAPS_DIR = "private-taps";

/** The tap's own type — deliberately NOT fut:Resonance (a separate universe). */
export const FUT_PRIVATE_TAP: string = fut("PrivateTap");

/** The originating circle, recorded for audit (as:context). */
const AS_CONTEXT = `${NS.as}context`;

const XSD_DATETIME = `${NS.xsd}dateTime`;

/** One verified private tap. */
export interface PrivateTap {
  /** The tap subject IRI (`${resource}#tap`). */
  readonly id: string;
  /** The statement privately dissented from. */
  readonly onStatement: string;
  /** The verified tapper WebID (== the pod owner). */
  readonly creator: string;
  /** The circle the summary line was seen in (audit only — never a read key). */
  readonly circle: string;
  readonly created: string;
}

/** The private acknowledgement the tapper (and only the tapper) sees. */
export const TAP_ACK =
  "Noted, privately. Nothing this circle sees changes because of it — if enough people across " +
  "the whole community quietly feel the same, it surfaces there, anonymously. The public " +
  "“I see it differently” is always one tap away if you want the room to know.";

/** Write one private tap to the tapper's OWN pod. Fail-closed scope guard. */
export async function writePrivateTap(
  fetchFn: typeof fetch,
  base: string,
  tap: Omit<PrivateTap, "id">,
): Promise<{ url: string; id: string }> {
  const url = assertWithinBase(base, childUrl(base, PRIVATE_TAPS_DIR, slug()));
  const id = `${url}#tap`;
  const s = namedNode(id);
  const quads = [
    quad(s, namedNode(RDF_TYPE), namedNode(FUT_PRIVATE_TAP)),
    quad(s, namedNode(FUT_ON_STATEMENT), namedNode(tap.onStatement)),
    quad(s, namedNode(DCT_CREATOR), namedNode(tap.creator)),
    quad(s, namedNode(AS_CONTEXT), namedNode(tap.circle)),
    quad(s, namedNode(DCT_CREATED), literal(tap.created, namedNode(XSD_DATETIME))),
  ];
  await putTurtle(fetchFn, url, await serializeTurtle(quads, { fut: NS.fut }));
  return { url, id };
}

/** First object of (subject, predicate) in a dataset, or undefined. */
function objectOf(
  ds: Awaited<ReturnType<typeof parseRdf>>,
  subject: string,
  predicate: string,
): string | undefined {
  for (const q of ds.match(namedNode(subject), namedNode(predicate), null, null)) {
    return q.object.value;
  }
  return undefined;
}

/**
 * Read the private-tap store across participants' pods. Creator-verified
 * (a tap counts only when its dct:creator is the pod owner), base-scoped,
 * fail-isolated — the same fold posture as every other cross-pod read.
 */
export async function readPrivateTaps(
  fetchFn: typeof fetch,
  participants: ReadonlyArray<{ readonly webId: string; readonly base: string }>,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<PrivateTap[]> {
  const out: PrivateTap[] = [];
  for (const p of participants) {
    let members: string[];
    try {
      members = await listContainer(fetchFn, new URL(`${PRIVATE_TAPS_DIR}/`, p.base).toString());
    } catch {
      continue; // fail-isolated
    }
    for (const member of members) {
      if (!isWithinBase(p.base, member)) continue;
      try {
        const res = await fetchFn(member, { headers: { accept: "text/turtle" } });
        if (!res.ok) continue;
        const text = await readBodyCapped(res, maxBytes);
        const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: member });
        const id = `${member}#tap`;
        const isTap = [
          ...ds.match(namedNode(id), namedNode(RDF_TYPE), namedNode(FUT_PRIVATE_TAP), null),
        ];
        if (isTap.length === 0) continue;
        const onStatement = objectOf(ds, id, FUT_ON_STATEMENT);
        const creator = objectOf(ds, id, DCT_CREATOR);
        const circle = objectOf(ds, id, AS_CONTEXT);
        const created = objectOf(ds, id, DCT_CREATED);
        if (onStatement === undefined || creator === undefined || created === undefined) continue;
        if (creator !== p.webId) continue; // creator-owns-the-pod
        out.push({ id, onStatement, creator, circle: circle ?? "", created });
      } catch {
        // fail-isolated: a broken member never aborts the fold
      }
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * Fold taps into COMMUNITY-scale annotations, ≥k-gated (03 §4): the returned
 * map has an entry ONLY for statements with ≥k DISTINCT tappers — below k a
 * statement simply is not in the map, so nothing can render. The value is
 * deliberately NOT a count: the letter's annotation is count-free.
 */
export function foldCommunityTaps(
  taps: readonly PrivateTap[],
  k: number = DEFAULT_K_THRESHOLD,
): ReadonlySet<string> {
  const tappers = new Map<string, Set<string>>();
  for (const t of taps) {
    const set = tappers.get(t.onStatement);
    if (set === undefined) tappers.set(t.onStatement, new Set([t.creator]));
    else set.add(t.creator);
  }
  const out = new Set<string>();
  for (const [statement, who] of tappers) {
    if (who.size >= k) out.add(statement);
  }
  return out;
}

/** The count-free letter annotation for a ≥k-tapped theme (03 §4). */
export const TAPPED_ANNOTATION =
  "Privately, people across the community have said this doesn't quite speak for them — held " +
  "anonymously until enough said so, and now said here rather than nowhere.";

/**
 * The notetaker's missing-voice invitation schedule — the SEEDED JITTER
 * (03 §4): a pure, deterministic function of the circle id and the message
 * count ONLY. It takes no tap input, so its rendered output is literally
 * identical whether or not anyone tapped — neither the prompt's arrival nor
 * its absence is evidence of dissent.
 */
export function missingVoiceInvite(circleId: string, messageCount: number): boolean {
  let h = 0;
  for (let i = 0; i < circleId.length; i++) h = (h * 31 + circleId.charCodeAt(i)) >>> 0;
  // Fires on a sparse, reproducible cadence once a conversation has body.
  return messageCount >= 6 && (h + messageCount) % 5 === 0;
}

/** The invitation's copy — asks the room, points at no one (04 §4). */
export const MISSING_VOICE_INVITE =
  "A thought for the room: what would someone who disagrees with where this is heading say? " +
  "No pressure on anyone — the question is the point.";
