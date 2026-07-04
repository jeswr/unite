// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The seeded demo trust layer must be REAL end-to-end: credentials are signed
// with the seeded steward keys, stored in the in-memory pods, read back
// through PodCredentialSource → verifyMembershipCredential, and gated by the
// same TierParticipationGate the app's aggregation uses. If any of it were a
// mock verdict, the TAMPER test below would not lose the role.

import { beforeEach, describe, expect, it } from "vitest";
import { aggregateDeliberation } from "../lib/aggregate.js";
import { StaticRegistry } from "../lib/registry.js";
import {
  hasRole,
  issueRoleCredential,
  TierParticipationGate,
  UNTRUSTED,
  writeCredentialDoc,
} from "../lib/trust.js";
import { SCOPES } from "../scope/scopes.js";
import { DEMO_NEEDS, DEMO_PEOPLE, DEMO_TRUST, demoWebId } from "./fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "./pods.js";

beforeEach(() => {
  resetDemoInstances();
});

describe("seeded standings per scope (the tier-spanning personas)", () => {
  it("apps: 'you' are a steward; the fixture roles all resolve", async () => {
    const demo = await getDemoDeliberation("apps");
    const { resolver } = demo.trust;
    const you = await resolver.resolve(demoWebId("you"), demo.deliberation);
    expect(you.tier).toBe(1);
    expect(hasRole(you, "steward")).toBe(true);
    expect(demo.trust.sessionSteward?.webId).toBe(demoWebId("you"));

    const amara = await resolver.resolve(demoWebId("amara"), demo.deliberation);
    expect(amara).toEqual({ tier: 1, roles: ["builder"] });
    const hana = await resolver.resolve(demoWebId("hana"), demo.deliberation);
    expect([...hana.roles].sort()).toEqual(["reviewer", "steward"]);
    // A member with no role credentials: tier 1, nothing more.
    const efe = await resolver.resolve(demoWebId("efe"), demo.deliberation);
    expect(efe).toEqual({ tier: 1, roles: [] });
  });

  it("infrastructure: 'you' are deliberately an UNVOUCHED visitor (T0)", async () => {
    const demo = await getDemoDeliberation("infrastructure");
    const you = await demo.trust.resolver.resolve(demoWebId("you"), demo.deliberation);
    expect(you).toEqual(UNTRUSTED);
    expect(demo.trust.sessionSteward).toBeNull();
    // …while the seeded members verify.
    const hana = await demo.trust.resolver.resolve(demoWebId("hana"), demo.deliberation);
    expect(hana.tier).toBe(1);
    expect(hasRole(hana, "steward")).toBe(true);
  });

  it("society: floor 0 admits 'you' as honestly-labelled pseudonymous voice", async () => {
    const demo = await getDemoDeliberation("society");
    const gate = new TierParticipationGate(demo.trust.resolver, SCOPES.society.minTierToPropose);
    expect(await gate.verify(demoWebId("you"), demo.deliberation)).toEqual({
      ok: true,
      tier: "T0",
    });
    expect(await gate.verify(demoWebId("hana"), demo.deliberation)).toEqual({
      ok: true,
      tier: "T1",
    });
    expect(demo.trust.sessionSteward).toBeNull();
  });

  it("every scope seeds ≥2 stewards and only members hold roles (fixture sanity)", async () => {
    for (const scope of ["apps", "infrastructure", "society"] as const) {
      const spec = DEMO_TRUST[scope];
      const stewards = Object.entries(spec.roles).filter(([, r]) => r.includes("steward"));
      expect(stewards.length).toBeGreaterThanOrEqual(2);
      for (const person of Object.keys(spec.roles)) {
        expect(spec.members).toContain(person);
      }
    }
  });
});

