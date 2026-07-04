// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The fut:InfraProposal typed round-trip (S2): serialise → parse equality, the
// SHACL MUSTs enforced BOTH ways (build throws / parse drops the item), and
// hostile-input hardening — every drop rule exercised, because foreign RDF is
// hostile input and a parser that throws (or keeps a malformed item) is a bug.

import { parseRdf } from "@jeswr/fetch-rdf";
import type { DatasetCore } from "@rdfjs/types";
import { describe, expect, it } from "vitest";
import { WF_TASK } from "./fut.js";
import {
  KIND_DEPRECATION,
  KIND_SPEC_CHANGE,
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
  ROLE_PARTICIPANT,
} from "./fut-draft.js";
import {
  buildInfraProposalQuads,
  type InfraProposal,
  parseInfraProposals,
  serializeInfraProposal,
} from "./infra.js";
import { MAX_LINKS } from "./model.js";

const BASE: InfraProposal = {
  id: "https://alice.example/unite/infrastructure/proposals/p1.ttl",
  title: "Adopt futures sector 0.2.0",
  content: "Additive scope-B layer; dual-advertised during migration.",
  targetsSystem: ["https://w3id.org/jeswr/sectors/futures"],
  proposalKind: KIND_SPEC_CHANGE,
  affectsRole: [ROLE_IMPLEMENTER, ROLE_PARTICIPANT],
  breakingChange: false,
  referenceImplementation:
    "https://github.com/jeswr/solid-federation-vocab/commit/67b00beda1a05963842de75f72b9968ddca990e3",
  motivatedBy: ["https://bob.example/unite/infrastructure/needs/n1.ttl"],
  indirectStakeholders: "Future deliberation communities.",
  created: "2026-06-15T10:00:00Z",
  creator: "https://alice.example/profile#me",
  inDeliberation: "https://community.example/deliberations/infra",
};

async function roundTrip(p: InfraProposal): Promise<InfraProposal[]> {
  const ttl = await serializeInfraProposal(p);
  const ds = await parseRdf(ttl, "text/turtle", { baseIRI: p.id });
  return parseInfraProposals(ds);
}

async function parseTtl(ttl: string): Promise<DatasetCore> {
  return parseRdf(ttl, "text/turtle", { baseIRI: "https://alice.example/" });
}

/** Turtle for a minimal valid proposal, with one line swappable per test. */
function ttlWith(overrides: Partial<Record<string, string>> = {}): string {
  const lines: Record<string, string> = {
    types: "a fut:InfraProposal, wf:Task ;",
    title: `dct:title "Adopt futures 0.2.0" ;`,
    content: `as:content "The change." ;`,
    targets: "fut:targetsSystem <https://w3id.org/jeswr/sectors/futures> ;",
    kind: "fut:proposalKind fut:SpecChange ;",
    roles: "fut:affectsRole fut:ImplementerRole ;",
    breaking: `fut:breakingChange "false"^^xsd:boolean ;`,
    motivated: "fut:motivatedBy <https://bob.example/needs/n1.ttl> ;",
    created: `dct:created "2026-06-15T10:00:00Z"^^xsd:dateTime ;`,
    creator: "dct:creator <https://alice.example/profile#me> ;",
    ...overrides,
  };
  return `
    @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
    @prefix wf: <http://www.w3.org/2005/01/wf/flow#> .
    @prefix as: <https://www.w3.org/ns/activitystreams#> .
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <https://alice.example/proposals/p1.ttl>
      ${Object.values(lines).filter(Boolean).join("\n      ")}
      fut:inDeliberation <https://community.example/deliberations/infra> .
  `;
}

