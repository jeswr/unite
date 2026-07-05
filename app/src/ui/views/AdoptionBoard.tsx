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
// This view renders the matrix as an actual table (advertisers × versions),
// the shape the copy has always promised: rows are the storages advertising a
// lineage, columns are its versions, and each filled cell is a re-checkable
// observation. Reads are credential-free (publicFetch / the demo sandbox
// fetch), https-only, byte-capped, fail-isolated per source (lib/adoption.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_ADOPTION_SOURCES } from "../../demo/fixtures.js";
import {
  type AdoptionObservation,
  type AdoptionSnapshot,
  computeAdoption,
  DEFAULT_ADOPTION_BAR,
  GOVERNED_SYSTEMS,
  observeAdoption,
  type VersionAdoption,
} from "../../lib/adoption.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { useController } from "../auth.js";
import { EmptyState, Notice, Panel, SectionHeader, ViewHeader } from "../components.js";
import { readFetchFor } from "../hooks.js";
import type { DeliberationConfig } from "../state.js";

/** A stored snapshot, tagged with the config key it was observed under. */
export interface KeyedSnapshot {
  readonly key: string;
  readonly snap: AdoptionSnapshot;
}

/**
 * The snapshot the board may RENDER for `configKey` — PURE, derived at render:
 * a snapshot observed under a different config resolves to null, so a stale
 * (e.g. demo) snapshot is unrenderable under a new (e.g. pod) config by
 * construction — there is no effect-timing window to get wrong. Exported so
 * the no-stale-frame property is provable as a unit test on the derivation
 * itself (a DOM test after rerender cannot distinguish render-derivation from
 * effect-clearing, since testing-library flushes effects inside act()).
 */
export function activeAdoptionSnapshot(
  stored: KeyedSnapshot | null,
  configKey: string,
): AdoptionSnapshot | null {
  return stored !== null && stored.key === configKey ? stored.snap : null;
}

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

