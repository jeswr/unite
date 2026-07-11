// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The notetaker's static script engine: deterministic beat sequencing + the
// covenant-bearing copy. The boundary beat carries the CORRECTED 02 §4.1
// semantics — keep-it-here / reword-it-yourself ONLY, no machine
// reformulation — and that is pinned here so a regression is a red test.

import { describe, expect, it } from "vitest";
import {
  ASK_BEAT,
  BOUNDARY_ACTIONS,
  boundaryBeat,
  COMPOSER_CHIPS,
  HANDSHAKE,
  MIRROR_ACTIONS,
  NOTETAKER_NAME,
  notetakerBeats,
  openingPrompt,
  type ScriptState,
} from "./script.js";

const BASE: ScriptState = {
  visitorMessageCount: 0,
  pending: null,
  boundaryHit: null,
  adoptedCount: 0,
  reacted: false,
  peerCard: null,
  summaryPhrase: null,
};

describe("the handshake + register (P5/P6/P9)", () => {
  it("the handshake is role-framed and makes the pod promise", () => {
    expect(HANDSHAKE).toContain("notetaker, not a person");
    expect(HANDSHAKE).toContain("your own notebook");
    expect(NOTETAKER_NAME).toBe("unite · notetaker");
  });

  it("no exclamation marks anywhere in the standing copy (the warmth register)", () => {
    for (const text of [
      HANDSHAKE,
      openingPrompt("What should mornings be like?"),
      ASK_BEAT,
      boundaryBeat({ domain: "health", term: "my disability" }),
      ...COMPOSER_CHIPS,
      ...Object.values(MIRROR_ACTIONS),
      ...Object.values(BOUNDARY_ACTIONS),
    ]) {
      expect(text).not.toContain("!");
    }
  });

  it("chips are never chips-only (free text always open — the composer renders both)", () => {
    expect(COMPOSER_CHIPS).toEqual(["A memory", "A wish", "Honestly, a gripe"]);
  });
});

describe("the boundary beat (corrected 02 §4.1 semantics)", () => {
  it("names the rule, keeps the words standing, offers keep/reword ONLY", () => {
    const text = boundaryBeat({ domain: "health", term: "my disability" });
    expect(text).toContain("stays here");
    expect(text).toContain("health details are off-limits");
    expect(text).toContain("a hard rule, not a judgment");
    // The two — and only two — paths:
    expect(BOUNDARY_ACTIONS).toEqual({ keep: "Keep it all just here", reword: "Let me reword it" });
    // NO machine take-forward exists (the corrected semantics): the copy never
    // offers a machine-made reformulation.
    expect(text).not.toContain("Here's what I can take forward");
    expect(text).not.toContain("Take that forward");
  });
});

describe("beat sequencing (deterministic)", () => {
  it("an unresolved draft renders no trailing beat (mirrors are punctuation)", () => {
    expect(notetakerBeats({ ...BASE, visitorMessageCount: 1, pending: null })).toEqual([]);
  });

  it("ask + boundary beats surface, one at a time", () => {
    expect(notetakerBeats({ ...BASE, pending: "ask" })).toEqual([{ kind: "ask", text: ASK_BEAT }]);
    const hit = { domain: "health" as const, term: "my anxiety" };
    const beats = notetakerBeats({ ...BASE, pending: "boundary", boundaryHit: hit });
    expect(beats).toHaveLength(1);
    expect(beats[0]).toMatchObject({ kind: "boundary", hit });
  });

  it("beat 4: after the first adoption, ONE peer statement is dealt", () => {
    const beats = notetakerBeats({
      ...BASE,
      adoptedCount: 1,
      peerCard: { statement: "https://x.example/c1", authorName: "Farah" },
    });
    expect(beats).toEqual([
      {
        kind: "peer",
        text: "Here's how Farah put it — does it ring true for you?",
        statement: "https://x.example/c1",
      },
    ]);
  });

  it("beat 5: the fate line closes the loop, quoting where the words went (P3)", () => {
    const beats = notetakerBeats({
      ...BASE,
      adoptedCount: 1,
      reacted: true,
      summaryPhrase: "getting across Maple without sprinting",
    });
    expect(beats).toHaveLength(1);
    expect(beats[0]?.kind).toBe("fate");
    expect(beats[0]?.text).toContain("getting across Maple without sprinting");
    expect(beats[0]?.text).toContain("not in a notification storm");
  });

  it("no adoption → no peer beat (the loop is earned, not pushed)", () => {
    expect(
      notetakerBeats({
        ...BASE,
        peerCard: { statement: "https://x.example/c1", authorName: "Farah" },
      }),
    ).toEqual([]);
  });
});
