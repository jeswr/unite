// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The ODRL consent layer: policy → ODRL quads (fut: profile actions) → guarded
// read-back. The round-trip is the contract (the author's standing consent record
// a facilitation service later evaluates).

import { DataFactory, Store } from "n3";
import { describe, expect, it } from "vitest";
import { consentQuads, DEFAULT_CONSENT, parseConsent, policyIriFor } from "./consent.js";
import {
  CONSENT_AGGREGATE,
  CONSENT_GOVERNMENT_USE,
  CONSENT_K_THRESHOLD,
  CONSENT_QUOTE_VERBATIM,
  CONSENT_SYNTHESIZE,
} from "./fut.js";

const { namedNode: nn } = DataFactory;
const NEED = "https://alice.example/unite/d/needs/n-1.ttl#it";
const ODRL = "http://www.w3.org/ns/odrl/2/";

function storeFor(consent = DEFAULT_CONSENT, assigner?: string): Store {
  return new Store(consentQuads(NEED, consent, assigner));
}

describe("consentQuads + parseConsent round-trip", () => {
  it("round-trips the conservative default (aggregate + synthesize only)", () => {
    const parsed = parseConsent(storeFor(), NEED);
    expect(parsed).toEqual(DEFAULT_CONSENT);
  });

  it("round-trips a fully-open policy", () => {
    const open = {
      aggregate: true,
      synthesize: true,
      quoteVerbatim: true,
      governmentUse: true,
      kThreshold: 3,
    };
    expect(parseConsent(storeFor(open), NEED)).toEqual(open);
  });

  it("round-trips a fully-closed policy", () => {
    const closed = {
      aggregate: false,
      synthesize: false,
      quoteVerbatim: false,
      governmentUse: false,
      kThreshold: 5,
    };
    expect(parseConsent(storeFor(closed), NEED)).toEqual(closed);
  });

  it("preserves a non-default kThreshold even when synthesize is PROHIBITED", () => {
    // The constraint rides the synthesize rule whether permitted or prohibited;
    // parsing must read it from the prohibition too (regression guard).
    const policy = {
      aggregate: true,
      synthesize: false,
      quoteVerbatim: false,
      governmentUse: false,
      kThreshold: 9,
    };
    expect(parseConsent(storeFor(policy), NEED)).toEqual(policy);
  });

  it("links the policy to the resource via odrl:hasPolicy", () => {
    const store = storeFor();
    const policyNode = policyIriFor(NEED);
    expect(store.getQuads(NEED, `${ODRL}hasPolicy`, policyNode, null)).toHaveLength(1);
    expect(store.getQuads(policyNode, `${ODRL}permission`, null, null).length).toBeGreaterThan(0);
  });

  it("emits permitted actions as permissions and prohibited as prohibitions", () => {
    const store = storeFor();
    const policyNode = policyIriFor(NEED);
    // aggregate + synthesize permitted → under odrl:permission
    const permActions = store
      .getQuads(policyNode, `${ODRL}permission`, null, null)
      .flatMap((q) => store.getQuads(q.object, `${ODRL}action`, null, null))
      .map((q) => q.object.value);
    expect(permActions).toContain(CONSENT_AGGREGATE);
    expect(permActions).toContain(CONSENT_SYNTHESIZE);
    // quoteVerbatim + governmentUse prohibited → under odrl:prohibition
    const prohActions = store
      .getQuads(policyNode, `${ODRL}prohibition`, null, null)
      .flatMap((q) => store.getQuads(q.object, `${ODRL}action`, null, null))
      .map((q) => q.object.value);
    expect(prohActions).toContain(CONSENT_QUOTE_VERBATIM);
    expect(prohActions).toContain(CONSENT_GOVERNMENT_USE);
  });

  it("attaches the kThreshold constraint to the synthesize rule", () => {
    const store = storeFor({ ...DEFAULT_CONSENT, kThreshold: 7 });
    const kQuads = store.getQuads(null, `${ODRL}leftOperand`, CONSENT_K_THRESHOLD, null);
    expect(kQuads).toHaveLength(1);
    const constraint = kQuads[0]?.subject;
    if (!constraint) throw new Error("no constraint");
    const right = store.getQuads(constraint, `${ODRL}rightOperand`, null, null);
    expect(right[0]?.object.value).toBe("7");
  });

  it("records the assigner WebID when a valid http(s) IRI", () => {
    const store = storeFor(DEFAULT_CONSENT, "https://alice.example/profile/card#me");
    expect(
      store.getQuads(
        policyIriFor(NEED),
        `${ODRL}assigner`,
        "https://alice.example/profile/card#me",
        null,
      ),
    ).toHaveLength(1);
  });

  it("skips an invalid assigner (never writes junk)", () => {
    const store = storeFor(DEFAULT_CONSENT, "not-a-webid");
    expect(store.getQuads(policyIriFor(NEED), `${ODRL}assigner`, null, null)).toHaveLength(0);
  });
});

