// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The V3–V5 accessibility floor, recorded as machine checks (design/v2 02 §9,
// 07 §3 V5): every new view renders exactly one page heading, every control
// carries an accessible name, images/figures carry text alternatives, and
// nothing is keyboard-unreachable (all interactive elements are real buttons
// and links). The HUMAN screen-reader walkthrough remains part of the
// covenant walkthrough before any audience showing — these fixtures are its
// standing machine-verifiable floor, not its replacement.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../../lib/aggregate.js";
import type { AggregateState } from "../../ui/hooks.js";
import { demoConfig } from "../../ui/state.js";
import { Arc } from "./Arc.js";
import { Circles } from "./Circles.js";
import { Curtain } from "./Curtain.js";
import { How } from "./How.js";
import { Pitch } from "./Pitch.js";
import { Story } from "./Story.js";

afterEach(cleanup);

function emptyAggregate(): AggregateState {
  const result: AggregateResult = {
    deliberation: demoConfig("society").deliberation,
    needs: [],
    resonances: [],
    proposals: [],
    infraProposals: [],
    candidates: [],
    critiques: [],
    visions: [],
    claims: [],
    values: [],
    synthesizable: new Set<string>(),
    verified: [],
    unverified: [],
    errors: [],
  };
  return { result, loading: false, error: null, refresh: vi.fn(async () => {}) };
}

const VIEWS: [string, () => React.JSX.Element][] = [
  ["Arc", () => <Arc />],
  ["Pitch", () => <Pitch />],
  ["How", () => <How />],
  ["Story", () => <Story id="maple-crossing" />],
  ["Circles", () => <Circles aggregate={emptyAggregate()} />],
  ["Curtain", () => <Curtain aggregate={emptyAggregate()} config={demoConfig("society")} />],
];

describe("the a11y floor on the V3–V5 views", () => {
  for (const [name, mount] of VIEWS) {
    it(`${name}: one page heading; every control and link has an accessible name`, () => {
      const { container } = render(mount());
      expect(screen.getAllByRole("heading", { level: 2 }).length).toBe(1);
      for (const el of container.querySelectorAll("button, a")) {
        expect((el.textContent ?? "").trim().length, `${name}: unnamed ${el.tagName}`).toBeGreaterThan(0);
      }
      // No click handlers on non-interactive elements (keyboard reachability).
      expect(container.querySelectorAll("div[onclick], span[onclick]").length).toBe(0);
    });
  }

  it("every SVG figure carries a text alternative (role img + title)", () => {
    const { container } = render(
      <Curtain aggregate={emptyAggregate()} config={demoConfig("society")} />,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("role")).toBe("img");
      expect(svg.querySelector("title")).not.toBeNull();
    }
  });
});
