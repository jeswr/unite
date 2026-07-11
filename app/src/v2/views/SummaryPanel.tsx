// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The LIVING SUMMARY panel (design/v2 02 §6): "what this circle is figuring
// out" — consented, attributed words; verdicts community-scale; NO tallies,
// NO splits (the two-scale rule is structural in v2/summary.ts). The differ
// block renders with the SAME visual warmth as agreement (P7 — the same card,
// a different heading, never a warning colour), and every machine-made line
// carries its quiet seam.

import { displayName } from "../../ui/hooks.js";
import { TAP_ACK } from "../private-tap.js";
import { differSeam, stillFormingSeam } from "../seams.js";
import type { LivingSummary, SummaryLine } from "../summary.js";

function Line({
  line,
  onPrivateTap,
  tapped,
}: {
  line: SummaryLine;
  /** The private "actually, I don't" tap (03 §4) — circling lines only. */
  onPrivateTap?: ((statement: string) => void) | undefined;
  tapped?: boolean | undefined;
}): React.JSX.Element {
  return (
    <li>
      “{line.words}” <span className="muted small">— {displayName(line.author)}</span>
      {!line.heardFromViewer && (
        <span className="muted small"> · we haven't heard you on this one — no pressure</span>
      )}
      {onPrivateTap !== undefined && !tapped && (
        <>
          {" "}
          <button type="button" className="v2-seam" onClick={() => onPrivateTap(line.statement)}>
            actually, I don't (private)
          </button>
        </>
      )}
      {/* The ack renders to the tapper ONLY — it is component state, written
          nowhere the circle reads; the tap itself lives in the separate
          signal store and changes nothing this panel computes (03 §4). */}
      {tapped === true && <p className="v2-seam-text">{TAP_ACK}</p>}
    </li>
  );
}

export function SummaryPanel({
  summary,
  onPrivateTap,
  privatelyTapped,
}: {
  summary: LivingSummary;
  onPrivateTap?: ((statement: string) => void) | undefined;
  privatelyTapped?: ReadonlySet<string> | undefined;
}): React.JSX.Element | null {
  const empty =
    summary.circling.length === 0 && summary.differ.length === 0 && summary.forming.length === 0;
  if (empty) return null;
  return (
    <div className="v2-summary">
      <h3>What this circle is figuring out</h3>
      {summary.circling.length > 0 && (
        <>
          <p className="muted small">We're circling agreement on:</p>
          <ul>
            {summary.circling.map((l) => (
              <Line
                key={l.statement}
                line={l}
                onPrivateTap={onPrivateTap}
                tapped={privatelyTapped?.has(l.statement)}
              />
            ))}
          </ul>
        </>
      )}
      {/* MANDATORY whenever the engine computes a disagreement (P7) — and
          rendered with the same warmth as agreement, never a warning. */}
      {summary.differ.length > 0 && (
        <>
          <p className="muted small">
            <strong>Where we genuinely differ:</strong>
          </p>
          <ul>
            {summary.differ.map((l) => (
              <Line key={l.statement} line={l} />
            ))}
          </ul>
          <p className="v2-seam-text">
            {differSeam()} <a href="#/how">the long version →</a>
          </p>
        </>
      )}
      {summary.forming.length > 0 && (
        <>
          <p className="muted small">Still forming:</p>
          <ul>
            {summary.forming.map((l) => (
              <Line key={l.statement} line={l} />
            ))}
          </ul>
          <p className="v2-seam-text">
            {stillFormingSeam()} <a href="#/how">the long version →</a>
          </p>
        </>
      )}
    </div>
  );
}
