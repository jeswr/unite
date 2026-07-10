// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The reaction row (design/v2 02 §3): the v1 tri-state resonance worn as
// three warm labels on a message — a reaction, not a ballot. Writes the SAME
// fut:Resonance through the SAME writeResonance path as every v1 surface
// (latest-wins dedupe is the aggregate's standing rule), with the optional
// one-tap qualifier mapping to the v1 dimension triple in human words.
// "I see it differently" is always followed by a pressure-free invitation.
//
// ELICIT-BEFORE-EXPOSE (P4, 03 §5): this row shows NO distribution before the
// viewer's own reaction — the post-reaction reveal is the Distribution
// component's job (V2), mounted by the parent AFTER `yours` is set.

import { useState } from "react";
import {
  DIM_ASPIRE,
  DIM_SHARE,
  DIM_SUPPORT,
  type Dimension,
  STANCE_CONFLICTS,
  STANCE_RESONATES,
  STANCE_UNSURE,
  type Stance,
} from "../../lib/fut.js";
import type { Resonance } from "../../lib/model.js";
import { writeResonance } from "../../lib/pod.js";
import { DIVERGENCE_INVITE, QUALIFIER_LABELS, REACTION_LABELS } from "../script.js";

const REACTIONS: { stance: Stance; label: string }[] = [
  { stance: STANCE_RESONATES, label: REACTION_LABELS.resonates },
  { stance: STANCE_UNSURE, label: REACTION_LABELS.unsure },
  { stance: STANCE_CONFLICTS, label: REACTION_LABELS.conflicts },
];

const QUALIFIERS: { dimension: Dimension; label: string }[] = [
  { dimension: DIM_SHARE, label: QUALIFIER_LABELS.share },
  { dimension: DIM_ASPIRE, label: QUALIFIER_LABELS.aspire },
  { dimension: DIM_SUPPORT, label: QUALIFIER_LABELS.support },
];

export function ReactionRow({
  statement,
  fetchFn,
  ownBase,
  identity,
  deliberation,
  yours,
  onReacted,
  onStanceChosen,
  children,
}: {
  /** The statement IRI being reacted to. */
  statement: string;
  /** The session write fetch (demo pod fetch / authenticated fetch). */
  fetchFn: typeof fetch;
  ownBase: string;
  identity: string;
  deliberation: string;
  /** The viewer's current stance on this statement (null = not yet reacted). */
  yours: Stance | null;
  onReacted: () => void | Promise<void>;
  /** Called with the stance the viewer chose (parents key P4 reveals off it). */
  onStanceChosen?: (stance: Stance) => void;
  /** Rendered ONLY post-reaction (the Distribution slot — P4). */
  children?: React.ReactNode;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualified, setQualified] = useState<Dimension | null>(null);

  async function react(stance: Stance, dimension?: Dimension): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const resonance: Omit<Resonance, "id"> = {
        onStatement: statement,
        stance,
        created: new Date().toISOString(),
        creator: identity,
        inDeliberation: deliberation,
        ...(dimension !== undefined ? { dimension } : {}),
      };
      await writeResonance(fetchFn, ownBase, resonance);
      if (dimension !== undefined) setQualified(dimension);
      onStanceChosen?.(stance);
      await onReacted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <fieldset className="v2-chips v2-fieldset">
        <legend className="visually-hidden">your reaction</legend>
        {REACTIONS.map((r) => (
          <button
            type="button"
            key={r.stance}
            className="v2-chip"
            aria-pressed={yours === r.stance}
            disabled={busy}
            onClick={() => react(r.stance)}
          >
            {r.label}
          </button>
        ))}
      </fieldset>
      {yours === STANCE_RESONATES && (
        <fieldset className="v2-chips v2-fieldset">
          <legend className="visually-hidden">optional — say which way it lands</legend>
          {QUALIFIERS.map((q) => (
            <button
              type="button"
              key={q.dimension}
              className="v2-chip"
              aria-pressed={qualified === q.dimension}
              disabled={busy}
              onClick={() => react(STANCE_RESONATES, q.dimension)}
            >
              {q.label}
            </button>
          ))}
        </fieldset>
      )}
      {yours === STANCE_CONFLICTS && <p className="muted small">{DIVERGENCE_INVITE}</p>}
      {yours !== null && children}
      {error && <p className="notice error">{error}</p>}
    </div>
  );
}
