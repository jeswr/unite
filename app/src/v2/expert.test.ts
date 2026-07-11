// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// EXPERT-surface fixtures (design/v2 05 §1–2, 07 §5): the expert affordance
// is ABSENT pre-stable-question (structural — stableQuestion returns null
// until the room's own conversation recurs on an answerable question that
// matches the expert), and the chip is TIER-HONEST: steward-invited carries
// no checkmark; institution-attested names its issuer.

import { describe, expect, it } from "vitest";
import type { ConversationTurn } from "../lib/questions.js";
import {
  type ExpertRecord,
  expertChipLabel,
  expertChipSeam,
  MARIA,
  stableQuestion,
} from "./expert.js";

function turn(id: string, author: string, text: string): ConversationTurn {
  return { id, author, text, created: `2026-06-2${id.length % 10}T00:00:00Z` };
}

describe("stableQuestion — the timing rule is structural (05 §1)", () => {
  it("no conversation → no affordance", () => {
    expect(stableQuestion([], MARIA)).toBeNull();
  });

  it("one asking turn is not a STABLE question (recurrence floor 2)", () => {
    expect(
      stableQuestion([turn("t1", "a", "What would a raised crossing cost?")], MARIA),
    ).toBeNull();
  });

  it("statements without interrogative form never summon an expert", () => {
    expect(
      stableQuestion(
        [
          turn("t1", "a", "The crossing cost is a real worry."),
          turn("t2", "b", "The crossing cost keeps coming up."),
        ],
        MARIA,
      ),
    ).toBeNull();
  });

  it("a recurring answerable question MATCHING the expert surfaces", () => {
    const q = stableQuestion(
      [
        turn("t1", "a", "What would a raised crossing actually cost?"),
        turn("t2", "b", "What does a proper crossing cost, and who pays?"),
      ],
      MARIA,
    );
    expect(q).not.toBeNull();
    expect(q?.theme).toContain("crossing");
    expect(q?.turnCount).toBe(2);
  });

  it("a recurring question OUTSIDE the expert's experience stays unmatched", () => {
    const q = stableQuestion(
      [
        turn("t1", "a", "What time does the library open on Sundays?"),
        turn("t2", "b", "Seriously, what time does the library open?"),
      ],
      MARIA,
    );
    expect(q).toBeNull();
  });
});

describe("the two-tier chip — never stronger than its issuer (05 §2)", () => {
  const attested: ExpertRecord = {
    name: "Maria",
    experience: "8 years",
    tier: "institution-attested",
    issuer: "Anytown Council",
    matches: [],
    demoVoice: false,
  };

  it("steward-invited carries NO checkmark — a social vouch, name-backed", () => {
    const label = expertChipLabel(MARIA);
    expect(label).toContain("invited by your stewards");
    expect(label).not.toContain("✓");
    expect(expertChipSeam(MARIA)).toContain("won't fake a checkmark");
  });

  it("institution-attested names its issuer, in the chip AND the seam", () => {
    expect(expertChipLabel(attested)).toBe("attested by Anytown Council — checkable ✓");
    expect(expertChipSeam(attested)).toContain("Anytown Council");
  });

  it("an attested record WITHOUT an issuer falls back to the vouch — no unbacked ✓", () => {
    const { issuer: _drop, ...noIssuer } = attested;
    expect(expertChipLabel(noIssuer)).not.toContain("✓");
  });
});
