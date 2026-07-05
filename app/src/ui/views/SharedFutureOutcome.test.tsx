// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C output presentation (S4): the ENDORSED and DISAGREEMENT
// outcomes get the SAME publication panel (co-equal — never a failure
// banner); the dissent annex is mandatory (standing critiques, or the
// explicit no-dissent assertion); the ≥2-steward floor renders honestly
// UNMET; the method-provenance label is always present; an OPEN round
// renders nothing.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CandidateReception } from "../../lib/convergence.js";
import type { Critique } from "../../lib/model.js";
import { SCOPES } from "../../scope/scopes.js";
import { SharedFutureOutcome } from "./SharedFutureOutcome.js";

const reception = (outcome: CandidateReception["outcome"]): CandidateReception => ({
  candidate: "https://h.example/syntheses/s1.ttl",
  outcome,
  perCluster: [],
  score: 0.5,
  totalSeen: 8,
  clusterCount: 2,
});

const critique: Critique = {
  id: "https://d.example/critiques/c1.ttl",
  content: "This trades away carer mobility.",
  onStatement: "https://h.example/syntheses/s1.ttl",
  created: "2026-06-22T00:00:00Z",
  creator: "https://d.example/#me",
  inDeliberation: "https://demo.unite.example/deliberations/society",
};

afterEach(cleanup);

describe("SharedFutureOutcome", () => {
  it("renders nothing while the round is open", () => {
    const { container } = render(
      <SharedFutureOutcome scope={SCOPES.society} reception={reception("open")} critiques={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("presents an ENDORSED candidate as a publishable shared future with its dissent annex", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[critique]}
      />,
    );
    expect(screen.getByText("What publishes: a shared future")).toBeTruthy();
    expect(screen.getByText(/1 standing critique/)).toBeTruthy();
    expect(screen.getByText(/0 of ≥2 required/)).toBeTruthy();
    expect(screen.getByText(/resonance mapping/)).toBeTruthy();
    expect(screen.getByText(/not a representative sample/)).toBeTruthy();
    expect(screen.getByText(/institutions and humans decide/)).toBeTruthy();
  });

  it("presents the DISAGREEMENT map as a CO-EQUAL publication, never a failure", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("disagreement")}
        critiques={[critique]}
      />,
    );
    expect(
      screen.getByText("What publishes: the disagreement map — a first-class outcome"),
    ).toBeTruthy();
    expect(screen.getByText(/not a failure/)).toBeTruthy();
    // Same signing + provenance obligations as an endorsement.
    expect(screen.getByText(/0 of ≥2 required/)).toBeTruthy();
    expect(screen.getByText(/resonance mapping/)).toBeTruthy();
  });

  it("an EMPTY dissent annex requires the explicit no-dissent assertion (silence ≠ consensus)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
      />,
    );
    expect(screen.getByText(/fut:noDissentRecorded true/)).toBeTruthy();
    expect(screen.getByText(/silence is never treated as consensus/)).toBeTruthy();
  });

  it("the steward floor comes from the scope's endorsement gate (raise-only)", () => {
    const raised = {
      ...SCOPES.society,
      endorsementGate: { ...SCOPES.society.endorsementGate, stewardSignatures: 3 },
    };
    render(<SharedFutureOutcome scope={raised} reception={reception("endorsed")} critiques={[]} />);
    expect(screen.getByText(/0 of ≥3 required/)).toBeTruthy();
  });
});
