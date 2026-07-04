// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Futures gallery (S4 — §4.4): whole narratives, shared needs FIRST,
// across-the-divide badged, the viewer's own visions excluded, scope-ladder +
// horizon rendered, honest empty states. Ordering itself is characterised in
// lib/gallery.test.ts — here we verify the view renders the routed evidence.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_RESONATES } from "../../lib/fut.js";
import { SCOPE_COMMUNITY } from "../../lib/fut-society.js";
import type { Need, Resonance } from "../../lib/model.js";
import type { VisionStatement } from "../../lib/model-society.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import { demoConfig } from "../state.js";
import { FuturesGallery } from "./FuturesGallery.js";

const DELIB = "https://demo.unite.example/deliberations/society";
const YOU = demoWebId("you");
const P2 = "https://p2.example/#me";
const FUT = "https://w3id.org/jeswr/sectors/futures#";

const N1 = "https://n.example/n1.ttl";
const need: Need = {
  id: N1,
  content: "Walkable streets.",
  needConcept: `${FUT}maxneef-subsistence`,
  created: "2026-06-01T00:00:00Z",
  creator: P2,
  inDeliberation: DELIB,
};

const vision = (id: string, creator: string, content: string): VisionStatement => ({
  id,
  content,
  title: "A future",
  scope: SCOPE_COMMUNITY,
  horizon: "2032",
  created: "2026-06-14T09:00:00Z",
  creator,
  inDeliberation: DELIB,
});

const vote = (creator: string, on: string, n: number): Resonance => ({
  id: `https://r.example/${n}`,
  onStatement: on,
  stance: STANCE_RESONATES,
  created: "2026-06-20T00:00:00Z",
  creator,
  inDeliberation: DELIB,
});

function resultWith(overrides: Partial<AggregateResult>): AggregateResult {
  return {
    deliberation: DELIB,
    needs: [need],
    // Both YOU and P2 endorse the subsistence need → a SHARED need concept.
    resonances: [vote(YOU, N1, 1), vote(P2, N1, 2)],
    proposals: [],
    candidates: [],
    critiques: [],
    visions: [
      vision("https://p2.example/visions/v1.ttl", P2, "Streets where my kids walk to school."),
      vision("https://you.example/visions/v-own.ttl", YOU, "My own story."),
    ],
    claims: [],
    values: [],
    synthesizable: new Set<string>(),
    verified: [
      { webId: YOU, base: "https://demo.unite.example/pods/you/unite/society/", tier: "T0" },
      { webId: P2, base: "https://p2.example/u/", tier: "T0" },
    ],
    unverified: [],
    errors: [],
    ...overrides,
  };
}

function renderGallery(r: AggregateResult | null) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <FuturesGallery
        scope={SCOPES.society}
        config={demoConfig("society")}
        webId={null}
        aggregate={{ result: r, loading: false, error: null, refresh: vi.fn(async () => {}) }}
      />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("FuturesGallery", () => {
  it("renders others' narratives with the SHARED NEEDS leading", () => {
    renderGallery(resultWith({}));
    expect(screen.getByText("Streets where my kids walk to school.")).toBeTruthy();
    expect(screen.getByText("you both need:")).toBeTruthy();
    expect(screen.getByText("Subsistence")).toBeTruthy();
  });

  it("excludes the viewer's OWN visions (the gallery is for meeting others)", () => {
    renderGallery(resultWith({}));
    expect(screen.queryByText("My own story.")).toBeNull();
  });

  it("renders the scope-ladder + horizon badges and the T0 label", () => {
    renderGallery(resultWith({}));
    expect(screen.getByText("for My community")).toBeTruthy();
    expect(screen.getByText("by 2032")).toBeTruthy();
    expect(screen.getByText("pseudonymous voice (T0)")).toBeTruthy();
  });

  it("shows the honest empty state when no visions exist", () => {
    renderGallery(resultWith({ visions: [] }));
    expect(screen.getByText("No shared futures yet")).toBeTruthy();
  });

  it("shows the honest only-yours state when every vision is the viewer's", () => {
    renderGallery(
      resultWith({ visions: [vision("https://you.example/visions/v-own.ttl", YOU, "Mine.")] }),
    );
    expect(screen.getByText("Only your own visions are here so far")).toBeTruthy();
  });
});
