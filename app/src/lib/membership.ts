// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Q1 participation-gate seam (decisions/0001). Stage-1 gates deliberation on
// WebID + a community-vouched membership (tier T1). The gate is a swappable
// interface so a ZK-personhood provider (tier T2 — the SPARQ ZK track via the
// @jeswr/solid-vc pluggable proof-suite seam) drops in without touching
// deliberation / aggregation code.
//
// PRODUCTION wiring (follow-up): a MembershipVerifier over
// @jeswr/federation-trust `fedtrust:MembershipCredential` verification — the
// operator/community's signed vouching VC over a `fedreg:` membership.
//
// Fail-closed everywhere: an unknown WebID is REJECTED, never defaulted in.

/**
 * The verification tier that vouched a participant (design/02 §5 stratifies).
 * "T0" is pseudonymous voice — it is only ever ADMITTED by a floor-0
 * participation gate (scope C, design/04 §4.1's participant row); a T1-floor
 * gate rejects it. Outputs stratify by tier, so a T0 admit is honestly
 * labelled, never silently upgraded.
 */
export type MembershipTier = "T0" | "T1" | "T2";

/** The result of a membership check — a discriminated union, fail-closed. */
export type MembershipResult =
  | { readonly ok: true; readonly tier: MembershipTier }
  | { readonly ok: false; readonly reason: string };

/** The swappable participation gate. */
export interface MembershipVerifier {
  /**
   * Decide whether `webId` may participate in `deliberation`. Resolves a
   * fail-closed {@link MembershipResult}: an unverified WebID is `ok:false`.
   */
  verify(webId: string, deliberation: string): Promise<MembershipResult>;
}

/**
 * The dev/test verifier: an explicit allowlist of WebIDs → tier T1. Anything
 * not on the list is fail-closed rejected. DEV-ONLY — production uses the
 * @jeswr/federation-trust credential path.
 */
export class StubMembershipVerifier implements MembershipVerifier {
  readonly #allowed: ReadonlySet<string>;

  /** @param allowed the WebIDs vouched as T1 members. */
  constructor(allowed: Iterable<string>) {
    this.#allowed = new Set(allowed);
  }

  verify(webId: string, _deliberation: string): Promise<MembershipResult> {
    if (this.#allowed.has(webId)) {
      return Promise.resolve({ ok: true, tier: "T1" });
    }
    return Promise.resolve({
      ok: false,
      reason: "not a vouched member of this deliberation (dev stub allowlist)",
    });
  }
}
