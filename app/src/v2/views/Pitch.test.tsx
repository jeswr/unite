// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The pitch page (design/v2 06 §6): renders content-v2/pitch.ts whole — the
// claim with its checkable grounds, the asks (a)–(h), and the NON-claims
// carrying the same weight as the claims.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PITCH } from "../../content-v2/pitch.js";
import { Pitch } from "./Pitch.js";

afterEach(cleanup);

describe("the pitch page (#/join-us)", () => {
  it("renders the claim, its grounds, and how to check each", () => {
    render(<Pitch />);
    expect(screen.getByText("Help build unite")).toBeTruthy();
    expect(screen.getByText(/Your words live in your own pod/)).toBeTruthy();
    expect(screen.getAllByText(/Check it yourself:/).length).toBe(PITCH.claim.grounds.length);
  });

  it("renders every ask — including the designer and credential-issuer asks", () => {
    render(<Pitch />);
    for (const ask of PITCH.asks.items) {
      expect(screen.getByText(new RegExp(`${ask.audience}:`))).toBeTruthy();
    }
  });

  it("the non-claims render with claim-grade prominence", () => {
    render(<Pitch />);
    expect(screen.getByText(/Not claimed: unite is decentralised\./)).toBeTruthy();
    expect(screen.getByText(/Not claimed: This is production software\./)).toBeTruthy();
    expect(screen.getByText(/unite is bootstrapping/)).toBeTruthy();
  });

  it("lists what the prototype defers, out loud", () => {
    render(<Pitch />);
    expect(screen.getByText(/Any LLM call — none ships anywhere in the demo/)).toBeTruthy();
  });

  it("links the repository", () => {
    render(<Pitch />);
    const link = screen.getByRole("link", { name: PITCH.closing.repoUrl });
    expect(link.getAttribute("href")).toBe("https://github.com/jeswr/unite");
  });
});
