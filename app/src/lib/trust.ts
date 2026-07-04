// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Phase-2 governance + trust layer (docs/PLATFORM-PLAN.md §4,
// design/04-governance.md): identity TIERS × community-scoped ROLES, resolved
// from signed W3C Verifiable Credentials via @jeswr/federation-trust — the
// audited fail-closed verifier (signature / expiry / issuer-binding / status /
// trust anchors / self-certifying delegation chains). NO bespoke VC or crypto
// code lives here: a role credential IS a `fedtrust:MembershipCredential`
// whose signed `federation` claim names a ROLE-SCOPED community IRI
// ({@link roleScopeIri}), so the entire verification pipeline is reused
// wholesale (PLATFORM-PLAN §4.1: "Roles are scoped credentials — the same
// federation-trust machinery as memberships").
//
// Fail-closed everywhere: no credential → tier 0 and no roles; a malformed,
// expired, revoked, tampered, wrong-community, wrong-subject or
// untrusted-issuer credential is simply not counted; resolution NEVER throws
// into a grant. A role credential without a verified membership credential
// grants nothing (design/04 §4.1: every role requires ≥ T1).

import {
  issueMembershipCredential,
  type KeyPair,
  type MembershipVerificationResult,
  type TrustAnchor,
  type VerifiableCredential,
  verifyMembershipCredential,
} from "@jeswr/federation-trust";
import type { MembershipResult, MembershipTier, MembershipVerifier } from "./membership.js";
import { isHttpIri } from "./model.js";
import {
  assertWithinBase,
  DEFAULT_MAX_BODY_BYTES,
  isWithinBase,
  listContainer,
  readBodyCapped,
} from "./pod.js";

/**
 * Identity tiers (design/02 §5): 0 = pseudonymous voice (WebID only),
 * 1 = community-vouched member (verified membership credential),
 * 2 = verified unique person (ZK personhood — SEAMED, not yet live: nothing in
 * this module can mint tier 2 today; the solid-vc pluggable proof-suite seam is
 * where a personhood credential plugs in later).
 */
export type IdentityTier = 0 | 1 | 2;

/** The community-scoped roles (design/04 §4.1 — what a participant MAY DO). */
export const ROLES = ["builder", "reviewer", "steward"] as const;
export type Role = (typeof ROLES)[number];

/** Type guard for a role token (UI inputs are untrusted). */
export function isRole(value: unknown): value is Role {
  return value === "builder" || value === "reviewer" || value === "steward";
}

/** A participant's resolved standing within ONE community. Roles are never global. */
export interface TrustProfile {
  readonly tier: IdentityTier;
  readonly roles: readonly Role[];
}

/** The fail-closed zero: pseudonymous, no roles. */
export const UNTRUSTED: TrustProfile = Object.freeze({ tier: 0, roles: Object.freeze([]) });

/** True iff the profile holds `role`. */
export function hasRole(profile: TrustProfile, role: Role): boolean {
  return profile.roles.includes(role);
}

/** True iff the profile meets an identity-tier floor. */
export function meetsTier(profile: TrustProfile, floor: IdentityTier): boolean {
  return profile.tier >= floor;
}

/**
 * The trust seam (extends the Q1 membership-verifier seam to roles): resolve a
 * WebID's tier + roles within a community. FAIL-CLOSED CONTRACT: implementations
 * never throw and never default a grant — any failure resolves {@link UNTRUSTED}.
 */
export interface TrustResolver {
  resolve(webId: string, community: string): Promise<TrustProfile>;
}

/**
 * The IRI a role credential's signed `federation` claim must name: the community
 * IRI with a `/roles/<role>` suffix. Exact-string matched on verify (never a
 * prefix match), so a credential minted for one (community, role) can never be
 * read as another. CONVENTION (issuance-side): a community IRI must not itself
 * be nested under another community's `roles/` path — a steward controls the
 * IRIs they sign for, and the per-community trust-anchor scoping bounds any
 * pathological nesting to that steward's own communities.
 */
export function roleScopeIri(community: string, role: Role): string {
  return `${community}${community.endsWith("/") ? "" : "/"}roles/${role}`;
}

// ── Credential sourcing (where a holder's credentials are read from) ─────────

/** Where the resolver finds a holder's CANDIDATE credentials (all untrusted). */
export interface CredentialSource {
  /**
   * The candidate credential documents presented for `webId`. Documents are
   * UNTRUSTED input — the verifier is the only gate. A source failure should
   * throw (the resolver maps it to a fail-closed, uncached {@link UNTRUSTED}).
   */
  credentialsFor(webId: string): Promise<readonly unknown[]>;
}

/** The pod subdirectory credentials are written to / read from. */
export const CREDENTIALS_DIR = "credentials";