describe("InfraProposal round-trip", () => {
  it("serialises and parses back every field", async () => {
    const [parsed] = await roundTrip(BASE);
    expect(parsed).toEqual(BASE);
  });

  it("round-trips a breaking change with its migration story", async () => {
    const breaking: InfraProposal = {
      ...BASE,
      proposalKind: KIND_DEPRECATION,
      breakingChange: true,
      migrationPath: "A dual-read window while apps migrate.",
    };
    const [parsed] = await roundTrip(breaking);
    expect(parsed).toEqual(breaking);
  });

  it("round-trips the minimal proposal (no kind, no refImpl, no stakeholders)", async () => {
    const minimal: InfraProposal = {
      id: BASE.id,
      title: BASE.title,
      content: BASE.content,
      targetsSystem: BASE.targetsSystem,
      affectsRole: [ROLE_OPERATOR],
      motivatedBy: BASE.motivatedBy,
      created: BASE.created,
      creator: BASE.creator,
      inDeliberation: BASE.inDeliberation,
    };
    const [parsed] = await roundTrip(minimal);
    expect(parsed).toEqual(minimal);
  });

  it("asserts BOTH rdf:types (fut:InfraProposal AND wf:Task) so plain wf:Task readers federate it", async () => {
    const ttl = await serializeInfraProposal(BASE);
    expect(ttl).toContain("InfraProposal");
    const ds = await parseRdf(ttl, "text/turtle", { baseIRI: BASE.id });
    let wfTyped = false;
    for (const q of ds.match(null, null, null, null)) {
      if (q.object.termType === "NamedNode" && q.object.value === WF_TASK) wfTyped = true;
    }
    expect(wfTyped).toBe(true);
  });

  it("sorts multi-valued fields deterministically", async () => {
    const p: InfraProposal = {
      ...BASE,
      affectsRole: [ROLE_PARTICIPANT, ROLE_IMPLEMENTER],
      targetsSystem: ["https://z.example/spec", "https://a.example/spec"],
    };
    const [parsed] = await roundTrip(p);
    expect(parsed?.affectsRole).toEqual([...p.affectsRole].sort());
    expect(parsed?.targetsSystem).toEqual([...p.targetsSystem].sort());
  });
});

describe("buildInfraProposalQuads validation (throws — the author-side gate)", () => {
  const cases: [string, InfraProposal][] = [
    ["empty title", { ...BASE, title: "" }],
    ["overlong title", { ...BASE, title: "x".repeat(201) }],
    ["no targets", { ...BASE, targetsSystem: [] }],
    [
      "too many targets",
      {
        ...BASE,
        targetsSystem: Array.from({ length: MAX_LINKS + 1 }, (_, i) => `https://t.example/${i}`),
      },
    ],
    ["non-http target", { ...BASE, targetsSystem: ["javascript:alert(1)"] }],
    ["no roles", { ...BASE, affectsRole: [] }],
    ["non-coded role", { ...BASE, affectsRole: ["https://evil.example/Role" as never] }],
    ["non-coded kind", { ...BASE, proposalKind: "https://evil.example/Kind" as never }],
    ["breaking without migration", { ...BASE, breakingChange: true }],
    ["breaking with blank migration", { ...BASE, breakingChange: true, migrationPath: "  " }],
    ["overlong migration", { ...BASE, breakingChange: true, migrationPath: "x".repeat(2001) }],
    ["non-http refImpl", { ...BASE, referenceImplementation: "file:///etc/passwd" }],
    ["no needs trace", { ...BASE, motivatedBy: [] }],
    [
      "too many needs",
      {
        ...BASE,
        motivatedBy: Array.from({ length: MAX_LINKS + 1 }, (_, i) => `https://n.example/${i}`),
      },
    ],
    ["non-http need", { ...BASE, motivatedBy: ["not-an-iri"] }],
    ["overlong stakeholders", { ...BASE, indirectStakeholders: "x".repeat(2001) }],
    ["overlong content", { ...BASE, content: "x".repeat(2001) }],
    ["bad created", { ...BASE, created: "yesterday" }],
    ["non-http creator", { ...BASE, creator: "mailto:a@example.org" }],
  ];
  for (const [name, p] of cases) {
    it(`rejects ${name}`, () => {
      expect(() => buildInfraProposalQuads(p)).toThrow();
    });
  }
});

