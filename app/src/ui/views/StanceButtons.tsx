// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The shared tri-state reaction control (S1): one voice per person per
// statement, written to the reactor's OWN pod via writeResonance — the same
// mechanism everywhere a statement can be reacted to (needs board, proposals,
// the Convergence Room's endorsement round; design/01: endorsement votes ARE
// ordinary fut:Resonances on the candidate). Tier-gated like every write.

import { useMemo, useState } from "react";
import { STANCE_CONFLICTS, STANCE_RESONATES, STANCE_UNSURE, type Stance } from "../../lib/fut.js";
import type { Resonance } from "../../lib/model.js";
import { writeResonance } from "../../lib/pod.js";
import { meetsTier } from "../../lib/trust.js";
import { useController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { writeSessionFor } from "../hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";
import { tallyResonances } from "./NeedsBoard.js";

const STANCE_META: { stance: Stance; label: string; glyph: string; cls: string }[] = [
  { stance: STANCE_RESONATES, label: "Resonates", glyph: "✓", cls: "res" },
  { stance: STANCE_CONFLICTS, label: "Conflicts", glyph: "✕", cls: "con" },
  { stance: STANCE_UNSURE, label: "Unsure", glyph: "?", cls: "uns" },
];

export function StanceButtons({
  statement,
  config,
  webId,
  trust,
  aggregate,
  labels,
}: {
  /** The statement being reacted to (a need / proposal / candidate IRI). */
  statement: string;
  config: DeliberationConfig;
  webId: string | null;
  trust: SessionTrust;
  aggregate: AggregateState;
  /** Optional stance-label overrides (the room says "Endorse" for resonates). */
  labels?: Partial<Record<Stance, string>>;
}): React.JSX.Element {
  const controller = useController();
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const identity = sessionIdentity(config, webId);
  const floor = config.participationFloor;
  const canReact = floor === 0 || (trust.profile !== null && meetsTier(trust.profile, floor));

  const tally = useMemo(
    () => tallyResonances(aggregate.result?.resonances ?? [], identity).get(statement),
    [aggregate.result, identity, statement],
  );

  async function react(stance: Stance): Promise<void> {
    setWriteError(null);
    if (!identity) {
      setWriteError("Sign in to react — your reaction is stored in your own pod.");
      return;
    }
    if (!canReact) {
      setWriteError(
        `Reacting here requires identity tier T${floor} (a vouched membership) — see the Trust view.`,
      );
      return;
    }
    setBusy(true);
    try {
      const session = await writeSessionFor(config, controller, webId);
      const resonance: Omit<Resonance, "id"> = {
        onStatement: statement,
        stance,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: config.deliberation,
      };
      await writeResonance(session.fetch, session.ownBase, resonance);
      await aggregate.refresh();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="stances">
        {STANCE_META.map(({ stance, label, glyph, cls }) => (
          <button
            type="button"
            key={stance}
            className={`stance ${cls}`}
            aria-pressed={tally?.yours === stance}
            disabled={busy || !canReact}
            title={
              canReact
                ? undefined
                : `Reacting requires a vouched membership (T${floor}) in this scope`
            }
            onClick={() => react(stance)}
          >
            <span aria-hidden="true">{glyph}</span> {labels?.[stance] ?? label}
            <span className="n">
              {stance === STANCE_RESONATES
                ? (tally?.resonates ?? 0)
                : stance === STANCE_CONFLICTS
                  ? (tally?.conflicts ?? 0)
                  : (tally?.unsure ?? 0)}
            </span>
          </button>
        ))}
        {tally?.yours && <span className="yours">your current reaction is marked</span>}
      </div>
      {writeError && <p className="notice error">{writeError}</p>}
    </div>
  );
}
