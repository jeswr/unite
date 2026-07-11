// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE WARMTH-REGISTER CHECKLIST as a fixture (design/v2 07 §3 V-D, 02
// preamble): no exclamation marks anywhere in the v2 copy — content modules,
// the notetaker's script, the seams, the staged story, the arc, the expert
// and nudge copy. The covenant walkthrough's machine-checkable half.

import { describe, expect, it } from "vitest";
import { HOW_LISTENS } from "../content-v2/how-listens.js";
import { PITCH } from "../content-v2/pitch.js";
import { PERSONA_MIRRORS, SCRIBE_SEAM } from "./demo-scribe.js";
import { DEMO_STORIES } from "./demo-stories.js";
import { EXPERT_SEES, expertChipSeam, expertConsentAsk, MARIA, MARIA_REPLY } from "./expert.js";
import { NUDGE_PROMISES, nudgeAsk } from "./nudge.js";
import { MISSING_VOICE_INVITE, TAP_ACK, TAPPED_ANNOTATION } from "./private-tap.js";
import * as script from "./script.js";
import { ARC_BEATS, STAGED_HONESTY_LINE } from "./views/Arc.js";

/** Every string reachable inside a value (deep). */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) strings(v, out);
  }
  return out;
}

describe("the warmth register — no exclamation marks in v2 copy (V-D)", () => {
  const surfaces: [string, unknown][] = [
    ["PITCH", PITCH],
    ["HOW_LISTENS", HOW_LISTENS],
    ["the notetaker script constants", { ...script }],
    ["the staged stories", DEMO_STORIES],
    ["the persona mirrors + scribe seam", { PERSONA_MIRRORS, SCRIBE_SEAM }],
    [
      "the expert copy",
      { EXPERT_SEES, MARIA_REPLY, chip: expertChipSeam(MARIA), ask: expertConsentAsk(MARIA) },
    ],
    ["the nudge copy", { NUDGE_PROMISES, ask: nudgeAsk(["garden"], 2) }],
    ["the tap copy", { TAP_ACK, TAPPED_ANNOTATION, MISSING_VOICE_INVITE }],
    ["the arc", { ARC_BEATS, STAGED_HONESTY_LINE }],
  ];
  for (const [name, value] of surfaces) {
    it(`${name} carries no exclamation mark`, () => {
      const offenders = strings(value).filter((s) => s.includes("!"));
      expect(offenders).toEqual([]);
    });
  }
});

describe("the covenant walkthrough's beat coverage (07 §5)", () => {
  it("the arc's beats exercise P1, P3, P4, P5, P6, P7 and P10", () => {
    const covered = ARC_BEATS.map((b) => b.covenant).join(" ");
    for (const clause of ["P1", "P3", "P4", "P5", "P6", "P7", "P10"]) {
      expect(covered).toContain(clause);
    }
  });

  it("the arc opens on the 06 §2 staged-honesty line, verbatim in spirit", () => {
    expect(STAGED_HONESTY_LINE).toContain("staged neighbourhood with made-up people");
    expect(STAGED_HONESTY_LINE).toContain("computed for real, in your browser");
  });

  it("beat 3 carries the un-tuned-drafter honesty rule (no staged correction)", () => {
    const beat3 = ARC_BEATS.find((b) => b.n === 3);
    expect(beat3?.what).toContain("un-tuned");
    expect(beat3?.what).toContain("NOT a version rigged");
  });
});