describe("parseInfraProposals hostile-input hardening (drops — the read-side gate)", () => {
  it("parses the minimal well-formed Turtle", async () => {
    const items = parseInfraProposals(await parseTtl(ttlWith()));
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Adopt futures 0.2.0");
    expect(items[0]?.breakingChange).toBe(false);
  });

  const itemDrops: [string, Partial<Record<string, string>>][] = [
    ["a missing title", { title: "" }],
    ["a missing content", { content: "" }],
    ["a missing needs trace (SHACL MUST)", { motivated: "" }],
    ["a missing target (SHACL MUST)", { targets: "" }],
    ["a missing role (SHACL MUST)", { roles: "" }],
    [
      "only NON-CODED roles (all drop → the MUST is violated)",
      { roles: "fut:affectsRole <https://evil.example/FakeRole> ;" },
    ],
    [
      "a breaking change WITHOUT a migration story (interop honesty)",
      { breaking: `fut:breakingChange "true"^^xsd:boolean ;` },
    ],
    [
      "a breaking change whose migration story is WHITESPACE-ONLY (roborev Medium: hostile RDF must not satisfy the invariant with spaces)",
      { breaking: `fut:breakingChange "true"^^xsd:boolean ; fut:migrationPath "   " ;` },
    ],
    ["a malformed created date", { created: `dct:created "not-a-date"^^xsd:dateTime ;` }],
    ["a literal creator", { creator: `dct:creator "alice" ;` }],
    [
      "a non-http(s) target only",
      { targets: "fut:targetsSystem <urn:uuid:0b7d24b2-93a5-4fca-8e2c-1d5e8c9f8a10> ;" },
    ],
  ];
  for (const [name, overrides] of itemDrops) {
    it(`drops the ITEM on ${name}`, async () => {
      expect(parseInfraProposals(await parseTtl(ttlWith(overrides)))).toHaveLength(0);
    });
  }

  const fieldDrops: [string, Partial<Record<string, string>>, (p: InfraProposal) => unknown][] = [
    [
      "a non-coded proposal kind",
      { kind: "fut:proposalKind <https://evil.example/Kind> ;" },
      (p) => p.proposalKind,
    ],
    [
      "a non-boolean breakingChange literal",
      { breaking: `fut:breakingChange "maybe"^^xsd:boolean ;` },
      (p) => p.breakingChange,
    ],
    [
      "a string-typed breakingChange",
      { breaking: `fut:breakingChange "true" ;` },
      (p) => p.breakingChange,
    ],
    [
      "a javascript: reference implementation",
      { kind: "fut:referenceImplementation <javascript:alert(1)> ;" },
      (p) => p.referenceImplementation,
    ],
    [
      "an integer-typed indirectStakeholders",
      { kind: `fut:indirectStakeholders "123"^^xsd:integer ;` },
      (p) => p.indirectStakeholders,
    ],
    [
      "a whitespace-only migration story on a NON-breaking proposal (no story is no story)",
      { kind: `fut:migrationPath "  " ;` },
      (p) => p.migrationPath,
    ],
  ];
  for (const [name, overrides, get] of fieldDrops) {
    it(`drops the FIELD on ${name} (item survives)`, async () => {
      const items = parseInfraProposals(await parseTtl(ttlWith(overrides)));
      expect(items).toHaveLength(1);
      expect(get(items[0] as InfraProposal)).toBeUndefined();
    });
  }

  it("keeps the coded roles and drops the hostile ones from a mixed set", async () => {
    const items = parseInfraProposals(
      await parseTtl(
        ttlWith({
          roles:
            "fut:affectsRole fut:ImplementerRole, fut:OperatorRole, <https://evil.example/FakeRole> ;",
        }),
      ),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.affectsRole).toEqual([ROLE_IMPLEMENTER, ROLE_OPERATOR].sort());
  });

  it("caps a hostile targetsSystem fan-out at MAX_LINKS", async () => {
    const many = Array.from(
      { length: MAX_LINKS + 25 },
      (_, i) => `fut:targetsSystem <https://t.example/${String(i).padStart(4, "0")}> ;`,
    ).join("\n      ");
    const items = parseInfraProposals(await parseTtl(ttlWith({ targets: many })));
    expect(items).toHaveLength(1);
    expect(items[0]?.targetsSystem).toHaveLength(MAX_LINKS);
  });

  it("a malformed sibling never aborts the parse of a well-formed item", async () => {
    const ttl = `${ttlWith()}
      <https://alice.example/proposals/broken.ttl>
        a <https://w3id.org/jeswr/sectors/futures#InfraProposal> ;
        <http://purl.org/dc/terms/title> "Broken — no required fields" .
    `;
    const items = parseInfraProposals(await parseTtl(ttl));
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("https://alice.example/proposals/p1.ttl");
  });
});
