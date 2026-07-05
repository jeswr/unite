// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.1 — declared → VERIFIED stakeholder role (docs/design/next-phases.md §1.3(a);
// SCOPE-DIFFERENTIATION §3.2). A scope-B participant may DECLARE implementer /
// operator standing; this module VERIFIES the claim against the PUBLIC federation
// web and degrades FAIL-CLOSED to the base fut:ParticipantRole on anything it
// cannot verify. Nothing here is persisted as an authority claim: a verified role
// is a COMPUTED fact (INV-3 posture — computed, never asserted), recomputed live
// from the wire, exactly like adoption.ts's observed adoption.
//
// The two verifiable standings (the vocab gives no "verified role" class — mint
// nothing; a role is a computed fact over existing fedreg documents):
//   • IMPLEMENTER — runs an implementation that advertises the governed system via
//     `fedreg:acceptsSpec` (or `fedreg:supportsSector`) on a live
//     `fedreg:StorageDescription`. Bound to the declarer FAIL-CLOSED by requiring
//     the advertising storage to be SAME-ORIGIN as the declarer's WebID — you may
//     only claim implementer standing for a storage you demonstrably control, so a
//     forged claim pointing at SOMEONE ELSE's storage description never verifies.
//   • OPERATOR — the declarer's WebID is an `assertedBy` party of a VALID
//     membership on a live `fedreg:Registry` (the reviewed, signature-free
//     well-formedness + assertedBy check).
//   • PARTICIPANT — the base standing; always granted, needs no evidence.
//
// Composes @jeswr/federation-registry (`parseStorage` / `parseRegistry` — the
// suite's ONE reviewed fedreg reader, never a bespoke parser). Mirrors adoption.ts
// EXACTLY for the untrusted-web discipline (INV-4): https-only (a non-https
// evidence IRI is refused before any request), per-source byte cap, fail-isolated
// per source (one hostile/broken document degrades one claim, never throws), a
// credential-free fetch, and every foreign IRI http(s)-validated before use.

import { parseRegistry, parseStorage, TRUSTED_STATUS } from "@jeswr/federation-registry";
import {
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
  ROLE_PARTICIPANT,
  type StakeholderRole,
} from "./fut-draft.js";
import { isHttpIri, MAX_LINKS } from "./model.js";
import { DEFAULT_MAX_BODY_BYTES, readBodyCapped } from "./pod.js";

/**
 * A participant's DECLARED stakeholder standing (untrusted self-assertion). The
 * client verifies it against the federation web before it counts for anything.
 */
export interface RoleDeclaration {
  /** The declarer's WebID (the identity the claim is bound to; https only). */
  readonly webId: string;
  /** The role the participant DECLARES (fut:ImplementerRole / OperatorRole /
   *  ParticipantRole). A participant declaration needs no evidence. */
  readonly declaredRole: StakeholderRole;
  /**
   * The re-checkable evidence IRIs the verification reads:
   *  • implementer → `fedreg:StorageDescription` IRI(s) (their live storage);
   *  • operator    → `fedreg:Registry` IRI(s) (the registry that asserts them).
   * https only; a non-https / non-http(s) entry is skipped fail-closed.
   */
  readonly evidence?: readonly string[];
}

/** A resolved (verified) stakeholder standing — fail-closed to ParticipantRole. */
export interface VerifiedStakeholderRole {
  readonly webId: string;
  /** What was declared. */
  readonly declaredRole: StakeholderRole;
  /** What VERIFIED — the declared role IFF the web confirmed it, else the base
   *  fut:ParticipantRole (never a stored authority claim; recomputed live). */
  readonly verifiedRole: StakeholderRole;
  /** `true` iff `verifiedRole === declaredRole` (a participant declaration is
   *  trivially verified; an unverifiable implementer/operator claim is `false`). */
  readonly verified: boolean;
  /** The evidence IRI that confirmed the standing (for re-check / display). */
  readonly evidenceSource?: string;
  /** Why an implementer/operator claim failed to verify (honest surfaces). */
  readonly reason?: string;
}

/** Options for {@link verifyStakeholderRole}. */
export interface VerifyRoleOptions {
  /** The credential-free read fetch (publicFetch / the demo sandbox fetch). */
  readonly fetch: typeof fetch;
  /**
   * The governed system's immutable version IRIs an IMPLEMENTER's storage must
   * advertise via `fedreg:acceptsSpec` (the adoption.ts GOVERNED_SYSTEMS versions).
   */
  readonly acceptedVersions: readonly string[];
  /**
   * Sector IRIs an implementer's storage may advertise via `fedreg:supportsSector`
   * as an ALTERNATIVE proof (advertising the governed sector counts too). Optional.
   */
  readonly acceptedSectors?: readonly string[];
  /** Cap on a single fedreg document body (default {@link DEFAULT_MAX_BODY_BYTES}). */
  readonly maxBodyBytes?: number;
}

