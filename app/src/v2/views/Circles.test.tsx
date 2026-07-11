// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The circles view (design/v2 04, 07 §5): the composition renders with its
// honest per-case seam — a starter circle claims nothing; the waitlist is
// warm, never a fake room — and NO health metrics render anywhere (no
// talk-share, no percentages, no per-circle tallies).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import type { AggregateResult } from "../../lib/aggregate.js";
import type { MembershipTier } from "../../lib/membership.js";
import type { AggregateState } from "../../ui/hooks.js";
import { Circles } from "./Circles.js";

afterEach(cleanup);

function aggregateOf(result: Partial<AggregateResult> | null): AggregateState {
  const empty: AggregateResult = {
    deliberation: "d",
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
  return {
    result: result === null ? null : { ...empty, ...result },
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
  };
}

function verified(keys: string[]): AggregateResult["verified"] {
  return keys.map((k) => ({
    webId: demoWebId(k),
    base: `https://demo.unite.example/pods/${k}/unite/society/`,
    tier: "T0" as MembershipTier,
  }));
}

describe("the circles view (#/circles)", () => {
  it("a community below the floor gets ONE starter circle that claims nothing", () => {
    render(<Circles aggregate={aggregateOf({ verified: verified(["amara", "ben", "you"]) })} />);
    expect(screen.getByText("Circle 1")).toBeTruthy();
    expect(screen.getAllByText(/everyone so far/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/claims nothing/).length).toBeGreaterThan(0);
  });

  it("renders NO health metrics — no percentages, no talk-share, no tallies", () => {
    const { container } = render(
      <Circles aggregate={aggregateOf({ verified: verified(["amara", "ben", "you"]) })} />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/talk[- ]share|airtime|activity/i);
  });

  it("states relational continuity: standing circles are never reshuffled", () => {
    render(<Circles aggregate={aggregateOf({ verified: verified(["amara", "ben", "you"]) })} />);
    expect(screen.getByText(/never reshuffled to chase the map/)).toBeTruthy();
  });

  it("gathers honestly while the aggregate loads", () => {
    render(<Circles aggregate={aggregateOf(null)} />);
    expect(screen.getByText("Gathering…")).toBeTruthy();
  });
});
