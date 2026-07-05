// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-C output presentation (S4) + the S5.4 steward signing surface:
// the ENDORSED and DISAGREEMENT outcomes get the SAME publication panel
// (co-equal — never a failure banner); the dissent annex is mandatory
// (standing critiques, or the explicit no-dissent assertion); the ≥2-steward
// quorum progress renders honestly (unmet is unmet, the floor is never
// silently lowered); the method-provenance label is always present; an OPEN
// round renders nothing. The SIGN ACTION is steward-gated fail-closed: a
// non-steward (or a keyless / allowlist-less session) sees an honestly
// labelled locked state, a steward sees the pre-sign review + the enabled
// action, and an un-signable refusal (the lib's throw) renders VERBATIM.

import type { KeyPair } from "@jeswr/solid-vc";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CandidateReception } from "../../lib/convergence.js";
import type { Critique } from "../../lib/model.js";
import { SCOPES } from "../../scope/scopes.js";
import type { SignedSharedFuture, StewardSigningContext } from "../sign-future.js";
import { type OutcomeSigning, SharedFutureOutcome } from "./SharedFutureOutcome.js";

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
    expect(screen.getByText(/0 of ≥2 stewards — quorum not met/)).toBeTruthy();
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
    expect(screen.getByText(/0 of ≥2 stewards — quorum not met/)).toBeTruthy();
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
    expect(screen.getByText(/0 of ≥3 stewards — quorum not met/)).toBeTruthy();
  });
});

// ── The S5.4 signing surface ──────────────────────────────────────────────────

/** A signing context stub — the component only inspects shape, never crypto. */
function context(overrides: Partial<StewardSigningContext> = {}): StewardSigningContext {
  return {
    steward: { webId: "https://hana.example/#me", key: {} as KeyPair },
    trustedStewards: ["https://hana.example/#me", "https://farah.example/#me"],
    resolveKey: () => undefined,
    verifyVc: () => Promise.reject(new Error("not called by the view")),
    ...overrides,
  };
}

function signingProps(overrides: Partial<OutcomeSigning> = {}): OutcomeSigning {
  return {
    isSteward: true,
    context: context(),
    signed: null,
    busy: false,
    error: null,
    onSign: () => {},
    ...overrides,
  };
}

/** A signed-artifact stub carrying only what the view renders. `ratified` is
 *  the lib's FULL verdict and can DIVERGE from quorumMet (quorum met but the
 *  artifact not fully verifying) — overridable so that case is coverable. */
function signedStub(
  view: Partial<SignedSharedFuture["view"]>,
  ratified?: boolean,
): SignedSharedFuture {
  return {
    verification: { ratified: ratified ?? view.quorumMet === true },
    view: {
      id: "https://h.example/syntheses/s1.ttl#shared-future",
      content: "One text.",
      methodProvenance: "https://w3id.org/jeswr/sectors/futures#resonanceMapping",
      bridgingEvidence: [],
      dissent: [],
      noDissentRecorded: true,
      distinctStewards: 1,
      stewardFloor: 2,
      quorumMet: false,
      bootstrapping: true,
      kAnonymous: true,
      kind: "shared-future",
      ...view,
    },
  } as SignedSharedFuture;
}

