// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The ODRL consent panel (design/01 "The ODRL consent layer"). When a participant
// submits a need it leaves their pod as aggregate signal; this panel surfaces —
// and lets them set — WHAT the deliberation federation may do with it and WITH
// WHOM, stored as an @jeswr/solid-odrl policy alongside the need. Conservative by
// default (aggregate + synthesize; quote-verbatim + government-use off).
//
// Presentational + controlled: it owns no state (Compose does), so it is trivially
// testable and reusable on the resonance path later.

import { CONSENT_ACTIONS, type ConsentPolicy } from "../../lib/consent.js";

/** Short, human descriptions of what each consent action permits. */
const ACTION_HELP: Record<string, string> = {
  aggregate:
    "Counted in the deliberation's opinion map + metrics — only ever in aggregate (k-anonymous).",
  synthesize:
    "May inform a synthesized shared-future statement (you're credited in its provenance).",
  quoteVerbatim: "May be quoted word-for-word in a synthesis or dissent record.",
  governmentUse: "Derived results may be forwarded into governance / policy reporting.",
};

export function ConsentPanel({
  value,
  onChange,
  deliberation,
}: {
  value: ConsentPolicy;
  onChange: (next: ConsentPolicy) => void;
  deliberation: string;
}): React.JSX.Element {
  return (
    <fieldset className="consent">
      <legend>Consent — what may be done with this need</legend>
      <p className="muted small">
        This need stays in <strong>your pod</strong>. These choices are stored with it as a usage
        policy the deliberation (<code>{deliberation}</code>) and its facilitation services must
        honour. Defaults are conservative; you can grant more.
      </p>

      {CONSENT_ACTIONS.map((a) => (
        <label className="consent-row" key={a.key}>
          <input
            type="checkbox"
            checked={value[a.key]}
            onChange={(e) => onChange({ ...value, [a.key]: e.target.checked })}
          />
          <span>
            <strong>{a.label}</strong>
            <span className="muted small"> — {ACTION_HELP[a.key]}</span>
          </span>
        </label>
      ))}

      <label className="field consent-k">
        <span>Minimum contributors before any derived result is published (k-anonymity)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={value.kThreshold}
          onChange={(e) => {
            // Number() (not parseInt) so "1.5" is NOT silently truncated to 1 —
            // a non-integer / sub-1 value keeps the previous threshold.
            const n = Number(e.target.value);
            onChange({
              ...value,
              kThreshold: Number.isInteger(n) && n >= 1 ? n : value.kThreshold,
            });
          }}
        />
      </label>
    </fieldset>
  );
}
