// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Seeds the demo community's TRUST layer with REAL cryptography: fresh
// in-memory Ed25519 steward keypairs become the community's trust anchors, and
// genuine federation-trust Verifiable Credentials (Data Integrity over
// RDFC-1.0) are issued and WRITTEN THROUGH THE SANDBOX FETCH into each
// holder's demo pod — so resolution reads them back through the production
// PodCredentialSource → verifyMembershipCredential pipeline, unshort-circuited.
// Nothing here is a mock verdict: tamper with a stored credential and the
// resolver rejects it.
//
// Sandbox guarantee unchanged: keys are generated per (in-memory) demo
// instance and never persisted; writes go through the demo fetch, which
// refuses any origin but demo.unite.example.

import { generateKeyPairForSuite, type KeyPair, type TrustAnchor } from "@jeswr/federation-trust";
import {
  CredentialTrustResolver,
  issueCommunityMembership,
  issueRoleCredential,
  PodCredentialSource,
  writeCredentialDoc,
} from "../lib/trust.js";
import type { ScopeId } from "../scope/scopes.js";
import { DEMO_PEOPLE, DEMO_TRUST, DEMO_YOU_KEY, demoBase, demoWebId } from "./fixtures.js";

/** The seeded trust layer for one scope's demo community. */
export interface DemoTrust {
  /** The community (deliberation) IRI the credentials are scoped to. */
  readonly community: string;
  /** The community's published trust anchors — the seeded stewards' keys. */
  readonly anchors: readonly TrustAnchor[];
  /** The production resolver, reading credentials back from the demo pods. */
  readonly resolver: CredentialTrustResolver;
  /** WebID → pod base for every demo participant (credential locations). */
  readonly bases: ReadonlyMap<string, string>;
  /**
   * The demo session's steward signing key, when "you" hold the steward role
   * in this scope — powers the live issuance UI. Null otherwise (the UI then
   * shows its fail-closed not-a-steward state).
   */
  readonly sessionSteward: { readonly webId: string; readonly key: KeyPair } | null;
}

/**
 * Generate steward keys, issue membership + role credentials per the
 * {@link DEMO_TRUST} spec, and write them into the holders' demo pods.
 * Fail-loud on fixture bugs (a role for a non-member, a scope with <2
 * stewards) — a silently mis-seeded trust demo would be worse than a crash.
 */
export async function seedDemoTrust(
  fetchFn: typeof fetch,
  scope: ScopeId,
  community: string,
): Promise<DemoTrust> {
  const spec = DEMO_TRUST[scope];

  const stewards = Object.entries(spec.roles)
    .filter(([, roles]) => roles.includes("steward"))
    .map(([person]) => person);
  if (stewards.length < 2) {
    throw new Error(`demo trust fixture ${scope}: needs ≥2 stewards (design/04 §4.4)`);
  }
  for (const person of Object.keys(spec.roles)) {
    if (!spec.members.includes(person)) {
      throw new Error(
        `demo trust fixture ${scope}: ${person} holds a role but no membership (roles presume T1)`,
      );
    }
  }

  // Steward keypairs → the community's trust anchors.
  const stewardKeys = new Map<string, KeyPair>();
  for (const person of stewards) {
    stewardKeys.set(person, await generateKeyPairForSuite(demoWebId(person), "Ed25519"));
  }
  const anchors: TrustAnchor[] = stewards.map((person) => {
    const key = stewardKeys.get(person);
    if (!key) throw new Error(`demo trust fixture ${scope}: missing steward key for ${person}`);
    return {
      authority: demoWebId(person),
      verificationMethod: demoWebId(person),
      publicKey: key.publicKey,
    };
  });

  // The first steward signs the seeded credentials (any anchor verifies).
  const issuerPerson = stewards[0];
  const issuerKey = issuerPerson === undefined ? undefined : stewardKeys.get(issuerPerson);
  if (issuerPerson === undefined || issuerKey === undefined) {
    throw new Error(`demo trust fixture ${scope}: no issuing steward`);
  }
  const issuer = demoWebId(issuerPerson);

  for (const person of spec.members) {
    const credential = await issueCommunityMembership({
      community,
      subject: demoWebId(person),
      steward: issuer,
      key: issuerKey,
    });
    await writeCredentialDoc(fetchFn, demoBase(person, scope), credential);
  }
  for (const [person, roles] of Object.entries(spec.roles)) {
    for (const role of roles) {
      const credential = await issueRoleCredential({
        community,
        subject: demoWebId(person),
        role,
        steward: issuer,
        key: issuerKey,
      });
      await writeCredentialDoc(fetchFn, demoBase(person, scope), credential);
    }
  }

  const bases = new Map(DEMO_PEOPLE.map((p) => [demoWebId(p.key), demoBase(p.key, scope)]));
  const resolver = new CredentialTrustResolver({
    trustAnchors: anchors,
    source: new PodCredentialSource(fetchFn, bases),
  });

  const youKey = stewardKeys.get(DEMO_YOU_KEY);
  return {
    community,
    anchors,
    resolver,
    bases,
    sessionSteward: youKey ? { webId: demoWebId(DEMO_YOU_KEY), key: youKey } : null,
  };
}