describe("SharedFutureOutcome — the S5.4 steward signing surface", () => {
  it("a NON-steward sees the honestly labelled locked state, never a sign control", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[critique]}
        signing={signingProps({ isSteward: false })}
      />,
    );
    expect(screen.getByText("Signing is steward-gated")).toBeTruthy();
    expect(screen.getByText(/does not hold the steward role/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign this/ })).toBeNull();
  });

  it("a STEWARD sees the pre-sign review + the enabled sign action, and clicking invokes it", () => {
    const onSign = vi.fn();
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[critique]}
        signing={signingProps({ onSign })}
      />,
    );
    // The pre-sign review: EXACTLY what the signature attests.
    expect(screen.getByText(/What your signature attests/)).toBeTruthy();
    expect(screen.getByText("in aggregate")).toBeTruthy(); // the annex record (fail-closed aggregate)
    expect(screen.getByText(/Bridging evidence \(recomputable\)/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Sign this shared future as steward" });
    fireEvent.click(button);
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it("the DISAGREEMENT map gets the SAME sign action (a co-equal outcome)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("disagreement")}
        critiques={[critique]}
        signing={signingProps()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Sign this disagreement map as steward" }),
    ).toBeTruthy();
  });

  it("a steward WITHOUT a session signing key stays locked (the role alone is not a key)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({ context: context({ steward: null }) })}
      />,
    );
    expect(screen.getByText("Signing is locked (fail-closed)")).toBeTruthy();
    expect(screen.getByText(/no steward signing key/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign this/ })).toBeNull();
  });

  it("NO registry-backed steward allowlist ⇒ locked (an S5 quorum never runs without one)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({ context: context({ trustedStewards: [] }) })}
      />,
    );
    expect(screen.getByText(/no registry-backed steward allowlist/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign this/ })).toBeNull();
  });

  it("an UNRESOLVED signing context stays locked (fail-closed while resolving)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({ context: null })}
      />,
    );
    expect(screen.getByText("Signing is locked (fail-closed)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign this/ })).toBeNull();
  });

  it("an UN-SIGNABLE refusal renders the lib's reason VERBATIM — a feature, never hidden", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[critique]}
        signing={signingProps({
          error:
            "buildSharedFuture: the dissent annex DROPS a standing critique (https://x.example/c1) — a synthesis is UN-SIGNABLE unless every critique standing at endorsement is accounted for (D2)",
        })}
      />,
    );
    expect(screen.getByText(/Un-signable:/)).toBeTruthy();
    expect(screen.getByText(/DROPS a standing critique/)).toBeTruthy();
    expect(screen.getByText(/the invariant working/)).toBeTruthy();
  });

  it("the ≥2 progress renders honestly UNMET after one signature (1 of ≥2), with the hand-off link", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({ signed: signedStub({ distinctStewards: 1, quorumMet: false }) })}
      />,
    );
    expect(screen.getByText(/1 of ≥2 stewards — quorum not met/)).toBeTruthy();
    expect(screen.getByText(/publishes once the quorum is met/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Published futures" })).toBeTruthy();
  });

  it("a met quorum renders as met (2 of ≥2) — and the floor is never lowered below 2", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({
          signed: signedStub({ distinctStewards: 2, quorumMet: true, bootstrapping: false }),
        })}
      />,
    );
    expect(screen.getByText(/2 of ≥2 — quorum met/)).toBeTruthy();
    expect(screen.getByText(/quorum is met and the artifact is ratified/)).toBeTruthy();
  });

  it("a met QUORUM that does NOT fully verify is never worded as ratified (the lib's verdict rules)", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({
          // quorum met, but the FULL verify verdict (lineage/k-anon/D2) is false.
          signed: signedStub({ distinctStewards: 2, quorumMet: true, bootstrapping: false }, false),
        })}
      />,
    );
    expect(screen.getByText(/quorum is met, but the artifact does not fully verify/)).toBeTruthy();
    expect(screen.queryByText(/artifact is ratified/)).toBeNull();
  });

  it("a SINGLE-steward community shows the bootstrapping label — the floor stands, never lowered", () => {
    render(
      <SharedFutureOutcome
        scope={SCOPES.society}
        reception={reception("endorsed")}
        critiques={[]}
        signing={signingProps({
          context: context({ trustedStewards: ["https://hana.example/#me"] }),
        })}
      />,
    );
    expect(screen.getByText(/bootstrapping: single-steward/)).toBeTruthy();
    expect(screen.getByText(/second steward must be vouched/)).toBeTruthy();
    // The floor is still ≥2 — visible, not silently lowered.
    expect(screen.getByText(/0 of ≥2 stewards/)).toBeTruthy();
  });
});
