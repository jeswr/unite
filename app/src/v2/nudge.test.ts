// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// NUDGE-honesty fixtures (design/v2 05 §3, 07 §5 "nudge honesty"): the
// private action-team nudge renders its "why me?" seam from the viewer's OWN
// evidence only, fires at most once per theme per person, and renders
// NOTHING to non-recipients — pinned at the module boundary, so no render
// path can exist for a non-recipient.

import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationTurn } from "../lib/questions.js";
import { markThemeSeen, NUDGE_PROMISES, nudgeFor, resetNudgeMemory, seenThemes } from "./nudge.js";

beforeEach(resetNudgeMemory);

// Alice and Bob both self-offer on the garden theme and keep coming back;
// Carol only ever said "someone should" (ownership never volunteers anyone).
const TURNS: ConversationTurn[] = [
  {
    id: "t1",
    author: "alice",
    text: "About the corner garden — I could bring tools this weekend.",
    created: "2026-06-20T08:00:00Z",
  },
  {
    id: "t2",
    author: "bob",
    text: "I've built planters before, count me in for the corner garden.",
    created: "2026-06-20T09:00:00Z",
  },
  {
    id: "t3",
    author: "alice",
    text: "That corner garden would change the whole street.",
    created: "2026-06-21T08:00:00Z",
  },
  {
    id: "t4",
    author: "bob",
    text: "The corner garden keeps pulling at me.",
    created: "2026-06-21T09:00:00Z",
  },
  {
    id: "t5",
    author: "carol",
    text: "Someone should sort out the corner garden honestly.",
    created: "2026-06-21T10:00:00Z",
  },
];

describe("nudgeFor — recipient-only, once per theme (05 §3)", () => {
  it("renders NOTHING to a non-recipient (ownership never volunteers anyone)", () => {
    expect(nudgeFor("carol", TURNS, seenThemes())).toBeNull();
    expect(nudgeFor("someone-else", TURNS, seenThemes())).toBeNull();
  });

  it("a named recipient gets the nudge, with their OWN evidence only", () => {
    const nudge = nudgeFor("alice", TURNS, seenThemes());
    expect(nudge).not.toBeNull();
    expect(nudge?.yourOffers.every((o) => o.author === "alice")).toBe(true);
    expect(nudge?.yourOffers.length).toBeGreaterThan(0);
    expect(nudge?.recipientCount).toBe(2); // alice + bob; carol never qualified
  });

  it("fires at most once per theme per person (the session memory)", () => {
    const first = nudgeFor("alice", TURNS, seenThemes());
    expect(first).not.toBeNull();
    if (first !== null) markThemeSeen(first.themeKey);
    expect(nudgeFor("alice", TURNS, seenThemes())).toBeNull();
  });

  it("states the three standing promises in the nudge itself", () => {
    const nudge = nudgeFor("bob", TURNS, seenThemes());
    expect(nudge?.promises).toBe(NUDGE_PROMISES);
    expect(NUDGE_PROMISES).toContain("at most once per theme per person");
    expect(NUDGE_PROMISES).toContain("saying no — or nothing — is a fine answer");
  });

  it("the ask is small, warm and time-boxed — never a broadcast CTA", () => {
    const nudge = nudgeFor("alice", TURNS, seenThemes());
    expect(nudge?.ask).toContain("You two");
    expect(nudge?.ask).not.toMatch(/petition|pledge|sign up|everyone/i);
  });
});
