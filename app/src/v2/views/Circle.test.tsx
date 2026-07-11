// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The V1 acceptance walkthrough (design/v2 07 §3): a visitor can complete
// 02 §2 beats 0–3 in demo mode — arrive (the handshake is waiting), read the
// opening prompt + the seeded conversation, speak, and be accurately mirrored
// with adopt / fix / discard. Runs against the REAL demo pods + drafter;
// only the aggregate state is handed in (the shell owns it).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import { resetDemoInstances } from "../../demo/pods.js";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_RESONATES } from "../../lib/fut.js";
import type { MembershipTier } from "../../lib/membership.js";
import type { Resonance } from "../../lib/model.js";
import type { Claim } from "../../lib/model-society.js";
import { AuthProvider, DevLoginController } from "../../ui/auth.js";
import type { AggregateState } from "../../ui/hooks.js";
import { demoConfig } from "../../ui/state.js";
import { resetDemoCircleSeed } from "../demo-circle.js";
import { Circle } from "./Circle.js";

const CONFIG = demoConfig("society");

function emptyResult(): AggregateResult {
  return {
    deliberation: CONFIG.deliberation,
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
}

function emptyAggregate(): AggregateState {
  return { result: emptyResult(), loading: false, error: null, refresh: vi.fn(async () => {}) };
}

// A peer claim authored by another circle member + ≥k community reactions, so
// the deck deals it and the post-reaction distribution renders real numbers.
const PEER_CLAIM = "https://demo.unite.example/pods/farah/unite/society/claims/safe.ttl";
const PEER_AUTHOR = demoWebId("farah");
const PEER_TEXT = "Every child should be able to cross the high street safely on foot.";

function richAggregate(): AggregateState {
  const voters = ["farah", "chidi", "gus", "hana", "ben"]; // 5 = k
  let seq = 0;
  const resonances: Resonance[] = voters.map((who) => {
    seq += 1;
    return {
      id: `https://r.example/${seq}`,
      onStatement: PEER_CLAIM,
      stance: STANCE_RESONATES,
      created: "2026-06-20T00:00:00Z",
      creator: demoWebId(who),
      inDeliberation: CONFIG.deliberation,
    };
  });
  const claim: Claim = {
    id: PEER_CLAIM,
    content: PEER_TEXT,
    adoptedBy: PEER_AUTHOR,
    creator: PEER_AUTHOR,
    created: "2026-06-14T09:30:00Z",
    inDeliberation: CONFIG.deliberation,
  };
  const verified = [...voters, "you"].map((who) => ({
    webId: demoWebId(who),
    base: `https://demo.unite.example/pods/${who}/unite/society/`,
    tier: "T0" as MembershipTier,
  }));
  return {
    result: { ...emptyResult(), claims: [claim], resonances, verified },
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
  };
}

function mount(aggregate: AggregateState = emptyAggregate()) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Circle circleSlug="maple-mornings" aggregate={aggregate} config={CONFIG} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  resetDemoInstances();
  resetDemoCircleSeed();
});

afterEach(cleanup);

/** Wait for the seeded conversation (the demo pods take a beat to build). */
async function waitForSeed(): Promise<void> {
  await waitFor(
    () => {
      expect(screen.getByText(/I want to hear kids on bikes, not brakes/)).toBeTruthy();
    },
    { timeout: 5000 },
  );
}

/** True when `text` is a MESSAGE paragraph in the thread (not the composer). */
function inThread(text: string): boolean {
  return screen
    .getAllByText(text)
    .some((el) => el.tagName === "P" && el.className.includes("v2-msg-text"));
}

