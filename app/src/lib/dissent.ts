// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.1 — materialise the mandatory dissent annex (fut:DissentRecord) from the
// STANDING CRITIQUES at endorsement time (docs/design/next-phases.md §2.2 D2,
// §2.6 (2); design/01 fut:DissentRecord). This is the raw material of the
// un-signable-if-it-drops-dissent guarantee: {@link materializeDissent} produces
// EXACTLY one record per standing critique — so the annex it yields ACCOUNTS FOR
// every standing critique by construction, and its `accountedFor` set is the key
// shared-future.ts checks against the endorsement-time critique set (D2).
//
// The `fut:quoteVerbatim` consent split (design/01 "The ODRL consent layer";
// §2.2 D2 "does not weaken INV-1"): a critic who consented to verbatim quotation
// is QUOTED (their as:content + dct:creator attribution + a prov:wasDerivedFrom
// lineage to the source critique). A critic who did NOT is represented in
// AGGREGATE only — a non-identifying placeholder record with NO verbatim text,
// NO attribution and NO back-pointer to their pod resource. Either way the
// dissent is CARRIED (the count is preserved), NEVER erased — that is the whole
// point of the mandatory annex. FAIL-CLOSED: a critique NOT explicitly in the
// consent set is aggregated (verbatim requires an affirmative grant, matching
// the conservative consent default where quoteVerbatim is false).
//
// Serialisation stays via n3.Writer (typed quads) — never hand-built RDF; the
// record shape MIRRORS S3's fut:DissentRecord (as:content + optional dct:creator)
// so a plain SharedFuture reader federates it, plus the verbatim lineage edge.

import type { Quad } from "@rdfjs/types";
import { DataFactory } from "n3";
import { AS_CONTENT, DCT_CREATOR, PROV_WAS_DERIVED_FROM, RDF_TYPE } from "./fut.js";
import { FUT_DISSENT, FUT_DISSENT_RECORD } from "./fut-draft.js";
import { type Critique, isHttpIri, MAX_CONTENT_LENGTH, MAX_LINKS } from "./model.js";

const { namedNode, literal, blankNode, quad } = DataFactory;

/**
 * The non-identifying content of an AGGREGATE-ONLY dissent record — one standing
 * critique whose author did NOT consent to fut:quoteVerbatim. Its dissent is
 * carried (the record exists, the count is preserved) but its text + identity are
 * withheld. Deliberately constant across such records (it must reveal nothing).
 */
export const AGGREGATE_DISSENT_PLACEHOLDER =
  "A standing critique withheld from verbatim quotation (its author did not consent to " +
  "fut:quoteVerbatim); represented in aggregate — carried, never erased.";

/**
 * One materialised `fut:DissentRecord`. VERBATIM records carry the critique's own
 * text + attribution + source lineage (the author consented); AGGREGATE-only
 * records carry the non-identifying placeholder and nothing that could re-identify
 * the withholding critic.
 */
export interface DissentRecord {
  /** `as:content` — the verbatim critique text, or {@link AGGREGATE_DISSENT_PLACEHOLDER}. */
  readonly content: string;
  /** True iff quoted verbatim (author consented to fut:quoteVerbatim). */
  readonly verbatim: boolean;
  /** `dct:creator` — the critic WebID; present ONLY on a verbatim record. */
  readonly creator?: string;
  /** `prov:wasDerivedFrom` — the source critique IRI; present ONLY on a verbatim
   *  record (an aggregate-only record must not point back to an identifiable pod
   *  resource, which could re-identify the withholding critic). */
  readonly derivedFromCritique?: string;
}

/** Options for {@link materializeDissent}. */
export interface MaterializeDissentOptions {
  /**
   * The critique IRIs whose author's inline ODRL policy PERMITS `fut:quoteVerbatim`
   * (compose `consent.parseConsent(...).quoteVerbatim === true` per critique). A
   * critique NOT in this set is represented in AGGREGATE only — FAIL-CLOSED: no
   * verbatim quotation or attribution without an affirmative grant.
   */
  readonly quoteVerbatimConsent?: ReadonlySet<string>;
  /** Cap on the number of records (bounded fan-out; default {@link MAX_LINKS}). */
  readonly maxRecords?: number;
}

/** The materialised annex + the honest counts + the completeness key. */
export interface MaterializedDissent {
  /** One record per standing critique — the complete annex (D2 by construction). */
  readonly records: readonly DissentRecord[];
  /** How many were quoted verbatim. */
  readonly verbatimCount: number;
  /** How many were represented in aggregate only. */
  readonly aggregatedCount: number;
  /**
   * The EXACT set of standing-critique IRIs this annex accounts for — the key
   * shared-future.ts checks against the endorsement-time standing-critique set
   * (D2 dissent faithfulness). Every input critique is a member.
   */
  readonly accountedFor: ReadonlySet<string>;
}

