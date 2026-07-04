// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Adoption board (S2 — SCOPE-DIFFERENTIATION §3.4, B-only): the
// ratification instrument. A versions × advertisers matrix per governed
// system, built from live `fedreg:acceptsSpec` reads — every cell an
// observation carrying its RE-CHECKABLE source IRI (an index entry is a
// cache, never authoritative). "The wire is the ballot box": the room's
// endorsement is advisory; Current / Superseded / Proposed here is COMPUTED
// from observations against the adoption bar, never asserted — and an empty
// matrix is the CORRECT display while the network hasn't adopted anything
// (§9: that emptiness is honest, not a bug to paper over).
//
// Reads are credential-free (publicFetch / the demo sandbox fetch),
// https-only, byte-capped, fail-isolated per source (lib/adoption.ts).

import { useCallback, useEffect, useState } from "react";
import { DEMO_ADOPTION_SOURCES } from "../../demo/fixtures.js";
import {
  type AdoptionSnapshot,
  computeAdoption,
  DEFAULT_ADOPTION_BAR,
  GOVERNED_SYSTEMS,
  observeAdoption,
  type VersionAdoption,
} from "../../lib/adoption.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import { readFetchFor } from "../hooks.js";
import type { DeliberationConfig } from "../state.js";

/** The computed-status chip (never an asserted property anywhere). */
function StatusBadge({ column }: { column: VersionAdoption }): React.JSX.Element {
  if (column.status === "current") {
    return <span className="badge gold">current — bar met on observed evidence</span>;
  }
  if (column.status === "superseded") {
    return <span className="badge">superseded — a newer version meets the bar</span>;
  }
  return <span className="badge con">proposed — the wire hasn't adopted it</span>;
}

export function AdoptionBoard({
  scope,
  config,
}: {
  scope: ScopeConfig;
  config: DeliberationConfig;
}): React.JSX.Element {
  const controller = useController();
  const isDemo = config.mode === "demo";
  // Demo mode observes the sandboxed seed documents; pod mode observes
  // whatever storage-description IRIs the user configures (view-local — the
  // sources are an OBSERVER's input, not part of the deliberation config).
  const [sourcesText, setSourcesText] = useState(isDemo ? DEMO_ADOPTION_SOURCES.join("\n") : "");
  const [snapshot, setSnapshot] = useState<AdoptionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const observe = useCallback(async () => {
    const sources = sourcesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setLoading(true);
    setError(null);
    try {
      const fetchFn = await readFetchFor(config, controller);
      setSnapshot(await observeAdoption(sources, { fetch: fetchFn }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sourcesText, config, controller]);

  // Observe on mount (and when the deliberation changes) — the board must not
  // sit empty waiting for a button press when sources are already configured.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per config change, not per keystroke — Observe re-runs on demand.
  useEffect(() => {
    void observe();
  }, [config]);

  const { matrices, undeclared } = computeAdoption(GOVERNED_SYSTEMS, snapshot?.observations ?? []);

  return (
    <section className="view">
      <div className="row-between">
        <div>
          <h2 className="view-title">Adoption board</h2>
          <p className="view-lede">
            <strong>The wire is the ballot box.</strong> The room's endorsement is advisory — a
            version becomes <em>Current</em> only when the network's storages actually advertise it
            (<span className="data">fedreg:acceptsSpec</span>). Every cell below is an observation
            you can re-check at its source; nothing here is asserted.
          </p>
        </div>
        <button type="button" className="btn" onClick={observe} disabled={loading}>
          {loading ? "Observing…" : "Observe now"}
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}

      {matrices.map(({ system, versions, advertisers }) => (
        <div key={system.id} className="panel">
          <h3 className="view-title" style={{ fontSize: "1rem", marginTop: 0 }}>
            {system.label}
          </h3>
          <p className="muted small">
            lineage: <span className="data">{system.id}</span>
          </p>
          <div className="chip-row">
            {versions.map((col) => (
              <div key={col.version.iri} className="card" style={{ flex: 1 }}>
                <div className="row-between">
                  <strong>{col.version.label}</strong>
                  <StatusBadge column={col} />
                </div>
                {col.version.note && <p className="muted small">{col.version.note}</p>}
                <p className="muted small">
                  {col.parties.length} of ≥{DEFAULT_ADOPTION_BAR} advertising{" "}
                  {col.parties.length === 1 ? "party" : "parties"} observed
                </p>
                {col.observations.length === 0 ? (
                  <p className="muted small">No advertisers observed.</p>
                ) : (
                  <ul>
                    {col.observations.map((o) => (
                      <li key={`${o.party} ${o.source}`} className="muted small">
                        <span className="data">{o.party}</span>{" "}
                        <a href={o.source} rel="noopener noreferrer" target="_blank">
                          re-check
                        </a>{" "}
                        <span className="when">observed {o.observedAt.slice(0, 10)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {advertisers.length === 0 && (
            <div className="empty">
              <span className="empty-title">Nobody advertises this lineage yet</span>
              <p>
                An empty matrix is the honest display, not a bug: adoption is measured, and the
                network hasn't voted. It fills as independent storages publish{" "}
                <span className="data">fedreg:StorageDescription</span> documents advertising a
                version.
              </p>
            </div>
          )}
        </div>
      ))}

      <p className="muted small">
        The adoption bar (design/04 §2) is ≥2 independent implementations AND ≥2 communities
        advertising. Only the advertising half is machine-observable from{" "}
        <span className="data">fedreg:acceptsSpec</span> — implementation independence still needs
        human judgement, so "bar met" here means the <em>observable</em> half.
        {scope.status === "live" &&
          " Reviewer/steward endorsement gating and the signed fut:AdoptionDecision arrive in S3."}
      </p>

      {undeclared.length > 0 && (
        <div className="panel">
          <h3 className="view-title" style={{ fontSize: "1rem", marginTop: 0 }}>
            Observed versions outside the governed lineages
          </h3>
          <ul>
            {undeclared.map((o) => (
              <li key={`${o.party} ${o.version}`} className="muted small">
                <span className="data">{o.party}</span> advertises{" "}
                <span className="data">{o.version}</span>{" "}
                <a href={o.source} rel="noopener noreferrer" target="_blank">
                  re-check
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(snapshot?.errors.length ?? 0) > 0 && (
        <div className="panel">
          <h3 className="view-title" style={{ fontSize: "1rem", marginTop: 0 }}>
            Sources that could not be observed
          </h3>
          <ul>
            {(snapshot?.errors ?? []).map((e) => (
              <li key={e.source} className="muted small">
                <span className="data">{e.source}</span> — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span>
          Observation sources{" "}
          <span className="hint">
            — one <span className="data">fedreg:StorageDescription</span> IRI per line (https-only;
            read credential-free)
          </span>
        </span>
        <textarea
          rows={3}
          value={sourcesText}
          onChange={(e) => setSourcesText(e.target.value)}
          placeholder="https://storage.example/.well-known/fedreg.ttl"
        />
      </label>
    </section>
  );
}
