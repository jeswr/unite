// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The adoption instrument (S2): observeAdoption reads REAL
// fedreg:StorageDescription documents (authored here through the same typed
// builder the demo uses — never hand-built triples) and computeAdoption is a
// PURE function whose Current/Superseded/Proposed statuses are COMPUTED from
// observations against the bar, never asserted. Hostile-input + fail-isolation
// rules exercised: a broken source degrades one source, https-only, byte caps,
// non-http(s) parties/versions dropped.

import { describeStorage } from "@jeswr/federation-registry";
import { describe, expect, it } from "vitest";
import {
  type AdoptionObservation,
  computeAdoption,
  DEFAULT_ADOPTION_BAR,
  GOVERNED_SYSTEMS,
  type GovernedSystem,
  observeAdoption,
} from "./adoption.js";

const V1 = "https://w3id.org/jeswr/sectors/futures/0.1.0";
const V2 = "https://w3id.org/jeswr/sectors/futures/0.2.0";

const LINEAGE: GovernedSystem = {
  id: "https://w3id.org/jeswr/sectors/futures",
  label: "futures",
  versions: [
    { iri: V1, label: "0.1.0" },
    { iri: V2, label: "0.2.0" },
  ],
};

const obs = (
  party: string,
  version: string,
  source = "https://src.example/d.ttl",
): AdoptionObservation => ({
  party,
  version,
  observedAt: "2026-07-04T00:00:00Z",
  source,
});

