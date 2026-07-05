// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.1 the dissent annex materialiser — the raw material of the un-signable
// guarantee. Tests the completeness contract (one record per standing critique →
// accountedFor = the critique set) and the fut:quoteVerbatim consent split
// (verbatim quotes carry text + attribution + lineage; withheld critiques are
// represented in AGGREGATE only, never erased, never re-identifiable).

import { describe, expect, it } from "vitest";
import {
  AGGREGATE_DISSENT_PLACEHOLDER,
  buildDissentAnnexQuads,
  type DissentRecord,
  materializeDissent,
} from "./dissent.js";
import { AS_CONTENT, DCT_CREATOR, PROV_WAS_DERIVED_FROM, RDF_TYPE } from "./fut.js";
import { FUT_DISSENT, FUT_DISSENT_RECORD } from "./fut-draft.js";
import type { Critique } from "./model.js";

const CAND = "https://d.example/futures/sf-1.ttl#it";
const CRIT_1 = "https://c.example/critiques/k1.ttl#it";
const CRIT_2 = "https://d2.example/critiques/k2.ttl#it";
const CRITIC_1 = "https://c.example/profile/card#me";
const CRITIC_2 = "https://d2.example/profile/card#me";

const critique = (
  id: string,
  creator: string,
  content = "This overlooks rural access.",
): Critique => ({
  id,
  content,
  onStatement: CAND,
  created: "2026-07-04T00:00:00Z",
  creator,
  inDeliberation: "https://d.example/futures",
});

describe("materializeDissent — completeness + quoteVerbatim consent", () => {
  it("produces one record per standing critique; accountedFor = the critique set", () => {
    const m = materializeDissent([critique(CRIT_1, CRITIC_1), critique(CRIT_2, CRITIC_2)]);
    expect(m.records).toHaveLength(2);
    expect([...m.accountedFor].sort()).toEqual([CRIT_1, CRIT_2].sort());
  });

  it("FAIL-CLOSED: a critique NOT in the consent set is aggregate-only", () => {
    const m = materializeDissent([critique(CRIT_1, CRITIC_1)]);
    const r = m.records[0] as DissentRecord;
    expect(r.verbatim).toBe(false);
    expect(r.content).toBe(AGGREGATE_DISSENT_PLACEHOLDER);
    expect(r.creator).toBeUndefined();
    expect(r.derivedFromCritique).toBeUndefined();
    expect(m.aggregatedCount).toBe(1);
    expect(m.verbatimCount).toBe(0);
  });

  it("a consented critique is quoted verbatim (text + attribution + source lineage)", () => {
    const m = materializeDissent([critique(CRIT_1, CRITIC_1)], {
      quoteVerbatimConsent: new Set([CRIT_1]),
    });
    const r = m.records[0] as DissentRecord;
    expect(r.verbatim).toBe(true);
    expect(r.content).toBe("This overlooks rural access.");
    expect(r.creator).toBe(CRITIC_1);
    expect(r.derivedFromCritique).toBe(CRIT_1);
    expect(m.verbatimCount).toBe(1);
  });

  it("mixed consent: one quoted, one aggregated — both accounted for", () => {
    const m = materializeDissent([critique(CRIT_1, CRITIC_1), critique(CRIT_2, CRITIC_2)], {
      quoteVerbatimConsent: new Set([CRIT_1]),
    });
    expect(m.verbatimCount).toBe(1);
    expect(m.aggregatedCount).toBe(1);
    expect(m.accountedFor.size).toBe(2);
  });

  it("FAIL-CLOSED: a consented but malformed critique (non-http creator) is aggregate-only", () => {
    const bad: Critique = { ...critique(CRIT_1, "not-a-webid"), creator: "urn:not-http" };
    const m = materializeDissent([bad], { quoteVerbatimConsent: new Set([CRIT_1]) });
    expect(m.records[0]?.verbatim).toBe(false);
    expect(m.records[0]?.creator).toBeUndefined();
  });

  it("THROWS when the critique count exceeds the annex fan-out bound (never drops dissent)", () => {
    const many = Array.from({ length: 3 }, (_, i) =>
      critique(`https://c.example/k${i}.ttl#it`, CRITIC_1),
    );
    expect(() => materializeDissent(many, { maxRecords: 2 })).toThrow(
      /exceed the annex fan-out bound/,
    );
  });
});

