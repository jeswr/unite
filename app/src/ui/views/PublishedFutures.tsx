// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.5 — the Published-futures renderer (docs/design/next-phases.md §2.4, §2.6
// (5)): the LAST unbuilt scope-C surface (it was the only PreviewView placeholder
// left). It renders a signed fut:SharedFuture ONLY with its full legitimacy
// evidence — the mandatory dissent annex, the recomputable bridging evidence, the
// verified ≥2-steward integrity proof, and the method-provenance label — and a
// DISAGREEMENT MAP is a CO-EQUAL published outcome, never a failure banner
// (design/03 §4 (5)). The machinery (lib/shared-future + lib/quorum + lib/dissent
// + lib/convergence-metrics) is real and exhaustively tested; this view is the
// honest window onto it, showing an honest "nothing signed yet" empty until the
// steward signing surface (S5.4) feeds it — never a faked or relabelled surface.

import type { ClusterBridgingEvidence } from "../../lib/adoption-decision.js";
import type { DissentRecord } from "../../lib/dissent.js";
import {
  METHOD_MEDIATED_SYNTHESIS,
  METHOD_MINI_PUBLIC,
  METHOD_RESONANCE_MAPPING,
} from "../../lib/fut-society.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { EmptyState, SectionHeader, ViewHeader } from "../components.js";

// The no-single-owner floor (lib/quorum QUORUM_FLOOR = 2, INV-5). Duplicated as a
// plain literal HERE rather than imported, so this browser view never pulls
// lib/quorum's `@jeswr/solid-vc` (node-only crypto/undici) dep chain into the
// client bundle — verification is a lib/server concern, never the renderer's.
const NO_SINGLE_OWNER_FLOOR = 2;

/** The human label for a coded `fut:methodProvenance` concept (design/03 §5). */
const METHOD_LABELS: Readonly<Record<string, string>> = {
  [METHOD_RESONANCE_MAPPING]:
    "resonance mapping — a self-selected resonance map; it informs, it is not a representative sample",
  [METHOD_MEDIATED_SYNTHESIS]:
    "mediated synthesis — an attributed facilitator/model produced this draft; advisory only",
  [METHOD_MINI_PUBLIC]: "mini-public — a sortition-selected deliberating cohort",
};

/** The render view-model for one published shared future (or disagreement map). */
export interface PublishedFutureView {
  readonly id: string;
  readonly title?: string;
  readonly content: string;
  /** The coded `fut:methodProvenance` IRI (D4). */
  readonly methodProvenance: string;
  /** The per-cluster common-ground proof (recomputable, D3). */
  readonly bridgingEvidence: readonly ClusterBridgingEvidence[];
  /** The materialised dissent annex (verbatim + aggregate records). */
  readonly dissent: readonly DissentRecord[];
  /** True when the annex is the explicit `fut:noDissentRecorded true` (empty dissent). */
  readonly noDissentRecorded: boolean;
  /** The number of DISTINCT verified stewards who signed. */
  readonly distinctStewards: number;
  /** The community's steward floor (≥ 2, the no-single-owner floor). */
  readonly stewardFloor: number;
  /** True iff the ≥floor quorum is met (a verified integrity proof). */
  readonly quorumMet: boolean;
  /** True on the single-steward bootstrapping state (honest "1 of ≥2"). */
  readonly bootstrapping: boolean;
  /** True iff any published convergence metrics are k-anonymous (≥ k). */
  readonly kAnonymous: boolean;
  /** Whether this is an endorsed shared future or a co-equal disagreement map. */
  readonly kind: "shared-future" | "disagreement-map";
}

function methodLabel(iri: string): string {
  return METHOD_LABELS[iri] ?? "method recorded";
}

function BridgingBar({ evidence }: { evidence: ClusterBridgingEvidence }): React.JSX.Element {
  const { seenCount, resonatesCount, conflictsCount, unsureCount } = evidence;
  const pct = (n: number) => (seenCount > 0 ? Math.round((n / seenCount) * 100) : 0);
  return (
    <div className="field">
      <span className="small">
        {evidence.clusterLabel} <span className="hint">— {seenCount} saw it</span>
      </span>
      <div
        className="dist-counts"
        role="img"
        aria-label={`${resonatesCount} resonated, ${conflictsCount} conflicted, ${unsureCount} unsure`}
      >
        <span className="badge res">{pct(resonatesCount)}% resonate</span>{" "}
        <span className="badge con">{pct(conflictsCount)}% conflict</span>{" "}
        <span className="badge">{pct(unsureCount)}% unsure</span>
      </div>
    </div>
  );
}

