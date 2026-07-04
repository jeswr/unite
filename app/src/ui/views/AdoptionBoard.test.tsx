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
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import { demoConfig, podConfig } from "../state.js";
import { AdoptionBoard } from "./AdoptionBoard.js";

function renderBoard(config = demoConfig("infrastructure")) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <AdoptionBoard scope={SCOPES.infrastructure} config={config} />
    </AuthProvider>,
  );
}

afterEach(cleanup);

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
    expect(screen.getByText(/arrive in S3/)).toBeTruthy();
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
    // The demo source list is gone in the SAME render cycle, the stale demo
    // snapshot is dropped, and the empty pod-mode matrix renders honestly.
    expect((screen.getByPlaceholderText(/fedreg.ttl/) as HTMLTextAreaElement).value).toBe("");
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
