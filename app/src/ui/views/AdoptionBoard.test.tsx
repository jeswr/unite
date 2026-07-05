// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Adoption board view (S2): in demo mode it observes the sandboxed
// fedreg:StorageDescription seeds through the REAL pipeline and renders the
// computed matrix — 0.1.0 Current (bar met on observed evidence), 0.2.0
// Proposed with NO advertisers (the honest emptiness); statuses are computed,
// re-check links carry every cell's source; and with no observable sources
// the board renders the honest empty state, never fake data.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AdoptionDecisionVerification } from "../../lib/adoption-decision.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { SignedAdoptionDecision } from "../sign-decision.js";
import { demoConfig, podConfig } from "../state.js";
import { AdoptionBoard, activeAdoptionSnapshot } from "./AdoptionBoard.js";

function renderBoard(
  config = demoConfig("infrastructure"),
  decisions: readonly SignedAdoptionDecision[] = [],
) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <AdoptionBoard scope={SCOPES.infrastructure} config={config} decisions={decisions} />
    </AuthProvider>,
  );
}

/** A signed-decision stub recommending a governed version at a given bar. */
function decisionStub(version: string, bar: number, id: string): SignedAdoptionDecision {
  return {
    id,
    candidate: `${id}#cand`,
    quads: [],
    vcs: [],
    verification: {
      decision: {
        id,
        content: `Recommend ${version} at bar ${bar}.`,
        proposesVersion: version,
        adoptionBar: bar,
        adoptionEvidence: [],
        derivedFrom: [`${id}#cand`],
        bridgingEvidence: [],
        created: "2026-07-05T00:00:00Z",
        creator: "https://hana.example/#me",
        inDeliberation: "https://demo.unite.example/deliberations/infrastructure",
        hasDissentAnnex: true,
      },
      quorum: {
        met: true,
        threshold: 2,
        distinctStewards: 2,
        stewards: [],
        rejected: [],
        bootstrapping: false,
      },
      ratified: true,
      lineageConsented: true,
      computedStatus: "current",
    } as unknown as AdoptionDecisionVerification,
  };
}

afterEach(cleanup);

describe("activeAdoptionSnapshot (the pure render derivation — the no-stale-frame proof)", () => {
  const demoSnap = { observations: [], errors: [] };
  const stored = { key: JSON.stringify(["demo", "https://d.example/infra"]), snap: demoSnap };

  it("resolves a snapshot ONLY under the config key it was observed with", () => {
    expect(activeAdoptionSnapshot(stored, stored.key)).toBe(demoSnap);
  });

  it("resolves NULL for any other config key — a stale snapshot is unrenderable by construction, no effect involved", () => {
    expect(
      activeAdoptionSnapshot(stored, JSON.stringify(["pod", "https://d.example/infra"])),
    ).toBeNull();
    expect(
      activeAdoptionSnapshot(stored, JSON.stringify(["demo", "https://other.example/x"])),
    ).toBeNull();
    expect(activeAdoptionSnapshot(null, stored.key)).toBeNull();
  });
});

describe("AdoptionBoard (the ratification instrument)", () => {
  it("renders the computed matrix from the demo seeds: 0.1.0 Current, 0.2.0 honestly empty", async () => {
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/current — bar met on observed evidence/)).toBeTruthy();
    });
    // 0.1.0: both demo storages advertise.
    expect(screen.getByText("https://demo.unite.example/storages/alpha/")).toBeTruthy();
    expect(screen.getByText("https://demo.unite.example/storages/beta/")).toBeTruthy();
    // 0.2.0: recommended by the room, adopted by nobody — computed Proposed.
    expect(screen.getByText(/proposed — the wire hasn't adopted it/)).toBeTruthy();
    expect(screen.getByText("No advertisers observed.")).toBeTruthy();
  });

  it("every cell carries its re-checkable source link (an index entry is a cache)", async () => {
    renderBoard();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "re-check" }).length).toBe(2);
    });
    const hrefs = screen
      .getAllByRole("link", { name: "re-check" })
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://demo.unite.example/registry/storage-alpha.ttl");
    expect(hrefs).toContain("https://demo.unite.example/registry/storage-beta.ttl");
  });

  it("says the quiet part out loud: only the advertising half of the bar is machine-observable", async () => {
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText(/implementation independence still/i)).toBeTruthy();
    });
    expect(screen.getByText(/live in.*Convergence room/)).toBeTruthy();
  });

  it("S3.6: a signed decision's live status honors ITS OWN adoptionBar, not the board default (roborev Medium)", async () => {
    // The demo advertises 0.1.0 with 2 storages. A decision recommending 0.1.0
    // at a HIGHER bar (5) must render "2 of ≥5" (its own bar, unmet) — never
    // shown as met against the board's default bar of 2.
    const V010 = "https://w3id.org/jeswr/sectors/futures/0.1.0";
    renderBoard(demoConfig("infrastructure"), [
      decisionStub(V010, 5, "https://d.example/high#adoption-decision"),
    ]);
    await waitFor(() => {
      expect(screen.getByText("Signed adoption decisions")).toBeTruthy();
    });
    // The decision card recomputes against its OWN bar of 5 (2 advertisers < 5).
    expect(await screen.findByText(/2 of ≥5 advertising/)).toBeTruthy();
    expect(screen.getByText(/this decision's own bar/)).toBeTruthy();
  });

  it("resets the source list on a demo→pod config switch (roborev Low: never observes the previous mode's sources)", async () => {
    const { rerender } = renderBoard();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: "re-check" }).length).toBe(2);
    });
    const textarea = screen.getByPlaceholderText(/fedreg.ttl/) as HTMLTextAreaElement;
    expect(textarea.value).toContain("storage-alpha");
    rerender(
      <AuthProvider controller={new DevLoginController()}>
        <AdoptionBoard scope={SCOPES.infrastructure} config={podConfig(SCOPES.infrastructure)} />
      </AuthProvider>,
    );
    // After the switch the demo source list AND the demo snapshot are gone.
    // (testing-library flushes effects inside act(), so this DOM check alone
    // cannot prove the no-stale-FRAME property — that is proven directly on
    // the pure render derivation in the activeAdoptionSnapshot suite below.)
    expect((screen.getByPlaceholderText(/fedreg.ttl/) as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("link", { name: "re-check" })).toBeNull();
    expect(screen.getByText("Nobody advertises this lineage yet")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Nobody advertises this lineage yet")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "re-check" })).toBeNull();
  });

  it("pod mode with no sources renders the HONEST empty matrix — never fake advertisers", async () => {
    renderBoard(podConfig(SCOPES.infrastructure));
    await waitFor(() => {
      expect(screen.getByText("Nobody advertises this lineage yet")).toBeTruthy();
    });
    expect(screen.getByText(/An empty matrix is the honest display/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "re-check" })).toBeNull();
  });
});
