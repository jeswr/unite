// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The commons — the garden's TEXT equivalent is COUNT-FREE (design/v2
// P8/P11, roborev fix): the garden shows no numbers, so neither does its text
// alternative — a bridge count is still a tally. Tested purely (the copy is a
// pure function of the shape, no async render).

import { describe, expect, it } from "vitest";
import { gardenText } from "./Commons.js";

describe("gardenText — the count-free garden equivalent", () => {
  it("names only the SHAPE, never a number — across every bridge count", () => {
    for (const bridges of [0, 1, 2, 5, 12]) {
      const text = gardenText(2, bridges);
      expect(text).not.toMatch(/\d/); // no bridge COUNT, no tally
    }
  });

  it("says common ground is bridging when at least one bridge exists (no count)", () => {
    expect(gardenText(2, 3)).toBe(
      "Two groups of neighbours read the street differently, and common ground is starting to bridge them.",
    );
    expect(gardenText(2, 1)).toBe(gardenText(2, 3)); // 1 vs 3 bridges read identically
  });

  it("says no bridge yet when there is none", () => {
    expect(gardenText(2, 0)).toContain("no common ground bridging them yet");
  });

  it("gathers honestly before two groups exist", () => {
    expect(gardenText(0, 0)).toContain("still gathering");
    expect(gardenText(1, 0)).toContain("still gathering");
  });
});