describe("the circle — beats 0–3 in demo mode", () => {
  it("beat 0–1: the handshake is waiting and the opening prompt stands", async () => {
    mount();
    expect(screen.getByText(/I'm unite's notetaker, not a person/)).toBeTruthy();
    expect(screen.getByText(/What should mornings be like on this street/)).toBeTruthy();
    // The seeded conversation arrives from the demo pods.
    await waitForSeed();
    // Free text is always open; chips are offers, not walls.
    expect(screen.getByLabelText("say it your way")).toBeTruthy();
    expect(screen.getByText("A memory")).toBeTruthy();
  });

  it("beats 2–3: the visitor speaks and is mirrored; adopt / fix / discard offered", async () => {
    mount();
    await waitForSeed();
    const composer = await screen.findByLabelText("say it your way");
    fireEvent.change(composer, { target: { value: "I want the crossing fixed before winter." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    // The message lands in the THREAD (their own pod, read back) — matched on
    // the message paragraph, not the composer's value.
    await waitFor(
      () => {
        expect(inThread("I want the crossing fixed before winter.")).toBe(true);
      },
      { timeout: 5000 },
    );
    // The mirror: one warm sentence + the three responses.
    expect(
      await screen.findByText(/Hearing you: i want the crossing fixed before winter/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "That's it" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close — let me fix it" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No, that's not it" })).toBeTruthy();
    // The mirror carries its quiet seam (assistance is never invisible — C6).
    expect(screen.getByText(/mirror-draft-lexicon/)).toBeTruthy();
  });

  it("discard visibly scraps the draft and nothing more is asked", async () => {
    mount();
    await waitForSeed();
    const composer = await screen.findByLabelText("say it your way");
    fireEvent.change(composer, { target: { value: "I wish the bins weren't out all week." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "No, that's not it" }, { timeout: 5000 }),
    );
    expect(screen.getByText(/Scrapped — say it your way/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "That's it" })).toBeNull();
  });

  it("the boundary beat offers keep/reword ONLY (corrected 02 §4.1)", async () => {
    mount();
    await waitForSeed();
    const composer = await screen.findByLabelText("say it your way");
    fireEvent.change(composer, {
      target: { value: "My disability makes this crossing terrifying." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    // The utterance SENT (visible in the THREAD) — no refusal of speech.
    await waitFor(
      () => {
        expect(inThread("My disability makes this crossing terrifying.")).toBe(true);
      },
      { timeout: 5000 },
    );
    // The boundary beat: named rule, two choices, no machine take-forward.
    expect(await screen.findByText(/health details are off-limits/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep it all just here" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Let me reword it" })).toBeTruthy();
    expect(screen.queryByText(/take forward/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "That's it" })).toBeNull();
  });

  it("an unknown circle slug fails closed to an honest card", () => {
    render(
      <AuthProvider controller={new DevLoginController()}>
        <Circle circleSlug="nope" aggregate={emptyAggregate()} config={CONFIG} />
      </AuthProvider>,
    );
    expect(screen.getByText("That circle isn't here")).toBeTruthy();
  });
});

describe("beat 4 — the peer statement + the P4 post-reaction reveal", () => {
  it("the distribution appears ONLY after the viewer's own reaction, and stays", async () => {
    mount(richAggregate());
    await waitForSeed();

    // Speak, then adopt — beat 4's peer statement is dealt only after adopting.
    const composer = await screen.findByLabelText("say it your way");
    fireEvent.change(composer, { target: { value: "I want the crossing fixed before winter." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "That's it" }, { timeout: 5000 }));

    // The dealt peer card shows — a claim by another member (not the viewer),
    // and the reaction affordance appears with it.
    await waitFor(() => expect(screen.getByRole("button", { name: "resonates" })).toBeTruthy(), {
      timeout: 5000,
    });

    // P4: BEFORE reacting, no distribution is shown.
    expect(screen.queryByText(/Across the community/)).toBeNull();

    // React — and the distribution REVEALS (it is a CHILD of the pinned peer
    // card, so its presence proves the card stayed mounted through the reveal
    // rather than unmounting the instant `reacted` flipped).
    fireEvent.click(screen.getByRole("button", { name: "resonates" }));
    await waitFor(
      () => {
        expect(screen.getByText(/Across the community: 5 resonate/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
    // The reacted peer statement is still on screen (pinned, not unmounted).
    expect(screen.getAllByText(`“${PEER_TEXT}”`).length).toBeGreaterThanOrEqual(1);
  });
});