/** Cap on credential documents read per holder (a hostile pod can't fan out). */
export const MAX_CREDENTIAL_DOCS = 50;

/**
 * Reads a holder's credentials from `<base>credentials/` in their OWN pod —
 * the same own-pod, fail-closed discipline as statements: only container
 * members within the holder's base are fetched (a hostile listing cannot SSRF
 * elsewhere), bodies are byte-capped, malformed JSON is skipped (verification
 * would reject it anyway — this just avoids the parse throw), and a missing
 * container (404) is simply "no credentials".
 */
export class PodCredentialSource implements CredentialSource {
  readonly #fetch: typeof fetch;
  readonly #bases: ReadonlyMap<string, string>;
  readonly #maxDocs: number;
  readonly #maxBytes: number;

  /** @param bases WebID → the holder's unite container base (ends "/"). */
  constructor(
    fetchFn: typeof fetch,
    bases: ReadonlyMap<string, string>,
    maxDocs = MAX_CREDENTIAL_DOCS,
    maxBytes = DEFAULT_MAX_BODY_BYTES,
  ) {
    this.#fetch = fetchFn;
    this.#bases = bases;
    this.#maxDocs = maxDocs;
    this.#maxBytes = maxBytes;
  }

  async credentialsFor(webId: string): Promise<readonly unknown[]> {
    const base = this.#bases.get(webId);
    if (base === undefined) return [];
    const container = new URL(`${CREDENTIALS_DIR}/`, base).toString();
    const members = (await listContainer(this.#fetch, container, this.#maxBytes)).slice(
      0,
      this.#maxDocs,
    );
    const docs: unknown[] = [];
    for (const member of members) {
      // The listing is untrusted: only fetch members inside the holder's base.
      if (!isWithinBase(base, member)) continue;
      try {
        const res = await this.#fetch(member, {
          headers: { accept: "application/ld+json, application/json;q=0.9" },
        });
        if (!res.ok) continue;
        docs.push(JSON.parse(await readBodyCapped(res, this.#maxBytes)));
      } catch {
        // One unreadable/malformed document never sinks the holder's others.
      }
    }
    return docs;
  }
}

// ── The credential-backed resolver (the production path) ─────────────────────

/** Options for {@link CredentialTrustResolver}. */
export interface CredentialTrustResolverOptions {
  /**
   * The community's published trust anchors — its stewards' public keys. A
   * credential from anyone else fails closed inside federation-trust
   * (`UNTRUSTED_AUTHORITY`); an empty anchor set trusts NOBODY.
   */
  readonly trustAnchors: readonly TrustAnchor[];
  readonly source: CredentialSource;
  /** Injectable clock (expiry evaluation) — tests pin it. */
  readonly now?: () => Date;
}

/**
 * Resolves tier + roles from federation-trust credentials, fail-closed:
 *
 * - each candidate document is verified by `verifyMembershipCredential` with
 *   the subject bound (`expectedApp` = the WebID) — signature, expiry,
 *   `status ∈ {Active}`, issuer-binding and anchor trust all enforced there;
 * - the verified credential's SIGNED `federation` claim is then exact-matched
 *   (Map lookup, never a prefix) against this community's IRI (→ membership)
 *   or its {@link roleScopeIri}s (→ a role); any other value is ignored;
 * - roles count ONLY when a membership credential also verified (design/04
 *   §4.1 — every role presumes ≥ T1); tier 2 is seamed, never minted here.
 *
 * Successful resolutions are memoised per (community, webId), but the cache is
 * VALIDITY-BOUNDED: an entry expires at the earliest validity boundary among
 * the credentials that shaped it (the soonest `validUntil` of an accepted
 * credential, and the soonest future `validFrom` of a not-yet-valid one), so a
 * grant can never outlive its credential and a pending credential activates on
 * time — expiry IS the design's routine revocation path (design/04 §4.2). Call
 * {@link invalidate} after issuing/revoking a credential. A SOURCE failure
 * resolves {@link UNTRUSTED} WITHOUT caching, so a transient outage is never a
 * sticky denial. Also implements the Q1 {@link MembershipVerifier} seam so the
 * same resolver backs the aggregation gate.
 */
export class CredentialTrustResolver implements TrustResolver, MembershipVerifier {
  readonly #anchors: readonly TrustAnchor[];
  readonly #source: CredentialSource;
  readonly #now: (() => Date) | undefined;
  readonly #cache = new Map<string, { profile: TrustProfile; staleAtMs: number }>();

  constructor(options: CredentialTrustResolverOptions) {
    this.#anchors = options.trustAnchors;
    this.#source = options.source;
    this.#now = options.now;
  }

  /** Drop memoised profiles (all, or one WebID's) after issuance/revocation. */
  invalidate(webId?: string): void {
    if (webId === undefined) {
      this.#cache.clear();
      return;
    }
    for (const key of this.#cache.keys()) {
      if ((JSON.parse(key) as string[])[1] === webId) this.#cache.delete(key);
    }
  }

  async resolve(webId: string, community: string): Promise<TrustProfile> {
    const now = this.#now ? this.#now() : new Date();
    const key = JSON.stringify([community, webId]);
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      // A cached profile is honoured only while no credential validity
      // boundary has passed — past it, re-verify (fail-closed refresh).
      if (now.getTime() < cached.staleAtMs) return cached.profile;
      this.#cache.delete(key);
    }

    let docs: readonly unknown[];
    try {
      docs = await this.#source.credentialsFor(webId);
    } catch {
      // Fail-closed but UNCACHED: a transient source failure must not stick.
      return UNTRUSTED;
    }

    // The closed set of signed `federation` values this community accepts.
    const scopes = new Map<string, "member" | Role>([[community, "member"]]);
    for (const role of ROLES) scopes.set(roleScopeIri(community, role), role);

    let member = false;
    const roles = new Set<Role>();
    // The instant this resolution's outcome could change on its own: the
    // soonest accepted-credential expiry, or the soonest future validFrom of
    // a not-yet-valid credential. The cache must not outlive it.
    let staleAtMs = Number.POSITIVE_INFINITY;
    const boundary = (iso: string | undefined, mustBeFuture: boolean): void => {
      if (typeof iso !== "string") return;
      const ms = Date.parse(iso);
      if (Number.isNaN(ms)) return;
      if (mustBeFuture && ms <= now.getTime()) return;
      if (ms < staleAtMs) staleAtMs = ms;
    };
    for (const doc of docs) {
      let result: MembershipVerificationResult;
      try {
        result = await verifyMembershipCredential(doc as VerifiableCredential, {
          trustAnchors: this.#anchors,
          expectedApp: webId,
          now,
        });
      } catch {
        continue; // defence in depth — a throwing document is just not counted
      }
      if (result.claim !== undefined && scopes.has(result.claim.federation)) {
        if (result.verified) {
          // An accepted grant lapses at its expiry.
          boundary(result.claim.validUntil, false);
        } else if (result.errors.some((e) => e.code === "NOT_YET_VALID")) {
          // A pending credential activates at its validFrom.
          boundary(result.claim.validFrom, true);
        }
      }
      if (!result.verified || result.claim === undefined) continue;
      const purpose = scopes.get(result.claim.federation);
      if (purpose === undefined) continue; // wrong community / unknown scope
      if (purpose === "member") member = true;
      else roles.add(purpose);
    }

    // Roles presume membership (design/04 §4.1) — without a verified
    // membership credential, a role credential grants NOTHING.
    const profile: TrustProfile = member
      ? { tier: 1, roles: ROLES.filter((r) => roles.has(r)) }
      : UNTRUSTED;
    this.#cache.set(key, { profile, staleAtMs });
    return profile;
  }

  /** The Q1 seam bridge: ok IFF the profile reaches T1 (vouched member). */
  async verify(webId: string, deliberation: string): Promise<MembershipResult> {
    const profile = await this.resolve(webId, deliberation);
    if (profile.tier >= 1) {
      return { ok: true, tier: profile.tier >= 2 ? "T2" : "T1" };
    }
    return {
      ok: false,
      reason: "no verifiable membership credential for this deliberation",
    };
  }
}

/**
 * The config-derived resolver for hand-configured (pod-mode) deliberations
 * until the community-registry wiring lands: the user-typed participant list IS
 * the trust decision, so listed WebIDs are vouched members (tier 1). ROLES ARE
 * NEVER GRANTED here — roles require signed credentials, always (fail-closed).
 */
export class AllowlistTrustResolver implements TrustResolver {
  readonly #allowed: ReadonlySet<string>;