/** The observation(s) for a given advertiser in a given version column, if any. */
function cellObservations(column: VersionAdoption, party: string): readonly AdoptionObservation[] {
  return column.observations.filter((o) => o.party === party);
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
  // DERIVED-AT-RENDER, keyed to the config (the useTrustProfile pattern): a
  // demo↔pod switch (or a deliberation change) exposes that config's default
  // source list in the very same render — a stale list from the previous mode
  // is never observed, and user edits are scoped to the config they edited.
  const configKey = JSON.stringify([config.mode, config.deliberation]);
  const [edited, setEdited] = useState<{ key: string; text: string } | null>(null);
  const sourcesText =
    edited !== null && edited.key === configKey
      ? edited.text
      : isDemo
        ? DEMO_ADOPTION_SOURCES.join("\n")
        : "";
  // The snapshot is KEYED to the config it was observed under and derived at
  // render: a snapshot observed under a previous config is never rendered —
  // not even for the one frame before the refresh effect fires (a demo
  // snapshot must never appear under a pod config).
  const [snapshot, setSnapshot] = useState<KeyedSnapshot | null>(null);
  const activeSnapshot = activeAdoptionSnapshot(snapshot, configKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic request id: only the LATEST observation sweep may apply its
  // outcome (a slow superseded sweep never clobbers a newer one).
  const reqId = useRef(0);

  const observe = useCallback(async () => {
    reqId.current += 1;
    const id = reqId.current;
    const key = JSON.stringify([config.mode, config.deliberation]);
    const sources = sourcesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setLoading(true);
    setError(null);
    try {
      const fetchFn = await readFetchFor(config, controller);
      const next = await observeAdoption(sources, { fetch: fetchFn });
      if (id === reqId.current) setSnapshot({ key, snap: next });
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [sourcesText, config, controller]);

  // Observe on mount and whenever the config changes — the board must not sit
  // empty waiting for a button press. (Stale-snapshot hiding is handled by the
  // keyed derivation above, not by this effect.) `observe` is re-created for
  // the same render that derives the new sourcesText, so this always sweeps
  // the NEW config's sources.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per config change, not per keystroke — Observe re-runs on demand.
  useEffect(() => {
    void observe();
  }, [configKey]);

  const { matrices, undeclared } = computeAdoption(
    GOVERNED_SYSTEMS,
    activeSnapshot?.observations ?? [],
  );

  return (
    <section className="view">
      <ViewHeader
        title="Adoption board"
        lede={
          <>
            <strong>The wire is the ballot box.</strong> The room's endorsement is advisory — a
            version becomes <em>Current</em> only when the network's storages actually advertise it
            (<span className="data">fedreg:acceptsSpec</span>). Every cell below is an observation
            you can re-check at its source; nothing here is asserted.
          </>
        }
        actions={
          <button type="button" className="btn" onClick={observe} disabled={loading}>
            {loading ? "Observing…" : "Observe now"}
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {matrices.map(({ system, versions, advertisers }) => (
        <Panel key={system.id} className="u-matrix-panel">
          <SectionHeader
            title={system.label}
            sub={
              <>
                lineage: <span className="data">{system.id}</span>
              </>
            }
          />
          {advertisers.length === 0 ? (
            <EmptyState title="Nobody advertises this lineage yet">
              <p>
                An empty matrix is the honest display, not a bug: adoption is measured, and the
                network hasn't voted. It fills as independent storages publish{" "}
                <span className="data">fedreg:StorageDescription</span> documents advertising a
                version.
              </p>
            </EmptyState>
          ) : (
            <div className="matrix-scroll">
              <table className="adoption-matrix">
                <caption className="u-visually-hidden">
                  Which storage advertises which version of {system.label}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="am-corner">
                      Advertising storage
                    </th>
                    {versions.map((col) => (
                      <th key={col.version.iri} scope="col" className="am-version">
                        <span className="am-version-label">{col.version.label}</span>
                        <StatusBadge column={col} />
                        {col.version.note && (
                          <span className="am-version-note">{col.version.note}</span>
                        )}
                        <span className="am-version-count">
                          {col.parties.length} of ≥{DEFAULT_ADOPTION_BAR} advertising{" "}
                          {col.parties.length === 1 ? "party" : "parties"}
                        </span>
                        {col.observations.length === 0 && (
                          <span className="am-none">No advertisers observed.</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advertisers.map((party) => (
                    <tr key={party}>
                      <th scope="row" className="am-party">
                        <span className="data">{party}</span>
                      </th>
                      {versions.map((col) => {
                        const obs = cellObservations(col, party);
                        return (
                          <td
                            key={col.version.iri}
                            className={obs.length > 0 ? "am-cell am-yes" : "am-cell am-no"}
                          >
                            {obs.length > 0 ? (
                              obs.map((o) => (
                                <span key={`${o.party} ${o.source}`} className="am-obs">
                                  <span className="am-check" aria-hidden="true">
                                    ✓
                                  </span>
                                  <a href={o.source} rel="noopener noreferrer" target="_blank">
                                    re-check
                                  </a>
                                  <span className="when">obs. {o.observedAt.slice(0, 10)}</span>
                                </span>
                              ))
                            ) : (
                              <span className="am-dash" role="img" aria-label="not advertised">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
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
        <Panel>
          <SectionHeader title="Observed versions outside the governed lineages" />
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
        </Panel>
      )}

      {(activeSnapshot?.errors.length ?? 0) > 0 && (
        <Panel>
          <SectionHeader title="Sources that could not be observed" />
          <ul>
            {(activeSnapshot?.errors ?? []).map((e) => (
              <li key={e.source} className="muted small">
                <span className="data">{e.source}</span> — {e.message}
              </li>
            ))}
          </ul>
        </Panel>
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
          onChange={(e) => setEdited({ key: configKey, text: e.target.value })}
          placeholder="https://storage.example/.well-known/fedreg.ttl"
        />
      </label>
    </section>
  );
}
