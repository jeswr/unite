// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Proposals (S1 — SCOPE-DIFFERENTIATION §2): scope A's proposal layer. A
// proposal is a SATISFIER — every card names the shared needs it serves
// (fut:motivatedBy, ≥1 enforced at compose and on read), and filtering by a
// need presents the rival proposals for that need as a PORTFOLIO of answers,
// not a conflict (design/03 §2). Proposals are wf:Tasks, so they federate into
// the shared task model unchanged. Thin over src/lib.

import { useMemo, useState } from "react";
import { type ConsentPolicy, DEFAULT_CONSENT } from "../../lib/consent.js";
import type { AppProposal, Need } from "../../lib/model.js";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "../../lib/model.js";
import { writeProposal } from "../../lib/pod.js";
import { meetsTier } from "../../lib/trust.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import {
  EmptyState,
  LoadingRows,
  Notice,
  Panel,
  SectionHeader,
  ViewHeader,
} from "../components.js";
import { avatarColor, formatDate, initials } from "../format.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { displayName, writeSessionFor } from "../hooks.js";
import { configReady, type DeliberationConfig, sessionIdentity } from "../state.js";
import { ConsentPanel } from "./ConsentPanel.js";
import { InfraProposals } from "./InfraProposals.js";
import { StanceButtons } from "./StanceButtons.js";
import { TIER_MEANING } from "./Trust.js";

export function Proposals({
  scope,
  config,
  webId,
  trust,
  aggregate,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
}): React.JSX.Element {
  // S2: a scope whose proposal artifact is the fut:InfraProposal (scope B)
  // renders the infra board — same spine, scope-B cards (kind/target/breaking
  // badges); composing lives in the structured wizard on Compose (§3.3).
  // Branched BEFORE any hook so the two boards' hook orders never interleave.
  if (scope.artifactKinds.includes("infra-proposal")) {
    return (
      <InfraProposals
        scope={scope}
        config={config}
        webId={webId}
        trust={trust}
        aggregate={aggregate}
      />
    );
  }
  return (
    <AppProposals scope={scope} config={config} webId={webId} trust={trust} aggregate={aggregate} />
  );
}

