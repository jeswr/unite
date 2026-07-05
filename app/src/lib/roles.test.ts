// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.1 declared → VERIFIED stakeholder role. The attack surface IS the test
// surface: the load-bearing property is that a role is a COMPUTED fact over the
// public federation web, FAIL-CLOSED to fut:ParticipantRole — a FORGED claim
// (pointing at someone else's storage, or a registry that never asserts you) must
// NOT verify. Every degrade path is exercised: forged same-origin, hostile/absent
// document, https-only, no evidence, batch fail-isolation.

import { buildRegistry, describeStorage } from "@jeswr/federation-registry";
import { describe, expect, it } from "vitest";
import { ROLE_IMPLEMENTER, ROLE_OPERATOR, ROLE_PARTICIPANT } from "./fut-draft.js";
import {
  type RoleDeclaration,
  verifiedRoleMap,
  verifyStakeholderRole,
  verifyStakeholderRoles,
} from "./roles.js";

const V2 = "https://w3id.org/jeswr/sectors/futures/0.2.0";
const SECTOR = "https://w3id.org/jeswr/sectors/futures";

// Alice runs an implementation at her OWN origin (the ownership binding).
const ALICE = "https://alice.example/profile/card#me";
const ALICE_STORAGE_DOC = "https://alice.example/.well-known/storage.ttl";
const ALICE_POD = "https://alice.example/";
// Mallory is a different origin — her forged implementer claim over Alice's
// storage must fail the same-origin ownership bind.
const MALLORY = "https://mallory.example/card#me";
// An operator asserted by a community registry.
const OP = "https://op.example/card#me";
const REGISTRY_DOC = "https://community.example/registry.ttl";

