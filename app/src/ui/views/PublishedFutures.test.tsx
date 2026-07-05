// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S5.5 the Published-futures renderer: an honest empty state until a community
// signs one (never a faked surface), and — with data — a signed shared future
// rendered ONLY with its verified integrity proof, mandatory dissent annex,
// recomputable bridging evidence and method-provenance label; a disagreement map
// is a CO-EQUAL published outcome.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AGGREGATE_DISSENT_PLACEHOLDER } from "../../lib/dissent.js";
import { METHOD_RESONANCE_MAPPING } from "../../lib/fut-society.js";
import { SCOPES } from "../../scope/scopes.js";
import { PublishedFutures, type PublishedFutureView } from "./PublishedFutures.js";

afterEach(cleanup);

const sample = (overrides: Partial<PublishedFutureView> = {}): PublishedFutureView => ({
  id: "https://d.example/futures/sf-1.ttl#it",
  title: "Housing 2040",
  content: "Universal access to affordable housing by 2040.",
  methodProvenance: METHOD_RESONANCE_MAPPING,
  bridgingEvidence: [
    {
      clusterLabel: "cluster-0",
      resonatesCount: 4,
      conflictsCount: 0,
      unsureCount: 0,
      seenCount: 4,
    },
    {
      clusterLabel: "cluster-1",
      resonatesCount: 3,
      conflictsCount: 1,
      unsureCount: 0,
      seenCount: 4,
    },
  ],
  dissent: [
    { content: "This overlooks renters.", verbatim: true, creator: "https://c.example/#me" },
    { content: AGGREGATE_DISSENT_PLACEHOLDER, verbatim: false },
  ],
  noDissentRecorded: false,
  distinctStewards: 2,
  stewardFloor: 2,
  quorumMet: true,
  bootstrapping: false,
  kAnonymous: true,
  kind: "shared-future",
  ...overrides,
});

describe("PublishedFutures", () => {
  it("renders an HONEST empty state when nothing is signed yet (not faked)", () => {
    render(<PublishedFutures scope={SCOPES.society} />);
    expect(screen.getByText("No published futures")).toBeTruthy();
    expect(screen.getByText(/un-signable/)).toBeTruthy();
  });

  it("renders a signed shared future with its integrity proof + dissent annex + bridging", () => {
    render(<PublishedFutures scope={SCOPES.society} futures={[sample()]} />);
    expect(screen.getByText("Housing 2040")).toBeTruthy();
    expect(screen.getByText(/integrity proof verified/)).toBeTruthy();
    // the dissent annex shows both a quoted + an aggregate record
    expect(screen.getByText(/This overlooks renters\./)).toBeTruthy();
    expect(screen.getByText(new RegExp(AGGREGATE_DISSENT_PLACEHOLDER.slice(0, 20)))).toBeTruthy();
    // the method-provenance label + the k-anon badge
    expect(screen.getByText(/resonance mapping/)).toBeTruthy();
    expect(screen.getByText(/k-anonymous metrics/)).toBeTruthy();
  });

  it("renders a disagreement map as a CO-EQUAL outcome (never a failure banner)", () => {
    render(
      <PublishedFutures
        scope={SCOPES.society}
        futures={[sample({ kind: "disagreement-map", title: "Where we divide" })]}
      />,
    );
    expect(screen.getByText(/disagreement map — a first-class outcome/)).toBeTruthy();
  });

  it("shows the honest single-steward bootstrapping state (unmet quorum)", () => {
    render(
      <PublishedFutures
        scope={SCOPES.society}
        futures={[sample({ distinctStewards: 1, quorumMet: false, bootstrapping: true })]}
      />,
    );
    expect(screen.getByText(/bootstrapping: single-steward/)).toBeTruthy();
  });

  it("does NOT render 'verified' for a claimed 1 of ≥1 (defends the ≥2 no-single-owner floor)", () => {
    // A caller cannot render an integrity proof as verified below the ≥2 floor, even
    // by claiming stewardFloor=1 + quorumMet=true — the card normalises the floor.
    render(
      <PublishedFutures
        scope={SCOPES.society}
        futures={[sample({ stewardFloor: 1, distinctStewards: 1, quorumMet: true })]}
      />,
    );
    expect(screen.queryByText(/integrity proof verified/)).toBeNull();
    expect(screen.getByText(/of ≥2/)).toBeTruthy();
  });

  it("renders the explicit no-dissent assertion when the annex is empty", () => {
    render(
      <PublishedFutures
        scope={SCOPES.society}
        futures={[sample({ dissent: [], noDissentRecorded: true })]}
      />,
    );
    expect(screen.getByText(/fut:noDissentRecorded true/)).toBeTruthy();
  });
});
