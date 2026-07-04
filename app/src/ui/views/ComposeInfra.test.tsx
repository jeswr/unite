// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The structured-infra compose wizard (S2 — SCOPE-DIFFERENTIATION §3.3):
// Compose mounts it for a scope whose composeFlow is "structured-infra" AFTER
// the tier gate (the gate tests live in Compose.test.tsx and still pass —
// same fail-closed floor); the wizard enforces every §3.3 invariant BEFORE
// any write (target ≥1, kind, breaking ⇒ migration story, roles ≥1, needs
// trace ≥1); and a fully-valid submission writes a real fut:InfraProposal
// through the demo pod path.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../../lib/aggregate.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Compose } from "./Compose.js";

const DELIB = "https://demo.unite.example/deliberations/infrastructure";
const NEED = "https://demo.unite.example/pods/chidi/unite/infrastructure/needs/n1.ttl";

const result: AggregateResult = {
  deliberation: DELIB,
  needs: [
    {
      id: NEED,
      content: "Protocol changes must be versioned and adoption-measured.",
      needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-protection",
      created: "2026-06-03T10:00:00Z",
      creator: "https://demo.unite.example/people/chidi/profile#me",
      inDeliberation: DELIB,
    },
  ],
  resonances: [],
  proposals: [],
  infraProposals: [],
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

function renderInfraCompose(trust: SessionTrust = asTrust({ tier: 1, roles: [] })) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Compose
        scope={SCOPES.infrastructure}
        config={demoConfig("infrastructure")}
        webId={null}
        trust={trust}
        aggregate={asAggregate(result)}
      />
    </AuthProvider>,
  );
}

/** Fill the wizard to a fully-valid state, then override per test. */
function fillValid(): void {
  fireEvent.click(screen.getByRole("button", { name: /futures sector/ })); // target
  fireEvent.click(screen.getByRole("button", { name: "spec change" })); // kind
  fireEvent.change(screen.getByPlaceholderText(/Adopt futures sector/), {
    target: { value: "A change" },
  });
  fireEvent.change(screen.getByPlaceholderText(/What changes, and why/), {
    target: { value: "Because interop." },
  });
  fireEvent.click(screen.getByRole("button", { name: "implementers" })); // role
  fireEvent.click(screen.getByRole("button", { name: /Protocol changes must be versioned/ })); // need
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /Put this change to the deliberation/ }));

afterEach(cleanup);

describe("Compose mounts the structured-infra wizard (the composeFlow seam, S2)", () => {
  it("renders the wizard — numbered §3.3 sections — for a vouched member", () => {
    renderInfraCompose();
    expect(screen.getByText("Propose an infrastructure change")).toBeTruthy();
    expect(screen.getByText(/1 · Target system/)).toBeTruthy();
    expect(screen.getByText(/2 · The change/)).toBeTruthy();
    expect(screen.getByText(/3 · Who is affected/)).toBeTruthy();
    expect(screen.getByText(/4 · Which shared needs/)).toBeTruthy();
    expect(screen.getByText(/5 · Running code/)).toBeTruthy();
  });

  it("still LOCKS below the floor — the tier gate runs BEFORE the wizard branch", () => {
    renderInfraCompose(asTrust({ tier: 0, roles: [] }));
    expect(screen.getByText("Proposing here needs a vouched membership")).toBeTruthy();
    expect(screen.queryByText(/1 · Target system/)).toBeNull();
  });

  it("the need form stays one click away (needs feed the wizard's trace step) — and one click back", () => {
    renderInfraCompose();
    fireEvent.click(screen.getByRole("button", { name: "Share an infrastructure need" }));
    expect(screen.getByText(/composing a shared/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Back to the structured proposal wizard/ }));
    expect(screen.getByText(/1 · Target system/)).toBeTruthy();
  });
});

describe("the wizard's §3.3 invariants (validated BEFORE any write)", () => {
  it("requires ≥1 target system", () => {
    renderInfraCompose();
    submit();
    expect(screen.getByText(/Name the governed system/)).toBeTruthy();
  });

  it("requires a coded change kind", () => {
    renderInfraCompose();
    fireEvent.click(screen.getByRole("button", { name: /futures sector/ }));
    submit();
    expect(screen.getByText(/Pick the change kind/)).toBeTruthy();
  });

  it("requires a migration story when the change is breaking (interop honesty)", () => {
    renderInfraCompose();
    fillValid();
    fireEvent.click(screen.getByRole("checkbox", { name: /breaking change/ }));
    submit();
    expect(screen.getByText(/must carry a migration story/)).toBeTruthy();
  });

  it("requires ≥1 blast-radius role", () => {
    renderInfraCompose();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "implementers" })); // deselect
    submit();
    expect(screen.getByText(/Declare who the change touches/)).toBeTruthy();
  });

  it("requires the needs trace (value-centric — never a feature-request tracker)", () => {
    renderInfraCompose();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /Protocol changes must be versioned/ })); // deselect
    submit();
    expect(screen.getByText(/Trace the proposal to at least one shared need/)).toBeTruthy();
  });

  it("rejects a non-http(s) reference implementation", () => {
    renderInfraCompose();
    fillValid();
    fireEvent.change(screen.getByPlaceholderText(/github.com/), {
      target: { value: "javascript:alert(1)" },
    });
    submit();
    expect(screen.getByText(/must be an absolute http\(s\) IRI/)).toBeTruthy();
  });

  it("rejects a non-http(s) free target IRI at the add step", () => {
    renderInfraCompose();
    fireEvent.change(screen.getByLabelText("free target IRI"), {
      target: { value: "file:///etc/passwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));
    expect(screen.getByText(/must be an absolute http\(s\) IRI/)).toBeTruthy();
  });
});

describe("a valid submission writes through the real demo pod path", () => {
  it("saves and reports the created resource", async () => {
    renderInfraCompose();
    fillValid();
    fireEvent.change(screen.getByPlaceholderText(/github.com/), {
      target: { value: "https://github.com/jeswr/unite/commit/abc123" },
    });
    submit();
    await waitFor(() => {
      expect(screen.getByText(/Saved to the demo pod/)).toBeTruthy();
    });
  });
});