/** A fetch serving pre-authored fedreg Turtle per URL (adoption.test pattern). */
function fetchServing(docs: Record<string, string>): typeof fetch {
  return async (input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = docs[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  };
}

async function storageDoc(
  id: string,
  storage: string,
  acceptsSpec: string[],
  supportsSector: string[] = [],
): Promise<string> {
  return describeStorage({ id, storage, acceptsSpec, supportsSector }).toString();
}

async function registryDoc(members: { app: string; assertedBy: string[] }[]): Promise<string> {
  return buildRegistry({
    id: REGISTRY_DOC,
    members: members.map((m, i) => ({
      id: `${REGISTRY_DOC}#m${i}`,
      app: m.app,
      status: "Active",
      assertedBy: m.assertedBy,
    })),
  }).toString();
}

const opts = (fetchFn: typeof fetch) => ({
  fetch: fetchFn,
  acceptedVersions: [V2],
  acceptedSectors: [SECTOR],
});

describe("verifyStakeholderRole — participant is the fail-closed base", () => {
  it("a participant declaration is trivially verified (no evidence needed)", async () => {
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_PARTICIPANT },
      opts(fetchServing({})),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(true);
  });

  it("a NON-https participant WebID is NOT verified (invalid identity), even as base role", async () => {
    const r = await verifyStakeholderRole(
      { webId: "http://alice.example/card#me", declaredRole: ROLE_PARTICIPANT },
      opts(fetchServing({})),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT); // fail-closed base
    expect(r.verified).toBe(false); // but the invalid identity is never "verified"
  });

  it("a non-https WebID never upgrades past participant", async () => {
    const r = await verifyStakeholderRole(
      {
        webId: "http://alice.example/card#me",
        declaredRole: ROLE_IMPLEMENTER,
        evidence: [ALICE_STORAGE_DOC],
      },
      opts(fetchServing({})),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
  });
});

describe("verifyStakeholderRole — IMPLEMENTER (acceptsSpec + same-origin bind)", () => {
  it("verifies a real implementer: same-origin storage advertising the version", async () => {
    const fetchFn = fetchServing({
      [ALICE_STORAGE_DOC]: await storageDoc(ALICE_STORAGE_DOC, ALICE_POD, [V2]),
    });
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_IMPLEMENTER);
    expect(r.verified).toBe(true);
    expect(r.evidenceSource).toBe(ALICE_STORAGE_DOC);
  });

  it("verifies via supportsSector as an alternative proof", async () => {
    // A valid storage description (fedreg requires ≥1 acceptsSpec) whose acceptsSpec
    // does NOT match the accepted version, but whose supportsSector DOES — the
    // alternative implementer proof path.
    const fetchFn = fetchServing({
      [ALICE_STORAGE_DOC]: await storageDoc(
        ALICE_STORAGE_DOC,
        ALICE_POD,
        ["https://w3id.org/jeswr/sectors/futures/0.9.9"],
        [SECTOR],
      ),
    });
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_IMPLEMENTER);
  });

  it("FORGED claim: Mallory (other origin) points at Alice's storage → base role", async () => {
    // The core attack: a forged implementer claim over a storage the declarer does
    // NOT control. The storage advertises the version, and parseStorage succeeds —
    // but Mallory's WebID is not within Alice's pod, so it does not verify.
    const fetchFn = fetchServing({
      [ALICE_STORAGE_DOC]: await storageDoc(ALICE_STORAGE_DOC, ALICE_POD, [V2]),
    });
    const r = await verifyStakeholderRole(
      { webId: MALLORY, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/within the advertised storage/);
  });

  it("MULTI-TENANT forgery: a co-tenant on the SAME origin cannot claim another tenant's pod", async () => {
    // A shared host: alice's pod is https://pods.example/alice/ (WebID under it), and
    // mallory is a co-tenant on the SAME origin. A bare same-origin check would let
    // mallory claim alice's storage; the within-storage (path-containment) bind blocks
    // it — mallory's WebID is not under alice's pod path.
    const host = "https://pods.example";
    const aliceStorageDoc = `${host}/alice/.well-known/storage.ttl`;
    const aliceWebId = `${host}/alice/profile/card#me`;
    const malloryWebId = `${host}/mallory/profile/card#me`;
    const fetchFn = fetchServing({
      [aliceStorageDoc]: await storageDoc(aliceStorageDoc, `${host}/alice/`, [V2]),
    });
    // The real tenant (alice) verifies — her WebID IS within her pod.
    const alice = await verifyStakeholderRole(
      { webId: aliceWebId, declaredRole: ROLE_IMPLEMENTER, evidence: [aliceStorageDoc] },
      opts(fetchFn),
    );
    expect(alice.verifiedRole).toBe(ROLE_IMPLEMENTER);
    // The co-tenant (mallory) does NOT — her WebID is not under alice's pod path.
    const mallory = await verifyStakeholderRole(
      { webId: malloryWebId, declaredRole: ROLE_IMPLEMENTER, evidence: [aliceStorageDoc] },
      opts(fetchFn),
    );
    expect(mallory.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(mallory.verified).toBe(false);
  });

  it("same-origin storage that advertises NO accepted version/sector → base role", async () => {
    const OTHER = "https://w3id.org/jeswr/sectors/futures/0.1.0";
    const fetchFn = fetchServing({
      [ALICE_STORAGE_DOC]: await storageDoc(ALICE_STORAGE_DOC, ALICE_POD, [OTHER]),
    });
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
  });

  it("FORGED off-origin doc: a storage description NOT served from the storage it describes → base role", async () => {
    // The attack: an attacker-hosted HTTPS document (at mallory.example) that NAMES
    // alice's pod as fedreg:storage + advertises the accepted spec. parseStorage does
    // not bind the doc URL to fedreg:storage, so without the authoritativeness check
    // alice could forge implementer standing via a doc she doesn't serve. The doc is
    // not within alice's pod → refused.
    const forgedDoc = "https://mallory.example/forged-storage.ttl";
    const fetchFn = fetchServing({
      [forgedDoc]: await storageDoc(forgedDoc, ALICE_POD, [V2]), // claims alice's pod
    });
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [forgedDoc] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
    expect(r.reason).toMatch(/served from within the storage/);
  });

  it("a hostile / non-storage document degrades fail-closed, never throws", async () => {
    const fetchFn = fetchServing({ [ALICE_STORAGE_DOC]: "<not a storage description> ." });
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
  });

  it("refuses a non-https evidence IRI before any request (https-only)", async () => {
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: ["http://alice.example/s.ttl"] },
      opts(fetchServing({})),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.reason).toMatch(/https/);
  });

  it("no evidence → participant fallback", async () => {
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER },
      opts(fetchServing({})),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.reason).toMatch(/no evidence/);
  });

  it("BOUNDED: an over-limit evidence list is refused (no unbounded network fan-out)", async () => {
    // A hostile declaration naming 51 evidence IRIs must NOT trigger 51 fetches — it
    // fails closed to ParticipantRole before any request.
    let fetches = 0;
    const counting: typeof fetch = async () => {
      fetches += 1;
      return new Response("not found", { status: 404 });
    };
    const evidence = Array.from({ length: 51 }, (_, i) => `https://e${i}.example/s.ttl`);
    const r = await verifyStakeholderRole(
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence },
      opts(counting),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.reason).toMatch(/too many/);
    expect(fetches).toBe(0); // refused before any network request
  });
});

