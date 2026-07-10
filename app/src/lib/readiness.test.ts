// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Readiness fixtures (design/v2/05 §3, 07 §5 "Nudge honesty" — the detector
// half): a converging theme with ≥2 self-offerers yields an evidence-linked
// signal (every cited turn is a real input turn; evidence is recipient-scoped
// so nothing renders about anyone else); ownership-only chatter, lone
// offerers, and drive-by offers never trigger; recipients cap at 4; the
// themeKey is stable so the surface can keep "once per theme per person".

import { describe, expect, it } from "vitest";
import type { ConversationTurn } from "./questions.js";
import { detectReadiness, scanOffers } from "./readiness.js";

const wid = (name: string): string => `https://${name}.example/#me`;

let seq = 0;
function turn(author: string, text: string): ConversationTurn {
  seq++;
  return {
    id: `https://c.example/circle/msg-${String(seq).padStart(3, "0")}`,
    author: wid(author),
    text,
    created: `2026-07-01T10:${String(seq).padStart(2, "0")}:00Z`,
  };
}

/** The corner-garden scenario of 05 §3 — three people converging. */
function gardenTurns(): {
  g1: ConversationTurn;
  g2: ConversationTurn;
  g3: ConversationTurn;
  g4: ConversationTurn;
  g5: ConversationTurn;
  g6: ConversationTurn;
  noise: ConversationTurn;
  all: ConversationTurn[];
} {
  const g1 = turn("p1", "The corner garden keeps coming up for me.");
  const g2 = turn("p1", "I could help clear the corner garden this weekend.");
  const g3 = turn("p2", "Someone should fix up the corner garden.");
  const g4 = turn("p2", "I'm free on Saturday to work on the garden.");
  const g5 = turn("p3", "I've built raised beds for a community garden before.");
  const g6 = turn("p3", "That garden could be lovely.");
  const noise = turn("p4", "The bus timetable is a mess.");
  return { g1, g2, g3, g4, g5, g6, noise, all: [g1, g2, g3, g4, g5, g6, noise] };
}

describe("scanOffers — the cue lexicon", () => {
  it("classifies offer/time/skill/ownership hits, linked to their turns", () => {
    const { g2, g3, g4, g5, all } = gardenTurns();
    const hits = scanOffers(all);
    expect(hits.map((h) => [h.turnId, h.kind])).toEqual([
      [g2.id, "offer"], // "i could"
      [g2.id, "time"], // "this weekend"
      [g3.id, "ownership"], // "someone should"
      [g4.id, "time"], // "i'm free"
      [g5.id, "skill"], // "i've built"
    ]);
    for (const h of hits) expect(all.some((t) => t.id === h.turnId)).toBe(true);
  });

  it('matches on word boundaries — "i couldn\'t" is not an offer', () => {
    expect(scanOffers([turn("p9", "I couldn't face the garden meeting.")])).toEqual([]);
    expect(scanOffers([turn("p9", "I'm interested but unsure.")])).toEqual([]);
  });
});

describe("detectReadiness — the positive signal (05 §3)", () => {
  it("detects a converging theme with 2–4 recipients, evidence-linked to matched turns", () => {
    const { g1, g2, g3, g4, g5, g6, all } = gardenTurns();
    const signals = detectReadiness(all);

    expect(signals).toHaveLength(1);
    const s = signals[0];
    expect(s?.theme).toContain("garden");
    expect(s?.themeKey).toBe(s?.theme.join("+")); // stable dedupe key
    expect(s?.recipients).toEqual([wid("p1"), wid("p2"), wid("p3")]);

    // Every recipient is backed by a SELF-offer (ownership alone never qualifies).
    for (const r of s?.recipients ?? []) {
      const selfOffers = (s?.offers ?? []).filter((o) => o.author === r && o.kind !== "ownership");
      expect(selfOffers.length).toBeGreaterThanOrEqual(1);
    }

    // Evidence linkage: every cited turn is a real input turn ("each one linked").
    const inputIds = new Set(all.map((t) => t.id));
    for (const o of s?.offers ?? []) expect(inputIds.has(o.turnId)).toBe(true);
    for (const t of s?.recurringTurns ?? []) expect(inputIds.has(t.turnId)).toBe(true);

    // "Kept coming back": ≥2 recurring theme turns per recipient, each linked.
    for (const r of s?.recipients ?? []) {
      const mine = (s?.recurringTurns ?? []).filter((t) => t.author === r);
      expect(mine.length).toBeGreaterThanOrEqual(2);
    }
    expect(s?.recurringTurns.map((t) => t.turnId)).toEqual(
      [g1, g2, g3, g4, g5, g6].map((t) => t.id),
    );

    // Recipient-scoped privacy: nothing about p4 (or anyone else) leaves here.
    expect((s?.offers ?? []).every((o) => s?.recipients.includes(o.author))).toBe(true);
    expect((s?.recurringTurns ?? []).every((t) => s?.recipients.includes(t.author))).toBe(true);
  });

  it("keeps unrelated themes separate, each with its own stable themeKey", () => {
    const turns = [
      turn("p1", "I could help clear the corner garden."),
      turn("p1", "The corner garden matters to me."),
      turn("p2", "I can bring tools for the corner garden."),
      turn("p2", "That corner garden needs love."),
      turn("p5", "I could paint the station mural."),
      turn("p5", "The station mural is peeling."),
      turn("p6", "I could repaint the station mural."),
      turn("p6", "The station mural again."),
    ];
    const signals = detectReadiness(turns);
    expect(signals).toHaveLength(2);
    const keys = signals.map((s) => s.themeKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys.some((k) => k.includes("garden"))).toBe(true);
    expect(keys.some((k) => k.includes("mural"))).toBe(true);
  });
});

