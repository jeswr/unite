// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Trust: the governance layer made visible (docs/PLATFORM-PLAN.md §4,
// design/04 §4.1–4.2). Your own standing (tier × roles) against this scope's
// participation floor, the community roll with each participant's VERIFIED
// standing, and the steward issuance surface — which, in the demo sandbox,
// round-trips a real signed credential into the holder's pod and re-resolves.
// Thin over src/lib (trust.ts) + the state seam (deliberationTrust).

import { useCallback, useEffect, useRef, useState } from "react";
import type { IdentityTier, Role, TrustProfile } from "../../lib/trust.js";
import {
  hasRole,
  isRole,
  issueRoleCredential,
  meetsTier,
  writeCredentialDoc,
} from "../../lib/trust.js";
import { scopeHref } from "../../scope/scopes.js";
import { avatarColor, initials } from "../format.js";
import type { SessionTrust } from "../hooks.js";
import { displayName } from "../hooks.js";
import {
  type DeliberationConfig,
  type DeliberationTrust,
  deliberationKey,
  deliberationTrust,
  sessionIdentity,
} from "../state.js";

/** Plain-language tier meanings (design/02 §5). */
export const TIER_MEANING: Readonly<Record<IdentityTier, string>> = {
  0: "pseudonymous voice — a WebID only",
  1: "a community-vouched member",
  2: "a verified unique person",
};

/** What each role may do (design/04 §4.1). */
const ROLE_MEANING: Readonly<Record<Role, string>> = {
  builder: "be commissioned to implement an endorsed synthesis",
  reviewer: "approve implementation work against the endorsed spec",
  steward: "operate the community: issue role credentials, sign outputs (never alone)",
};

/** The roles a steward issues from this surface (steward seats are a community-formation act). */
const ISSUABLE_ROLES: readonly Role[] = ["builder", "reviewer"];

function TierBadge({ tier }: { tier: IdentityTier }): React.JSX.Element {
  return <span className={tier > 0 ? "badge res" : "badge"}>T{tier}</span>;
}

function RoleBadges({ profile }: { profile: TrustProfile }): React.JSX.Element | null {
  if (profile.roles.length === 0) return null;
  return (
    <>
      {profile.roles.map((role) => (
        <span key={role} className={role === "steward" ? "badge gold" : "badge concept"}>
          {role}
        </span>
      ))}
    </>
  );
}

