// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Proposals board (S1): cards carry their needs trace (satisfier → needs),
// the portfolio filter groups rival proposals for one need, compose is
// tier-gated fail-closed, and the ≥1-need invariant is enforced in the form
// before any write.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_RESONATES } from "../../lib/fut.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Proposals } from "./Proposals.js";

const DELIB = "https://demo.unite.example/deliberations/apps";
const NEED_OFFLINE = "https://a.example/needs/offline.ttl";
const NEED_LOGIN = "https://b.example/needs/login.ttl";

const result: AggregateResult = {
  deliberation: DELIB,
  needs: [
    {
      id: NEED_OFFLINE,
      content: "Apps must keep working offline.",
      needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence",
      created: "2026-06-01T00:00:00Z",
      creator: "https://a.example/#me",
      inDeliberation: DELIB,
    },
    {
      id: NEED_LOGIN,
      content: "One sign-in across every app.",
      needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-participation",
      created: "2026-06-02T00:00:00Z",
      creator: "https://b.example/#me",
      inDeliberation: DELIB,
    },
  ],
  resonances: [
    {
      id: "https://a.example/resonances/r1.ttl",
      onStatement: "https://a.example/proposals/p1.ttl",
      stance: STANCE_RESONATES,
      created: "2026-06-20T00:00:00Z",
      creator: "https://a.example/#me",
      inDeliberation: DELIB,
    },
  ],
  proposals: [
    {
      id: "https://a.example/proposals/p1.ttl",
      title: "Pocket Notes",
      content: "Offline-first notes.",
      motivatedBy: [NEED_OFFLINE],
      created: "2026-06-18T00:00:00Z",
      creator: "https://a.example/#me",
      inDeliberation: DELIB,
    },
    {
      id: "https://b.example/proposals/p2.ttl",
      title: "Tunnel Docs",
      content: "Local-first docs.",
      motivatedBy: [NEED_OFFLINE, NEED_LOGIN],
      created: "2026-06-19T00:00:00Z",
      creator: "https://b.example/#me",
      inDeliberation: DELIB,
    },
  ],
  candidates: [],
  critiques: [],
  synthesizable: new Set<string>([NEED_OFFLINE, NEED_LOGIN]),
  verified: [],
  unverified: [],
  errors: [],
};

const asTrust = (profile: TrustProfile | null): SessionTrust => ({
  profile,
  refresh: () => Promise.resolve(),
});
const asAggregate = (r: AggregateResult | null): AggregateState => ({
  result: r,
  loading: false,
  error: null,
  refresh: vi.fn(async () => {}),
});

function renderProposals(trust: SessionTrust, r: AggregateResult | null = result) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Proposals
        scope={SCOPES.apps}
        config={demoConfig("apps")}
        webId={null}
        trust={trust}
        aggregate={asAggregate(r)}
      />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("Proposals board", () => {
  it("renders every proposal with its needs trace resolved to need content", () => {
    renderProposals(asTrust({ tier: 1, roles: [] }));
    expect(screen.getByText("Pocket Notes")).toBeTruthy();
    expect(screen.getByText("Tunnel Docs")).toBeTruthy();
    // The serves chips resolve the need IRIs to their content.
    expect(screen.getAllByText(/Apps must keep working offline/).length).toBeGreaterThan(0);
  });

  it("the portfolio filter presents rival proposals for one need side by side", () => {
    renderProposals(asTrust({ tier: 1, roles: [] }));
    // The filter chip row exists (needs with ≥1 proposal); filter to the shared need.
    const chips = screen.getAllByRole("button", { name: /Apps must keep working offline/ });
    fireEvent.click(chips[0] as HTMLElement);
    expect(screen.getByText(/Portfolio:/)).toBeTruthy();
    expect(screen.getByText(/2 proposals answering/)).toBeTruthy();
  });

  it("LOCKS compose below the floor (T0 in a floor-1 scope) with the explanatory notice", () => {
    renderProposals(asTrust({ tier: 0, roles: [] }));
    expect(screen.queryByRole("button", { name: /Propose an app proposal/ })).toBeNull();
    expect(screen.getByText(/requires a vouched membership/)).toBeTruthy();
  });

  it("fails closed while the profile is resolving (no compose button flash)", () => {
    renderProposals(asTrust(null));
    expect(screen.queryByRole("button", { name: /Propose an app proposal/ })).toBeNull();
  });

  it("enforces the ≥1-need invariant in the form BEFORE any write", () => {
    renderProposals(asTrust({ tier: 1, roles: [] }));
    fireEvent.click(screen.getByRole("button", { name: /Propose an app proposal/ }));
    fireEvent.change(screen.getByPlaceholderText(/Offline-first notes/), {
      target: { value: "A name" },
    });
    fireEvent.change(screen.getByPlaceholderText(/What should exist/), {
      target: { value: "An idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share this proposal" }));
    expect(screen.getByText(/Pick at least one shared need/)).toBeTruthy();
  });

  it("shows the empty state when no proposals exist yet", () => {
    renderProposals(asTrust({ tier: 1, roles: [] }), { ...result, proposals: [] });
    expect(screen.getByText("No proposals yet")).toBeTruthy();
  });
});
