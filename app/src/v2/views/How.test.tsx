// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The How-unite-listens reconcile (design/v2 07 §3 V5): the page renders the
// content-v2/how-listens.ts module (the words' ONE home), discloses the
// withholding mechanisms too, and links the v1 instrument views IN PLACE
// carrying the forced society scope — hiding them would fail the reveal test.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HOW_LISTENS } from "../../content-v2/how-listens.js";
import { How } from "./How.js";

afterEach(cleanup);

describe("How unite listens (#/how)", () => {
  it("renders the content module's reveal-test rule verbatim", () => {
    render(<How />);
    expect(screen.getByText(HOW_LISTENS.revealTest.rule)).toBeTruthy();
  });

  it("discloses every mechanism group, including the withholding ones", () => {
    render(<How />);
    for (const group of HOW_LISTENS.groups) {
      expect(screen.getByText(group.label)).toBeTruthy();
    }
    // Elicit-before-expose — deliberate withholding, disclosed here.
    expect(screen.getByText(/Why you don't see the numbers until you've spoken/)).toBeTruthy();
    // The private tap and the two-scale k.
    expect(screen.getByText(/The private "actually, I don't"/)).toBeTruthy();
  });

  it("names the honest residuals — the un-reassuring parts included", () => {
    render(<How />);
    expect(screen.getByText(/Most people will never read this page/)).toBeTruthy();
    expect(
      screen.getByText(/This demo is not cleared for real people's political opinions/),
    ).toBeTruthy();
  });

  it("links every v1 instrument view, pinned to surface=v1 + the society scope", () => {
    render(<How />);
    for (const link of HOW_LISTENS.instruments.links) {
      const a = screen.getByRole("link", { name: link.label });
      const href = a.getAttribute("href") ?? "";
      expect(href).toContain("surface=v1");
      expect(href).toContain("scope=society");
      expect(href).toContain(link.route);
    }
  });
});
