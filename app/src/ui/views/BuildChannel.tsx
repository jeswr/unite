// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Build channel view (BL.2 — next-phases §3.5): a READ-ONLY window on the
// agentic "Slack-style build layer" — a `wf:Tracker` channel, its `wf:Task`
// threads, and every participant's pod `CanonicalMessage`s aggregated into one
// creator-verified, cross-pod feed (BL.1), with agents as first-class, LABELLED,
// accountable participants and each thread's commission LIFECYCLE state computed
// by the BL.3 fold. It renders the landed feature; it does NOT commission, sign,
// or merge (that WRITE UI is a later increment). Every agent turn is shown with
// its mandatory PROV-O attribution — an agent is never rendered as a human; its
// self-claimed owner is rendered as an UNVERIFIED CLAIM ("claims to act for X"),
// never a verified back-link. Thin over ui/build-channel (composes the lib reads).

import type { CommissionState } from "../../lib/channel.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import {
  type BuildChannelState,
  type BuildChannelView,
  type CommissionInfo,
  type MessageView,
  type ThreadView,
  useBuildChannel,
} from "../build-channel.js";
import {
  Badge,
  type BadgeTone,
  EmptyState,
  LoadingRows,
  Notice,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  ViewHeader,
} from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import { displayName } from "../hooks.js";
import type { DeliberationConfig } from "../state.js";

/** The state → badge (tone + human label) map for a commission lifecycle state. */
const STATE_BADGE: Record<CommissionState, { tone: BadgeTone; label: string }> = {
  drafted: { tone: "neutral", label: "drafted" },
  commissioned: { tone: "petrol", label: "commissioned" },
  "in-progress": { tone: "petrol", label: "in progress" },
  "pr-open": { tone: "gold", label: "PR open" },
  "in-review": { tone: "gold", label: "in review" },
  merged: { tone: "res", label: "merged" },
  rejected: { tone: "con", label: "rejected" },
};

/** A relative step label for the audit chain. */
const STEP_LABEL: Record<string, string> = {
  commission: "commissioned",
  start: "started",
  "open-pr": "opened a PR",
  "request-review": "requested review",
  "request-changes": "requested changes",
  merge: "merged",
  reject: "rejected",
};

/** One message in a feed — a human note or a clearly-attributed agent turn. An
 *  agent turn is NEVER shown as a human (the "agent" badge is the core invariant).
 *  Its self-claimed owner is rendered as an UNVERIFIED CLAIM ("claims to act for
 *  X"), visually distinct — never as a verified back-link (the reciprocal
 *  owner→agent binding is the audit increment). */
function MessageCard({ m }: { m: MessageView }): React.JSX.Element {
  const name = m.isAgent ? (m.agentLabel?.name ?? "an agent") : displayName(m.author);
  return (
    <li className="card bc-msg">
      <div className="bc-msg-head">
        <span className="avatar" style={{ background: avatarColor(m.author) }}>
          {m.isAgent ? "AI" : initials(displayName(m.author))}
        </span>
        <span className="who">{name}</span>
        {m.isAgent && (
          <Badge tone="petrol" title="a PROV-O-attributed agent turn — not a human author">
            agent
          </Badge>
        )}
        {m.published && <span className="when">{formatDate(m.published)}</span>}
      </div>
      <p className="need-content">{m.content}</p>
      {m.isAgent && (
        <p className="bc-attribution muted small">
          {/* MANDATORY attribution: an agent turn is always shown as one, with its
              generating model + its (UNVERIFIED, self-claimed) owner where known. */}
          {m.agentLabel?.ownerClaim ? (
            <>
              claims to act for <span className="data">{displayName(m.agentLabel.ownerClaim)}</span>{" "}
              <span className="bc-unverified">unverified</span> ·{" "}
            </>
          ) : null}
          <span className="data">{m.author}</span>
          {m.model ? (
            <>
              {" "}
              · via <span className="data">{m.model}</span>
            </>
          ) : null}
        </p>
      )}
    </li>
  );
}

/** The commission-state badge + the "accountable build chain" audit expander. */
function CommissionPanel({ commission }: { commission: CommissionInfo }): React.JSX.Element {
  // A PRESENT-but-unverified commission (e.g. pod mode, before the audit-increment
  // verify) is shown DISTINCTLY from a genuine `drafted` (no commission at all), so
  // a live commissioned thread is never rendered as if it had never been commissioned.
  const badge = commission.unverified
    ? { tone: "gold" as BadgeTone, label: "commission · unverified" }
    : (STATE_BADGE[commission.state] ?? STATE_BADGE.drafted);
  const hasChain = commission.chain.length > 0 || commission.evidence !== undefined;
  return (
    <div className="bc-commission">
      <Badge
        tone={badge.tone}
        title={
          commission.unverified
            ? "a signed commission is present but not verified in this view"
            : `commission lifecycle: ${commission.state}`
        }
      >
        {badge.label}
      </Badge>
      {commission.unverified && (
        <span className="muted small">
          {" "}
          — a signed commission is present but its delegation is not verified in this view
          (fail-closed; verifying live commissions is the audit increment)
        </span>
      )}
      {hasChain && (
        <details className="sources bc-audit">
          <summary>Why is this here? — the accountable build chain</summary>
          {commission.commissioner && (
            <p className="muted small">
              Commissioned by <span className="data">{displayName(commission.commissioner)}</span>{" "}
              {commission.verified ? (
                <Badge tone="res" title="the signed fedtrust:DelegationCredential verified">
                  signature verified
                </Badge>
              ) : (
                <Badge tone="con" title="the delegation did not verify in this view">
                  unverified
                </Badge>
              )}
            </p>
          )}
          {commission.chain.length > 0 && (
            <ol className="bc-chain">
              {commission.chain.map((s) => (
                <li key={`${s.type} ${s.at}`} className="muted small">
                  <span className="data">{displayName(s.actor)}</span>{" "}
                  {STEP_LABEL[s.type] ?? s.type} · {formatDate(s.at)}
                </li>
              ))}
            </ol>
          )}
          {commission.evidence && (
            <p className="muted small">
              <a href={commission.evidence} rel="noopener noreferrer" target="_blank">
                re-check the signed commission
              </a>{" "}
              — the full audit walk (verifyAgentAuthority / auditArtifact) re-verifies the whole
              chain client-side, with zero credentials.
            </p>
          )}
        </details>
      )}
    </div>
  );
}

