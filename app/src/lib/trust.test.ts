// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Phase-2 trust layer, adversarially: EVERY trust-decision path — grant,
// no-credential, expired, not-yet-valid, malformed, tampered, wrong-community,
// wrong-role-scope, wrong-subject, untrusted-issuer, revoked, role-without-
// membership — must resolve the fail-closed way. All credentials here are REAL
// (Ed25519 Data Integrity proofs over RDFC-1.0 via federation-trust); nothing
// is stubbed at the verification layer.

import {
  generateKeyPairForSuite,
  issueMembershipCredential,
  type KeyPair,
  type TrustAnchor,
  type VerifiableCredential,
} from "@jeswr/federation-trust";
import { beforeAll, describe, expect, it } from "vitest";
import {
  AllowlistTrustResolver,
  type CredentialSource,
  CredentialTrustResolver,
  hasRole,
  isRole,
  issueCommunityMembership,
  issueRoleCredential,
  meetsTier,
  PodCredentialSource,
  ROLE_VALIDITY_DAYS,
  ROLES,
  roleScopeIri,
  TierParticipationGate,
  type TrustResolver,
  UNTRUSTED,
  writeCredentialDoc,
} from "./trust.js";

const COMMUNITY = "https://community.example/deliberations/apps";
const OTHER_COMMUNITY = "https://community.example/deliberations/infra";
const STEWARD = "https://steward.example/profile#me";
const ALICE = "https://alice.example/profile#me";
const BOB = "https://bob.example/profile#me";

let stewardKey: KeyPair;
let strangerKey: KeyPair; // NOT a trust anchor
let anchors: TrustAnchor[];

beforeAll(async () => {
  stewardKey = await generateKeyPairForSuite(STEWARD, "Ed25519");
  strangerKey = await generateKeyPairForSuite("https://stranger.example/#me", "Ed25519");
  anchors = [{ authority: STEWARD, verificationMethod: STEWARD, publicKey: stewardKey.publicKey }];
});

/** An in-memory credential source with call counting (memoisation proofs). */
class MapSource implements CredentialSource {
  calls = 0;
  constructor(readonly docs = new Map<string, unknown[]>()) {}
  credentialsFor(webId: string): Promise<readonly unknown[]> {
    this.calls += 1;
    return Promise.resolve(this.docs.get(webId) ?? []);
  }
}

function resolverWith(docs: Map<string, unknown[]>, now?: () => Date): CredentialTrustResolver {
  return new CredentialTrustResolver({
    trustAnchors: anchors,
    source: new MapSource(docs),
    ...(now ? { now } : {}),
  });
}

const membershipFor = (subject: string, community = COMMUNITY) =>
  issueCommunityMembership({ community, subject, steward: STEWARD, key: stewardKey });

// ── the role-scope convention ────────────────────────────────────────────────

