// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Resonance deck (S4 — §4.4): deals exactly ONE routed card at a time
// (the lib/deck order), discloses the tier composition, labels T0 authors,
// carries NO reply surface, and renders honest empty/cleared states.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWebId } from "../../demo/fixtures.js";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_RESONATES } from "../../lib/fut.js";
import type { Resonance } from "../../lib/model.js";
import type { Claim } from "../../lib/model-society.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { Deck } from "./Deck.js";

const DELIB = "https://demo.unite.example/deliberations/society";
// The demo session identity ("you") — what sessionIdentity resolves in demo mode.
const YOU = demoWebId("you");
const P2 = "https://p2.example/#me";
const P3 = "https://p3.example/#me";

const claim = (id: string, content: string, creator: string): Claim => ({
  id,
  content,
  adoptedBy: creator,
  created: "2026-06-14T09:30:00Z",
  creator,
  inDeliberation: DELIB,
});

let seq = 0;
const vote = (creator: string, on: string): Resonance => {
  seq += 1;
  return {
    id: `https://r.example/${seq}`,
    onStatement: on,
    stance: STANCE_RESONATES,
    created: "2026-06-20T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
};

const C1 = "https://p2.example/claims/c1.ttl";
const C2 = "https://p3.example/claims/c2.ttl";

function resultWith(overrides: Partial<AggregateResult>): AggregateResult {
  return {
    deliberation: DELIB,
    needs: [],
    resonances: [],
    proposals: [],
    infraProposals: [],
    candidates: [],
    critiques: [],
    visions: [],
    claims: [
      claim(C1, "Safe crossings for every child.", P2),
      claim(C2, "Buses past midnight.", P3),
    ],
    values: [],
    synthesizable: new Set<string>(),
    verified: [
      { webId: YOU, base: "https://demo.unite.example/pods/you/unite/society/", tier: "T0" },
      { webId: P2, base: "https://p2.example/u/", tier: "T1" },
      { webId: P3, base: "https://p3.example/u/", tier: "T0" },
    ],
    unverified: [],
    errors: [],
    ...overrides,
  };
}

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

function renderDeck(r: AggregateResult | null) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Deck
        scope={SCOPES.society}
        config={demoConfig("society")}
        webId={null}
        trust={asTrust({ tier: 0, roles: [] })}
        aggregate={asAggregate(r)}
      />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("Deck", () => {
  it("deals exactly ONE card — the deterministic top of the routed queue", () => {
    renderDeck(resultWith({}));
    // Both claims unseen by "you"; totalSeen equal (0) → id order: C1 first.
    expect(screen.getByText("Safe crossings for every child.")).toBeTruthy();
    expect(screen.queryByText("Buses past midnight.")).toBeNull();
    expect(screen.getByText(/1 more in your deck/)).toBeTruthy();
  });

  it("labels a T0 author as pseudonymous voice, honestly", () => {
    // Route C2 (a T0 author's claim) to the top by marking C1 already seen.
    renderDeck(resultWith({ resonances: [vote(YOU, C1)] }));
    expect(screen.getByText("Buses past midnight.")).toBeTruthy();
    expect(screen.getByText("pseudonymous voice (T0)")).toBeTruthy();
  });

  it("discloses the tier composition (stratify-and-disclose)", () => {
    renderDeck(resultWith({}));
    expect(screen.getByLabelText("tier composition").textContent).toContain("T0: 2");
    expect(screen.getByLabelText("tier composition").textContent).toContain("T1: 1");
  });

  it("shows the honest cleared state once every claim was reacted to", () => {
    renderDeck(resultWith({ resonances: [vote(YOU, C1), vote(YOU, C2)] }));
    expect(screen.getByText(/Deck cleared/)).toBeTruthy();
  });

  it("shows the honest empty state when no claims exist yet", () => {
    renderDeck(resultWith({ claims: [] }));
    expect(screen.getByText("No claims yet")).toBeTruthy();
  });

  it("has NO reply surface anywhere (reactions, not threads)", () => {
    renderDeck(resultWith({}));
    expect(screen.queryByText(/repl(y|ies)/i)?.textContent ?? "no replies anywhere").toMatch(
      /no replies/i,
    );
    // No free-text input exists on the deck at all.
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