/** A fetch serving pre-authored storage-description Turtle per URL. */
function fetchServing(docs: Record<string, string>): typeof fetch {
  return async (input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = docs[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  };
}

async function storageTtl(id: string, storage: string, acceptsSpec: string[]): Promise<string> {
  return describeStorage({ id, storage, acceptsSpec }).toString();
}

describe("computeAdoption (pure, computed-never-asserted)", () => {
  it("an empty snapshot yields an honestly empty matrix — every version Proposed", () => {
    const { matrices, undeclared } = computeAdoption([LINEAGE], []);
    expect(undeclared).toEqual([]);
    const m = matrices[0];
    expect(m?.advertisers).toEqual([]);
    for (const v of m?.versions ?? []) {
      expect(v.status).toBe("proposed");
      expect(v.barMet).toBe(false);
      expect(v.parties).toEqual([]);
    }
  });

  it("bar met on the older version only → it is Current, the newer stays Proposed", () => {
    const { matrices } = computeAdoption(
      [LINEAGE],
      [obs("https://a.example/", V1), obs("https://b.example/", V1)],
    );
    const [v1, v2] = matrices[0]?.versions ?? [];
    expect(v1?.status).toBe("current");
    expect(v1?.barMet).toBe(true);
    expect(v2?.status).toBe("proposed");
  });

  it("bar met on BOTH versions → the newest is Current, the older Superseded", () => {
    const { matrices } = computeAdoption(
      [LINEAGE],
      [
        obs("https://a.example/", V1),
        obs("https://b.example/", V1),
        obs("https://a.example/", V2),
        obs("https://c.example/", V2),
      ],
    );
    const [v1, v2] = matrices[0]?.versions ?? [];
    expect(v1?.status).toBe("superseded");
    expect(v2?.status).toBe("current");
    expect(matrices[0]?.advertisers).toEqual([
      "https://a.example/",
      "https://b.example/",
      "https://c.example/",
    ]);
  });

  it("counts DISTINCT parties, not observations (a party re-observed is one vote)", () => {
    const { matrices } = computeAdoption(
      [LINEAGE],
      [
        obs("https://a.example/", V1, "https://src1.example/d.ttl"),
        obs("https://a.example/", V1, "https://src2.example/d.ttl"),
      ],
    );
    const v1 = matrices[0]?.versions[0];
    expect(v1?.parties).toEqual(["https://a.example/"]);
    expect(v1?.barMet).toBe(false); // 1 < DEFAULT_ADOPTION_BAR
    expect(v1?.observations).toHaveLength(2); // both cells kept, re-checkable
  });

  it("a raised bar only raises (community floors are raise-only)", () => {
    const two = [obs("https://a.example/", V1), obs("https://b.example/", V1)];
    expect(computeAdoption([LINEAGE], two, 2).matrices[0]?.versions[0]?.barMet).toBe(true);
    expect(computeAdoption([LINEAGE], two, 3).matrices[0]?.versions[0]?.barMet).toBe(false);
  });

  it("observations for undeclared versions surface honestly, never silently dropped", () => {
    const stray = obs("https://a.example/", "https://other.example/spec/9.9.9");
    const { matrices, undeclared } = computeAdoption([LINEAGE], [stray]);
    expect(undeclared).toEqual([stray]);
    expect(matrices[0]?.advertisers).toEqual([]);
  });

  it("the default governed surface is the futures lineage with both minted version IRIs", () => {
    expect(GOVERNED_SYSTEMS.map((s) => s.id)).toContain("https://w3id.org/jeswr/sectors/futures");
    const futures = GOVERNED_SYSTEMS.find((s) => s.id === "https://w3id.org/jeswr/sectors/futures");
    expect(futures?.versions.map((v) => v.iri)).toEqual([V1, V2]);
    expect(DEFAULT_ADOPTION_BAR).toBe(2);
  });
});

describe("observeAdoption (fail-isolated, https-only, hostile-input-hardened)", () => {
  it("reads a real storage description into observations carrying the re-checkable source", async () => {
    const src = "https://storage.example/fedreg.ttl";
    const docs = { [src]: await storageTtl(src, "https://storage.example/", [V1, V2]) };
    const snap = await observeAdoption([src], {
      fetch: fetchServing(docs),
      now: () => new Date("2026-07-04T12:00:00Z"),
    });
    expect(snap.errors).toEqual([]);
    expect(snap.observations).toEqual([
      {
        party: "https://storage.example/",
        version: V1,
        observedAt: "2026-07-04T12:00:00.000Z",
        source: src,
      },
      {
        party: "https://storage.example/",
        version: V2,
        observedAt: "2026-07-04T12:00:00.000Z",
        source: src,
      },
    ]);
  });

  it("refuses a non-https source BEFORE any request fires", async () => {
    let fetched = 0;
    const spy: typeof fetch = async () => {
      fetched++;
      return new Response("x");
    };
    const snap = await observeAdoption(
      ["http://insecure.example/d.ttl", "ftp://weird.example/d", "not a url"],
      { fetch: spy },
    );
    expect(fetched).toBe(0);
    expect(snap.observations).toEqual([]);
    expect(snap.errors).toHaveLength(3);
  });

  it("isolates a broken source — the healthy sibling still observes", async () => {
    const good = "https://good.example/fedreg.ttl";
    const docs = { [good]: await storageTtl(good, "https://good.example/", [V1]) };
    const snap = await observeAdoption(["https://down.example/d.ttl", good], {
      fetch: fetchServing(docs),
    });
    expect(snap.observations.map((o) => o.party)).toEqual(["https://good.example/"]);
    expect(snap.errors).toHaveLength(1);
    expect(snap.errors[0]?.source).toBe("https://down.example/d.ttl");
  });

  it("a document that is not a storage description records an error, not a crash", async () => {
    const src = "https://odd.example/thing.ttl";
    const snap = await observeAdoption([src], {
      fetch: fetchServing({ [src]: "<https://odd.example/x> a <https://odd.example/Thing> ." }),
    });
    expect(snap.observations).toEqual([]);
    expect(snap.errors).toHaveLength(1);
  });

  it("drops a non-http(s) advertised version value; keeps the http(s) ones", async () => {
    const src = "https://storage.example/fedreg.ttl";
    // Hand-craft hostile Turtle here (the TYPED BUILDER refuses to author it —
    // this simulates a hostile foreign document, which is exactly the point).
    const hostile = `
      @prefix fedreg: <https://w3id.org/jeswr/fedreg#> .
      <${src}> a fedreg:StorageDescription ;
        fedreg:storage <https://storage.example/> ;
        fedreg:acceptsSpec <${V1}>, <urn:isbn:not-a-version> .
    `;
    const snap = await observeAdoption([src], { fetch: fetchServing({ [src]: hostile }) });
    expect(snap.observations.map((o) => o.version)).toEqual([V1]);
  });

  it("caps a hostile oversized body (byte cap) — recorded as a source error", async () => {
    const src = "https://big.example/fedreg.ttl";
    const big = `# ${"x".repeat(4000)}\n`;
    const snap = await observeAdoption([src], {
      fetch: fetchServing({ [src]: big }),
      maxBodyBytes: 1024,
    });
    expect(snap.observations).toEqual([]);
    expect(snap.errors).toHaveLength(1);
  });
});
