// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B proposals board (S2): the Proposals spine branches to infra
// cards for a scope whose artifactKinds include "infra-proposal" — kind /
// breaking / role badges, the migration story, the running-code LINK (never
// fetched), the needs-portfolio filter, and the honest empty state. The apps
// path is untouched (its own tests keep passing unchanged).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../../lib/aggregate.js";
import {
  KIND_DEPRECATION,
  KIND_SPEC_CHANGE,
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
} from "../../lib/fut-draft.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Proposals } from "./Proposals.js";

const DELIB = "https://demo.unite.example/deliberations/infrastructure";
const NEED = "https://a.example/needs/versioning.ttl";

const result: AggregateResult = {
  deliberation: DELIB,
  needs: [
    {
      id: NEED,
      content: "Protocol changes must be versioned.",
      needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-protection",
      created: "2026-06-03T10:00:00Z",
      creator: "https://a.example/#me",
      inDeliberation: DELIB,
    },
  ],
  resonances: [],
  proposals: [],
  infraProposals: [
    {
      id: "https://a.example/proposals/futures-020.ttl",
      title: "Adopt futures sector 0.2.0",
      content: "Additive scope-B layer.",
      targetsSystem: ["https://w3id.org/jeswr/sectors/futures"],
      proposalKind: KIND_SPEC_CHANGE,
      affectsRole: [ROLE_IMPLEMENTER],
      breakingChange: false,
      referenceImplementation:
        "https://github.com/jeswr/solid-federation-vocab/commit/67b00beda1a05963842de75f72b9968ddca990e3",
      motivatedBy: [NEED],
      created: "2026-06-15T10:00:00Z",
      creator: "https://a.example/#me",
      inDeliberation: DELIB,
    },
    {
      id: "https://b.example/proposals/e2e.ttl",
      title: "Require E2E by default",
      content: "Operators should never read pod contents.",
      targetsSystem: ["https://w3id.org/jeswr/sectors/futures"],
      proposalKind: KIND_DEPRECATION,
      affectsRole: [ROLE_IMPLEMENTER, ROLE_OPERATOR],
      breakingChange: true,
      migrationPath: "A dual-read window while apps migrate.",
      motivatedBy: [NEED],
      created: "2026-06-17T09:45:00Z",
      creator: "https://b.example/#me",
      inDeliberation: DELIB,
    },
  ],
  candidates: [],
  critiques: [],
  synthesizable: new Set<string>([NEED]),
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

function renderBoard(trust: SessionTrust, r: AggregateResult | null = result) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Proposals
        scope={SCOPES.infrastructure}
        config={demoConfig("infrastructure")}
        webId={null}
        trust={trust}
        aggregate={asAggregate(r)}
      />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("InfraProposals board (the Proposals spine, scope-B cards)", () => {
  it("renders infra cards with kind, blast-radius and breaking badges", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    expect(screen.getByText("Infrastructure proposals")).toBeTruthy();
    expect(screen.getByText("Adopt futures sector 0.2.0")).toBeTruthy();
    expect(screen.getByText("spec change")).toBeTruthy();
    expect(screen.getByText("deprecation")).toBeTruthy();
    expect(screen.getByText("breaking")).toBeTruthy();
    expect(screen.getByText("non-breaking")).toBeTruthy();
    expect(screen.getAllByText("implementers").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("operators")).toBeTruthy();
  });

  it("shows the migration story on a breaking proposal", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    expect(screen.getByText(/A dual-read window/)).toBeTruthy();
  });

  it("shows running code as a LINK (never fetched), and the honest absence note without it", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    const link = screen.getByRole("link", { name: /67b00be/ });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/jeswr/solid-federation-vocab/commit/67b00beda1a05963842de75f72b9968ddca990e3",
    );
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(/No running code yet — required before/)).toBeTruthy();
  });

  it("the portfolio filter presents rival proposals for one need side by side", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    const chips = screen.getAllByRole("button", { name: /Protocol changes must be versioned/ });
    fireEvent.click(chips[0] as HTMLElement);
    expect(screen.getByText(/Portfolio:/)).toBeTruthy();
    expect(screen.getByText(/2 proposals answering/)).toBeTruthy();
  });

  it("points composing at the structured wizard (Compose), gated by the floor", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    const compose = screen.getByRole("link", { name: /Propose an infrastructure proposal/ });
    expect(compose.getAttribute("href")).toBe("#/compose");
  });

  it("LOCKS the compose affordance below the floor, with the explanatory notice", () => {
    renderBoard(asTrust({ tier: 0, roles: [] }));
    expect(screen.queryByRole("link", { name: /Propose an infrastructure proposal/ })).toBeNull();
    expect(screen.getByText(/requires a vouched membership/)).toBeTruthy();
  });

  it("shows the honest empty state when no proposals exist", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }), { ...result, infraProposals: [] });
    expect(screen.getByText("No infrastructure proposals yet")).toBeTruthy();
  });

  it("names the adoption instrument: the wire is the ballot box", () => {
    renderBoard(asTrust({ tier: 1, roles: [] }));
    expect(screen.getByText(/the wire is the ballot box/i)).toBeTruthy();
  });
});
