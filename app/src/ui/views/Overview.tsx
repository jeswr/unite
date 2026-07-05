// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Overview: the deliberation's front door. An honest scope-status landing (the
// three nested scopes and what is actually live today), a live dashboard over
// the aggregate (voices / needs / reactions), the demo ↔ your-pods mode switch,
// participant roster with verification state, pod-mode onboarding (sign in →
// configure → membership check), and a plain-language "how unite works" strip.
// Thin over src/lib (buildVerifier / MembershipVerifier / the shared aggregate).

import { useEffect, useState } from "react";
import type { MembershipResult } from "../../lib/membership.js";
import { SCOPE_ORDER, SCOPES, type ScopeConfig, scopeHref } from "../../scope/scopes.js";
import {
  Notice,
  Panel,
  ScopeStatusBadge,
  SectionHeader,
  StatGrid,
  StatTile,
  ViewHeader,
} from "../components.js";
import { avatarColor, initials } from "../format.js";
import type { AggregateState } from "../hooks.js";
import { displayName } from "../hooks.js";
import type { View } from "../route.js";
import {
  configReady,
  type DeliberationConfig,
  deliberationTrust,
  demoConfig,
  podConfig,
} from "../state.js";

function parseParticipants(text: string): DeliberationConfig["participants"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [wid, base] = line.split(/\s+/);
      return { webId: wid ?? "", base: base ?? "" };
    });
}

/** A short scope label without the "Co-designing " prefix. */
function shortScopeName(name: string): string {
  return name.replace("Co-designing ", "");
}

/**
 * The honest scope-status ladder: the three nested scopes and their REAL
 * maturity (live vs preview, straight off the scope config), so a visitor
 * immediately grasps what unite is and what actually works today. The current
 * scope is flagged; the others link across (preserving query + hash).
 */
