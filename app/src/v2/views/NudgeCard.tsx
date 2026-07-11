// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE PRIVATE ACTION-TEAM NUDGE (design/v2 05 §3): rendered ONLY to a named
// recipient (v2/nudge.ts nudgeFor — a non-recipient's render is nothing,
// structurally), at most once per theme per person (the session memory is
// marked the moment the card first computes), carrying the strongest seam in
// the system: "why me?" opens the viewer's OWN matched turns — never anyone
// else's — plus the three standing promises, stated in the nudge itself.
// Declining is sticky and consequence-free: nothing is written, nothing is
// shown to anyone else, and the theme never re-asks.

import { useEffect, useState } from "react";
import type { ConversationTurn } from "../../lib/questions.js";
import { markThemeSeen, type NudgeView, nudgeFor, seenThemes } from "../nudge.js";

export function NudgeCard({
  identity,
  turns,
}: {
  identity: string;
  turns: readonly ConversationTurn[];
}): React.JSX.Element | null {
  const [nudge, setNudge] = useState<NudgeView | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (nudge !== null) return; // once per mount; the memory guards remounts
    const found = nudgeFor(identity, turns, seenThemes());
    if (found !== null) {
      markThemeSeen(identity, found.themeKey); // once per theme per PERSON
      setNudge(found);
    }
  }, [identity, turns, nudge]);

  if (nudge === null) return null;
  if (answered) {
    return (
      <p className="muted small">
        Noted — and that's the last of it. Nothing was shown to anyone else either way.
      </p>
    );
  }
  return (
    <section className="v2-summary v2-nudge" aria-label="a private nudge — only you see this">
      <h3>Quietly, just to the few of you</h3>
      <p className="small">{nudge.ask}</p>
      <p className="muted small">{nudge.promises}</p>
      <details>
        <summary className="v2-seam">why me?</summary>
        <p className="muted small">
          Because of your own turns, literally these — nothing else and nobody else's:
        </p>
        <ul>
          {nudge.yourOffers.map((o) => (
            <li key={`${o.turnId}-${o.kind}`} className="muted small">
              “{o.sentence}”{" "}
              <span className="v2-seam-text">
                matched as {o.kind}: “{o.term}”
              </span>
            </li>
          ))}
          {nudge.yourTurnIds.length > 0 && (
            <li className="muted small">
              …and you came back to this theme in {nudge.yourTurnIds.length} turn
              {nudge.yourTurnIds.length === 1 ? "" : "s"} of the conversation above.
            </li>
          )}
        </ul>
      </details>
      <div className="v2-chips">
        <button type="button" className="v2-chip" onClick={() => setAnswered(true)}>
          I'm in — let's sort a time in the circle
        </button>
        <button type="button" className="v2-chip" onClick={() => setAnswered(true)}>
          Not for me
        </button>
      </div>
    </section>
  );
}
