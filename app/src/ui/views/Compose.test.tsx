// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Compose participation gate (design/04 §4.1): a floor-1 scope LOCKS the
// form for anyone below T1 with an explanatory panel (never a silent failure),
// resolves fail-closed while the profile is loading, and floor-0 (society)
// keeps pseudonymous voice open. The gate reads the session's VERIFIED profile.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Compose } from "./Compose.js";

const asTrust = (profile: TrustProfile | null): SessionTrust => ({
  profile,
  refresh: () => Promise.resolve(),
});

function renderCompose(scopeId: "apps" | "infrastructure" | "society", trust: SessionTrust) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Compose scope={SCOPES[scopeId]} config={demoConfig(scopeId)} webId={null} trust={trust} />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("Compose participation gate", () => {
  it("LOCKS a floor-1 scope for a T0 session, with the explanatory panel", () => {
    renderCompose("infrastructure", asTrust({ tier: 0, roles: [] }));
    expect(screen.getByText("Proposing here needs a vouched membership")).toBeTruthy();
    expect(screen.getByText(/You currently hold/)).toBeTruthy();
    // The form itself must NOT render.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Share this/ })).toBeNull();
    // The path out is explained and linked.
    expect(screen.getByRole("link", { name: "Trust" })).toBeTruthy();
  });

  it("fails closed while the profile is still resolving (no form flash)", () => {
    renderCompose("infrastructure", asTrust(null));
    expect(screen.getByText("Checking your standing…")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens the form for a vouched member in a floor-1 scope", () => {
    renderCompose("apps", asTrust({ tier: 1, roles: [] }));
    expect(screen.queryByText("Proposing here needs a vouched membership")).toBeNull();
    expect(screen.getByRole("button", { name: /Share this app proposal/ })).toBeTruthy();
  });

  it("keeps a floor-0 scope (society) open to pseudonymous voice — even at T0", () => {
    // S4: society mounts its OWN grammar — the narrative→decompose→adopt
    // wizard (the composeFlow seam), open at T0.
    renderCompose("society", asTrust({ tier: 0, roles: [] }));
    expect(screen.queryByText(/needs a vouched membership/)).toBeNull();
    expect(screen.getByText("Share a vision")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next: split it/ })).toBeTruthy();
  });

  it("keeps society open even while the profile is resolving (floor 0 needs no proof)", () => {
    renderCompose("society", asTrust(null));
    expect(screen.getByRole("button", { name: /Next: split it/ })).toBeTruthy();
  });
});
