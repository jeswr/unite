// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C compose inversion (S4 — §4.3): the wizard walks
// tell → split → adopt → voice&consent; atoms start UNADOPTED and only
// adopted atoms are written (the C6 invariant end-to-end against the demo
// pod); the C4 sensitive screen refuses before any write; the manual-first
// assistant seam is honest about proposing nothing; T0 composes at floor 0.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDemoDeliberation, resetDemoInstances } from "../../demo/pods.js";
import { aggregateDeliberation } from "../../lib/aggregate.js";
import { StubMembershipVerifier } from "../../lib/membership.js";
import { StaticRegistry } from "../../lib/registry.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { SessionTrust } from "../hooks.js";
import { demoConfig } from "../state.js";
import { NarrativeCompose } from "./NarrativeCompose.js";

const asTrust = (profile: TrustProfile | null): SessionTrust => ({
  profile,
  refresh: () => Promise.resolve(),
});

function renderWizard(trust: SessionTrust = asTrust({ tier: 0, roles: [] })) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <NarrativeCompose
        scope={SCOPES.society}
        config={demoConfig("society")}
        webId={null}
        trust={trust}
      />
    </AuthProvider>,
  );
}

const narrativeBox = () => screen.getByPlaceholderText(/Write it whole/);
const next = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function walkToConsent(narrative: string, adoptClaim: boolean): void {
  fireEvent.change(narrativeBox(), { target: { value: narrative } });
  next(/Next: split it/);
  fireEvent.click(screen.getByRole("button", { name: "+ blank claim" }));
  next(/Next: adopt each/);
  const textarea = screen.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA");
  if (!textarea) throw new Error("no atom textarea");
  fireEvent.change(textarea, { target: { value: "Buses should run past midnight." } });
  if (adoptClaim) {
    fireEvent.click(screen.getByRole("checkbox", { name: /Adopt this claim/ }));
  }
  next(/Next: voice & consent/);
}

beforeEach(() => {
  resetDemoInstances();
});
afterEach(cleanup);

async function aggregateSociety() {
  const demo = await getDemoDeliberation("society");
  const registry = new StaticRegistry(demo.deliberation, [...demo.participants]);
  const verifier = new StubMembershipVerifier(demo.participants.map((p) => p.webId));
  return aggregateDeliberation({
    registry,
    verifier,
    fetch: demo.fetch,
    kinds: ["need", "vision", "claim", "value"],
  });
}

