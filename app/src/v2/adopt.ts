// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The ADOPTION path (design/v2 03 §2 bottom of pipeline): what happens when a
// person taps "that's it" (or edits, then adopts) on a mirror. Every atom is
// written through the UNTOUCHED v1 model-society path — writeClaim /
// writeSocietyNeed / writeValueStatement (lib/pod-society.ts) — so:
//
//   • the C6 ADOPTION INVARIANT holds by construction (the serializer throws
//     on adoptedBy ≠ creator; a forged adoption is unwritable);
//   • the C4 SENSITIVE gate stays FAIL-CLOSED at the chokepoint
//     (assertNotSensitive throws before serialisation — a UI bypass, or an
//     edit that re-introduces sensitive text, still cannot write past it);
//   • consent rides along as the author's inline ODRL policy.
//
// PROV (C6 — assistance is never invisible): the run first writes ONE
// prov:Activity resource to the author's own pod recording the drafter's
// {tool, plan}; every adopted CLAIM carries fut:decomposedBy → that activity.
// (Needs/values have no decomposedBy field in the v1 model — the activity
// resource still records the run they came from.)

import { DataFactory } from "n3";
import { type ConsentPolicy, DEFAULT_CONSENT } from "../lib/consent.js";
import type { DecompositionPlan, DraftAtom } from "../lib/decompose.js";
import { DCT_CREATED, DCT_CREATOR, DCT_TITLE, NS, RDF_TYPE } from "../lib/fut.js";
import { serializeTurtle } from "../lib/model.js";
import { assertWithinBase, childUrl, putTurtle, slug, type WriteResult } from "../lib/pod.js";
import { writeClaim, writeSocietyNeed, writeValueStatement } from "../lib/pod-society.js";

const { namedNode, quad, literal } = DataFactory;

const PROV_ACTIVITY = `${NS.prov}Activity`;
const PROV_PLAN = `${NS.prov}Plan`;
const PROV_HAD_PLAN = `${NS.prov}hadPlan`;
const XSD_DATETIME = `${NS.xsd}dateTime`;

/** The pod container decomposition activities live under. */
export const ACTIVITIES_DIR = "activities";

/**
 * Write the drafter run's prov:Activity resource to the author's own pod:
 * `<act> a prov:Activity; dct:title <tool>; prov:hadPlan <act#plan>` with the
 * plan's version — the resource adopted claims name via fut:decomposedBy.
 */
export async function writeDecompositionActivity(
  fetchFn: typeof fetch,
  base: string,
  creator: string,
  created: string,
  provenance: DecompositionPlan,
): Promise<string> {
  const url = assertWithinBase(base, childUrl(base, ACTIVITIES_DIR, slug()));
  const activity = `${url}#activity`;
  const plan = `${url}#plan`;
  const a = namedNode(activity);
  const p = namedNode(plan);
  const quads = [
    quad(a, namedNode(RDF_TYPE), namedNode(PROV_ACTIVITY)),
    quad(a, namedNode(DCT_TITLE), literal(provenance.tool)),
    quad(a, namedNode(DCT_CREATOR), namedNode(creator)),
    quad(a, namedNode(DCT_CREATED), literal(created, namedNode(XSD_DATETIME))),
    quad(a, namedNode(PROV_HAD_PLAN), p),
    quad(p, namedNode(RDF_TYPE), namedNode(PROV_PLAN)),
    quad(p, namedNode(DCT_TITLE), literal(provenance.plan)),
  ];
  await putTurtle(fetchFn, url, await serializeTurtle(quads, { prov: NS.prov }));
  return activity;
}

/** What one adoption run needs. */
export interface AdoptOptions {
  readonly fetchFn: typeof fetch;
  /** The author's own unite container (the demo "you" base, or a live pod). */
  readonly base: string;
  /** The author WebID — creator AND adoptedBy (the invariant). */
  readonly creator: string;
  readonly deliberation: string;
  /** The atoms the person adopted (possibly edited first). */
  readonly atoms: readonly DraftAtom[];
  /** The drafter disclosure — recorded as the PROV activity (C6). */
  readonly provenance: DecompositionPlan;
  /** The source utterance's pod resource (prov:wasDerivedFrom on claims). */
  readonly derivedFrom?: string;
  /** The author's consent (default: the conservative v1 DEFAULT_CONSENT). */
  readonly consent?: ConsentPolicy;
  /** Injectable clock (tests); default now. */
  readonly now?: () => Date;
}

/** One adoption run's outcome: what was written, where. */
export interface AdoptResult {
  /** The PROV activity IRI the claims carry as fut:decomposedBy. */
  readonly activity: string;
  /** The written resource URLs, in atom order. */
  readonly written: readonly { readonly kind: DraftAtom["kind"]; readonly url: string }[];
}

/**
 * Adopt drafted atoms: mint the PROV activity, then write each atom through
 * its fail-closed pod-society chokepoint. Throws (writing nothing further) if
 * any write is refused — the caller renders the refusal as the warm boundary
 * beat, and NOTHING refused ever reaches the pod.
 */
export async function adoptMirrorAtoms(options: AdoptOptions): Promise<AdoptResult> {
  const { fetchFn, base, creator, deliberation, atoms, provenance } = options;
  if (atoms.length === 0) throw new Error("adoptMirrorAtoms: nothing to adopt");
  const now = options.now ?? (() => new Date());
  const consent = options.consent ?? DEFAULT_CONSENT;
  const created = now().toISOString();

  const activity = await writeDecompositionActivity(fetchFn, base, creator, created, provenance);

  const written: { kind: DraftAtom["kind"]; url: string }[] = [];
  for (const atom of atoms) {
    let result: WriteResult<unknown>;
    if (atom.kind === "claim") {
      result = await writeClaim(
        fetchFn,
        base,
        {
          content: atom.content,
          adoptedBy: creator,
          creator,
          created,
          inDeliberation: deliberation,
          decomposedBy: activity,
          ...(options.derivedFrom !== undefined ? { derivedFrom: options.derivedFrom } : {}),
        },
        consent,
      );
    } else if (atom.kind === "need") {
      if (atom.needConcept === undefined) continue; // an uncoded need is not writable
      result = await writeSocietyNeed(
        fetchFn,
        base,
        {
          content: atom.content,
          needConcept: atom.needConcept,
          created,
          creator,
          inDeliberation: deliberation,
        },
        consent,
      );
    } else {
      if (atom.valueConcept === undefined) continue;
      result = await writeValueStatement(
        fetchFn,
        base,
        {
          content: atom.content,
          valueConcept: atom.valueConcept,
          created,
          creator,
          inDeliberation: deliberation,
        },
        consent,
      );
    }
    written.push({ kind: atom.kind, url: result.url });
  }
  return { activity, written };
}