function PublishedFutureCard({ item }: { item: PublishedFutureView }): React.JSX.Element {
  const endorsed = item.kind === "shared-future";
  // Defend the display invariant regardless of the item's claimed values: the floor
  // is NEVER below the no-single-owner floor, and "verified" requires the ACTUAL
  // distinct-steward count to meet that normalised floor (so a caller cannot render
  // "integrity proof verified" for e.g. 1 of ≥1 — the ≥2 floor is not lowerable here).
  const floor = Math.max(item.stewardFloor, NO_SINGLE_OWNER_FLOOR);
  const verified = item.quorumMet && item.distinctStewards >= floor;
  const bootstrapping = !verified && item.distinctStewards >= 1 && item.distinctStewards < floor;
  return (
    <article
      className="panel"
      aria-label={endorsed ? "published shared future" : "published disagreement map"}
    >
      <SectionHeader title={item.title ?? (endorsed ? "A shared future" : "A disagreement map")} />
      <p>
        {endorsed ? (
          <span className="badge res">shared future</span>
        ) : (
          <span className="badge con">disagreement map — a first-class outcome</span>
        )}
      </p>
      <p>{item.content}</p>

      {/* The verified integrity proof — the ≥2-steward quorum (honest when unmet). */}
      <div className="field">
        <span>Steward signatures</span>
        <p className="muted small">
          {verified ? (
            <span className="badge res">
              {item.distinctStewards} of ≥{floor} — integrity proof verified
            </span>
          ) : (
            <span className="badge con">
              {item.distinctStewards} of ≥{floor}
              {bootstrapping
                ? " — bootstrapping: single-steward, not yet published"
                : " — quorum unmet"}
            </span>
          )}{" "}
          A shared future publishes only with at least {floor} distinct steward Data-Integrity
          signatures over its exact content digest — never by silently lowering the floor.
        </p>
      </div>

      {/* The mandatory dissent annex — carried permanently, never smoothed away. */}
      <div className="field">
        <span>
          Dissent annex <span className="hint">— mandatory on every published output</span>
        </span>
        {item.noDissentRecorded ? (
          <p className="muted small">
            <code>fut:noDissentRecorded true</code> — no critique stood at endorsement; silence is
            recorded explicitly, never assumed to be consensus.
          </p>
        ) : (
          <ul className="participant-list">
            {item.dissent.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the annex is a fixed, ordered list — the index IS a stable record identity within this render.
              <li key={`${item.id}-dissent-${i}`} className="small">
                {d.verbatim ? (
                  <>
                    <span className="badge">quoted (author consented)</span> {d.content}
                  </>
                ) : (
                  <>
                    <span className="badge">in aggregate</span> {d.content}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The recomputable common-ground proof. */}
      <div className="field">
        <span>
          Bridging evidence <span className="hint">— recompute it from the raw counts</span>
        </span>
        {item.bridgingEvidence.map((be) => (
          <BridgingBar key={`${item.id}-${be.clusterLabel}`} evidence={be} />
        ))}
      </div>

      <p className="muted small">
        <span className="badge">method: {methodLabel(item.methodProvenance)}</span>{" "}
        {item.kAnonymous ? (
          <span className="badge res">k-anonymous metrics</span>
        ) : (
          <span className="badge con">metrics withheld (sub-k)</span>
        )}
      </p>
    </article>
  );
}

/**
 * The Published-futures view. Renders every signed shared future / disagreement
 * map with its full legitimacy evidence, or an honest empty when none are signed
 * yet (the steward signing surface is S5.4 — until it feeds this view, the scope
 * stays honestly labelled, never faked).
 */
export function PublishedFutures({
  scope,
  futures = [],
}: {
  scope: ScopeConfig;
  futures?: readonly PublishedFutureView[];
}): React.JSX.Element {
  const floor = Math.max(scope.endorsementGate.stewardSignatures, NO_SINGLE_OWNER_FLOOR);
  return (
    <section className="view">
      <ViewHeader
        title="Published futures"
        lede={
          <>
            Signed shared futures and disagreement maps — each rendered only with its verified
            integrity proof (≥{floor} steward signatures), its mandatory dissent annex, its
            recomputable bridging evidence and its method-provenance label. A disagreement map is
            published with the same care as any endorsement.
          </>
        }
      />

      {futures.length === 0 ? (
        <EmptyState
          title="No published futures"
          badge={<span className="badge">nothing signed yet — and not faked</span>}
        >
          <p className="muted small">
            The signing machinery is built and tested: a synthesis is <strong>un-signable</strong>{" "}
            if it drops a standing critique, a sub-quorum or sub-k-anonymous artifact never
            ratifies, and every signature is a verified Data-Integrity proof over the exact content
            digest. The steward signing surface (which turns an endorsed room outcome into a signed
            artifact) lands next; until a community signs one here, this view stays honestly empty
            rather than rendering a placeholder as if it were real.
          </p>
        </EmptyState>
      ) : (
        <div className="cards">
          {futures.map((f) => (
            <PublishedFutureCard key={f.id} item={f} />
          ))}
        </div>
      )}
    </section>
  );
}