  constructor(allowed: Iterable<string>) {
    this.#allowed = new Set(allowed);
  }

  resolve(webId: string, _community: string): Promise<TrustProfile> {
    return Promise.resolve(this.#allowed.has(webId) ? { tier: 1, roles: [] } : UNTRUSTED);
  }
}

/**
 * The scope-aware participation gate over a {@link TrustResolver} — the
 * aggregation-side enforcement of design/04 §4.1's participant row: scopes A/B
 * demand a vouched member (floor 1); scope C admits pseudonymous voice
 * (floor 0), HONESTLY LABELLED with its tier ("T0") so outputs can stratify.
 * A tier-2 floor is expressible for future T2-only cohorts.
 */
export class TierParticipationGate implements MembershipVerifier {
  readonly #resolver: TrustResolver;
  readonly #floor: IdentityTier;

  constructor(resolver: TrustResolver, floor: IdentityTier) {
    this.#resolver = resolver;
    this.#floor = floor;
  }

  async verify(webId: string, deliberation: string): Promise<MembershipResult> {
    const profile = await this.#resolver.resolve(webId, deliberation);
    if (profile.tier >= this.#floor) {
      return { ok: true, tier: `T${profile.tier}` as MembershipTier };
    }
    return {
      ok: false,
      reason: `participation here requires identity tier T${this.#floor} (you hold T${profile.tier}) — a community-vouched membership credential`,
    };
  }
}

// ── Issuance (the steward's path) ─────────────────────────────────────────────

/** Default role-credential validity (design/04 §4.2: short-lived, renewable). */
export const ROLE_VALIDITY_DAYS = 90;

/** Inputs to {@link issueRoleCredential} / {@link issueCommunityMembership}. */
export interface IssueTrustCredentialInput {
  /** The community the credential is scoped to (an http(s) IRI). */
  readonly community: string;
  /** The holder's WebID (an http(s) IRI). */
  readonly subject: string;
  /** The issuing steward's WebID (the credential issuer / assertedBy). */
  readonly steward: string;
  /** The steward's signing key (`verificationMethod` controlled by `steward`). */
  readonly key: KeyPair;
  /** Validity start (default: now). */
  readonly validFrom?: Date;
  /** Validity length (default {@link ROLE_VALIDITY_DAYS}). */
  readonly validityDays?: number;
}

function validateIssueInput(input: IssueTrustCredentialInput): { from: Date; until: Date } {
  if (!isHttpIri(input.community)) {
    throw new Error(`trust issuance: community must be an http(s) IRI: ${input.community}`);
  }
  if (!isHttpIri(input.subject)) {
    throw new Error(`trust issuance: subject must be an http(s) WebID: ${input.subject}`);
  }
  const from = input.validFrom ?? new Date();
  const days = input.validityDays ?? ROLE_VALIDITY_DAYS;
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`trust issuance: validityDays must be a positive number: ${days}`);
  }
  return { from, until: new Date(from.getTime() + days * 86_400_000) };
}

