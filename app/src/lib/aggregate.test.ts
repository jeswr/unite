// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Client-side aggregation: the membership gate is enforced HERE, cross-pod
// authorship is verified (a pod cannot stuff statements as someone else), votes
// are deduped one-per-(participant,statement), and a hostile/broken source
// degrades that source alone — never the whole aggregation.

import { describe, expect, it } from "vitest";
import { aggregateDeliberation, dedupeResonances } from "./aggregate.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "./fut.js";
import {
  type MembershipResult,
  type MembershipVerifier,
  StubMembershipVerifier,
} from "./membership.js";
import type { Resonance } from "./model.js";
import { StaticRegistry } from "./registry.js";

const DELIB = "https://community.example/d1";
const OTHER_DELIB = "https://community.example/other";
const ALICE = "https://alice.example/profile#me";
const BOB = "https://bob.example/profile#me";
const ALICE_BASE = "https://alice.example/u/d1/";
const BOB_BASE = "https://bob.example/u/d1/";
const CONCEPT = "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence";

const PREFIX = `
  @prefix fut: <https://w3id.org/jeswr/sectors/futures#> .
  @prefix as: <https://www.w3.org/ns/activitystreams#> .
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix ldp: <http://www.w3.org/ns/ldp#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;

function needTtl(url: string, creator: string, delib: string, content = "x"): string {
  return `${PREFIX}
    <${url}> a fut:Need ; as:content "${content}" ;
      fut:needConcept <${CONCEPT}> ;
      dct:created "2026-07-01T00:00:00Z"^^xsd:dateTime ;
      dct:creator <${creator}> ; fut:inDeliberation <${delib}> .`;
}
function resTtl(url: string, creator: string, on: string, stance: string, created: string): string {
  return `${PREFIX}
    <${url}> a fut:Resonance ; fut:onStatement <${on}> ;
      fut:stance <${stance}> ;
      dct:created "${created}"^^xsd:dateTime ;
      dct:creator <${creator}> ; fut:inDeliberation <${DELIB}> .`;
}
function containerTtl(url: string, members: string[]): string {
  const contains = members.map((m) => `<${m}>`).join(", ");
  return `${PREFIX}
    <${url}> a ldp:Container, ldp:BasicContainer ${members.length ? `; ldp:contains ${contains}` : ""} .`;
}

/** Build a fake fetch over an in-memory url→turtle pod (missing → 404). */
function podFetch(pod: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = pod[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  }) as unknown as typeof fetch;
}

const registryBoth = () =>
  new StaticRegistry(DELIB, [
    { webId: ALICE, base: ALICE_BASE },
    { webId: BOB, base: BOB_BASE },
  ]);

describe("aggregateDeliberation", () => {
  it("aggregates verified participants' own, in-deliberation statements", async () => {
    const aliceN1 = `${ALICE_BASE}needs/n1.ttl`;
    const bobN1 = `${BOB_BASE}needs/n1.ttl`;
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [aliceN1]),
      [aliceN1]: needTtl(aliceN1, ALICE, DELIB),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, [
        `${ALICE_BASE}resonances/r1.ttl`,
      ]),
      [`${ALICE_BASE}resonances/r1.ttl`]: resTtl(
        `${ALICE_BASE}resonances/r1.ttl`,
        ALICE,
        bobN1,
        STANCE_RESONATES,
        "2026-07-01T01:00:00Z",
      ),
      [`${BOB_BASE}needs/`]: containerTtl(`${BOB_BASE}needs/`, [bobN1]),
      [bobN1]: needTtl(bobN1, BOB, DELIB),
      [`${BOB_BASE}resonances/`]: containerTtl(`${BOB_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: registryBoth(),
      verifier: new StubMembershipVerifier([ALICE, BOB]),
      fetch: podFetch(pod),
    });
    expect(result.needs.map((n) => n.id).sort()).toEqual([bobN1, aliceN1].sort());
    expect(result.resonances).toHaveLength(1);
    expect(result.verified.map((v) => v.webId).sort()).toEqual([ALICE, BOB].sort());
    expect(result.verified.every((v) => v.tier === "T1")).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.unverified).toEqual([]);
  });

  it("EXCLUDES an unverified participant's statements (the gate)", async () => {
    const aliceN1 = `${ALICE_BASE}needs/n1.ttl`;
    const bobN1 = `${BOB_BASE}needs/n1.ttl`;
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [aliceN1]),
      [aliceN1]: needTtl(aliceN1, ALICE, DELIB),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
      [`${BOB_BASE}needs/`]: containerTtl(`${BOB_BASE}needs/`, [bobN1]),
      [bobN1]: needTtl(bobN1, BOB, DELIB),
      [`${BOB_BASE}resonances/`]: containerTtl(`${BOB_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: registryBoth(),
      verifier: new StubMembershipVerifier([ALICE]), // BOB not vouched
      fetch: podFetch(pod),
    });
    expect(result.needs.map((n) => n.id)).toEqual([aliceN1]);
    expect(result.unverified).toEqual([
      { webId: BOB, reason: expect.stringContaining("dev stub") },
    ]);
  });

  it("drops a statement whose creator ≠ the pod's registry WebID (anti-spoof)", async () => {
    const spoof = `${ALICE_BASE}needs/spoof.ttl`;
    const pod: Record<string, string> = {
      // alice's pod hosts a need CLAIMING creator=BOB — must be dropped.
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [spoof]),
      [spoof]: needTtl(spoof, BOB, DELIB),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: podFetch(pod),
    });
    expect(result.needs).toEqual([]);
  });

  it("drops a statement whose fut:inDeliberation does not match", async () => {
    const n = `${ALICE_BASE}needs/n.ttl`;
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [n]),
      [n]: needTtl(n, ALICE, OTHER_DELIB),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: podFetch(pod),
    });
    expect(result.needs).toEqual([]);
  });

  it("records a per-source error for a malformed container, still aggregating others", async () => {
    const bobN1 = `${BOB_BASE}needs/n1.ttl`;
    const pod: Record<string, string> = {
      // alice's needs container is broken Turtle → source error, not a throw.
      [`${ALICE_BASE}needs/`]: "@@@ this is not turtle @@@",
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
      [`${BOB_BASE}needs/`]: containerTtl(`${BOB_BASE}needs/`, [bobN1]),
      [bobN1]: needTtl(bobN1, BOB, DELIB),
      [`${BOB_BASE}resonances/`]: containerTtl(`${BOB_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: registryBoth(),
      verifier: new StubMembershipVerifier([ALICE, BOB]),
      fetch: podFetch(pod),
    });
    expect(result.needs.map((n) => n.id)).toEqual([bobN1]); // bob still aggregated
    expect(result.errors.some((e) => e.webId === ALICE && e.stage === "needs")).toBe(true);
  });

  it("isolates ONE bad member: keeps the valid sibling, records the bad one", async () => {
    const good = `${ALICE_BASE}needs/good.ttl`;
    const bad = `${ALICE_BASE}needs/bad.ttl`;
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [good, bad]),
      [good]: needTtl(good, ALICE, DELIB),
      [bad]: "@@@ not turtle @@@", // one hostile member
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: podFetch(pod),
    });
    expect(result.needs.map((n) => n.id)).toEqual([good]); // sibling survives
    expect(result.errors.some((e) => e.resource === bad && e.stage === "needs")).toBe(true);
  });

  it("SSRF: skips a container member outside the participant's base, keeps in-scope", async () => {
    const good = `${ALICE_BASE}needs/good.ttl`;
    const evil = "https://evil.example/internal/secret.ttl"; // out-of-scope member
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [good, evil]),
      [good]: needTtl(good, ALICE, DELIB),
      // Even if evil served a matching need, it must never be fetched:
      [evil]: needTtl(evil, ALICE, DELIB),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const fetched: string[] = [];
    const base = podFetch(pod);
    const spyFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push(typeof input === "string" ? input : input.toString());
      return base(input as string, init);
    }) as unknown as typeof fetch;

    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: spyFetch,
    });
    expect(result.needs.map((n) => n.id)).toEqual([good]);
    expect(fetched).not.toContain(evil); // never fetched — no SSRF
    expect(result.errors.some((e) => e.resource === evil)).toBe(true);
  });

  it("records a per-source error for an oversize resource body", async () => {
    const n = `${ALICE_BASE}needs/big.ttl`;
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, [n]),
      [n]: needTtl(n, ALICE, DELIB, "x".repeat(200)),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: new StubMembershipVerifier([ALICE]),
      fetch: podFetch(pod),
      maxBodyBytes: 50,
    });
    expect(result.needs).toEqual([]);
    expect(result.errors.some((e) => e.stage === "needs")).toBe(true);
  });

  it("propagates a verifier throw as a membership source error", async () => {
    const throwingVerifier: MembershipVerifier = {
      verify(): Promise<MembershipResult> {
        return Promise.reject(new Error("verifier down"));
      },
    };
    const pod: Record<string, string> = {
      [`${ALICE_BASE}needs/`]: containerTtl(`${ALICE_BASE}needs/`, []),
      [`${ALICE_BASE}resonances/`]: containerTtl(`${ALICE_BASE}resonances/`, []),
    };
    const result = await aggregateDeliberation({
      registry: new StaticRegistry(DELIB, [{ webId: ALICE, base: ALICE_BASE }]),
      verifier: throwingVerifier,
      fetch: podFetch(pod),
    });
    expect(result.errors[0]?.stage).toBe("membership");
    expect(result.needs).toEqual([]);
  });
});

