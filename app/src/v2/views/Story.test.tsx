// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The fate-trail view (design/v2 05 §4, 07 §5): the state ladder renders in
// plain words with no silent dead end, the commitment banner names the
// listener up front, the honest "not yet" is told plainly, the return loop
// is scheduled mechanically, and the expert moment carries the tier-honest
// chip. The staged story says it is staged.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Story } from "./Story.js";

afterEach(cleanup);

describe("the Maple-crossing fate-trail (#/story/maple-crossing)", () => {
  it("tells the trail in plain-word states, commitment banner first", () => {
    render(<Story id="maple-crossing" />);
    expect(screen.getByText("The Maple crossing")).toBeTruthy();
    expect(screen.getByText(/The council's roads team is listening/)).toBeTruthy();
    expect(screen.getAllByText("taking shape").length).toBeGreaterThan(0);
    expect(screen.getByText("asked")).toBeTruthy();
    expect(screen.getByText("answered")).toBeTruthy();
  });

  it("carries the honest 'not yet' from the council, plainly", () => {
    render(<Story id="maple-crossing" />);
    expect(screen.getByText(/not yet to the raised table/)).toBeTruthy();
  });

  it("Maria's moment wears the tier-honest chip — no unbacked checkmark", () => {
    render(<Story id="maple-crossing" />);
    const chip = screen.getByText(/invited by your stewards/);
    expect(chip.textContent).not.toContain("✓");
    expect(screen.getByText(/Who stands behind that\?/)).toBeTruthy();
  });

  it("schedules the mechanical check-in, and says it runs on schedule", () => {
    render(<Story id="maple-crossing" />);
    expect(screen.getByText(/Next check-in/)).toBeTruthy();
    expect(screen.getByText(/on a\s+schedule, not on goodwill/)).toBeTruthy();
  });

  it("labels the staged trail as demo voice", () => {
    render(<Story id="maple-crossing" />);
    expect(screen.getByText(/demo voice — this trail is staged/)).toBeTruthy();
  });

  it("an unknown slug fails closed to the honest story list", () => {
    render(<Story id="nope" />);
    expect(screen.getByText(/That story isn't here/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "The Maple crossing" })).toBeTruthy();
  });
});