/**
 * A steward signs "subject holds `role` in `community`" — a federation-trust
 * membership credential whose signed federation claim is the role-scope IRI.
 * Short-lived by default (90 days): expiry IS the routine revocation path;
 * immediate revocation is a status update (the fedreg lifecycle) — Phase 5.
 */
export async function issueRoleCredential(
  input: IssueTrustCredentialInput & { readonly role: Role },
): Promise<VerifiableCredential> {
  if (!isRole(input.role)) {
    throw new Error(`trust issuance: unknown role: ${String(input.role)}`);
  }
  const { from, until } = validateIssueInput(input);
  return issueMembershipCredential({
    claim: {
      federation: roleScopeIri(input.community, input.role),
      app: input.subject,
      status: "Active",
      assertedBy: input.steward,
      validFrom: from.toISOString(),
      validUntil: until.toISOString(),
    },
    key: input.key,
    created: from,
  });
}

/** A steward signs "subject is a vouched member (T1) of `community`". */
export async function issueCommunityMembership(
  input: IssueTrustCredentialInput,
): Promise<VerifiableCredential> {
  const { from, until } = validateIssueInput(input);
  return issueMembershipCredential({
    claim: {
      federation: input.community,
      app: input.subject,
      status: "Active",
      assertedBy: input.steward,
      validFrom: from.toISOString(),
      validUntil: until.toISOString(),
    },
    key: input.key,
    created: from,
  });
}

/**
 * Write a credential document into a holder's pod at
 * `<base>credentials/<slug>.jsonld` (create-only, scope-guarded — the same
 * fail-closed write discipline as statements). In the live-pod world the
 * holder saves a credential delivered to their inbox; the demo sandbox (and a
 * future steward console with append access) writes it directly.
 */
export async function writeCredentialDoc(
  fetchFn: typeof fetch,
  base: string,
  credential: VerifiableCredential,
): Promise<{ url: string; response: Response }> {
  const url = assertWithinBase(
    base,
    new URL(`${CREDENTIALS_DIR}/${crypto.randomUUID()}.jsonld`, base).toString(),
  );
  const response = await fetchFn(url, {
    method: "PUT",
    headers: { "content-type": "application/ld+json", "if-none-match": "*" },
    body: JSON.stringify(credential),
  });
  if (!response.ok) {
    throw new Error(`credential write failed: ${response.status} ${response.statusText} (${url})`);
  }
  return { url, response };
}
