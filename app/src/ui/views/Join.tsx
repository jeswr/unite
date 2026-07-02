// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Join view: configure the deliberation (its IRI, your own unite container, and
// the participant registry) and run a membership check via the seam. Thin over
// src/lib (buildRegistry / buildVerifier / MembershipVerifier).

import { useState } from "react";
import type { MembershipResult } from "../../lib/membership.js";
import { buildVerifier, type DeliberationConfig } from "../state.js";

export function Join({
  config,
  onChange,
  webId,
}: {
  config: DeliberationConfig;
  onChange: (next: DeliberationConfig) => void;
  webId: string | null;
}): React.JSX.Element {
  const [check, setCheck] = useState<MembershipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const participantsText = config.participants.map((p) => `${p.webId} ${p.base}`).join("\n");

  const parseParticipants = (text: string): DeliberationConfig["participants"] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [wid, base] = line.split(/\s+/);
        return { webId: wid ?? "", base: base ?? "" };
      });

  async function runCheck(): Promise<void> {
    setError(null);
    setCheck(null);
    if (!webId) {
      setError("Sign in first — your WebID is the identity the deliberation vouches.");
      return;
    }
    try {
      const verifier = buildVerifier(config);
      setCheck(await verifier.verify(webId, config.deliberation));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="view">
      <h2>Join a deliberation</h2>
      <p className="muted">
        Stage-1 gates participation on your WebID + a community-vouched membership (tier T1).
      </p>

      <label className="field">
        <span>Deliberation IRI</span>
        <input
          type="url"
          value={config.deliberation}
          onChange={(e) => onChange({ ...config, deliberation: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Your unite container (own pod, ends "/")</span>
        <input
          type="url"
          value={config.ownBase}
          onChange={(e) => onChange({ ...config, ownBase: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Participants — one "WebID base/" per line</span>
        <textarea
          rows={4}
          defaultValue={participantsText}
          onBlur={(e) => onChange({ ...config, participants: parseParticipants(e.target.value) })}
        />
      </label>

      <button type="button" className="primary" onClick={runCheck}>
        Check my membership
      </button>

      {error && <p className="error">{error}</p>}
      {check &&
        (check.ok ? (
          <p className="ok">Vouched — tier {check.tier}. You may deliberate.</p>
        ) : (
          <p className="error">Not vouched: {check.reason}</p>
        ))}
    </section>
  );
}
