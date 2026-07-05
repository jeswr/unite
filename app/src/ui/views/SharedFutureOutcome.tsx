// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C output presentation (S4 — docs/SCOPE-DIFFERENTIATION.md §4.5;
// the Room's outputKind seam for "advisory-synthesis"): COMPUTE + PRESENT
// what publication will be, ahead of the S5 signing pipeline. Everything here
// is computed, never asserted (the Convergence Room's posture):
//
//   • ENDORSED → a fut:SharedFuture draft: mandatory dissent annex (the
//     standing critiques ARE its raw material; an empty annex requires the
//     EXPLICIT fut:noDissentRecorded assertion — silence is never consensus),
//     a method-provenance label, and the ≥2-steward signature requirement
//     shown honestly as UNMET (the signing UI lands in S5).
//   • DISAGREEMENT → the CO-EQUAL outcome: the disagreement map gets the SAME
//     publication framing, not a failure banner (design/03 §4 (5)).
//   • No executor either way: publication is the output; institutions and
//     humans decide (critique C8).

import type { CandidateReception } from "../../lib/convergence.js";
import type { Critique } from "../../lib/model.js";
import type { ScopeConfig } from "../../scope/scopes.js";
import { SectionHeader } from "../components.js";

/** The §4.4 method-provenance label for the Stage-1 method (resonance mapping). */
export const METHOD_PROVENANCE_LABEL =
  "method: resonance mapping — a self-selected resonance map; it informs, it is not a representative sample";

export function SharedFutureOutcome({
  scope,
  reception,
  critiques,
}: {
  scope: ScopeConfig;
  reception: CandidateReception;
  critiques: readonly Critique[];
}): React.JSX.Element | null {
  if (reception.outcome === "open") return null; // the round is still running
  const stewardFloor = scope.endorsementGate.stewardSignatures;
  const endorsed = reception.outcome === "endorsed";

  return (
    <section className="panel" aria-label="what publication will be">
      <SectionHeader
        title={
          endorsed
            ? "What publishes: a shared future"
            : "What publishes: the disagreement map — a first-class outcome"
        }
      />
      <p className="muted small">
        {endorsed ? (
          <>
            Every opinion group leaned positive, so this candidate is publishable as a{" "}
            <strong>shared future</strong> — with its dissent carried permanently, never smoothed
            away.
          </>
        ) : (
          <>
            The groups divide here — and that map is{" "}
            <strong>published with the same care as any endorsement</strong>: exactly where the
            community divides is a success output of the deliberation, not a failure (dissent is
            data).
          </>
        )}
      </p>

      {/* The mandatory dissent annex (SHACL: fut:dissent, or the explicit
          fut:noDissentRecorded true — an annex is never silently absent). */}
      <div className="field">
        <span>
          Dissent annex <span className="hint">— mandatory on every published output</span>
        </span>
        {critiques.length > 0 ? (
          <p className="muted small">
            {critiques.length} standing critique{critiques.length === 1 ? "" : "s"} (listed below)
            travel{critiques.length === 1 ? "s" : ""} with the publication as its dissent annex —
            whatever stands at signing time is carried verbatim only where its author consented
            (fut:quoteVerbatim), in aggregate otherwise.
          </p>
        ) : (
          <p className="muted small">
            No standing critiques: publication would carry the EXPLICIT assertion{" "}
            <code>fut:noDissentRecorded true</code> — silence is never treated as consensus.
          </p>
        )}
      </div>

      {/* Signing status — computed + presented honestly; the signing UI is S5. */}
      <div className="field">
        <span>Steward signatures</span>
        <p className="muted small">
          <span className="badge con">0 of ≥{stewardFloor} required</span> A shared future (or
          disagreement map) publishes only with at least {stewardFloor} steward Data-Integrity
          signatures. The signing surface arrives in <strong>S5</strong> — until then this outcome
          is computed and presented, not published.
        </p>
      </div>

      <p className="muted small">
        <span className="badge">{METHOD_PROVENANCE_LABEL}</span>
      </p>
      <p className="muted small">
        Nothing executes from this scope: publication <em>is</em> the output — institutions and
        humans decide. The per-group reception above is the bridging evidence any consumer can
        recompute from the votes.
      </p>
    </section>
  );
}
