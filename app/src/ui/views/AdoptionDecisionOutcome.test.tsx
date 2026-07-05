// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.5 — the AdoptionDecision output surface. The load-bearing assertions:
// the sign action is steward-gated FAIL-CLOSED (a non-steward / keyless /
// allowlist-less session sees an honestly-labelled locked state, never a
// button); the §3.4 both-partitions gate blocks the sign controls with the
// honest reason; the lib's refusal renders VERBATIM; and a signed decision
// renders its INV-3 COMPUTED status (recomputed from evidence, never
// asserted) plus the honest 1-of-≥2 quorum progress and the Adoption-board
// hand-off link.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdoptionDecisionVerification } from "../../lib/adoption-decision.js";
import type { CandidateReception, InfraCandidateReception } from "../../lib/convergence.js";
import { SCOPES } from "../../scope/scopes.js";
import type { SignedAdoptionDecision } from "../sign-decision.js";
import type { StewardSigningContext } from "../sign-future.js";
import { AdoptionDecisionOutcome, type DecisionSigning } from "./AdoptionDecisionOutcome.js";

const CAND = "https://h.example/syntheses/s1.ttl#it";
const VERSION = "https://w3id.org/jeswr/sectors/futures/0.2.0";

const opinion = (outcome: CandidateReception["outcome"]): CandidateReception => ({
  candidate: CAND,
  outcome,
  perCluster: [
    { resonates: 3, conflicts: 0, unsure: 0, seen: 3, size: 3 },
    { resonates: 2, conflicts: 1, unsure: 0, seen: 3, size: 3 },
  ],
  score: 0.8,
  totalSeen: 6,
  clusterCount: 2,
});

const role = (outcome: CandidateReception["outcome"]): CandidateReception => ({
  candidate: CAND,
  outcome,
  perCluster: [
    { resonates: 2, conflicts: 0, unsure: 0, seen: 2, size: 2 },
    { resonates: 3, conflicts: 1, unsure: 0, seen: 4, size: 4 },
  ],
  score: 0.75,
  totalSeen: 6,
  clusterCount: 2,
});

function infra(
  opinionOutcome: CandidateReception["outcome"],
  roleOutcome: CandidateReception["outcome"],
): InfraCandidateReception {
  const bothCleared = opinionOutcome === "endorsed" && roleOutcome === "endorsed";
  return {
    candidate: CAND,
    outcome: bothCleared ? "endorsed" : "open",
    opinion: opinion(opinionOutcome),
    role: role(roleOutcome),
    bothCleared,
  };
}

const ROLE_LABELS = ["role: implementers", "role: participants"];

/** A resolved signing context stub (the view only reads its shape). */
function context(trustedStewards: readonly string[] = ["https://hana.example/#me"]) {
  return {
    steward: { webId: "https://hana.example/#me", key: {} },
    trustedStewards,
    resolveKey: () => undefined,
    verifyVc: () => Promise.resolve({}),
  } as unknown as StewardSigningContext;
}

function signingProps(overrides: Partial<DecisionSigning> = {}): DecisionSigning {
  return {
    isSteward: true,
    gate: { allowed: true },
    context: context(),
    signed: null,
    busy: false,
    error: null,
    onSign: () => {},
    sources: "https://storage.example/registry/alpha.ttl",
    onSourcesChange: () => {},
    ...overrides,
  };
}

/** A signed-decision stub carrying only what the view renders. */
function signedStub(
  overrides: Partial<{
    distinctStewards: number;
    met: boolean;
    bootstrapping: boolean;
    ratified: boolean;
    computedStatus: "current" | "superseded" | "proposed";
  }> = {},
): SignedAdoptionDecision {
  const met = overrides.met ?? false;
  const verification = {
    decision: {
      id: "https://h.example/syntheses/s1.ttl#adoption-decision",
      content: "Recommend the scope-B layer.",
      proposesVersion: VERSION,
      adoptionBar: 2,
      adoptionEvidence: [
        {
          party: "https://storage-alpha.example/pods/",
          version: VERSION,
          observedAt: "2026-07-05T00:00:00Z",
          source: "https://storage-alpha.example/registry/alpha.ttl",
        },
      ],
      derivedFrom: [CAND],
      bridgingEvidence: [],
      created: "2026-07-05T00:00:00Z",
      creator: "https://hana.example/#me",
      inDeliberation: "https://demo.unite.example/deliberations/infrastructure",
      hasDissentAnnex: true,
    },
    quorum: {
      met,
      threshold: 2,
      distinctStewards: overrides.distinctStewards ?? 1,
      stewards: [],
      rejected: [],
      bootstrapping: overrides.bootstrapping ?? !met,
    },
    ratified: overrides.ratified ?? met,
    lineageConsented: true,
    computedStatus: overrides.computedStatus ?? "proposed",
  } as unknown as AdoptionDecisionVerification;
  return {
    id: "https://h.example/syntheses/s1.ttl#adoption-decision",
    candidate: CAND,
    quads: [],
    vcs: [],
    verification,
  };
}

afterEach(cleanup);