describe("roleScopeIri", () => {
  it("derives a role-scoped IRI under the community", () => {
    expect(roleScopeIri(COMMUNITY, "builder")).toBe(`${COMMUNITY}/roles/builder`);
  });

  it("handles a trailing-slash community without doubling the slash", () => {
    expect(roleScopeIri("https://c.example/d/", "steward")).toBe(
      "https://c.example/d/roles/steward",
    );
  });

  it("is distinct per role and per community", () => {
    const all = ROLES.flatMap((r) => [
      roleScopeIri(COMMUNITY, r),
      roleScopeIri(OTHER_COMMUNITY, r),
    ]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("profile helpers", () => {
  it("isRole accepts exactly the closed set", () => {
    expect(isRole("builder")).toBe(true);
    expect(isRole("reviewer")).toBe(true);
    expect(isRole("steward")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("hasRole / meetsTier read the profile", () => {
    const p = { tier: 1 as const, roles: ["builder" as const] };
    expect(hasRole(p, "builder")).toBe(true);
    expect(hasRole(p, "steward")).toBe(false);
    expect(meetsTier(p, 0)).toBe(true);
    expect(meetsTier(p, 1)).toBe(true);
    expect(meetsTier(p, 2)).toBe(false);
    expect(meetsTier(UNTRUSTED, 0)).toBe(true);
    expect(meetsTier(UNTRUSTED, 1)).toBe(false);
  });
});

// ── the resolver: GRANT paths ────────────────────────────────────────────────

describe("CredentialTrustResolver — grants", () => {
  it("a verified membership credential grants tier 1, no roles", async () => {
    const r = resolverWith(new Map([[ALICE, [await membershipFor(ALICE)]]]));
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual({ tier: 1, roles: [] });
    expect(await r.verify(ALICE, COMMUNITY)).toEqual({ ok: true, tier: "T1" });
  });

  it("membership + role credentials grant the roles", async () => {
    const docs = [
      await membershipFor(ALICE),
      await issueRoleCredential({
        community: COMMUNITY,
        subject: ALICE,
        role: "builder",
        steward: STEWARD,
        key: stewardKey,
      }),
      await issueRoleCredential({
        community: COMMUNITY,
        subject: ALICE,
        role: "steward",
        steward: STEWARD,
        key: stewardKey,
      }),
    ];
    const profile = await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY);
    expect(profile.tier).toBe(1);
    expect([...profile.roles].sort()).toEqual(["builder", "steward"]);
  });

  it("a valid credential still grants when surrounded by garbage documents", async () => {
    const docs: unknown[] = [
      null,
      42,
      "not a credential",
      {},
      { issuer: STEWARD }, // structurally hopeless
      await membershipFor(ALICE),
    ];
    const profile = await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY);
    expect(profile).toEqual({ tier: 1, roles: [] });
  });

  it("never mints tier 2 (the ZK-personhood seam is not live)", async () => {
    const docs = [
      await membershipFor(ALICE),
      ...(await Promise.all(
        ROLES.map((role) =>
          issueRoleCredential({
            community: COMMUNITY,
            subject: ALICE,
            role,
            steward: STEWARD,
            key: stewardKey,
          }),
        ),
      )),
    ];
    const profile = await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY);
    expect(profile.tier).toBe(1);
  });
});

// ── the resolver: DENY paths (every one fail-closed) ─────────────────────────

describe("CredentialTrustResolver — denials", () => {
  it("no credentials → UNTRUSTED", async () => {
    const r = resolverWith(new Map());
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual(UNTRUSTED);
    const gate = await r.verify(ALICE, COMMUNITY);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/no verifiable membership/);
  });

  it("a role credential WITHOUT membership grants nothing (roles presume T1)", async () => {
    const docs = [
      await issueRoleCredential({
        community: COMMUNITY,
        subject: ALICE,
        role: "builder",
        steward: STEWARD,
        key: stewardKey,
      }),
    ];
    expect(await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("an EXPIRED membership is rejected (validity window enforced)", async () => {
    const issued = await issueCommunityMembership({
      community: COMMUNITY,
      subject: ALICE,
      steward: STEWARD,
      key: stewardKey,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validityDays: 30,
    });
    const past = resolverWith(
      new Map([[ALICE, [issued]]]),
      () => new Date("2026-03-01T00:00:00Z"), // after the 30-day window
    );
    expect(await past.resolve(ALICE, COMMUNITY)).toEqual(UNTRUSTED);
    const inWindow = resolverWith(
      new Map([[ALICE, [issued]]]),
      () => new Date("2026-01-15T00:00:00Z"),
    );
    expect(await inWindow.resolve(ALICE, COMMUNITY)).toEqual({ tier: 1, roles: [] });
  });

  it("a NOT-YET-VALID membership is rejected", async () => {
    const issued = await issueCommunityMembership({
      community: COMMUNITY,
      subject: ALICE,
      steward: STEWARD,
      key: stewardKey,
      validFrom: new Date("2027-01-01T00:00:00Z"),
    });
    const r = resolverWith(new Map([[ALICE, [issued]]]), () => new Date("2026-06-01T00:00:00Z"));
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual(UNTRUSTED);
  });

  it("a membership for a DIFFERENT community is ignored (exact scope match)", async () => {
    const docs = [await membershipFor(ALICE, OTHER_COMMUNITY)];
    expect(await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a role scoped to a DIFFERENT community grants no role here", async () => {
    const docs = [
      await membershipFor(ALICE), // member HERE
      await issueRoleCredential({
        community: OTHER_COMMUNITY, // steward THERE
        subject: ALICE,
        role: "steward",
        steward: STEWARD,
        key: stewardKey,
      }),
    ];
    const profile = await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY);
    expect(profile).toEqual({ tier: 1, roles: [] }); // no cross-community authority
  });

  it("someone ELSE's credential grants nothing (subject binding)", async () => {
    const docs = [await membershipFor(BOB)]; // presented by/for ALICE
    expect(await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a credential signed by a NON-ANCHOR key is rejected (untrusted issuer)", async () => {
    const forged = await issueMembershipCredential({
      claim: {
        federation: COMMUNITY,
        app: ALICE,
        status: "Active",
        assertedBy: "https://stranger.example/#me",
      },
      key: strangerKey,
    });
    expect(await resolverWith(new Map([[ALICE, [forged]]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a credential CLAIMING the steward but signed by an attacker key is rejected", async () => {
    const attackerWithStewardIri = await generateKeyPairForSuite(STEWARD, "Ed25519");
    const forged = await issueMembershipCredential({
      claim: { federation: COMMUNITY, app: ALICE, status: "Active", assertedBy: STEWARD },
      key: attackerWithStewardIri, // wrong private key behind the anchor's IRI
    });
    expect(await resolverWith(new Map([[ALICE, [forged]]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a REVOKED membership is rejected (status gate)", async () => {
    const revoked = await issueMembershipCredential({
      claim: { federation: COMMUNITY, app: ALICE, status: "Revoked", assertedBy: STEWARD },
      key: stewardKey,
    });
    expect(await resolverWith(new Map([[ALICE, [revoked]]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a TAMPERED credential is rejected (signature over the claim graph)", async () => {
    const genuine = await membershipFor(BOB);
    // The attacker swaps the subject to themselves, keeping the valid proof.
    const tampered = JSON.parse(JSON.stringify(genuine)) as Record<string, unknown>;
    const subject = tampered.credentialSubject as Record<string, unknown>;
    for (const [k, v] of Object.entries(subject)) {
      if (v === BOB) subject[k] = ALICE;
    }
    tampered.credentialSubject = subject;
    expect(await resolverWith(new Map([[ALICE, [tampered]]])).resolve(ALICE, COMMUNITY)).toEqual(
      UNTRUSTED,
    );
  });

  it("a tampered ROLE ESCALATION is rejected (reviewer edited into steward)", async () => {
    const reviewer = await issueRoleCredential({
      community: COMMUNITY,
      subject: ALICE,
      role: "reviewer",
      steward: STEWARD,
      key: stewardKey,
    });
    const escalated = JSON.parse(
      JSON.stringify(reviewer).replaceAll("roles/reviewer", "roles/steward"),
    );
    const docs = [await membershipFor(ALICE), escalated];
    const profile = await resolverWith(new Map([[ALICE, docs]])).resolve(ALICE, COMMUNITY);
    expect(profile.roles).toEqual([]); // the forged steward role did NOT verify
  });

  it("with NO trust anchors, nothing ever verifies", async () => {
    const r = new CredentialTrustResolver({
      trustAnchors: [],
      source: new MapSource(new Map([[ALICE, [await membershipFor(ALICE)]]])),
    });
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual(UNTRUSTED);
  });
});

// ── resolver caching semantics ───────────────────────────────────────────────

describe("CredentialTrustResolver — memoisation + failure isolation", () => {
  it("memoises per (community, webId) and invalidates per WebID", async () => {
    const source = new MapSource(new Map([[ALICE, [await membershipFor(ALICE)]]]));
    const r = new CredentialTrustResolver({ trustAnchors: anchors, source });
    await r.resolve(ALICE, COMMUNITY);
    await r.resolve(ALICE, COMMUNITY);
    expect(source.calls).toBe(1); // cached
    r.invalidate(BOB); // someone else — Alice stays cached
    await r.resolve(ALICE, COMMUNITY);
    expect(source.calls).toBe(1);
    r.invalidate(ALICE);
    await r.resolve(ALICE, COMMUNITY);
    expect(source.calls).toBe(2); // re-resolved
    r.invalidate(); // clear all
    await r.resolve(ALICE, COMMUNITY);
    expect(source.calls).toBe(3);
  });

  it("a SOURCE failure is fail-closed but NOT cached (no sticky denial)", async () => {
    let healthy = false;
    const membership = await membershipFor(ALICE);
    const source: CredentialSource = {
      credentialsFor: () => {
        if (!healthy) return Promise.reject(new Error("pod unreachable"));
        return Promise.resolve([membership]);
      },
    };
    const r = new CredentialTrustResolver({ trustAnchors: anchors, source });
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual(UNTRUSTED); // outage → deny
    healthy = true;
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual({ tier: 1, roles: [] }); // no cache poison
  });
});

// ── the floor-aware participation gate ───────────────────────────────────────

describe("TierParticipationGate", () => {
  const t0: TrustResolver = { resolve: () => Promise.resolve(UNTRUSTED) };
  const t1: TrustResolver = { resolve: () => Promise.resolve({ tier: 1, roles: [] }) };

  it("floor 0 admits pseudonymous voice, honestly labelled T0", async () => {
    expect(await new TierParticipationGate(t0, 0).verify(ALICE, COMMUNITY)).toEqual({
      ok: true,
      tier: "T0",
    });
  });

  it("floor 0 labels a vouched member T1", async () => {
    expect(await new TierParticipationGate(t1, 0).verify(ALICE, COMMUNITY)).toEqual({
      ok: true,
      tier: "T1",
    });
  });

  it("floor 1 rejects T0 with an explanatory reason", async () => {
    const res = await new TierParticipationGate(t0, 1).verify(ALICE, COMMUNITY);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/T1.*T0|requires identity tier T1/);
  });

  it("floor 1 admits T1; floor 2 rejects T1 (the T2 seam)", async () => {
    expect((await new TierParticipationGate(t1, 1).verify(ALICE, COMMUNITY)).ok).toBe(true);
    expect((await new TierParticipationGate(t1, 2).verify(ALICE, COMMUNITY)).ok).toBe(false);
  });
});

describe("AllowlistTrustResolver (pod-mode fallback)", () => {
  it("grants tier 1 to listed WebIDs — and NEVER any role", async () => {
    const r = new AllowlistTrustResolver([ALICE]);
    expect(await r.resolve(ALICE, COMMUNITY)).toEqual({ tier: 1, roles: [] });
    expect(await r.resolve(BOB, COMMUNITY)).toEqual(UNTRUSTED);
  });
});

// ── issuance ─────────────────────────────────────────────────────────────────

describe("issuance validation + validity window", () => {
  it("role credentials default to a 90-day validity (short-lived, renewable)", async () => {
    const from = new Date("2026-07-01T00:00:00Z");
    const vc = await issueRoleCredential({
      community: COMMUNITY,
      subject: ALICE,
      role: "builder",
      steward: STEWARD,
      key: stewardKey,
      validFrom: from,
    });
    // A long-lived membership, so ONLY the role's window is under test.
    const membership = await issueCommunityMembership({
      community: COMMUNITY,
      subject: ALICE,
      steward: STEWARD,
      key: stewardKey,
      validFrom: from,
      validityDays: 365,
    });
    const docs = new Map([[ALICE, [membership, vc]]]);
    const dayNinetyOne = new Date(from.getTime() + (ROLE_VALIDITY_DAYS + 1) * 86_400_000);
    const inWindow = resolverWith(docs, () => new Date("2026-07-15T00:00:00Z"));
    expect((await inWindow.resolve(ALICE, COMMUNITY)).roles).toEqual(["builder"]);
    // Past 90 days the ROLE has expired closed; the membership still stands.
    const after = resolverWith(docs, () => dayNinetyOne);
    expect(await after.resolve(ALICE, COMMUNITY)).toEqual({ tier: 1, roles: [] });
  });

  it("rejects a non-http community / subject and bad validity", async () => {
    const base = { community: COMMUNITY, subject: ALICE, steward: STEWARD, key: stewardKey };
    await expect(
      issueRoleCredential({ ...base, community: "not-an-iri", role: "builder" }),
    ).rejects.toThrow(/community/);
    await expect(
      issueRoleCredential({ ...base, subject: "javascript:alert(1)", role: "builder" }),
    ).rejects.toThrow(/subject/);
    await expect(
      issueRoleCredential({ ...base, role: "builder", validityDays: 0 }),
    ).rejects.toThrow(/validityDays/);
    await expect(issueRoleCredential({ ...base, role: "admin" as never })).rejects.toThrow(
      /unknown role/,
    );
  });
});

// ── credential pod I/O ───────────────────────────────────────────────────────

const BASE = "https://alice.example/unite/apps/";

describe("writeCredentialDoc", () => {
  it("PUTs JSON-LD create-only inside the holder's base", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchFn: typeof fetch = (input, init) => {
      seen.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(new Response(null, { status: 201 }));
    };
    const credential = (await membershipFor(ALICE)) as VerifiableCredential;
    const { url } = await writeCredentialDoc(fetchFn, BASE, credential);
    expect(url.startsWith(`${BASE}credentials/`)).toBe(true);
    expect(url.endsWith(".jsonld")).toBe(true);
    const req = seen[0];
    expect(req?.init.method).toBe("PUT");
    const headers = new Headers(req?.init.headers);
    expect(headers.get("content-type")).toBe("application/ld+json");
    expect(headers.get("if-none-match")).toBe("*");
    expect(JSON.parse(String(req?.init.body))).toEqual(credential);
  });

  it("throws on a failed write and on an unusable base (scope guard)", async () => {
    const failing: typeof fetch = () => Promise.resolve(new Response(null, { status: 403 }));
    const credential = await membershipFor(ALICE);
    await expect(writeCredentialDoc(failing, BASE, credential)).rejects.toThrow(/403/);
    // http (non-https) base → the fail-closed write guard rejects BEFORE any fetch
    await expect(
      writeCredentialDoc(failing, "http://alice.example/unite/apps/", credential),
    ).rejects.toThrow(/https/);
  });
});

describe("PodCredentialSource", () => {
  const CONTAINER = `${BASE}credentials/`;
  const containerTurtle = (members: string[]) =>
    `<${CONTAINER}> a <http://www.w3.org/ns/ldp#Container> ; <http://www.w3.org/ns/ldp#contains> ${members
      .map((m) => `<${m}>`)
      .join(", ")} .`;

  function podFetch(resources: Record<string, { body: string; type: string }>): {
    fetch: typeof fetch;
    fetched: string[];
  } {
    const fetched: string[] = [];
    return {
      fetched,
      fetch: (input) => {
        const url = String(input);
        fetched.push(url);
        const doc = resources[url];
        if (!doc) return Promise.resolve(new Response("nope", { status: 404 }));
        return Promise.resolve(
          new Response(doc.body, { status: 200, headers: { "content-type": doc.type } }),
        );
      },
    };
  }

  it("reads JSON credential docs listed in the container", async () => {
    const credUrl = `${CONTAINER}m1.jsonld`;
    const { fetch: f } = podFetch({
      [CONTAINER]: { body: containerTurtle([credUrl]), type: "text/turtle" },
      [credUrl]: { body: JSON.stringify({ hello: "world" }), type: "application/ld+json" },
    });
    const source = new PodCredentialSource(f, new Map([[ALICE, BASE]]));
    expect(await source.credentialsFor(ALICE)).toEqual([{ hello: "world" }]);
  });

  it("an unknown WebID or a 404 container is just 'no credentials'", async () => {
    const { fetch: f } = podFetch({});
    const source = new PodCredentialSource(f, new Map([[ALICE, BASE]]));
    expect(await source.credentialsFor(ALICE)).toEqual([]);
    expect(await source.credentialsFor(BOB)).toEqual([]); // no base configured
  });

  it("NEVER fetches a listed member outside the holder's base (hostile listing)", async () => {
    const inside = `${CONTAINER}ok.jsonld`;
    const outside = "https://attacker.example/steal";
    const { fetch: f, fetched } = podFetch({
      [CONTAINER]: { body: containerTurtle([inside, outside]), type: "text/turtle" },
      [inside]: { body: "{}", type: "application/ld+json" },
    });
    const source = new PodCredentialSource(f, new Map([[ALICE, BASE]]));
    expect(await source.credentialsFor(ALICE)).toEqual([{}]);
    expect(fetched).not.toContain(outside);
  });

  it("skips malformed JSON and caps the number of documents", async () => {
    const urls = Array.from({ length: 5 }, (_, i) => `${CONTAINER}c${i}.jsonld`);
    const resources: Record<string, { body: string; type: string }> = {
      [CONTAINER]: { body: containerTurtle(urls), type: "text/turtle" },
    };
    for (const [i, u] of urls.entries()) {
      resources[u] = {
        body: i === 1 ? "{{{not json" : JSON.stringify({ i }),
        type: "application/ld+json",
      };
    }
    const source = new PodCredentialSource(podFetch(resources).fetch, new Map([[ALICE, BASE]]), 3);
    const docs = await source.credentialsFor(ALICE);
    // 3 docs considered (the cap), one of them malformed → 2 parsed.
    expect(docs).toEqual([{ i: 0 }, { i: 2 }]);
  });
});