/**
 * Path-containment binding (fail-closed): `target` must live WITHIN the advertised
 * `storage` — same origin AND the storage's path is a prefix of the target's. Used
 * for BOTH bindings the implementer check requires:
 *   • the declarer's WebID must be within the storage (a self-hosted pod's WebID
 *     document is inside its own pod) — STRICTER than same-origin, which a
 *     MULTI-TENANT host defeats (a co-tenant's WebID is not under your pod's path);
 *   • the EVIDENCE DOCUMENT must be within the storage it describes (self-describing
 *     / authoritative) — `parseStorage` does NOT bind the document URL to the
 *     `fedreg:storage` value, so without this an ATTACKER-hosted document could name
 *     a victim's storage IRI + accepted spec and forge standing. Requiring the doc to
 *     be served from within the storage it claims closes that.
 * A different topology (WebID/doc + storage on disjoint paths) degrades to
 * ParticipantRole — use the registry/operator path instead.
 */
function withinStorageBase(storage: string, target: string): boolean {
  let s: URL;
  let t: URL;
  try {
    s = new URL(storage);
    t = new URL(target);
  } catch {
    return false;
  }
  if (s.protocol !== "https:" || t.protocol !== "https:") return false;
  if (s.origin !== t.origin) return false;
  const base = s.pathname.endsWith("/") ? s.pathname : `${s.pathname}/`;
  return t.pathname.startsWith(base);
}

/**
 * Wrap a fetch so every response body is read through the incremental byte cap
 * BEFORE the fedreg reader parses it (which has no cap seam of its own) — the
 * same guard adoption.ts uses. A hostile document cannot force unbounded memory.
 */