/**
 * Materialise the dissent annex from the standing critiques on a candidate. One
 * record per critique (so the annex is COMPLETE by construction — its
 * `accountedFor` set equals the input critique-IRI set); verbatim iff the author
 * consented, else aggregate-only. Pure + deterministic (preserves input order).
 *
 * THROWS fail-closed when the critique count exceeds `maxRecords`: an annex that
 * cannot hold every standing critique within the fan-out bound cannot HONESTLY
 * account for all of them, so it must not be built (the alternative — silently
 * dropping critiques — would erase dissent, the exact failure the annex prevents).
 */
export function materializeDissent(
  critiques: readonly Critique[],
  options: MaterializeDissentOptions = {},
): MaterializedDissent {
  const maxRecords = options.maxRecords ?? MAX_LINKS;
  const consent = options.quoteVerbatimConsent;
  if (critiques.length > maxRecords) {
    throw new Error(
      `materializeDissent: ${critiques.length} standing critiques exceed the annex fan-out bound ` +
        `(${maxRecords}) — the annex cannot honestly account for all of them; consolidate first`,
    );
  }
  const records: DissentRecord[] = [];
  const accountedFor = new Set<string>();
  let verbatimCount = 0;
  for (const c of critiques) {
    accountedFor.add(c.id);
    // Verbatim requires an AFFIRMATIVE grant AND a genuinely quotable, well-formed
    // critique (a valid WebID creator + a valid source IRI + non-empty text). Any
    // gap ⇒ aggregate-only (fail-closed — never quote what we cannot attribute).
    const consented = consent?.has(c.id) === true;
    const quotable =
      consented &&
      c.content.length > 0 &&
      c.content.length <= MAX_CONTENT_LENGTH &&
      isHttpIri(c.creator) &&
      isHttpIri(c.id);
    if (quotable) {
      verbatimCount += 1;
      records.push({
        content: c.content,
        verbatim: true,
        creator: c.creator,
        derivedFromCritique: c.id,
      });
    } else {
      records.push({ content: AGGREGATE_DISSENT_PLACEHOLDER, verbatim: false });
    }
  }
  return {
    records,
    verbatimCount,
    aggregatedCount: records.length - verbatimCount,
    accountedFor,
  };
}

/**
 * Build the `fut:dissent` → `fut:DissentRecord` annex quads for `subject`. Mirrors
 * S3's DissentRecord shape (a fut:DissentRecord; as:content; dct:creator?) and
 * adds the verbatim `prov:wasDerivedFrom` lineage. Fresh unlabelled blank nodes ⇒
 * no cross-artifact collision in a shared Store. Throws on a malformed record
 * (empty/over-length content, or a verbatim record whose creator/lineage is not an
 * http(s) IRI) so a record that would not round-trip is never serialised.
 */
export function buildDissentAnnexQuads(subject: string, records: readonly DissentRecord[]): Quad[] {
  if (!isHttpIri(subject)) {
    throw new Error(`buildDissentAnnexQuads: subject is not an http(s) IRI: ${subject}`);
  }
  if (records.length > MAX_LINKS) {
    throw new Error(`buildDissentAnnexQuads: records exceed MAX_LINKS (${MAX_LINKS})`);
  }
  const s = namedNode(subject);
  const quads: Quad[] = [];
  for (const r of records) {
    if (r.content.length === 0 || r.content.length > MAX_CONTENT_LENGTH) {
      throw new Error(
        "buildDissentAnnexQuads: a dissent record must carry text ≤ MAX_CONTENT_LENGTH",
      );
    }
    const rec = blankNode();
    quads.push(
      quad(s, namedNode(FUT_DISSENT), rec),
      quad(rec, namedNode(RDF_TYPE), namedNode(FUT_DISSENT_RECORD)),
      quad(rec, namedNode(AS_CONTENT), literal(r.content)),
    );
    if (r.verbatim) {
      // A verbatim record MUST carry BOTH its attribution AND its source lineage —
      // quoted text without a re-checkable prov:wasDerivedFrom back to the source
      // critique is un-auditable (you could not verify the quote is a real critique).
      if (r.creator === undefined || !isHttpIri(r.creator)) {
        throw new Error("buildDissentAnnexQuads: a verbatim record needs an http(s) creator");
      }
      if (r.derivedFromCritique === undefined || !isHttpIri(r.derivedFromCritique)) {
        throw new Error(
          "buildDissentAnnexQuads: a verbatim record needs an http(s) derivedFromCritique " +
            "(prov:wasDerivedFrom source lineage) — quoted text must be re-checkable to its critique",
        );
      }
      quads.push(
        quad(rec, namedNode(DCT_CREATOR), namedNode(r.creator)),
        quad(rec, namedNode(PROV_WAS_DERIVED_FROM), namedNode(r.derivedFromCritique)),
      );
    }
  }
  return quads;
}
