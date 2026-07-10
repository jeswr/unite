// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The why-seams: literal restatements of engine fields, k-gated where they
// name numbers, headcount-free at circle scale (design/v2 03 §6, 07 §5).

import { describe, expect, it } from "vitest";
import {
  deckBeatSeam,
  differSeam,
  gardenSeam,
  stillFormingSeam,
  summaryLineSeam,
  whereYouSitSeam,
} from "./seams.js";

describe("deckBeatSeam (DeckEntry fields, restated)", () => {
  it("restates ownClusterSeen + neighbourResonance exactly", () => {
    expect(deckBeatSeam({ ownClusterSeen: 0, neighbourResonance: 0.8 })).toBe(
      "Because people in your part of the map haven't weighed in on this, and people who usually read the street differently found it rang true.",
    );
    expect(deckBeatSeam({ ownClusterSeen: 0, neighbourResonance: 0.1 })).toBe(
      "Because people in your part of the map haven't weighed in on this.",
    );
    expect(deckBeatSeam({ ownClusterSeen: 2, neighbourResonance: 0.8 })).toBe(
      "Because few in your part of the map have weighed in on this, and people who usually read the street differently found it rang true.",
    );
  });
});

describe("summaryLineSeam (k-gated numbers)", () => {
  it("names the count only at/above k", () => {
    expect(summaryLineSeam(7)).toBe(
      "Said in different ways by 7 people across both parts of the map — tap to read the words it came from.",
    );
  });

  it("below k: count-free (P11)", () => {
    const s = summaryLineSeam(3);
    expect(s).toBe("A few people have spoken to this — it stays uncounted until enough have.");
    expect(s).not.toMatch(/\d/);
  });
});

describe("circle-scale seams carry no headcounts (03 §4)", () => {
  it("differ + still-forming + garden seams are number-free", () => {
    for (const s of [differSeam(), stillFormingSeam(), gardenSeam()]) {
      expect(s).not.toMatch(/\d/);
    }
    expect(differSeam()).toContain("nobody's view was averaged away");
    expect(stillFormingSeam()).toContain("no direction is implied");
  });
});

describe("whereYouSitSeam (notebook §4 — computed, ephemeral, correctable)", () => {
  it("always names recomputation + the correction affordance", () => {
    for (const s of [whereYouSitSeam(3), whereYouSitSeam(30)]) {
      expect(s).toContain("stored nowhere");
      expect(s).toContain("Revise any reaction");
    }
  });

  it("below k it declines the comparison statistic", () => {
    expect(whereYouSitSeam(3)).toContain("too small to say");
    expect(whereYouSitSeam(30)).not.toContain("too small to say");
  });
});