describe("detectReadiness — negatives (never nudge on thin signal)", () => {
  it("ownership-only chatter ('someone should…') triggers nothing", () => {
    const turns = [
      turn("p1", "Someone should fix up the corner garden."),
      turn("p1", "The corner garden again."),
      turn("p2", "Someone should really sort the corner garden."),
      turn("p2", "That corner garden is a state."),
      turn("p3", "We should do something about the corner garden."),
      turn("p3", "Thinking about the corner garden."),
    ];
    expect(detectReadiness(turns)).toEqual([]);
  });

  it("a single offerer is below the team floor — no signal", () => {
    const turns = [
      turn("p1", "I could help clear the corner garden."),
      turn("p1", "I can bring tools for the corner garden too."),
      turn("p2", "The corner garden is lovely in spring."),
    ];
    expect(detectReadiness(turns)).toEqual([]);
  });

  it("a drive-by offer (one turn, no recurrence) does not make its author a recipient", () => {
    const { all } = gardenTurns();
    const driveBy = turn("p5", "I could help with the garden.");
    const signals = detectReadiness([...all, driveBy]);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.recipients).toEqual([wid("p1"), wid("p2"), wid("p3")]);
    // and nothing about p5 leaks into the evidence
    expect(signals[0]?.offers.some((o) => o.author === wid("p5"))).toBe(false);
    expect(signals[0]?.recurringTurns.some((t) => t.author === wid("p5"))).toBe(false);
  });

  it("statement-only conversation triggers nothing", () => {
    const turns = [turn("p1", "The mornings are chaos."), turn("p2", "The crossing scares me.")];
    expect(detectReadiness(turns)).toEqual([]);
  });
});

describe("detectReadiness — the 2–4 cap and determinism", () => {
  it("caps recipients at 4, picked deterministically (earliest offers first)", () => {
    const turns: ConversationTurn[] = [];
    for (const q of ["q1", "q2", "q3", "q4", "q5"]) {
      turns.push(turn(q, `I could help dig the pond on the green.`));
      turns.push(turn(q, `The pond on the green matters.`));
    }
    const signals = detectReadiness(turns);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.recipients).toEqual([wid("q1"), wid("q2"), wid("q3"), wid("q4")]);
    // recipient-scoping: the capped-out q5's turns are not cited
    expect(signals[0]?.offers.some((o) => o.author === wid("q5"))).toBe(false);
    expect(signals[0]?.recurringTurns.some((t) => t.author === wid("q5"))).toBe(false);
  });

  it("is invariant to input ordering and repeatable", () => {
    const { all } = gardenTurns();
    const first = detectReadiness(all);
    const second = detectReadiness([...all].reverse());
    const third = detectReadiness(all);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("themeKey is stable when unrelated turns are added (once-per-theme dedupe)", () => {
    const { all } = gardenTurns();
    const before = detectReadiness(all);
    const after = detectReadiness([
      ...all,
      turn("p9", "The bus was late again."),
      turn("p9", "Rainy today."),
    ]);
    expect(after[0]?.themeKey).toBe(before[0]?.themeKey);
  });
});