describe("the credential-gated aggregation (the app's real gate)", () => {
  async function aggregateWithTrustGate(scope: "apps" | "infrastructure" | "society") {
    const demo = await getDemoDeliberation(scope);
    const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
    const gate = new TierParticipationGate(demo.trust.resolver, SCOPES[scope].minTierToPropose);
    return {
      demo,
      result: await aggregateDeliberation({ registry, verifier: gate, fetch: demo.fetch }),
    };
  }

  it("apps (floor 1): all nine verify as T1 — the board is unchanged", async () => {
    const { result } = await aggregateWithTrustGate("apps");
    expect(result.verified).toHaveLength(DEMO_PEOPLE.length);
    expect(result.verified.every((v) => v.tier === "T1")).toBe(true);
    expect(result.unverified).toEqual([]);
    expect(result.needs).toHaveLength(DEMO_NEEDS.apps.length);
  });

  it("infrastructure (floor 1): 'you' are excluded, the seeded board is intact", async () => {
    const { result } = await aggregateWithTrustGate("infrastructure");
    expect(result.unverified.map((u) => u.webId)).toEqual([demoWebId("you")]);
    expect(result.unverified[0]?.reason).toMatch(/T1/);
    expect(result.verified).toHaveLength(DEMO_PEOPLE.length - 1);
    expect(result.needs).toHaveLength(DEMO_NEEDS.infrastructure.length);
  });

  it("society (floor 0): everyone participates; 'you' are labelled T0", async () => {
    const { result } = await aggregateWithTrustGate("society");
    expect(result.unverified).toEqual([]);
    const you = result.verified.find((v) => v.webId === demoWebId("you"));
    expect(you?.tier).toBe("T0");
    expect(result.verified.filter((v) => v.tier === "T1")).toHaveLength(DEMO_PEOPLE.length - 1);
  });
});

describe("steward issuance round-trip (the Trust-view path, end-to-end)", () => {
  it("'you' issue efe a reviewer credential; it verifies from efe's pod", async () => {
    const demo = await getDemoDeliberation("apps");
    const steward = demo.trust.sessionSteward;
    if (!steward) throw new Error("apps demo must seed a session steward");
    const efe = demoWebId("efe");
    const before = await demo.trust.resolver.resolve(efe, demo.deliberation);
    expect(hasRole(before, "reviewer")).toBe(false);

    const credential = await issueRoleCredential({
      community: demo.deliberation,
      subject: efe,
      role: "reviewer",
      steward: steward.webId,
      key: steward.key,
    });
    const base = demo.trust.bases.get(efe);
    if (!base) throw new Error("missing efe base");
    const { url } = await writeCredentialDoc(demo.fetch, base, credential);
    expect(url.startsWith(base)).toBe(true); // stored inside the sandbox pod

    demo.trust.resolver.invalidate(efe);
    const after = await demo.trust.resolver.resolve(efe, demo.deliberation);
    expect(hasRole(after, "reviewer")).toBe(true);
    expect(after.tier).toBe(1);
  });

  it("TAMPERING with a stored credential silently loses the standing", async () => {
    const demo = await getDemoDeliberation("apps");
    const amara = demoWebId("amara");
    const before = await demo.trust.resolver.resolve(amara, demo.deliberation);
    expect(hasRole(before, "builder")).toBe(true);

    // Find amara's stored credential docs and re-point the builder credential
    // at a steward role (privilege escalation attempt on the stored bytes).
    const base = demo.trust.bases.get(amara);
    if (!base) throw new Error("missing amara base");
    const container = await demo.fetch(`${base}credentials/`);
    const listing = await container.text();
    const members = [...listing.matchAll(/<([^>]+\.jsonld)>/g)].map((m) => m[1] ?? "");
    expect(members.length).toBeGreaterThan(0);
    let tampered = 0;
    for (const member of members) {
      const body = await (await demo.fetch(member)).text();
      if (!body.includes("roles/builder")) continue;
      await demo.fetch(member, {
        method: "PUT",
        headers: { "content-type": "application/ld+json" },
        body: body.replaceAll("roles/builder", "roles/steward"),
      });
      tampered += 1;
    }
    expect(tampered).toBeGreaterThan(0);

    demo.trust.resolver.invalidate(amara);
    const after = await demo.trust.resolver.resolve(amara, demo.deliberation);
    // The forged steward role does NOT verify, and the builder role is gone
    // with the overwritten original — membership (untouched) still stands.
    expect(after.roles).toEqual([]);
    expect(after.tier).toBe(1);
  });

  it("credentials never leave the sandbox: a foreign-base write is refused", async () => {
    const demo = await getDemoDeliberation("apps");
    const steward = demo.trust.sessionSteward;
    if (!steward) throw new Error("apps demo must seed a session steward");
    const credential = await issueRoleCredential({
      community: demo.deliberation,
      subject: demoWebId("efe"),
      role: "reviewer",
      steward: steward.webId,
      key: steward.key,
    });
    // The write guard scopes the URL to the base; the sandbox fetch refuses
    // the foreign origin anyway — two independent fail-closed layers.
    await expect(
      writeCredentialDoc(demo.fetch, "https://attacker.example/pods/x/", credential),
    ).rejects.toThrow();
  });
});
