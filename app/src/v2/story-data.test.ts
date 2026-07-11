// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// FATE-TRAIL fixtures (design/v2 05 §4, 07 §5): the plain-word state ladder
// is total and pinned; a resting state carries its reason structurally; the
// return loops are mechanical (~30/90/365) off a simulated clock; and the
// letter's "what changed" lines derive from the trail, every one linked.

import { describe, expect, it } from "vitest";
import { DEMO_NEXT_MONTH, DEMO_NOW, DEMO_STORIES, MAPLE_CROSSING } from "./demo-stories.js";
import {
  currentState,
  letterChangedLines,
  nextReturnLoop,
  RETURN_LOOP_DAYS,
  returnLoopDue,
  STORY_STATE_WORDS,
  type Story,
  type StoryStateId,
} from "./story-data.js";

const LADDER: StoryStateId[] = [
  "dreaming",
  "taking-shape",
  "asked",
  "answered",
  "being-built",
  "alive",
  "resting",
];

function storyWith(events: Story["events"]): Story {
  return { slug: "s", title: "S", origin: "o", events, demoVoice: true };
}

describe("the plain-word state ladder (05 §4)", () => {
  it("is total: every state has pinned plain words, no state renders raw", () => {
    for (const state of LADDER) {
      expect(STORY_STATE_WORDS[state]).toBeTruthy();
      expect(STORY_STATE_WORDS[state]).not.toMatch(/[A-Z_-]/); // plain words only
    }
    expect(Object.keys(STORY_STATE_WORDS).sort()).toEqual([...LADDER].sort());
  });

  it("a resting event REQUIRES its reason (no silent dead end — P3)", () => {
    // Structural: the type forbids reason-less resting. Runtime shape check:
    const rested = storyWith([
      { state: "dreaming", date: "2026-01-01", text: "a chat" },
      {
        state: "resting",
        date: "2026-02-01",
        text: "parked for winter",
        reason: "the council's budget review lands in autumn — we look again then",
      },
    ]);
    const last = rested.events[rested.events.length - 1];
    expect(last?.state).toBe("resting");
    expect(last !== undefined && "reason" in last && last.reason.length > 0).toBe(true);
  });

  it("currentState is the latest event's state", () => {
    expect(currentState(MAPLE_CROSSING)).toBe("alive");
  });
});

describe("mechanical return loops (05 §4)", () => {
  const story = storyWith([{ state: "asked", date: "2026-01-01T00:00:00Z", text: "asked" }]);

  it("schedules the ~30/90/365-day check-ins off the LAST event", () => {
    expect(RETURN_LOOP_DAYS).toEqual([30, 90, 365]);
    const next = nextReturnLoop(story, new Date("2026-01-10T00:00:00Z"));
    expect(next?.days).toBe(30);
    const later = nextReturnLoop(story, new Date("2026-02-15T00:00:00Z"));
    expect(later?.days).toBe(90);
  });

  it("returnLoopDue fires once a checkpoint has passed", () => {
    expect(returnLoopDue(story, new Date("2026-01-10T00:00:00Z"))).toBe(false);
    expect(returnLoopDue(story, new Date("2026-02-15T00:00:00Z"))).toBe(true);
  });

  it("all checkpoints passed → no next loop (honest end of schedule)", () => {
    expect(nextReturnLoop(story, new Date("2028-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("the letter's changed lines (03 §4 part c)", () => {
  it("carries the month's delta, linked to the story", () => {
    const lines = letterChangedLines(DEMO_STORIES, DEMO_NOW);
    expect(lines.length).toBe(1);
    expect(lines[0]?.text).toContain("The Maple crossing");
    expect(lines[0]?.text).toContain("alive");
    expect(lines[0]?.href).toBe("#/story/maple-crossing");
  });

  it("a month on, the scheduled check-in falls due (the rhythm simulation)", () => {
    const lines = letterChangedLines(DEMO_STORIES, DEMO_NEXT_MONTH);
    expect(lines.length).toBe(1);
    expect(lines[0]?.text).toContain("shall we look in on this?");
    expect(lines[0]?.href).toBe("#/story/maple-crossing");
  });

  it("is deterministic: same inputs, same lines", () => {
    expect(letterChangedLines(DEMO_STORIES, DEMO_NOW)).toEqual(
      letterChangedLines(DEMO_STORIES, DEMO_NOW),
    );
  });
});
