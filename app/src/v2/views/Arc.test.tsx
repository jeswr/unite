// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The five-minute walk (design/v2 06 §2–3): the staged-honesty line is the
// FIRST thing said, the personas are visibly fictional seats, the visitor's
// seat is real, and each beat names the covenant clause it exercises — the
// page IS the acceptance walkthrough.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PERSONA_SEATS } from "../personas.js";
import { Arc, ARC_BEATS, STAGED_HONESTY_LINE } from "./Arc.js";

afterEach(cleanup);

describe("the arc (#/arc)", () => {
  it("says the staged-honesty line up front", () => {
    render(<Arc />);
    expect(screen.getByText(STAGED_HONESTY_LINE)).toBeTruthy();
  });

  it("renders nine seats: eight demo voices + the visitor's", () => {
    render(<Arc />);
    expect(PERSONA_SEATS.length).toBe(9);
    expect(screen.getAllByText("demo voice").length).toBe(8);
    expect(screen.getByText("your seat")).toBeTruthy();
  });

  it("walks all seven beats, each with a covenant check and a live link", () => {
    render(<Arc />);
    expect(ARC_BEATS.length).toBe(7);
    for (const beat of ARC_BEATS) {
      expect(screen.getByText(`${beat.n}. ${beat.title}`)).toBeTruthy();
      expect(screen.getByText(`covenant check: ${beat.covenant}`)).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "read the fate-trail →" })).toBeTruthy();
  });

  it("points at the curtain and the pitch", () => {
    render(<Arc />);
    expect(
      screen.getByRole("link", { name: /what was running the whole time/ }).getAttribute("href"),
    ).toBe("#/curtain");
    expect(screen.getByRole("link", { name: "the pitch" }).getAttribute("href")).toBe("#/join-us");
  });
});
