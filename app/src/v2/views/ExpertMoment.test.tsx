// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The expert-moment flow (design/v2 05 §1–2, 02 §7): absent without a stable
// question; the consent ask precedes the introduction and is written to the
// pod on answer; a no is honoured, acknowledged, and never re-asked; the
// introduction carries the tier-honest chip and the demo-voice label.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../../demo/pods.js";
import type { ConversationTurn } from "../../lib/questions.js";
import { AuthProvider, DevLoginController } from "../../ui/auth.js";
import { demoConfig } from "../../ui/state.js";
import { resetConsentMemory } from "../consent-moments.js";
import { ExpertMoment } from "./ExpertMoment.js";

const CONFIG = demoConfig("society");

const QUESTION_TURNS: ConversationTurn[] = [
  {
    id: "t1",
    author: "a",
    text: "What would a raised crossing actually cost?",
    created: "2026-06-22T08:00:00Z",
  },
  {
    id: "t2",
    author: "b",
    text: "What does a proper crossing cost, and who pays?",
    created: "2026-06-22T18:00:00Z",
  },
];

function mount(turns: readonly ConversationTurn[], about: string | null) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <ExpertMoment
        turns={turns}
        identity="https://demo.unite.example/people/you/profile#me"
        config={CONFIG}
        aboutResource={about}
      />
    </AuthProvider>,
  );
}

beforeEach(() => {
  resetDemoInstances();
  resetConsentMemory();
});

afterEach(cleanup);

describe("the expert moment", () => {
  it("does not exist without a stable question (05 §1 — structural)", () => {
    const { container } = mount([QUESTION_TURNS[0] as ConversationTurn], "https://x.example/r");
    expect(container.textContent).toBe("");
  });

  it("asks consent FIRST, then introduces Maria with the tier-honest chip", async () => {
    const demo = await getDemoDeliberation("society");
    mount(QUESTION_TURNS, `${demo.you.base}claims/one.ttl`);
    // The consent ask, before anything reaches the expert (02 §7).
    expect(screen.getByText(/She'd see the group's question and the summary/)).toBeTruthy();
    expect(screen.queryByText(/three ways councils usually do this/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Okay — she can see the question and the summary/ }),
    );
    // The introduction + the options-with-trade-offs reply, demo-voice labeled.
    expect(await screen.findByText(/three ways councils usually do this/)).toBeTruthy();
    expect(screen.getByText("demo voice")).toBeTruthy();
    const chip = screen.getByText(/invited by your stewards/);
    expect(chip.textContent).not.toContain("✓");
    // The decision landed in the pod as a policy.
    await waitFor(async () => {
      const res = await demo.fetch(`${demo.you.base}consents/`);
      expect(res.ok).toBe(true);
    });
  });

  it("a no is honoured, acknowledged, and never re-asked (session memory)", async () => {
    const demo = await getDemoDeliberation("society");
    const first = mount(QUESTION_TURNS, `${demo.you.base}claims/one.ttl`);
    fireEvent.click(screen.getByRole("button", { name: /No — keep mine in the circle/ }));
    expect(await screen.findByText(/Kept in the circle/)).toBeTruthy();
    first.unmount();
    // A remount does NOT re-ask — the decision is remembered.
    mount(QUESTION_TURNS, `${demo.you.base}claims/one.ttl`);
    await waitFor(() => expect(screen.getByText(/Kept in the circle/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Okay — she can see/ })).toBeNull();
  });
});