function ScopeLadder({ current }: { current: ScopeConfig }): React.JSX.Element {
  const loc = typeof window === "undefined" ? null : window.location;
  return (
    <ol className="scope-ladder">
      {SCOPE_ORDER.map((id) => {
        const s = SCOPES[id];
        const here = id === current.id;
        const name = shortScopeName(s.name);
        return (
          <li key={id} className={here ? "scope-status-card here" : "scope-status-card"}>
            <div className="ssc-head">
              <span className="ssc-name">{name}</span>
              <ScopeStatusBadge status={s.status} />
            </div>
            <p className="ssc-desc">{s.tagline}</p>
            <div className="ssc-foot">
              {here ? (
                <span className="badge concept">You're here</span>
              ) : (
                <a className="btn ghost" href={scopeHref(id, loc?.search, loc?.hash)}>
                  Open {name} →
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Overview({
  scope,
  config,
  onChange,
  webId,
  aggregate,
  onNavigate,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  onChange: (next: DeliberationConfig) => void;
  webId: string | null;
  aggregate: AggregateState;
  onNavigate: (view: View) => void;
}): React.JSX.Element {
  const [check, setCheck] = useState<MembershipResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const { result, loading } = aggregate;

  // CONTROLLED participants text, re-synced whenever the config's participants
  // change (e.g. a demo↔pod mode switch) — an uncontrolled defaultValue would
  // keep showing stale text and a later blur could write it into the new config.
  const participantsText = config.participants.map((p) => `${p.webId} ${p.base}`).join("\n");
  const [participantsDraft, setParticipantsDraft] = useState(participantsText);
  useEffect(() => setParticipantsDraft(participantsText), [participantsText]);

  async function runCheck(): Promise<void> {
    setCheckError(null);
    setCheck(null);
    if (!webId) {
      setCheckError("Sign in first — your WebID is the identity the deliberation vouches.");
      return;
    }
    try {
      // The SAME floor-aware gate the aggregation runs — what it says is what
      // the board does.
      const { gate } = await deliberationTrust(config);
      setCheck(await gate.verify(webId, config.deliberation));
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
    }
  }

  const verifiedTiers = new Map((result?.verified ?? []).map((v) => [v.webId, v.tier]));

  return (
    <section className="view">
      <ViewHeader
        title={scope.name}
        lede={scope.description}
        actions={<ScopeStatusBadge status={scope.status} />}
      >
        {scope.status === "preview" && (
          <Notice tone="info">
            This scope is an honest <strong>preview</strong> — its own machinery is still unlocking
            phase by phase. Where a surface isn't built, unite says so rather than dressing up
            another scope's screens as this one's.
          </Notice>
        )}
      </ViewHeader>

      {/* The honest scope-status landing — what unite is, and what is live. */}
      <Panel className="u-landing-panel">
        <SectionHeader
          title="One platform, three scopes"
          sub="unite points the same convergence engine at three arenas — apps, the infrastructure beneath them, and society itself. Each unlocks as its own machinery lands; here's what actually works today."
        />
        <ScopeLadder current={scope} />
      </Panel>

      {/* Live deliberation stats — the engine's real aggregate. */}
      <StatGrid label="deliberation activity">
        <StatTile
          value={result ? result.verified.length : loading ? "…" : "—"}
          label="verified voices"
        />
        <StatTile value={result ? result.needs.length : loading ? "…" : "—"} label="needs shared" />
        <StatTile
          value={result ? result.resonances.length : loading ? "…" : "—"}
          label="reactions"
        />
        <StatTile value={result ? result.errors.length : "—"} label="sources skipped" />
      </StatGrid>

      <div className="chip-row u-cta-row">
        <button type="button" className="btn primary" onClick={() => onNavigate("board")}>
          Browse the needs board
        </button>
        <button type="button" className="btn" onClick={() => onNavigate("bridge")}>
          See common ground
        </button>
        <button type="button" className="btn ghost" onClick={() => onNavigate("compose")}>
          Add your voice
        </button>
      </div>

      {/* Mode: seeded demo vs a real pod-backed deliberation. */}
      <fieldset className="mode-switch" aria-label="deliberation source">
        <button
          type="button"
          className="mode-card"
          aria-pressed={config.mode === "demo"}
          onClick={() => onChange(demoConfig(scope.id))}
        >
          <span className="m-title">Demo deliberation</span>
          <span className="m-desc">
            A seeded, sandboxed deliberation — nine voices, real engine, nothing leaves your
            browser. Explore, react, compose; it all works.
          </span>
        </button>
        <button
          type="button"
          className="mode-card"
          aria-pressed={config.mode === "pod"}
          onClick={() => onChange(podConfig(scope))}
        >
          <span className="m-title">Your own deliberation</span>
          <span className="m-desc">
            Point unite at a real community: every statement is read from — and written to — the
            participants' own Solid pods.
          </span>
        </button>
      </fieldset>

      {config.mode === "pod" && (
        <Panel>
          <ol className="steps">
            <li>
              <div className="step-body">
                <span className="step-title">Sign in with your WebID</span>
                <p className="step-desc">
                  Use the sign-in control in the header.{" "}
                  {webId ? (
                    <span className="ok">Signed in as {displayName(webId)}.</span>
                  ) : (
                    "Your pod stays yours — unite only ever writes to your own storage."
                  )}
                </p>
              </div>
            </li>
            <li>
              <div className="step-body">
                <span className="step-title">Configure the deliberation</span>
                <p className="step-desc">
                  The deliberation IRI names the shared question; your container is where YOUR
                  statements live; the participant list says whose pods to read. (A federated
                  registry replaces this hand-typed list — see decisions/0001.)
                </p>
                <label className="field">
                  <span>Deliberation IRI</span>
                  <input
                    type="url"
                    value={config.deliberation}
                    placeholder="https://community.example/deliberations/transport"
                    onChange={(e) => onChange({ ...config, deliberation: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>
                    Your unite container <span className="hint">(in your own pod, ends “/”)</span>
                  </span>
                  <input
                    type="url"
                    value={config.ownBase}
                    placeholder="https://you.pod.example/unite/transport/"
                    onChange={(e) => onChange({ ...config, ownBase: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>
                    Participants <span className="hint">— one “WebID base/” per line</span>
                  </span>
                  <textarea
                    rows={4}
                    value={participantsDraft}
                    onChange={(e) => setParticipantsDraft(e.target.value)}
                    onBlur={(e) =>
                      onChange({ ...config, participants: parseParticipants(e.target.value) })
                    }
                  />
                </label>
              </div>
            </li>
            <li>
              <div className="step-body">
                <span className="step-title">Check your membership</span>
                <p className="step-desc">
                  Participation is gated on a community-vouched membership (tier T1) — unverified
                  voices never enter the aggregate.
                </p>
                <button type="button" className="btn primary" onClick={runCheck}>
                  Check my membership
                </button>
                {checkError && <Notice tone="error">{checkError}</Notice>}
                {check &&
                  (check.ok ? (
                    <Notice tone="ok">
                      {check.tier === "T0"
                        ? "Admitted as pseudonymous voice (T0) — this scope is open to everyone."
                        : `Vouched — tier ${check.tier}. You may deliberate.`}
                    </Notice>
                  ) : (
                    <Notice tone="error">Not vouched: {check.reason}</Notice>
                  ))}
              </div>
            </li>
          </ol>
          {!configReady(config) && (
            <p className="muted small">
              The board stays empty until the deliberation IRI and at least one valid participant
              (https WebID + container ending “/”) are set.
            </p>
          )}
        </Panel>
      )}

      {/* Participant roster with verification state from the live aggregate. */}
      {config.participants.length > 0 && (
        <Panel>
          <SectionHeader title="Participants" />
          <ul className="participant-list">
            {config.participants.map((p) => {
              const name = displayName(p.webId);
              const tier = verifiedTiers.get(p.webId);
              return (
                <li key={p.webId}>
                  <span className="avatar" style={{ background: avatarColor(p.webId) }}>
                    {initials(name)}
                  </span>
                  <span className="who">{name}</span>
                  {tier !== undefined ? (
                    <span className={tier === "T0" ? "badge" : "badge res"}>
                      {tier === "T0" ? "voice · T0" : `vouched · ${tier}`}
                    </span>
                  ) : result ? (
                    <span className="badge">unverified</span>
                  ) : null}
                  <span className="pid">{p.webId}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* How unite works — the loop, in plain language. */}
      <Panel>
        <SectionHeader title="How unite works" />
        <ol className="steps">
          <li>
            <div className="step-body">
              <span className="step-title">Say what you need — from your own pod</span>
              <p className="step-desc">
                Each {scope.artifactNoun} is stored in its author's own storage, under their
                identity, with an explicit consent policy on what the community may do with it.
              </p>
            </div>
          </li>
          <li>
            <div className="step-body">
              <span className="step-title">React honestly</span>
              <p className="step-desc">
                Resonates, conflicts, or unsure — one voice per person per statement. Reactions map
                the real opinion landscape instead of rewarding whoever shouts loudest.
              </p>
            </div>
          </li>
          <li>
            <div className="step-body">
              <span className="step-title">Common ground surfaces</span>
              <p className="step-desc">
                Statements rank by cross-group agreement, not engagement: something rises only when
                every opinion group receives it well. Disagreement stays visible — never smoothed
                away.
              </p>
            </div>
          </li>
        </ol>
      </Panel>
    </section>
  );
}
