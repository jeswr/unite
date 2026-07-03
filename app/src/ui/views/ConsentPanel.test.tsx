// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The ODRL consent panel: renders the four fut: consent actions with the
// conservative default disposition, and edits flow through onChange (controlled).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONSENT } from "../../lib/consent.js";
import { ConsentPanel } from "./ConsentPanel.js";

describe("ConsentPanel", () => {
  afterEach(cleanup);

  it("renders the four consent actions with the conservative default checked state", () => {
    render(
      <ConsentPanel
        value={DEFAULT_CONSENT}
        onChange={vi.fn()}
        deliberation="https://c.example/d"
      />,
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes).toHaveLength(4);
    // aggregate + synthesize on; quoteVerbatim + governmentUse off.
    expect(boxes.map((b) => b.checked)).toEqual([true, true, false, false]);
  });

  it("names the deliberation the policy is shared with", () => {
    render(
      <ConsentPanel
        value={DEFAULT_CONSENT}
        onChange={vi.fn()}
        deliberation="https://c.example/town"
      />,
    );
    expect(screen.getByText("https://c.example/town")).toBeTruthy();
  });

  it("toggling an action calls onChange with the flipped value", () => {
    const onChange = vi.fn();
    render(
      <ConsentPanel
        value={DEFAULT_CONSENT}
        onChange={onChange}
        deliberation="https://c.example/d"
      />,
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // Flip quoteVerbatim (index 2, currently false → true).
    fireEvent.click(boxes[2] as HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CONSENT, quoteVerbatim: true });
  });

  it("editing the k threshold calls onChange; a sub-1 value is rejected", () => {
    const onChange = vi.fn();
    render(
      <ConsentPanel
        value={DEFAULT_CONSENT}
        onChange={onChange}
        deliberation="https://c.example/d"
      />,
    );
    const kInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(kInput, { target: { value: "8" } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CONSENT, kThreshold: 8 });

    onChange.mockClear();
    fireEvent.change(kInput, { target: { value: "0" } });
    // 0 is invalid → keeps the previous threshold.
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CONSENT,
      kThreshold: DEFAULT_CONSENT.kThreshold,
    });

    onChange.mockClear();
    fireEvent.change(kInput, { target: { value: "1.5" } });
    // A non-integer must NOT be truncated to 1 (weakening anonymity) — keep prior.
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CONSENT,
      kThreshold: DEFAULT_CONSENT.kThreshold,
    });
  });
});
