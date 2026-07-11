// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Behind-the-curtain (design/v2 06 §5): the visitor's session replays next
// to the engine state it produced — the drafter trace re-runs the REAL
// deterministic drafter, the deck's routing table shows the literal fields,
// the map places the viewer's own dot, and the pod inspector's delete
// triggers a live recompute (aggregate.refresh).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import { getDemoDeliberation, resetDemoInstances } from "../../demo/pods.js";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_RESONATES } from "../../lib/fut.js";
import type { MembershipTier } from "../../lib/membership.js";
import type { Need, Resonance } from "../../lib/model.js";
import type { Claim } from "../../lib/model-society.js";
import type { AggregateState } from "../../ui/hooks.js";
import { demoConfig } from "../../ui/state.js";
import { writeCircleMessage } from "../circle-data.js";
import { DEMO_CIRCLE } from "../demo-circle.js";
import { Curtain } from "./Curtain.js";

const CONFIG = demoConfig("society");
const NEED = "https://demo.unite.example/pods/farah/unite/society/needs/walkable.ttl";

function emptyResult(): AggregateResult {
  return {
    deliberation: CONFIG.deliberation,
    needs: [],
    resonances: [],
    proposals: [],
    infraProposals: [],
    candidates: [],
    critiques: [],
    visions: [],
    claims: [],
    values: [],
    synthesizable: new Set<string>(),
    verified: [],
    unverified: [],
    errors: [],
  };
}

const CLAIM = "https://demo.unite.example/pods/farah/unite/society/claims/safe.ttl";

function richAggregate(): AggregateState {
  const people = ["farah", "chidi", "gus", "hana", "ben", "you"];
  const need: Need = {
    id: NEED,
    content: "Streets designed for people first.",
    needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence",
    created: "2026-06-02T08:10:00Z",
    creator: demoWebId("farah"),
    inDeliberation: CONFIG.deliberation,
  };
  const claim: Claim = {
    id: CLAIM,
    content: "Every child should be able to cross safely.",
    adoptedBy: demoWebId("farah"),
    creator: demoWebId("farah"),
    created: "2026-06-14T09:30:00Z",
    inDeliberation: CONFIG.deliberation,
  };
  const resonances: Resonance[] = people.flatMap((who, i) => [
    {
      id: `https://r.example/n${i}`,
      onStatement: NEED,
      stance: STANCE_RESONATES,
      created: "2026-06-20T00:00:00Z",
      creator: demoWebId(who),
      inDeliberation: CONFIG.deliberation,
    },
    // Claim votes from OTHERS only, so the deck still deals it to "you".
    ...(who === "you"
      ? []
      : [
          {
            id: `https://r.example/c${i}`,
            onStatement: CLAIM,
            stance: STANCE_RESONATES,
            created: "2026-06-21T00:00:00Z",
            creator: demoWebId(who),
            inDeliberation: CONFIG.deliberation,
          },
        ]),
  ]);
  const verified = people.map((who) => ({
    webId: demoWebId(who),
    base: `https://demo.unite.example/pods/${who}/unite/society/`,
    tier: "T0" as MembershipTier,
  }));
  return {
    result: { ...emptyResult(), needs: [need], claims: [claim], resonances, verified },
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
  };
}

beforeEach(resetDemoInstances);
afterEach(cleanup);

describe("behind the curtain (#/curtain)", () => {
  it("replays the visitor's utterance through the REAL drafter, fields shown", async () => {
    const demo = await getDemoDeliberation("society");
    await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: "I want the crossing fixed before winter.",
      circle: DEMO_CIRCLE.id,
      published: new Date().toISOString(),
    });
    render(<Curtain aggregate={richAggregate()} config={CONFIG} />);
    const echoes = await screen.findAllByText(/I want the crossing fixed before winter/);
    expect(echoes.length).toBeGreaterThan(0);
    expect(screen.getByText("draft")).toBeTruthy(); // the drafter outcome, literal
    expect(screen.getAllByText(/it is deterministic, so this replay IS what/).length).toBe(1);
  });

  it("shows the deck's LITERAL routing fields and the viewer's matrix row", async () => {
    render(<Curtain aggregate={richAggregate()} config={CONFIG} />);
    await waitFor(() => expect(screen.getByText("ownClusterSeen")).toBeTruthy());
    expect(screen.getByText("neighbourResonance")).toBeTruthy();
    expect(screen.getByLabelText("your resonance-matrix row")).toBeTruthy();
    // The viewer reacted (resonates = 1 in their row).
    expect(screen.getByText(/1 = resonates, -1 = I see it differently/)).toBeTruthy();
  });

  it("places the viewer's own dot on the real map — ringed, named as theirs", async () => {
    render(<Curtain aggregate={richAggregate()} config={CONFIG} />);
    await waitFor(() => expect(screen.getByText(/The ringed dot is you/)).toBeTruthy());
  });

  it("the pod inspector deletes a real resource and triggers a live recompute", async () => {
    const demo = await getDemoDeliberation("society");
    await writeCircleMessage(demo.fetch, demo.you.base, {
      author: demo.you.webId,
      content: "Something to delete.",
      circle: DEMO_CIRCLE.id,
      published: new Date().toISOString(),
    });
    const aggregate = richAggregate();
    render(<Curtain aggregate={aggregate} config={CONFIG} />);
    const del = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(del);
    await waitFor(() => expect(aggregate.refresh).toHaveBeenCalled());
    // The resource is genuinely gone from the pod inspector.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Delete" })).toBeNull());
  });

  it("with nothing said yet, every section states its honest empty state", async () => {
    render(
      <Curtain
        aggregate={{ result: emptyResult(), loading: false, error: null, refresh: vi.fn() }}
        config={CONFIG}
      />,
    );
    expect(await screen.findByText(/You haven't said anything yet/)).toBeTruthy();
    expect(screen.getByText(/The map draws once reactions exist/)).toBeTruthy();
  });
});