function cappedFetch(fetchFn: typeof fetch, maxBytes: number): typeof fetch {
  return async (input, init) => {
    const res = await fetchFn(input, init);
    if (!res.ok || res.body === null) return res;
    const text = await readBodyCapped(res, maxBytes);
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

/** A fail-closed base result: the declared role degraded to ParticipantRole. */
function participantFallback(decl: RoleDeclaration, reason: string): VerifiedStakeholderRole {
  return {
    webId: decl.webId,
    declaredRole: decl.declaredRole,
    verifiedRole: ROLE_PARTICIPANT,
    verified: false,
    reason,
  };
}

/**
 * Verify ONE role declaration against the federation web, FAIL-CLOSED to
 * fut:ParticipantRole:
 *  • a participant declaration is trivially verified (base standing, no evidence);
 *  • an IMPLEMENTER declaration verifies iff SOME evidence IRI is a valid
 *    `fedreg:StorageDescription` that (a) is SAME-ORIGIN as the declarer's WebID
 *    (ownership binding — a forged claim over another party's storage fails here)
 *    and (b) advertises an accepted version (`acceptsSpec`) or sector
 *    (`supportsSector`);
 *  • an OPERATOR declaration verifies iff SOME evidence IRI is a `fedreg:Registry`
 *    with a VALID membership whose `assertedBy` includes the declarer's WebID.
 * Any unverifiable / hostile / non-https evidence degrades to ParticipantRole with
 * a recorded reason. NEVER throws (fail-isolated per evidence source).
 */
export async function verifyStakeholderRole(
  declaration: RoleDeclaration,
  options: VerifyRoleOptions,
): Promise<VerifiedStakeholderRole> {
  const { webId, declaredRole } = declaration;

  // The WebID must be a real https identity — a credential identity, no downgrade.
  // An invalid/non-https WebID is NEVER "verified" (even for the base participant
  // role): it falls back to ParticipantRole standing, but `verified` is false because
  // the identity itself did not check out.
  if (!isHttpIri(webId) || !webId.startsWith("https:")) {
    return {
      webId,
      declaredRole,
      verifiedRole: ROLE_PARTICIPANT,
      verified: false,
      reason: "declarer WebID is not a valid https IRI",
    };
  }

  // The base standing: everyone in the deliberation is at least a participant.
  if (declaredRole === ROLE_PARTICIPANT) {
    return { webId, declaredRole, verifiedRole: ROLE_PARTICIPANT, verified: true };
  }

  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const fetchFn = cappedFetch(options.fetch, maxBytes);
  const evidence = (declaration.evidence ?? []).filter((e): e is string => typeof e === "string");
  if (evidence.length === 0) {
    return participantFallback(declaration, "no evidence supplied for the declared role");
  }
  // Cap the (self-asserted, untrusted) evidence list FAIL-CLOSED — a hostile
  // declaration must not force arbitrary network fan-out. A legitimate claim names
  // one or two evidence IRIs; a list beyond MAX_LINKS is refused outright.
  if (evidence.length > MAX_LINKS) {
    return participantFallback(declaration, `too many evidence entries (> ${MAX_LINKS})`);
  }

  const acceptedVersions = new Set(options.acceptedVersions.filter(isHttpIri));
  const acceptedSectors = new Set((options.acceptedSectors ?? []).filter(isHttpIri));
  let lastReason = "no evidence confirmed the declared role";

  for (const source of evidence) {
    // https-only; a non-https / malformed evidence IRI is refused before any request.
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(source);
    } catch {
      lastReason = "evidence is not a valid URL";
      continue;
    }
    if (sourceUrl.protocol !== "https:") {
      lastReason = "role evidence must be https";
      continue;
    }
    const src = sourceUrl.toString();

    try {
      if (declaredRole === ROLE_IMPLEMENTER) {
        const verification = await parseStorage(src, { fetch: fetchFn });
        if (!verification.valid || !verification.storage) {
          lastReason = "evidence is not a valid fedreg:StorageDescription";
          continue;
        }
        const storage = verification.storage;
        const party = isHttpIri(storage.storage) ? storage.storage : undefined;
        if (party === undefined) {
          lastReason = "storage description names a non-http(s) storage";
          continue;
        }
        // Authoritativeness binding (fail-closed): the evidence DOCUMENT must be
        // served from WITHIN the storage it describes — otherwise an attacker-hosted
        // document could name a victim's storage IRI + accepted spec (parseStorage
        // does not bind the doc URL to fedreg:storage).
        if (!withinStorageBase(party, src)) {
          lastReason = "storage description is not served from within the storage it describes";
          continue;
        }
        // Ownership binding (fail-closed): the declarer's WebID must live WITHIN the
        // advertised storage — you cannot claim implementer standing for a storage you
        // do not demonstrably control (stricter than same-origin, so a co-tenant on a
        // MULTI-TENANT host cannot claim another tenant's pod).
        if (!withinStorageBase(party, webId)) {
          lastReason = "the declarer's WebID is not within the advertised storage";
          continue;
        }
        const advertisesVersion = storage.acceptsSpec.some(
          (v) => isHttpIri(v) && acceptedVersions.has(v),
        );
        const advertisesSector = storage.supportsSector.some(
          (s) => isHttpIri(s) && acceptedSectors.has(s),
        );
        if (advertisesVersion || advertisesSector) {
          return {
            webId,
            declaredRole,
            verifiedRole: ROLE_IMPLEMENTER,
            verified: true,
            evidenceSource: src,
          };
        }
        lastReason = "storage advertises no accepted spec version or sector";
        continue;
      }

      if (declaredRole === ROLE_OPERATOR) {
        const parsed = await parseRegistry(src, { fetch: fetchFn });
        // A VALID, ACTIVE (TRUSTED_STATUS) membership whose assertedBy names this
        // WebID = operator standing. A Revoked/Suspended/Proposed membership does
        // NOT grant standing (fail-closed — same status filter as the steward
        // allowlist), so a withdrawn registration cannot confer a live role.
        const asserted = parsed.members.some(
          (m) =>
            m.valid &&
            m.membership !== undefined &&
            m.membership.status !== undefined &&
            TRUSTED_STATUS.has(m.membership.status) &&
            (m.membership.assertedBy ?? []).some((a) => isHttpIri(a) && a === webId),
        );
        if (asserted) {
          return {
            webId,
            declaredRole,
            verifiedRole: ROLE_OPERATOR,
            verified: true,
            evidenceSource: src,
          };
        }
        lastReason = "registry asserts no membership by the declarer's WebID";
      }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : String(e);
    }
  }

  return participantFallback(declaration, lastReason);
}

/**
 * Verify a batch of declarations, fail-isolated (one hostile document never sinks
 * the others). Returns one {@link VerifiedStakeholderRole} per declaration, in the
 * SAME order — deterministic.
 */
export async function verifyStakeholderRoles(
  declarations: readonly RoleDeclaration[],
  options: VerifyRoleOptions,
): Promise<VerifiedStakeholderRole[]> {
  const out: VerifiedStakeholderRole[] = [];
  for (const decl of declarations) {
    out.push(await verifyStakeholderRole(decl, options));
  }
  return out;
}

/**
 * The verified-role MAP the role-cohort lens (convergence.ts) partitions on: WebID
 * → its verified `StakeholderRole`. A WebID absent from the map is treated as the
 * base ParticipantRole by the partition builder (fail-closed by default).
 *
 * DETERMINISTIC + ORDER-INDEPENDENT merge for a repeated WebID (a naive last-write
 * could let a later ParticipantRole fallback erase an earlier verified implementer/
 * operator, making the cohort gate order-dependent): a stronger (non-participant)
 * verified role is kept over a ParticipantRole regardless of order; two DIFFERENT
 * stronger roles for one WebID are AMBIGUOUS → fail-closed to ParticipantRole.
 */
export function verifiedRoleMap(
  roles: readonly VerifiedStakeholderRole[],
): Map<string, StakeholderRole> {
  const map = new Map<string, StakeholderRole>();
  const conflicted = new Set<string>();
  for (const r of roles) {
    const existing = map.get(r.webId);
    if (existing === undefined || existing === r.verifiedRole) {
      map.set(r.webId, r.verifiedRole);
      continue;
    }
    if (existing === ROLE_PARTICIPANT) {
      map.set(r.webId, r.verifiedRole); // upgrade participant → stronger role
    } else if (r.verifiedRole !== ROLE_PARTICIPANT) {
      conflicted.add(r.webId); // two DIFFERENT stronger roles → ambiguous
    }
    // else: keep the existing stronger role (a participant never downgrades it)
  }
  for (const w of conflicted) map.set(w, ROLE_PARTICIPANT); // fail-closed on conflict
  return map;
}