describe("NarrativeCompose (the §4.3 wizard)", () => {
  it("opens at T0 (floor 0 — pseudonymous voice composes) on the TELL step", () => {
    renderWizard();
    expect(screen.getByText("Share a vision")).toBeTruthy();
    expect(narrativeBox()).toBeTruthy();
    // Forward navigation is gated on a narrative existing.
    expect(
      (screen.getByRole("button", { name: /Next: split it/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("walks tell → split → adopt; atoms start UNADOPTED (adoption is explicit)", () => {
    renderWizard();
    fireEvent.change(narrativeBox(), { target: { value: "I want walkable streets for my kids." } });
    next(/Next: split it/);
    expect(screen.getByText(/0 atoms drafted/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ blank claim" }));
    expect(screen.getByText(/1 atom drafted/)).toBeTruthy();
    next(/Next: adopt each/);
    const adopt = screen.getByRole("checkbox", { name: /Adopt this claim/ }) as HTMLInputElement;
    expect(adopt.checked).toBe(false); // unadopted by default — the C6 gate
    expect(screen.getByText(/0 of 1 adopted/)).toBeTruthy();
  });

  it("the manual-first assistant seam proposes NOTHING and says so honestly", async () => {
    renderWizard();
    fireEvent.change(narrativeBox(), { target: { value: "A story to split." } });
    next(/Next: split it/);
    fireEvent.click(screen.getByRole("button", { name: "Suggest a split" }));
    await waitFor(() => {
      expect(screen.getByText(/No assistant is wired into this build/)).toBeTruthy();
    });
    expect(screen.getByText(/0 atoms drafted/)).toBeTruthy();
  });

  it("REFUSES personal health disclosure at submit (the C4 gate), writing nothing", async () => {
    renderWizard();
    walkToConsent("Since my diagnosis I want better buses.", false);
    fireEvent.click(screen.getByRole("button", { name: /Share this vision statement/ }));
    await waitFor(() => {
      expect(screen.getByText(/This looks like personal health information/)).toBeTruthy();
    });
    const before = await aggregateSociety();
    // Nothing new was written: the demo seed counts are unchanged.
    expect(before.visions.filter((v) => v.content.includes("diagnosis"))).toEqual([]);
  });

  it("writes the vision + ONLY the adopted atoms to the demo pod (end-to-end)", async () => {
    renderWizard();
    fireEvent.change(narrativeBox(), {
      target: { value: "I want to cross town after dark without a car." },
    });
    next(/Next: split it/);
    // Two claims: one to adopt, one to leave unadopted.
    fireEvent.click(screen.getByRole("button", { name: "+ blank claim" }));
    fireEvent.click(screen.getByRole("button", { name: "+ blank claim" }));
    next(/Next: adopt each/);
    const textareas = screen
      .getAllByRole("textbox")
      .filter((t) => t.tagName === "TEXTAREA") as HTMLTextAreaElement[];
    fireEvent.change(textareas[0] as HTMLTextAreaElement, {
      target: { value: "Night buses every 20 minutes." },
    });
    fireEvent.change(textareas[1] as HTMLTextAreaElement, {
      target: { value: "This one stays unadopted." },
    });
    const adopts = screen.getAllByRole("checkbox", { name: /Adopt this claim/ });
    fireEvent.click(adopts[0] as HTMLElement); // adopt only the first
    next(/Next: voice & consent/);
    fireEvent.click(screen.getByRole("button", { name: /Share this vision statement \+ 1 atom/ }));
    await waitFor(() => {
      expect(screen.getByText(/Saved to the demo pod/)).toBeTruthy();
    });
    const result = await aggregateSociety();
    expect(result.visions.some((v) => v.content.includes("after dark"))).toBe(true);
    expect(result.claims.some((c) => c.content === "Night buses every 20 minutes.")).toBe(true);
    // The unadopted atom was NEVER written — adoption confers authorship.
    expect(result.claims.some((c) => c.content === "This one stays unadopted.")).toBe(false);
    // The written claim traces to the written vision and is self-adopted.
    const written = result.claims.find((c) => c.content === "Night buses every 20 minutes.");
    expect(written?.adoptedBy).toBe(written?.creator);
    expect(result.visions.map((v) => v.id)).toContain(written?.derivedFrom);
  });

  it("labels the T0 voice honestly on the consent step", () => {
    renderWizard();
    walkToConsent("A future where the square has benches.", true);
    expect(screen.getAllByText(/pseudonymous voice/).length).toBeGreaterThan(0);
    expect(screen.getByText(/signed aggregates may persist after you delete/i)).toBeTruthy();
    expect(screen.getByText(/low-sensitivity civic topics only/)).toBeTruthy();
  });

  it("an UNADOPTED sensitive draft does not block a clean vision (only what writes is screened)", async () => {
    renderWizard();
    fireEvent.change(narrativeBox(), { target: { value: "A clean civic future." } });
    next(/Next: split it/);
    fireEvent.click(screen.getByRole("button", { name: "+ blank claim" }));
    next(/Next: adopt each/);
    const textarea = screen.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA");
    if (!textarea) throw new Error("no atom textarea");
    // Sensitive text in a draft the author does NOT adopt — never written,
    // so it must not block the share.
    fireEvent.change(textarea, { target: { value: "my diagnosis is nobody's business" } });
    next(/Next: voice & consent/);
    fireEvent.click(screen.getByRole("button", { name: /Share this vision statement$/ }));
    await waitFor(() => {
      expect(screen.getByText(/Saved to the demo pod/)).toBeTruthy();
    });
    const result = await aggregateSociety();
    expect(result.claims.some((c) => c.content.includes("diagnosis"))).toBe(false);
    expect(result.visions.some((v) => v.content === "A clean civic future.")).toBe(true);
  });

  it("an ASSISTED split carries concepts + the disclosed decomposition activity to the writes", async () => {
    const ACTIVITY = "https://assist.example/activities/run-1";
    const assistant = {
      decompose: () =>
        Promise.resolve({
          atoms: [
            { kind: "claim" as const, content: "Later buses on weekends." },
            {
              kind: "need" as const,
              content: "Getting home safely at night.",
              needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-protection",
            },
          ],
          provenance: { tool: "example-model", plan: "prompt-v1", activity: ACTIVITY },
        }),
    };
    render(
      <AuthProvider controller={new DevLoginController()}>
        <NarrativeCompose
          scope={SCOPES.society}
          config={demoConfig("society")}
          webId={null}
          trust={asTrust({ tier: 0, roles: [] })}
          assistant={assistant}
        />
      </AuthProvider>,
    );
    fireEvent.change(narrativeBox(), { target: { value: "I want safe nights out." } });
    next(/Next: split it/);
    fireEvent.click(screen.getByRole("button", { name: "Suggest a split" }));
    await waitFor(() => {
      expect(screen.getByText(/The assistant proposed 2 atoms/)).toBeTruthy();
    });
    next(/Next: adopt each/);
    // The assistant's need-concept suggestion pre-fills the picker.
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "https://w3id.org/jeswr/sectors/futures#maxneef-protection",
    );
    // Adopt both proposed atoms — adoption stays the author's explicit act.
    for (const box of screen.getAllByRole("checkbox", { name: /Adopt this/ })) {
      fireEvent.click(box);
    }
    next(/Next: voice & consent/);
    fireEvent.click(screen.getByRole("button", { name: /Share this vision statement \+ 2 atoms/ }));
    await waitFor(() => {
      expect(screen.getByText(/Saved to the demo pod/)).toBeTruthy();
    });
    const result = await aggregateSociety();
    const claim = result.claims.find((c) => c.content === "Later buses on weekends.");
    expect(claim?.decomposedBy).toBe(ACTIVITY); // assisted splits are never invisible
    const need = result.needs.find((n) => n.content === "Getting home safely at night.");
    expect(need?.needConcept).toBe("https://w3id.org/jeswr/sectors/futures#maxneef-protection");
  });
});