describe("dedupeResonances", () => {
  const mk = (
    creator: string,
    on: string,
    stance: string,
    created: string,
    id: string,
  ): Resonance => ({
    id,
    onStatement: on,
    stance: stance as Resonance["stance"],
    created,
    creator,
    inDeliberation: DELIB,
  });

  it("keeps one per (creator, statement): latest dct:created wins", () => {
    const early = mk(ALICE, "https://s/1", STANCE_RESONATES, "2026-07-01T00:00:00Z", "https://r/a");
    const late = mk(ALICE, "https://s/1", STANCE_CONFLICTS, "2026-07-02T00:00:00Z", "https://r/b");
    const deduped = dedupeResonances([early, late]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.stance).toBe(STANCE_CONFLICTS); // the later one
  });

  it("keeps distinct (creator, statement) pairs", () => {
    const a = mk(ALICE, "https://s/1", STANCE_RESONATES, "2026-07-01T00:00:00Z", "https://r/a");
    const b = mk(BOB, "https://s/1", STANCE_RESONATES, "2026-07-01T00:00:00Z", "https://r/b");
    const c = mk(ALICE, "https://s/2", STANCE_RESONATES, "2026-07-01T00:00:00Z", "https://r/c");
    expect(dedupeResonances([a, b, c])).toHaveLength(3);
  });
});
