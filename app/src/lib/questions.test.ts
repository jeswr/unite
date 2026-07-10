// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Question-inbox fixtures (design/v2/05 §1, 07 §5 "Determinism"): positives
// (recurring interrogative turns group into a theme, evidence-linked),
// negatives (statements, room-directed questions, sub-floor singletons,
// same-turn repetition), and characterization of the shared lexical toolkit.

import { describe, expect, it } from "vitest";
import {
  type ConversationTurn,
  contentKeywords,
  detectQuestions,
  isAnswerableQuestion,
  segmentSentences,
} from "./questions.js";

const wid = (name: string): string => `https://${name}.example/#me`;

let seq = 0;
function turn(author: string, text: string, created?: string): ConversationTurn {
  seq++;
  return {
    id: `https://c.example/circle/msg-${String(seq).padStart(3, "0")}`,
    author: wid(author),
    text,
    created: created ?? `2026-07-01T10:${String(seq).padStart(2, "0")}:00Z`,
  };
}

describe("segmentSentences", () => {
  it("splits on ./!/? and newlines, marking interrogatives", () => {
    const got = segmentSentences(
      "The mornings are chaos. Has anyone measured the traffic?\nI doubt it!",
    );
    expect(got).toEqual([
      { text: "The mornings are chaos.", interrogative: false },
      { text: "Has anyone measured the traffic?", interrogative: true },
      { text: "I doubt it!", interrogative: false },
    ]);
  });

  it("drops empty fragments and tolerates missing terminal punctuation", () => {
    expect(segmentSentences("  \n\nwhat would it cost")).toEqual([
      { text: "what would it cost", interrogative: false },
    ]);
  });
});

describe("contentKeywords", () => {
  it("drops stopwords, short tokens, and duplicates; sorts the rest", () => {
    expect(contentKeywords("What would a raised crossing actually cost? The crossing!")).toEqual([
      "cost",
      "crossing",
      "raised",
    ]);
  });

  it("keeps civic content words the themes are made of", () => {
    expect(contentKeywords("Has anyone done this for the corner garden?")).toEqual([
      "corner",
      "garden",
    ]);
  });
});

describe("isAnswerableQuestion", () => {
  it("accepts factual interrogatives and rejects room-directed ones", () => {
    const q = (text: string) => ({ text, interrogative: text.trim().endsWith("?") });
    expect(isAnswerableQuestion(q("Is that even legal?"))).toBe(true);
    expect(isAnswerableQuestion(q("What would it cost?"))).toBe(true);
    expect(isAnswerableQuestion(q("What do you think?"))).toBe(false); // the room talking to itself
    expect(isAnswerableQuestion(q("We should ask the council."))).toBe(false); // not a question
  });
});

describe("detectQuestions — positives (the question-inbox signal)", () => {
  it("groups recurring questions into one evidence-linked theme", () => {
    const t1 = turn("p1", "Has anyone actually built a raised crossing? I'd love one.");
    const t2 = turn("p2", "What would a raised crossing cost?");
    const t3 = turn("p3", "The mornings are chaos.");
    const got = detectQuestions([t1, t2, t3]);

    expect(got).toHaveLength(1);
    const q = got[0];
    expect(q?.turnCount).toBe(2);
    expect(q?.theme).toEqual(["crossing", "raised"]); // keywords recurring across ≥2 turns
    expect(q?.askers).toEqual([wid("p1"), wid("p2")]);
    expect(q?.instances.map((i) => i.turnId)).toEqual([t1.id, t2.id]); // each one linked
    expect(q?.instances[0]?.text).toBe("Has anyone actually built a raised crossing?");
  });

  it("keeps unrelated themes separate (no keyword overlap → no merge)", () => {
    const turns = [
      turn("p1", "What would the raised crossing cost?"),
      turn("p2", "How much does a raised crossing cost?"),
      turn("p3", "Where does the night bus route run?"),
      turn("p4", "Who decides the night bus route?"),
    ];
    const got = detectQuestions(turns);
    expect(got).toHaveLength(2);
    const themes = got.map((q) => q.theme.join(" "));
    expect(themes.some((t) => t.includes("crossing"))).toBe(true);
    expect(themes.some((t) => t.includes("bus"))).toBe(true);
    // and the two evidence sets do not share a single turn
    const a = new Set(got[0]?.instances.map((i) => i.turnId));
    for (const i of got[1]?.instances ?? []) expect(a.has(i.turnId)).toBe(false);
  });

  it("honours a caller-raised recurrence floor", () => {
    const turns = [
      turn("p1", "What would the raised crossing cost?"),
      turn("p2", "How much does a raised crossing cost?"),
    ];
    expect(detectQuestions(turns, { recurrenceFloor: 2 })).toHaveLength(1);
    expect(detectQuestions(turns, { recurrenceFloor: 3 })).toHaveLength(0);
  });
});

describe("detectQuestions — negatives (the conservative mold)", () => {
  it("detects nothing in statement-only conversation", () => {
    const turns = [
      turn("p1", "The mornings are chaos."),
      turn("p2", "We should ask the council about the crossing."),
      turn("p3", "I remember when it was quieter."),
    ];
    expect(detectQuestions(turns)).toEqual([]);
  });

  it("excludes room-directed questions — they are conversation, not knowledge needs", () => {
    const turns = [
      turn("p1", "What do you think about the crossing?"),
      turn("p2", "Do you all agree about the crossing?"),
    ];
    expect(detectQuestions(turns)).toEqual([]);
  });

  it("a single question below the recurrence floor never surfaces", () => {
    expect(detectQuestions([turn("p1", "Is that even legal?")])).toEqual([]);
  });

  it("repetition inside ONE turn is not recurrence (distinct turns count)", () => {
    const turns = [turn("p1", "What would it cost? Seriously, what would it cost?")];
    expect(detectQuestions(turns)).toEqual([]);
  });

  it("keyword-less questions cannot recur and are never surfaced alone", () => {
    const turns = [turn("p1", "Why?"), turn("p2", "Why?")];
    expect(detectQuestions(turns)).toEqual([]);
  });
});

describe("detectQuestions — determinism", () => {
  it("is invariant to input ordering", () => {
    const turns = [
      turn("p1", "Has anyone built a raised crossing?"),
      turn("p2", "What would a raised crossing cost?"),
      turn("p3", "Where does the night bus route run?"),
      turn("p4", "Who decides the night bus route?"),
      turn("p5", "The mornings are chaos."),
    ];
    const first = detectQuestions(turns);
    const second = detectQuestions([...turns].reverse());
    expect(second).toEqual(first);
    expect(first.length).toBe(2);
  });
});
