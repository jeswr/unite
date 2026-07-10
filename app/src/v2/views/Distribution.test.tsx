// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The P4 + P11 component fixtures (design/v2 07 §5): the distribution
// renders NULL pre-reaction (elicit-before-expose), the COUNT-FREE fallback
// below k, and the real shape only after the viewer's own signal at/above k.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BELOW_K_FALLBACK, Distribution } from "./Distribution.js";

afterEach(cleanup);

const BIG = { resonates: 4, conflicts: 2, unsure: 1 }; // 7 ≥ k
const SMALL = { resonates: 2, conflicts: 1, unsure: 0 }; // 3 < k

describe("Distribution (P4 elicit-before-expose)", () => {
  it("renders NOTHING before the viewer's own reaction — even with rich data", () => {
    const { container } = render(<Distribution tally={BIG} viewerReacted={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing with no tally", () => {
    const { container } = render(<Distribution tally={null} viewerReacted={true} />);
    expect(container.innerHTML).toBe("");
  });

  it("below k: the honest count-free fallback — NO digits anywhere (P11)", () => {
    render(<Distribution tally={SMALL} viewerReacted={true} />);
    const el = screen.getByText(BELOW_K_FALLBACK);
    expect(el).toBeTruthy();
    expect(el.textContent).not.toMatch(/\d/);
  });

  it("at/above k, post-reaction: the real distribution renders", () => {
    render(<Distribution tally={BIG} viewerReacted={true} />);
    expect(
      screen.getByText("Across the community: 4 resonate · 2 see it differently · 1 not sure."),
    ).toBeTruthy();
  });

  it("honours a custom k floor", () => {
    render(<Distribution tally={SMALL} viewerReacted={true} k={3} />);
    expect(screen.getByText(/Across the community: 2 resonate/)).toBeTruthy();
  });
});