describe("verifyStakeholderRole — OPERATOR (assertedBy on a live registry)", () => {
  it("verifies an operator whose WebID is an assertedBy party", async () => {
    const fetchFn = fetchServing({
      [REGISTRY_DOC]: await registryDoc([{ app: "https://app.example/id", assertedBy: [OP] }]),
    });
    const r = await verifyStakeholderRole(
      { webId: OP, declaredRole: ROLE_OPERATOR, evidence: [REGISTRY_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_OPERATOR);
    expect(r.verified).toBe(true);
  });

  it("FORGED claim: a WebID the registry never asserts → base role", async () => {
    const fetchFn = fetchServing({
      [REGISTRY_DOC]: await registryDoc([{ app: "https://app.example/id", assertedBy: [OP] }]),
    });
    const r = await verifyStakeholderRole(
      { webId: MALLORY, declaredRole: ROLE_OPERATOR, evidence: [REGISTRY_DOC] },
      opts(fetchFn),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
  });

  it("a REVOKED membership does NOT grant operator standing (status must be Active)", async () => {
    // The membership asserts OP, but its status is Revoked (withdrawn) → no live role.
    const doc = await buildRegistry({
      id: REGISTRY_DOC,
      members: [
        {
          id: `${REGISTRY_DOC}#m0`,
          app: "https://app.example/id",
          status: "Revoked",
          assertedBy: [OP],
        },
      ],
    }).toString();
    const r = await verifyStakeholderRole(
      { webId: OP, declaredRole: ROLE_OPERATOR, evidence: [REGISTRY_DOC] },
      opts(fetchServing({ [REGISTRY_DOC]: doc })),
    );
    expect(r.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(r.verified).toBe(false);
  });
});

describe("verifyStakeholderRoles — batch, fail-isolated + verifiedRoleMap", () => {
  it("resolves a mixed batch, one hostile document never sinks the others", async () => {
    const fetchFn = fetchServing({
      [ALICE_STORAGE_DOC]: await storageDoc(ALICE_STORAGE_DOC, ALICE_POD, [V2]),
      [REGISTRY_DOC]: await registryDoc([{ app: "https://app.example/id", assertedBy: [OP] }]),
    });
    const decls: RoleDeclaration[] = [
      { webId: ALICE, declaredRole: ROLE_IMPLEMENTER, evidence: [ALICE_STORAGE_DOC] },
      { webId: OP, declaredRole: ROLE_OPERATOR, evidence: [REGISTRY_DOC] },
      { webId: MALLORY, declaredRole: ROLE_IMPLEMENTER, evidence: ["https://void.example/x.ttl"] },
    ];
    const results = await verifyStakeholderRoles(decls, opts(fetchFn));
    expect(results.map((r) => r.verifiedRole)).toEqual([
      ROLE_IMPLEMENTER,
      ROLE_OPERATOR,
      ROLE_PARTICIPANT, // the forged/broken one degrades, siblings survive
    ]);
    const map = verifiedRoleMap(results);
    expect(map.get(ALICE)).toBe(ROLE_IMPLEMENTER);
    expect(map.get(OP)).toBe(ROLE_OPERATOR);
    expect(map.get(MALLORY)).toBe(ROLE_PARTICIPANT);
  });

  it("verifiedRoleMap merge is ORDER-INDEPENDENT: a participant fallback never erases a verified role", () => {
    const verifiedImpl = {
      webId: ALICE,
      declaredRole: ROLE_IMPLEMENTER,
      verifiedRole: ROLE_IMPLEMENTER,
      verified: true,
    };
    const fallback = {
      webId: ALICE,
      declaredRole: ROLE_IMPLEMENTER,
      verifiedRole: ROLE_PARTICIPANT,
      verified: false,
    };
    // Either order → the stronger verified role wins.
    expect(verifiedRoleMap([verifiedImpl, fallback]).get(ALICE)).toBe(ROLE_IMPLEMENTER);
    expect(verifiedRoleMap([fallback, verifiedImpl]).get(ALICE)).toBe(ROLE_IMPLEMENTER);
  });

  it("verifiedRoleMap fails closed to ParticipantRole on CONFLICTING stronger roles", () => {
    const asImpl = {
      webId: ALICE,
      declaredRole: ROLE_IMPLEMENTER,
      verifiedRole: ROLE_IMPLEMENTER,
      verified: true,
    };
    const asOp = {
      webId: ALICE,
      declaredRole: ROLE_OPERATOR,
      verifiedRole: ROLE_OPERATOR,
      verified: true,
    };
    expect(verifiedRoleMap([asImpl, asOp]).get(ALICE)).toBe(ROLE_PARTICIPANT);
    expect(verifiedRoleMap([asOp, asImpl]).get(ALICE)).toBe(ROLE_PARTICIPANT);
  });
});
