// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE EXPERT MOMENT (design/v2 05 §1–2, 02 §7): rendered ONLY once the
// circle's own conversation has produced a stable recurring question
// (v2/expert.ts stableQuestion — absent question, absent affordance,
// structurally). The sequence, in the open:
//
//   1. the in-context CONSENT moment (02 §7's exact shape): what the expert
//      would see, asked at the moment it matters, written to the person's
//      own pod as an ODRL policy; a "no" is respected and never re-asked;
//   2. the introduction (05 §2's register) + the TIER-HONEST chip;
//   3. the reply — options-with-trade-offs, in-thread, reply-only (asking,
//      ranking and voting do not exist on the expert's side of the surface).
//
// The demo's expert is a persona and is labeled demo voice (06 §2).

import { useEffect, useState } from "react";
import type { ConversationTurn } from "../../lib/questions.js";
import { useController } from "../../ui/auth.js";
import { writeSessionFor } from "../../ui/hooks.js";
import type { DeliberationConfig } from "../../ui/state.js";
import { decisionFor, recordConsentDecision, rememberDecision } from "../consent-moments.js";
import { DEMO_VOICE_LABEL } from "../demo-scribe.js";
import {
  EXPERT_SEES,
  expertConsentAsk,
  expertIntro,
  MARIA,
  MARIA_REPLY,
  stableQuestion,
} from "../expert.js";
import { ExpertChip } from "./ExpertChip.js";
import { Notetaker } from "./Notetaker.js";

export function ExpertMoment({
  turns,
  identity,
  config,
  /** The visitor's own contribution the consent is about (null = none yet). */
  aboutResource,
}: {
  turns: readonly ConversationTurn[];
  identity: string;
  config: DeliberationConfig;
  aboutResource: string | null;
}): React.JSX.Element | null {
  const controller = useController();
  const question = stableQuestion(turns, MARIA);
  const key = question === null ? null : `expert:${question.theme.join("+")}`;
  const [decision, setDecision] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (key !== null) setDecision(decisionFor(key));
  }, [key]);

  // The timing rule is structural: no stable question, no affordance (05 §1).
  if (question === null || key === null) return null;

  const gloss = question.instances[0] ? `“${question.instances[0].text}”` : "a costing question";

  async function decide(granted: boolean): Promise<void> {
    if (key === null) return;
    setError(null);
    // The pod write comes FIRST (02 §7: the answer is recorded, durably, in
    // the person's own pod) — only a successful record advances the flow. On
    // failure the ask stays on screen and nothing is remembered: an
    // unrecorded consent must not unlock (or lock) anything.
    if (aboutResource !== null) {
      try {
        const session = await writeSessionFor(config, controller, null);
        await recordConsentDecision(session.fetch, session.ownBase, {
          about: aboutResource,
          asked: expertConsentAsk(MARIA),
          granted,
          creator: identity,
          created: new Date().toISOString(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return; // the consent prompt stays; the decision did not happen
      }
    }
    rememberDecision(key, granted);
    setDecision(granted);
  }

  // Nothing of the visitor's exists yet → nothing of theirs travels, so no
  // consent is owed; the introduction can stand on the circle's own question.
  const needsConsent = aboutResource !== null && decision === undefined;

  return (
    <section className="v2-expert" aria-label="an expert joins">
      {needsConsent ? (
        <>
          <Notetaker text={expertConsentAsk(MARIA)} />
          <div className="v2-chips" style={{ marginLeft: "2.2rem" }}>
            <button type="button" className="v2-chip" onClick={() => void decide(true)}>
              Okay — she can see the question and the summary
            </button>
            <button type="button" className="v2-chip" onClick={() => void decide(false)}>
              No — keep mine in the circle
            </button>
          </div>
          <p className="v2-seam-text" style={{ marginLeft: "2.2rem" }}>
            Your answer is recorded in your own pod, and this surface obeys it: a no means nothing
            of yours reaches her — the question proceeds on what others consented to. A no is never
            asked again. <a href="#/how">the long version →</a>
          </p>
        </>
      ) : decision === false ? (
        <Notetaker text="Kept in the circle — the question can still go forward from what others consented to. That's the end of the asking." />
      ) : (
        <>
          <Notetaker text={expertIntro(MARIA, gloss)} />
          <div className="v2-mirror">
            <ExpertChip expert={MARIA} />
            <p className="v2-msg-who">
              {MARIA.name} <span className="badge demo">{DEMO_VOICE_LABEL}</span>
            </p>
            <p className="v2-msg-text">{MARIA_REPLY}</p>
            <p className="v2-seam-text">
              Why her, why now? The circle's own recurring question matched her experience, and the
              invitation was a steward's. {EXPERT_SEES} She can only reply in this thread — opening
              topics, ranking and voting don't exist on her side of the surface.{" "}
              <a href="#/how">the long version →</a>
            </p>
          </div>
        </>
      )}
      {error && <p className="notice error">{error}</p>}
    </section>
  );
}