describe("buildDissentAnnexQuads — serialisation", () => {
  /** The predicate/object values of the record blank node dangling off one dissent edge. */
  function recordProps(
    quads: readonly {
      subject: { value: string };
      predicate: { value: string };
      object: { value: string };
    }[],
  ): {
    recVal: string;
    preds: Map<string, string[]>;
    dissentEdges: number;
  } {
    const dissentEdges = quads.filter((q) => q.predicate.value === FUT_DISSENT);
    const recVal = dissentEdges[0]?.object.value ?? "";
    const preds = new Map<string, string[]>();
    for (const q of quads) {
      if (q.subject.value !== recVal) continue;
      const objs = preds.get(q.predicate.value) ?? [];
      objs.push(q.object.value);
      preds.set(q.predicate.value, objs);
    }
    return { recVal, preds, dissentEdges: dissentEdges.length };
  }

  it("emits fut:dissent → fut:DissentRecord with content (aggregate omits identity)", () => {
    const records: DissentRecord[] = [{ content: AGGREGATE_DISSENT_PLACEHOLDER, verbatim: false }];
    const { preds, dissentEdges } = recordProps(buildDissentAnnexQuads(CAND, records));
    expect(dissentEdges).toBe(1);
    expect(preds.get(AS_CONTENT)).toEqual([AGGREGATE_DISSENT_PLACEHOLDER]);
    expect(preds.get(DCT_CREATOR)).toBeUndefined(); // aggregate-only → no attribution
    expect(preds.get(PROV_WAS_DERIVED_FROM)).toBeUndefined(); // → no back-pointer
    expect(preds.get(RDF_TYPE)).toEqual([FUT_DISSENT_RECORD]);
  });

  it("a verbatim record carries dct:creator + prov:wasDerivedFrom lineage", () => {
    const records: DissentRecord[] = [
      { content: "keep it simple", verbatim: true, creator: CRITIC_1, derivedFromCritique: CRIT_1 },
    ];
    const { preds } = recordProps(buildDissentAnnexQuads(CAND, records));
    expect(preds.get(DCT_CREATOR)).toEqual([CRITIC_1]);
    expect(preds.get(PROV_WAS_DERIVED_FROM)).toEqual([CRIT_1]);
  });

  it("THROWS on an empty-content record", () => {
    expect(() => buildDissentAnnexQuads(CAND, [{ content: "", verbatim: false }])).toThrow(
      /must carry text/,
    );
  });

  it("THROWS on a verbatim record with no http(s) creator", () => {
    expect(() =>
      buildDissentAnnexQuads(CAND, [{ content: "x", verbatim: true, creator: "urn:bad" }]),
    ).toThrow(/verbatim record needs an http\(s\) creator/);
  });

  it("THROWS on a verbatim record with no derivedFromCritique source lineage", () => {
    // A verbatim quote MUST be re-checkable to its source critique — a quote with no
    // prov:wasDerivedFrom is un-auditable, so serialisation refuses it.
    expect(() =>
      buildDissentAnnexQuads(CAND, [{ content: "x", verbatim: true, creator: CRITIC_1 }]),
    ).toThrow(/needs an http\(s\) derivedFromCritique/);
  });

  it("THROWS on a non-http(s) subject", () => {
    expect(() => buildDissentAnnexQuads("urn:x", [{ content: "x", verbatim: false }])).toThrow(
      /subject is not an http\(s\) IRI/,
    );
  });
});