export function Trust({
  config,
  webId,
  trust,
}: {
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
}): React.JSX.Element {
  // Machinery + roll are stored KEYED to the config VALUE they were resolved
  // for and derived at render time — a config change must never expose (or let
  // the issue action use) the previous community's resolver/steward key, not
  // even for one render (the same stale-state discipline as useTrustProfile).
  const [resolved, setResolved] = useState<{
    readonly key: string;
    readonly machinery: DeliberationTrust;
    readonly roll: ReadonlyMap<string, TrustProfile>;
  } | null>(null);
  // The load error is keyed too — a previous config's failure must not show
  // under the new config, even for one render.
  const [loadError, setLoadError] = useState<{
    readonly key: string;
    readonly message: string;
  } | null>(null);

  const [subject, setSubject] = useState("");
  const [role, setRole] = useState<Role>("builder");
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Monotonic id: a superseded (config changed) resolution never applies.
  const reqId = useRef(0);
  // Render-synced ref + value key (the useTrustProfile pattern): loadRoll's
  // identity follows the config VALUE, so an equal-but-new config object can
  // neither loop the effect nor wedge the derived state.
  const configRef = useRef(config);
  configRef.current = config;
  const key = deliberationKey(config);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by VALUE — loadRoll re-creates when the config VALUE changes; the render-synced ref carries the object.
  const loadRoll = useCallback(async () => {
    const cfg = configRef.current;
    const k = deliberationKey(cfg);
    reqId.current += 1;
    const id = reqId.current;
    setLoadError(null);
    try {
      const m = await deliberationTrust(cfg);
      const entries = await Promise.all(
        cfg.participants.map(
          async (p) => [p.webId, await m.resolver.resolve(p.webId, cfg.deliberation)] as const,
        ),
      );
      if (id !== reqId.current) return;
      setResolved({ key: k, machinery: m, roll: new Map(entries) });
    } catch (e) {
      if (id !== reqId.current) return;
      setResolved(null);
      setLoadError({ key: k, message: e instanceof Error ? e.message : String(e) });
    }
  }, [key]);

  useEffect(() => {
    setIssued(null);
    setIssueError(null);
    void loadRoll();
    // On unmount (or config change) supersede any in-flight resolution so a
    // late result can never set state on an unmounted view.
    return () => {
      reqId.current += 1;
    };
  }, [loadRoll]);

  const identity = sessionIdentity(config, webId);
  const profile = trust.profile;
  const floor = config.participationFloor;
  const isSteward = profile !== null && hasRole(profile, "steward");
  // Derived at render time, keyed to the CURRENT config value (see above).
  const current = resolved !== null && resolved.key === key ? resolved : null;
  const roll = current?.roll ?? null;
  const issuance = current?.machinery.issuance ?? null;
  const rollError = loadError !== null && loadError.key === key ? loadError.message : null;
  const stewardNames = roll
    ? [...roll.entries()].filter(([, p]) => hasRole(p, "steward")).map(([w]) => displayName(w))
    : [];

  async function issue(): Promise<void> {
    setIssued(null);
    setIssueError(null);
    // Fail-closed: every precondition re-checked at action time.
    if (!issuance || !isSteward) {
      setIssueError("Only a steward of this community can issue role credentials.");
      return;
    }
    if (!isRole(role) || !ISSUABLE_ROLES.includes(role)) {
      setIssueError("Choose a role to issue (builder or reviewer).");
      return;
    }
    const base = issuance.baseFor(subject);
    if (!subject || base === undefined) {
      setIssueError("Choose a participant to issue to.");
      return;
    }
    setIssuing(true);
    try {
      const credential = await issueRoleCredential({
        community: config.deliberation,
        subject,
        role,
        steward: issuance.steward,
        key: issuance.key,
      });
      const { url } = await writeCredentialDoc(issuance.writeFetch, base, credential);
      issuance.invalidate(subject);
      setIssued(url);
      await loadRoll(); // the roll re-verifies — the new role appears for real
      await trust.refresh(); // in case the steward issued to themselves
    } catch (e) {
      setIssueError(e instanceof Error ? e.message : String(e));
    } finally {
      setIssuing(false);
    }
  }

  return (
    <section className="view">
      <h2 className="view-title">Governance &amp; trust</h2>
      <p className="view-lede">
        Two axes decide what anyone may do here: <strong>who you verifiably are</strong> (an
        identity tier) and <strong>what this community lets you do</strong> (roles, held as signed
        credentials scoped to this community — never global). Every claim below is verified from
        credentials, fail-closed: no credential, no standing.
      </p>

      {/* Your standing */}
      <div className="panel">
        <h3 className="view-title" style={{ fontSize: "1.05rem" }}>
          Your standing here
        </h3>
        {identity === null ? (
          <p className="muted">Not signed in — sign in with your WebID to resolve your standing.</p>
        ) : profile === null ? (
          <p className="muted" aria-live="polite">
            Verifying your credentials…
          </p>
        ) : (
          <>
            <p>
              <span className="who">{displayName(identity)}</span> <TierBadge tier={profile.tier} />{" "}
              <RoleBadges profile={profile} />
            </p>
            <p className="muted small">
              Tier T{profile.tier}: {TIER_MEANING[profile.tier]}.{" "}
              {profile.roles.length === 0
                ? "You hold no role credentials in this community."
                : profile.roles.map((r) => `As ${r}, you may ${ROLE_MEANING[r]}.`).join(" ")}
            </p>
            <p className={meetsTier(profile, floor) ? "notice ok" : "notice info"}>
              {meetsTier(profile, floor)
                ? `You meet this scope's participation floor (T${floor}) — you may compose and react.`
                : `This scope's participation floor is T${floor} — composing and reacting are locked until a steward issues your membership credential.`}
            </p>
          </>
        )}
      </div>

      {/* The community roll */}
      <div className="panel">
        <h3 className="view-title" style={{ fontSize: "1.05rem" }}>
          Community roll
        </h3>
        <p className="muted small">
          Each standing is resolved by verifying the participant's credentials against the
          community's trust anchors (its stewards' published keys) — signature, expiry, status and
          scope all checked, every failure a quiet denial.
        </p>
        {rollError !== null && <p className="notice error">{rollError}</p>}
        {!roll && rollError === null && <p className="muted">Verifying credentials…</p>}
        {roll && (
          <ul className="participant-list">
            {config.participants.map((p) => {
              const name = displayName(p.webId);
              const standing = roll.get(p.webId);
              return (
                <li key={p.webId}>
                  <span className="avatar" style={{ background: avatarColor(p.webId) }}>
                    {initials(name)}
                  </span>
                  <span className="who">{name}</span>
                  {standing && <TierBadge tier={standing.tier} />}
                  {standing && <RoleBadges profile={standing} />}
                  <span className="pid">{p.webId}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Steward issuance */}
      <div className="panel">
        <h3 className="view-title" style={{ fontSize: "1.05rem" }}>
          Issue a role credential
        </h3>
        {isSteward && issuance ? (
          <>
            <p className="muted small">
              As a steward you can issue a <strong>builder</strong> or <strong>reviewer</strong>{" "}
              credential: a signed statement, valid 90 days, written into the holder's own pod and
              verifiable by anyone against this community's trust anchors.
              {config.mode === "demo" &&
                " (Demo: signed with this sandbox's seeded steward key — the same pipeline production uses; nothing leaves your browser.)"}
            </p>
            <div className="field">
              <span>Issue to</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="participant to issue to"
              >
                <option value="">Choose a participant…</option>
                {config.participants
                  .filter((p) => p.webId !== identity)
                  .map((p) => (
                    <option key={p.webId} value={p.webId}>
                      {displayName(p.webId)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <span>Role</span>
              <fieldset className="segmented" aria-label="role to issue">
                {ISSUABLE_ROLES.map((r) => (
                  <button
                    type="button"
                    key={r}
                    aria-pressed={role === r}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </button>
                ))}
              </fieldset>
              <span className="hint">{ROLE_MEANING[role]}.</span>
            </div>
            <button type="button" className="primary" onClick={issue} disabled={issuing}>
              {issuing ? "Signing…" : "Issue credential"}
            </button>
            {issueError && <p className="notice error">{issueError}</p>}
            {issued && (
              <p className="notice ok">
                Issued — the credential now lives in the holder's pod and the roll above re-verified
                it. <span className="data">{issued}</span>
              </p>
            )}
            <p className="muted small">
              Steward seats themselves are a community-formation act (two-steward rule,
              unaffiliated-voucher quorum — design/04 §4.2) and are not issued from this form.
            </p>
          </>
        ) : config.mode === "demo" ? (
          <p className="muted">
            Only stewards may issue role credentials.
            {stewardNames.length > 0 && (
              <> Stewards of this community: {stewardNames.join(", ")}.</>
            )}{" "}
            In the{" "}
            <a
              href={scopeHref(
                "apps",
                typeof window === "undefined" ? null : window.location.search,
                typeof window === "undefined" ? null : window.location.hash,
              )}
            >
              apps scope
            </a>{" "}
            you hold a steward role and can try issuance live.
          </p>
        ) : (
          <p className="muted">
            Live steward issuance arrives with the community-registry wiring (published steward
            anchors + credential inboxes) — the seam is built; this deliberation has no steward keys
            configured yet.
          </p>
        )}
      </div>

      {/* The model, in plain language */}
      <div className="panel">
        <h3 className="view-title" style={{ fontSize: "1.05rem" }}>
          How trust works here
        </h3>
        <ol className="steps">
          <li>
            <div className="step-body">
              <span className="step-title">Tiers say who you are</span>
              <p className="step-desc">
                T0 {TIER_MEANING[0]}; T1 {TIER_MEANING[1]}; T2 {TIER_MEANING[2]} (arriving with
                zero-knowledge personhood). Speaking in the society scope needs only T0 — changing
                running systems needs more.
              </p>
            </div>
          </li>
          <li>
            <div className="step-body">
              <span className="step-title">Roles say what you may do</span>
              <p className="step-desc">
                Builder, reviewer and steward are signed credentials scoped to one community,
                short-lived and renewable. A steward of one community holds no authority in another.
              </p>
            </div>
          </li>
          <li>
            <div className="step-body">
              <span className="step-title">Everything is verifiable, nothing is assumed</span>
              <p className="step-desc">
                Credentials live in their holder's pod and verify against the community's published
                steward keys — signature, expiry, status, community and role scope all checked. Any
                doubt resolves to “no”.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