describe("policyIriFor (safe fragment derivation)", () => {
  it("sets the fragment (no double fragment) for a fragmented resource IRI", () => {
    expect(policyIriFor("https://p.example/needs/n-1.ttl#it")).toBe(
      "https://p.example/needs/n-1.ttl#consent",
    );
  });

  it("appends a fragment for a fragmentless resource IRI", () => {
    expect(policyIriFor("https://p.example/needs/n-1.ttl")).toBe(
      "https://p.example/needs/n-1.ttl#consent",
    );
  });

  it("round-trips a policy on a fragmented (#it) need subject", () => {
    const frag = "https://p.example/needs/n-1.ttl#it";
    const store = new Store(consentQuads(frag, DEFAULT_CONSENT));
    // The odrl:hasPolicy link uses distinct single-fragment IRIs on the same doc.
    expect(store.getQuads(frag, `${ODRL}hasPolicy`, policyIriFor(frag), null)).toHaveLength(1);
    expect(parseConsent(store, frag)).toEqual(DEFAULT_CONSENT);
  });
});

describe("consentQuads validation (never ships a malformed policy)", () => {
  it("throws on a non-http(s) resource IRI", () => {
    expect(() => consentQuads("javascript:alert(1)", DEFAULT_CONSENT)).toThrow(/http/);
  });

  it("throws on a non-positive-integer kThreshold", () => {
    expect(() => consentQuads(NEED, { ...DEFAULT_CONSENT, kThreshold: 0 })).toThrow(/kThreshold/);
    expect(() => consentQuads(NEED, { ...DEFAULT_CONSENT, kThreshold: 2.5 })).toThrow(/kThreshold/);
  });
});

describe("parseConsent robustness (foreign RDF is hostile)", () => {
  it("returns undefined when there is no policy", () => {
    expect(parseConsent(new Store(), NEED)).toBeUndefined();
  });

  it("fail-closed: an action only listed as a prohibition is NOT permitted", () => {
    const closed = parseConsent(storeFor({ ...DEFAULT_CONSENT, aggregate: false }), NEED);
    expect(closed?.aggregate).toBe(false);
  });

  it("fail-closed: a prohibition CONTRADICTING a permission wins (prohibit strategy)", () => {
    const store = storeFor(); // aggregate permitted
    // Inject a contradictory prohibition for aggregate on the same target.
    const rule = nn(`${NEED}#rogue`);
    store.addQuad(nn(policyIriFor(NEED)), nn(`${ODRL}prohibition`), rule);
    store.addQuad(rule, nn(`${ODRL}action`), nn(CONSENT_AGGREGATE));
    store.addQuad(rule, nn(`${ODRL}target`), nn(NEED));
    expect(parseConsent(store, NEED)?.aggregate).toBe(false);
  });

  it("fail-closed: a permission targeting ANOTHER resource does not grant this need", () => {
    const store = storeFor({ ...DEFAULT_CONSENT, aggregate: false }); // aggregate prohibited here
    // A permission whose target is a DIFFERENT resource must be ignored.
    const rule = nn(`${NEED}#foreign`);
    store.addQuad(nn(policyIriFor(NEED)), nn(`${ODRL}permission`), rule);
    store.addQuad(rule, nn(`${ODRL}action`), nn(CONSENT_AGGREGATE));
    store.addQuad(rule, nn(`${ODRL}target`), nn("https://other.example/thing"));
    expect(parseConsent(store, NEED)?.aggregate).toBe(false);
  });

  it("ignores a kThreshold constraint carrying a non-gteq operator", () => {
    const store = storeFor({ ...DEFAULT_CONSENT, kThreshold: 8 });
    // Flip the synthesize constraint's operator to lteq (would invert the bound).
    for (const q of store.getQuads(null, `${ODRL}operator`, `${ODRL}gteq`, null)) {
      store.removeQuad(q);
      store.addQuad(q.subject, nn(`${ODRL}operator`), nn(`${ODRL}lteq`));
    }
    // The corrupted constraint is rejected → default k, not the untrusted value.
    expect(parseConsent(store, NEED)?.kThreshold).toBe(DEFAULT_CONSENT.kThreshold);
  });

  it("ignores a rogue kThreshold attached to a NON-synthesize rule", () => {
    const store = storeFor({ ...DEFAULT_CONSENT, kThreshold: 8 }); // synthesize rule carries k=8
    // Attach a hostile k=1 constraint to the aggregate rule (wrong action).
    const rogueConstraint = nn(`${NEED}#c-rogue`);
    store.addQuad(nn(`${NEED}#rule-aggregate`), nn(`${ODRL}constraint`), rogueConstraint);
    store.addQuad(rogueConstraint, nn(`${ODRL}leftOperand`), nn(CONSENT_K_THRESHOLD));
    store.addQuad(rogueConstraint, nn(`${ODRL}rightOperand`), DataFactory.literal("1"));
    // The real synthesize k=8 must win; the rogue k=1 is ignored.
    expect(parseConsent(store, NEED)?.kThreshold).toBe(8);
  });

  it("falls back to the default kThreshold on a malformed constraint value", () => {
    const store = storeFor();
    // Corrupt the rightOperand to a non-integer.
    const policyNode = policyIriFor(NEED);
    for (const q of store.getQuads(null, `${ODRL}rightOperand`, null, null)) {
      store.removeQuad(q);
    }
    // No valid kThreshold left → default.
    expect(parseConsent(store, NEED)?.kThreshold).toBe(DEFAULT_CONSENT.kThreshold);
    expect(policyNode).toContain("#consent");
  });
});