describe("AdoptionDecisionOutcome — the gate + locked states (fail-closed)", () => {
  it("renders NOTHING while the opinion round is still open", () => {
    const { container } = render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("open", "open")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("a NON-steward session sees the locked gate with the LIB's reason — never a sign control", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({
          isSteward: false,
          gate: {
            allowed: false,
            reason: "signing an adoption decision requires a verified steward role credential",
          },
        })}
      />,
    );
    expect(screen.getByText("Signing is steward-gated")).toBeTruthy();
    expect(screen.getByText(/requires a verified steward role credential/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
  });

  it("a steward WITHOUT a resolved context stays locked fail-closed", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({ context: null })}
      />,
    );
    expect(screen.getByText("Signing is locked (fail-closed)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
  });

  it("an EMPTY registry-backed steward allowlist stays locked fail-closed (INV-5)", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({ context: context([]) })}
      />,
    );
    expect(screen.getByText("Signing is locked (fail-closed)")).toBeTruthy();
    expect(screen.getByText(/no registry-backed steward allowlist/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
  });

  it("the §3.4 gate: role-lens OPEN BLOCKS the sign controls (strict, S3.6 pending) — no button, honest pending state", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "open")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    // STRICT §3.4: opinion endorsed but role unconfirmed ⇒ no sign control.
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
    // …and the role lens is honestly shown as pending the S3.6 data flow.
    expect(screen.getByText(/verified-role confirmation pending \(S3.6\)/)).toBeTruthy();
    expect(screen.getByText(/verified-role lens: open/)).toBeTruthy();
    expect(screen.getByText(/until then this gate stays closed/)).toBeTruthy();
  });

  it("the §3.4 gate: an active verified-role DISAGREEMENT blocks the sign controls (fail-safe)", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "disagreement")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
    expect(
      screen.getByText(/a verified stakeholder-role cohort actively opposes this/),
    ).toBeTruthy();
    expect(screen.getByText(/gate not cleared/)).toBeTruthy();
  });

  it("renders the role-cohort distributions with their canonical labels", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    expect(screen.getByText(/role: implementers: 2✓ 0✕ 0\? of 2/)).toBeTruthy();
    expect(screen.getByText(/role: participants: 3✓ 1✕ 0\? of 4/)).toBeTruthy();
  });
});

describe("AdoptionDecisionOutcome — the sign action + honest outcomes", () => {
  it("a steward with a cleared gate signs: the action fires with the selected version", () => {
    const onSign = vi.fn();
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({ onSign })}
      />,
    );
    expect(screen.getByText(/What your signature attests/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign this adoption decision as steward" }));
    // The default recommended version is the newest governed one (0.2.0).
    expect(onSign).toHaveBeenCalledWith(VERSION);
  });

  it("the lib's refusal renders VERBATIM as the un-signable state", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({
          error:
            "buildAdoptionDecision: derivedFrom input lacks fut:synthesize consent (not in the aggregate's synthesizable set)",
        })}
      />,
    );
    expect(screen.getByText(/Un-signable:.*lacks fut:synthesize consent/)).toBeTruthy();
  });

  it("a signed decision renders the honest 1-of-≥2 progress + the COMPUTED status + the board link", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({ signed: signedStub({ computedStatus: "proposed" }) })}
      />,
    );
    expect(screen.getByText(/1 of ≥2 stewards — quorum not met/)).toBeTruthy();
    expect(screen.getByText(/Computed status from that evidence: proposed/)).toBeTruthy();
    expect(screen.getByText(/recomputed, never asserted \(INV-3\)/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Adoption board" }).length).toBeGreaterThan(0);
  });

  it("a met quorum renders as ratified — the FULL lib verdict, never quorum alone", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({
          signed: signedStub({ distinctStewards: 2, met: true, ratified: true }),
        })}
      />,
    );
    expect(screen.getByText(/2 of ≥2 — quorum met/)).toBeTruthy();
    expect(screen.getByText(/quorum is met and the recommendation is ratified/)).toBeTruthy();
  });

  it("quorum met but NOT fully verified renders the honest divergence", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({
          signed: signedStub({ distinctStewards: 2, met: true, ratified: false }),
        })}
      />,
    );
    expect(screen.getByText(/does not fully verify \(not ratified\)/)).toBeTruthy();
  });

  it("a SINGLE-steward community shows the bootstrapping label — the floor never lowers", () => {
    render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps({ context: context(["https://hana.example/#me"]) })}
      />,
    );
    expect(screen.getByText(/bootstrapping: single-steward/)).toBeTruthy();
    expect(screen.getByText(/floor stands/)).toBeTruthy();
  });

  it("the dissent annex copy: standing critiques travel; none ⇒ the EXPLICIT no-dissent assertion", () => {
    const { rerender } = render(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[
          {
            id: "https://p3.example/critiques/c1.ttl#it",
            content: "A standing concern.",
            onStatement: CAND,
            created: "2026-07-02T00:00:00Z",
            creator: "https://p3.example/#me",
            inDeliberation: "https://demo.unite.example/deliberations/infrastructure",
          },
        ]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    expect(screen.getByText(/1 standing critique travels with the decision/)).toBeTruthy();
    rerender(
      <AdoptionDecisionOutcome
        scope={SCOPES.infrastructure}
        infra={infra("endorsed", "endorsed")}
        critiques={[]}
        roleLabels={ROLE_LABELS}
        signing={signingProps()}
      />,
    );
    expect(screen.getByText(/fut:noDissentRecorded true/)).toBeTruthy();
  });
});
