// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Trust view against the REAL seeded demo trust layer (no mocked
// verdicts): standings render from verified credentials; the steward issuance
// form round-trips a real signed credential into the holder's demo pod and the
// roll re-verifies it; non-stewards get the fail-closed locked state.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import { resetDemoInstances } from "../../demo/pods.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import type { SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Trust } from "./Trust.js";

const asTrust = (profile: TrustProfile | null): SessionTrust => ({
  profile,
  refresh: () => Promise.resolve(),
});

beforeEach(() => {
  resetDemoInstances();
});

afterEach(cleanup);

describe("Trust view — standings", () => {
  it("renders the verified community roll with tier + role badges (apps demo)", async () => {
    render(
      <Trust
        config={demoConfig("apps")}
        webId={null}
        trust={asTrust({ tier: 1, roles: ["steward"] })}
      />,
    );
    // The roll resolves REAL credentials from the seeded pods ("builder" only
    // exists once the verified roll + issuance form landed — the session's own
    // "steward" badge renders immediately, so it can't be the wait signal).
    await waitFor(() => expect(screen.getAllByText("builder").length).toBeGreaterThanOrEqual(2), {
      timeout: 4000,
    });
    expect(screen.getAllByText("steward").length).toBeGreaterThan(1); // you + hana
    expect(screen.getAllByText("reviewer").length).toBeGreaterThan(0);
    // Your standing reflects the session profile + the floor.
    expect(screen.getByText(/You meet this scope's participation floor/)).toBeTruthy();
  });

  it("tells an unvouched visitor the floor locks them out (infrastructure demo)", async () => {
    render(
      <Trust
        config={demoConfig("infrastructure")}
        webId={null}
        trust={asTrust({ tier: 0, roles: [] })}
      />,
    );
    await waitFor(
      () => expect(screen.getByText(/composing and reacting are locked/i)).toBeTruthy(),
      { timeout: 4000 },
    );
    // Not a steward here → the issuance form is replaced by the locked note.
    expect(screen.queryByText("Issue credential")).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/Only stewards may issue role credentials/)).toBeTruthy(),
    );
  });
});

describe("Trust view — steward issuance round-trip", () => {
  it("a steward issues efe a reviewer credential and the roll re-verifies it", async () => {
    render(
      <Trust
        config={demoConfig("apps")}
        webId={null}
        trust={asTrust({ tier: 1, roles: ["steward"] })}
      />,
    );
    const select = (await screen.findByLabelText(
      "participant to issue to",
      {},
      { timeout: 4000 },
    )) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: demoWebId("efe") } });
    const reviewerButtons = screen.getAllByRole("button", { name: "reviewer" });
    const roleButton = reviewerButtons[reviewerButtons.length - 1];
    if (!roleButton) throw new Error("no role button");
    fireEvent.click(roleButton);
    fireEvent.click(screen.getByRole("button", { name: "Issue credential" }));
    // The credential is SIGNED, written to efe's pod, and re-verified — for real.
    await waitFor(() => expect(screen.getByText(/^Issued —/)).toBeTruthy(), { timeout: 4000 });
    // Efe's row now carries the reviewer badge (chidi + dana + hana + efe = 4).
    await waitFor(() => expect(screen.getAllByText("reviewer").length).toBeGreaterThanOrEqual(4));
  });

  it("refuses to issue without a chosen participant (fail-closed form)", async () => {
    render(
      <Trust
        config={demoConfig("apps")}
        webId={null}
        trust={asTrust({ tier: 1, roles: ["steward"] })}
      />,
    );
    const issue = await screen.findByRole(
      "button",
      { name: "Issue credential" },
      { timeout: 4000 },
    );
    fireEvent.click(issue);
    await waitFor(() => expect(screen.getByText("Choose a participant to issue to.")).toBeTruthy());
  });
});

describe("Trust view — floors surfaced", () => {
  it("society (floor 0) tells a T0 session they may participate", async () => {
    render(
      <Trust config={demoConfig("society")} webId={null} trust={asTrust({ tier: 0, roles: [] })} />,
    );
    await waitFor(
      () =>
        expect(screen.getByText(/You meet this scope's participation floor \(T0\)/)).toBeTruthy(),
      { timeout: 4000 },
    );
    expect(SCOPES.society.minTierToPropose).toBe(0);
  });
});