/** One thread: its `wf:Task` title, commission state, audit chain + message feed. */
function ThreadCard({ thread }: { thread: ThreadView }): React.JSX.Element {
  return (
    <Panel className="bc-thread">
      <SectionHeader
        title={thread.title}
        sub={
          <>
            opened by{" "}
            <span className="data">
              {thread.creatorIsAgent
                ? (thread.creatorLabel?.name ?? "an agent")
                : displayName(thread.creator)}
            </span>
            {thread.creatorIsAgent && (
              <>
                {" "}
                <Badge tone="petrol" title="this thread was opened by an agent participant">
                  agent
                </Badge>
              </>
            )}
          </>
        }
        actions={<CommissionPanel commission={thread.commission} />}
      />
      {thread.messages.length === 0 ? (
        <p className="muted small">No messages in this thread yet.</p>
      ) : (
        <ul className="cards bc-feed">
          {thread.messages.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The presentational board — takes a fully-resolved {@link BuildChannelView} (or
 * loading/error). Exported so rendering (agent attribution, human-not-mislabelled,
 * commission state, the empty state) is testable on plain data.
 */
export function BuildChannelBoard({
  scope,
  view,
  loading,
  error,
  onRefresh,
}: {
  scope: ScopeConfig;
  view: BuildChannelView | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
}): React.JSX.Element {
  const showSkeletons = loading && view === null;
  const agentCount = view?.participants.length ?? 0;
  const isEmpty = view !== null && view.threads.length === 0 && view.rootMessages.length === 0;

  return (
    <section className="view">
      <ViewHeader
        title="Build channel"
        lede={
          <>
            The agentic build layer, made visible: a converged proposal becomes built software with{" "}
            <strong>agents as first-class, accountable participants</strong>. Every message lives in
            its author's own pod; agents post with mandatory <em>PROV-O attribution</em> (never as a
            human), and every commission is a signed, walkable chain. This is a{" "}
            <strong>read</strong> view — commissioning, signing and merging are held by humans,
            elsewhere.
          </>
        }
        actions={
          onRefresh && (
            <button type="button" className="btn" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          )
        }
      />

      {!scope.buildLayer && (
        <Notice tone="info">The build layer is not enabled in this scope.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {showSkeletons && <LoadingRows count={3} />}

      {view !== null && (
        <StatGrid label="channel summary">
          <StatTile value={view.threads.length} label="threads" accent />
          <StatTile
            value={
              view.rootMessages.length + view.threads.reduce((n, t) => n + t.messages.length, 0)
            }
            label="messages"
          />
          <StatTile value={agentCount} label="participants" />
        </StatGrid>
      )}

      {isEmpty && (
        <EmptyState
          title="No build work in this channel yet"
          badge={view?.demo ? <Badge tone="demo">demo build channel</Badge> : undefined}
        >
          <p>
            When the room endorses a proposal, someone commissions a build: a signed delegation
            naming that exact synthesis, and the commissioned agent reports its progress here in
            thread — a channel per unit of work, a reviewable diff, human merge authority.
          </p>
        </EmptyState>
      )}

      {view !== null && view.rootMessages.length > 0 && (
        <Panel className="bc-thread">
          <SectionHeader
            title="Channel"
            sub="messages posted to the channel, not a specific thread"
          />
          <ul className="cards bc-feed">
            {view.rootMessages.map((m) => (
              <MessageCard key={m.id} m={m} />
            ))}
          </ul>
        </Panel>
      )}

      {view?.threads.map((t) => (
        <ThreadCard key={t.id} thread={t} />
      ))}

      {view !== null && view.unverified.length > 0 && (
        <details className="sources">
          <summary>
            {view.unverified.length} unvouched participant
            {view.unverified.length === 1 ? "" : "s"} excluded (fail-closed membership gate)
          </summary>
          <ul>
            {view.unverified.map((u) => (
              <li key={u.webId} className="muted small">
                <span className="data">{u.webId}</span> — {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {view !== null && view.errors.length > 0 && (
        <details className="sources">
          <summary>
            {view.errors.length} source{view.errors.length === 1 ? "" : "s"} skipped (fail-isolated)
          </summary>
          <ul>
            {view.errors.map((e) => (
              <li key={`${e.webId} ${e.stage} ${e.resource ?? ""}`} className="muted small">
                <span className="data">{e.resource ?? e.base}</span> ({e.stage}) — {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** The wired Build channel view. */
export function BuildChannel({
  scope,
  config,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
}): React.JSX.Element {
  const controller = useController();
  const state: BuildChannelState = useBuildChannel(config, controller, scope);
  return (
    <BuildChannelBoard
      scope={scope}
      view={state.view}
      loading={state.loading}
      error={state.error}
      onRefresh={state.refresh}
    />
  );
}