function AppProposals({
  scope,
  config,
  webId,
  trust,
  aggregate,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
}): React.JSX.Element {
  const controller = useController();
  const { result, loading, error, refresh } = aggregate;

  // Compose state
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [serves, setServes] = useState<readonly string[]>([]);
  const [stakeholders, setStakeholders] = useState("");
  const [consent, setConsent] = useState<ConsentPolicy>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Board state
  const [needFilter, setNeedFilter] = useState<string | null>(null);

  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;
  const mayParticipate = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  const needById = useMemo(() => {
    const m = new Map<string, Need>();
    for (const n of result?.needs ?? []) m.set(n.id, n);
    return m;
  }, [result]);

  const proposals = useMemo(() => {
    const list = [...(result?.proposals ?? [])];
    list.sort((a, b) => {
      const d = Date.parse(b.created) - Date.parse(a.created);
      if (!Number.isNaN(d) && d !== 0) return d;
      return a.id < b.id ? -1 : 1;
    });
    return list;
  }, [result]);

  // Needs that ≥1 proposal serves, with counts — the portfolio filter chips.
  const servedNeeds = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of proposals) {
      for (const n of p.motivatedBy) m.set(n, (m.get(n) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }, [proposals]);

  // A stale filter (its need vanished from live data) degrades to no-filter.
  const activeFilter =
    needFilter && servedNeeds.some(([iri]) => iri === needFilter) ? needFilter : null;
  const visible = activeFilter
    ? proposals.filter((p) => p.motivatedBy.includes(activeFilter))
    : proposals;

  function toggleServes(needId: string): void {
    setServes((prev) =>
      prev.includes(needId) ? prev.filter((n) => n !== needId) : [...prev, needId],
    );
  }

  async function submit(): Promise<void> {
    setFormError(null);
    setSavedUrl(null);
    if (!identity) {
      setFormError("Sign in first — a proposal is written to your own pod under your WebID.");
      return;
    }
    if (!mayParticipate) {
      setFormError(`Proposing here requires identity tier T${floor} — see the Trust view.`);
      return;
    }
    if (!title.trim()) {
      setFormError("Give the proposal a short name.");
      return;
    }
    if (!content.trim()) {
      setFormError("Describe the idea first.");
      return;
    }
    if (serves.length === 0) {
      setFormError(
        "Pick at least one shared need this proposal serves — a proposal is a satisfier, and the needs trace is what keeps co-design value-centric.",
      );
      return;
    }
    setSaving(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const proposal: Omit<AppProposal, "id"> = {
        title: title.trim(),
        content: content.trim(),
        motivatedBy: serves,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
        ...(stakeholders.trim() ? { indirectStakeholders: stakeholders.trim() } : {}),
      };
      const { url } = await writeProposal(session.fetch, session.ownBase, proposal, consent);
      setSavedUrl(url);
      setTitle("");
      setContent("");
      setServes([]);
      setStakeholders("");
      setConsent(DEFAULT_CONSENT);
      setComposing(false);
      try {
        await refresh(); // the write itself already succeeded
      } catch {
        // aggregation errors surface through the board's own error state
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const showSkeletons = loading && !result;

  return (
    <section className="view">
      <ViewHeader
        title="Proposals"
        lede={
          <>
            A proposal is a <em>satisfier</em>: it names the shared needs it serves. Rival proposals
            for the same need are a <strong>portfolio of answers</strong>, not a conflict — filter
            by a need to see its portfolio.
          </>
        }
        actions={
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {/* ── Compose ────────────────────────────────────────────────────── */}
      {!mayParticipate && trust.profile !== null && (
        <Notice tone="info">
          Reading is open to everyone; <strong>proposing and reacting</strong> here requires a
          vouched membership (tier T{floor} — {TIER_MEANING[floor]}). See the{" "}
          <a href="#/trust">Trust</a> view for how vouching works.
        </Notice>
      )}

      {mayParticipate && !composing && (
        <div>
          <button type="button" className="primary" onClick={() => setComposing(true)}>
            Propose an {scope.artifactNoun}
          </button>
        </div>
      )}

      {mayParticipate && composing && (
        <Panel>
          <SectionHeader title={`Propose an ${scope.artifactNoun}`} />
          <label className="field">
            <span>
              Short name{" "}
              <span className="char-count">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </span>
            <input
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Offline-first notes"
            />
          </label>
          <label className="field">
            <span>
              The idea{" "}
              <span className="char-count">
                {content.length}/{MAX_CONTENT_LENGTH}
              </span>
            </span>
            <textarea
              rows={4}
              maxLength={MAX_CONTENT_LENGTH}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What should exist? What would it do, for whom?"
            />
          </label>
          <div className="field">
            <span>
              Which shared needs does it serve?{" "}
              <span className="hint">
                — pick from the deliberation's needs board (≥1 required; this is the proposal's{" "}
                <em>reason to exist</em>)
              </span>
            </span>
            {(result?.needs.length ?? 0) === 0 ? (
              <p className="muted small">
                No shared needs yet — <a href="#/compose">share a need</a> first; proposals answer
                needs.
              </p>
            ) : (
              <fieldset className="chip-row" aria-label="needs served">
                {(result?.needs ?? []).map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    className="chip"
                    aria-pressed={serves.includes(n.id)}
                    onClick={() => toggleServes(n.id)}
                    title={n.content}
                  >
                    {n.content.length > 60 ? `${n.content.slice(0, 57)}…` : n.content}
                  </button>
                ))}
              </fieldset>
            )}
          </div>
          <label className="field">
            <span>
              Who is affected that isn't in the room? <span className="hint">(optional)</span>
            </span>
            <textarea
              rows={2}
              maxLength={MAX_CONTENT_LENGTH}
              value={stakeholders}
              onChange={(e) => setStakeholders(e.target.value)}
              placeholder="Indirect stakeholders — people the app would touch who aren't participating here."
            />
          </label>
          <ConsentPanel value={consent} onChange={setConsent} deliberation={config.deliberation} />
          <div className="chip-row">
            <button type="button" className="primary" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Share this proposal"}
            </button>
            <button type="button" className="btn" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {formError && <Notice tone="error">{formError}</Notice>}
      {savedUrl && (
        <Notice tone="ok">
          Saved to {config.mode === "demo" ? "the demo pod" : "your pod"} — it appears on the board
          below. <span className="data">{savedUrl}</span>
        </Notice>
      )}

      {/* ── The portfolio filter ────────────────────────────────────────── */}
      {servedNeeds.length > 0 && (
        <fieldset className="chip-row" aria-label="filter by need served">
          <button
            type="button"
            className="chip"
            aria-pressed={activeFilter === null}
            onClick={() => setNeedFilter(null)}
          >
            All <span className="count">{proposals.length}</span>
          </button>
          {servedNeeds.map(([iri, count]) => {
            const need = needById.get(iri);
            const label = need
              ? need.content.length > 48
                ? `${need.content.slice(0, 45)}…`
                : need.content
              : iri;
            return (
              <button
                type="button"
                key={iri}
                className="chip"
                aria-pressed={activeFilter === iri}
                onClick={() => setNeedFilter(activeFilter === iri ? null : iri)}
                title={need?.content ?? iri}
              >
                {label} <span className="count">{count}</span>
              </button>
            );
          })}
        </fieldset>
      )}

      {activeFilter && (
        <Notice tone="info">
          <strong>Portfolio:</strong> {visible.length} proposal{visible.length === 1 ? "" : "s"}{" "}
          answering “{needById.get(activeFilter)?.content ?? activeFilter}” — different satisfiers
          for the same need, side by side.
        </Notice>
      )}

      {/* ── The board ───────────────────────────────────────────────────── */}
      {showSkeletons && <LoadingRows count={2} />}

      {!showSkeletons && !configReady(config) && (
        <EmptyState title="Not connected yet">
          <p>
            Configure your deliberation on the <a href="#/overview">Overview</a> — or switch to the
            demo deliberation to explore how unite works.
          </p>
        </EmptyState>
      )}

      {!showSkeletons && result && configReady(config) && proposals.length === 0 && (
        <EmptyState title="No proposals yet">
          <p>
            A proposal answers the shared needs on the <a href="#/board">needs board</a>. Be the
            first to propose an {scope.artifactNoun}.
          </p>
        </EmptyState>
      )}

      <ul className="cards">
        {visible.map((p) => {
          const author = displayName(p.creator);
          return (
            <li key={p.id} className="card">
              <div className="row-between">
                <strong>{p.title}</strong>
              </div>
              <p className="need-content">{p.content}</p>
              <div className="chip-row">
                <span className="muted small">serves:</span>
                {p.motivatedBy.map((n) => {
                  const need = needById.get(n);
                  return (
                    <button
                      type="button"
                      key={n}
                      className="chip"
                      title={need?.content ?? n}
                      onClick={() => setNeedFilter(n)}
                    >
                      {need
                        ? need.content.length > 40
                          ? `${need.content.slice(0, 37)}…`
                          : need.content
                        : "a need outside this board"}
                    </button>
                  );
                })}
              </div>
              {p.indirectStakeholders && (
                <p className="muted small">Also affects: {p.indirectStakeholders}</p>
              )}
              <div className="card-meta">
                <span className="avatar" style={{ background: avatarColor(p.creator) }}>
                  {initials(author)}
                </span>
                <span className="who">{author}</span>
                <span className="when">{formatDate(p.created)}</span>
              </div>
              <StanceButtons
                statement={p.id}
                config={config}
                webId={webId}
                trust={trust}
                aggregate={aggregate}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
