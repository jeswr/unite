// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Convergence Room v1 (S1): the outcome badge is COMPUTED from the votes
// (endorsed / disagreement / open), the lineage and standing critiques render,
// drafting/critiquing is tier-gated fail-closed, and the ≥1-input invariant is
// enforced in the draft form before any write. The vote fixtures mirror
// convergence.test.ts: two clean opinion clusters over two needs.

import { generateKeyPairForSuite, type KeyPair, verifyCredential } from "@jeswr/solid-vc";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AggregateResult } from "../../lib/aggregate.js";
import { STANCE_CONFLICTS, STANCE_RESONATES } from "../../lib/fut.js";
import { ROLE_IMPLEMENTER } from "../../lib/fut-draft.js";
import type { InfraProposal } from "../../lib/infra.js";
import type { Resonance } from "../../lib/model.js";
import type { TrustProfile } from "../../lib/trust.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import type { AggregateState, SessionTrust } from "../hooks.js";
import type { SignedSharedFuture, StewardSigningContext } from "../sign-future.js";
import { demoConfig } from "../state.js";
import { Room } from "./Room.js";

const DELIB = "https://demo.unite.example/deliberations/apps";
const NEED_A = "https://a.example/needs/a.ttl";
const NEED_B = "https://b.example/needs/b.ttl";
const CAND = "https://h.example/syntheses/s1.ttl";
const P = [1, 2, 3, 4].map((n) => `https://p${n}.example/#me`);

let seq = 0;
const vote = (creator: string, on: string, stance: string): Resonance => {
  seq += 1;
  return {
    id: `https://r.example/${seq}`,
    onStatement: on,
    stance,
    created: "2026-06-20T00:00:00Z",
    creator,
    inDeliberation: DELIB,
  };
};

// Two clean clusters: {p1,p2} pro-A/anti-B; {p3,p4} the reverse.
const clusterVotes: Resonance[] = [
  vote(P[0] as string, NEED_A, STANCE_RESONATES),
  vote(P[1] as string, NEED_A, STANCE_RESONATES),
  vote(P[2] as string, NEED_A, STANCE_CONFLICTS),
  vote(P[3] as string, NEED_A, STANCE_CONFLICTS),
  vote(P[0] as string, NEED_B, STANCE_CONFLICTS),
  vote(P[1] as string, NEED_B, STANCE_CONFLICTS),
  vote(P[2] as string, NEED_B, STANCE_RESONATES),
  vote(P[3] as string, NEED_B, STANCE_RESONATES),
];

const need = (id: string, content: string) => ({
  id,
  content,
  needConcept: "https://w3id.org/jeswr/sectors/futures#maxneef-subsistence",
  created: "2026-06-01T00:00:00Z",
  creator: P[0] as string,
  inDeliberation: DELIB,
});

function resultWith(candidateVotes: Resonance[]): AggregateResult {
  return {
    deliberation: DELIB,
    needs: [need(NEED_A, "Need A content."), need(NEED_B, "Need B content.")],
    resonances: [...clusterVotes, ...candidateVotes],
    proposals: [],
    infraProposals: [],
    candidates: [
      {
        id: CAND,
        title: "The spine",
        content: "One text carrying both groups.",
        derivedFrom: [NEED_A, NEED_B],
        created: "2026-06-21T00:00:00Z",
        creator: P[0] as string,
        inDeliberation: DELIB,
      },
    ],
    critiques: [
      {
        id: "https://p3.example/critiques/c1.ttl",
        content: "It trades away the lockdown entirely.",
        onStatement: CAND,
        created: "2026-06-22T00:00:00Z",
        creator: P[2] as string,
        inDeliberation: DELIB,
      },
    ],
    visions: [],
    claims: [],
    values: [],
    synthesizable: new Set<string>([NEED_A, NEED_B]),
    verified: P.map((webId) => ({ webId, base: `${webId}/u/`, tier: "T1" as const })),
    unverified: [],
    errors: [],
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

function renderRoom(trust: SessionTrust, r: AggregateResult | null) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Room
        scope={SCOPES.apps}
        config={demoConfig("apps")}
        webId={null}
        trust={trust}
        aggregate={asAggregate(r)}
      />
    </AuthProvider>,
  );
}

afterEach(cleanup);

describe("Convergence Room", () => {
  it("computes ENDORSED when every group leans positive — and names the output pipeline", () => {
    const r = resultWith([
      vote(P[0] as string, CAND, STANCE_RESONATES),
      vote(P[1] as string, CAND, STANCE_RESONATES),
      vote(P[2] as string, CAND, STANCE_RESONATES),
      vote(P[3] as string, CAND, STANCE_RESONATES),
    ]);
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    expect(screen.getByText(/endorsed — every group leans positive/)).toBeTruthy();
    // The apps outputKind: an endorsed synthesis feeds the build commission.
    expect(screen.getByText(/build commission/)).toBeTruthy();
  });

  it("computes a DISAGREEMENT map when the groups divide — a first-class outcome", () => {
    const r = resultWith([
      vote(P[0] as string, CAND, STANCE_RESONATES),
      vote(P[1] as string, CAND, STANCE_RESONATES),
      vote(P[2] as string, CAND, STANCE_CONFLICTS),
      vote(P[3] as string, CAND, STANCE_CONFLICTS),
    ]);
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    expect(screen.getByText(/disagreement map — the groups divide here/)).toBeTruthy();
    expect(screen.getByText(/first-class outcome/)).toBeTruthy();
  });

  it("stays OPEN on thin cross-group signal", () => {
    const r = resultWith([vote(P[0] as string, CAND, STANCE_RESONATES)]);
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    expect(screen.getByText(/round open/)).toBeTruthy();
  });

  it("renders the checkable lineage and the standing critiques", () => {
    const r = resultWith([]);
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    expect(screen.getByText(/Derived from 2 inputs/)).toBeTruthy();
    expect(screen.getByText(/It trades away the lockdown entirely/)).toBeTruthy();
    expect(screen.getByText(/dissent-annex material/)).toBeTruthy();
  });

  it("LOCKS drafting/critiquing below the floor with the explanatory notice", () => {
    renderRoom(asTrust({ tier: 0, roles: [] }), resultWith([]));
    expect(screen.queryByRole("button", { name: /Draft a candidate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Stand this critique/ })).toBeNull();
    expect(screen.getByText(/requires a vouched membership/)).toBeTruthy();
  });

  it("enforces the ≥1-input invariant in the draft form BEFORE any write", () => {
    renderRoom(asTrust({ tier: 1, roles: [] }), resultWith([]));
    fireEvent.click(screen.getByRole("button", { name: "Draft a candidate" }));
    fireEvent.change(screen.getByPlaceholderText(/One text that tries to carry/), {
      target: { value: "A draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Put it to the room" }));
    expect(screen.getByText(/Select at least one input/)).toBeTruthy();
  });

  it("offers ONLY synthesis-consented inputs, and says how many are withheld (fail-closed)", () => {
    const r = { ...resultWith([]), synthesizable: new Set<string>([NEED_A]) };
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    fireEvent.click(screen.getByRole("button", { name: "Draft a candidate" }));
    // Need A is offered; Need B (no synthesize consent) is NOT.
    expect(screen.getByRole("button", { name: /need · Need A content/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /need · Need B content/ })).toBeNull();
    expect(screen.getByText(/1 statement is not offered/)).toBeTruthy();
  });

  it("PRUNES a stale draft selection when a fresh aggregate revokes its consent", () => {
    const before = resultWith([]);
    const { rerender } = render(
      <AuthProvider controller={new DevLoginController()}>
        <Room
          scope={SCOPES.apps}
          config={demoConfig("apps")}
          webId={null}
          trust={asTrust({ tier: 1, roles: [] })}
          aggregate={asAggregate(before)}
        />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft a candidate" }));
    fireEvent.click(screen.getByRole("button", { name: /need · Need B content/ }));
    expect(
      screen.getByRole("button", { name: /need · Need B content/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    // A refresh lands in which Need B's author revoked synthesize consent:
    const after = { ...resultWith([]), synthesizable: new Set<string>([NEED_A]) };
    rerender(
      <AuthProvider controller={new DevLoginController()}>
        <Room
          scope={SCOPES.apps}
          config={demoConfig("apps")}
          webId={null}
          trust={asTrust({ tier: 1, roles: [] })}
          aggregate={asAggregate(after)}
        />
      </AuthProvider>,
    );
    // Need B is no longer offered AND the stale selection was pruned — the
    // submit-time consent guard can never trap an un-deselectable input.
    expect(screen.queryByRole("button", { name: /need · Need B content/ })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/One text that tries to carry/), {
      target: { value: "A draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Put it to the room" }));
    // The pruned state fails the >=1-inputs check — NOT the consent trap.
    expect(screen.getByText(/Select at least one input/)).toBeTruthy();
    expect(screen.queryByText(/has not consented to synthesis/)).toBeNull();
  });

  it("offers NO inputs when nothing carries synthesis consent — with the honest reason", () => {
    const r = { ...resultWith([]), synthesizable: new Set<string>() };
    renderRoom(asTrust({ tier: 1, roles: [] }), r);
    fireEvent.click(screen.getByRole("button", { name: "Draft a candidate" }));
    expect(screen.queryByRole("button", { name: /need ·/ })).toBeNull();
    expect(screen.getByText(/do not carry consent to synthesis/)).toBeTruthy();
  });

  it("shows the empty state (with the draft CTA for members) when no candidate exists", () => {
    const empty = { ...resultWith([]), candidates: [], critiques: [] };
    renderRoom(asTrust({ tier: 1, roles: [] }), empty);
    expect(screen.getByText("No candidate synthesis yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Draft the first candidate" })).toBeTruthy();
  });
});

// ── The S2 scope-B reuse: same room, adoption-decision output stage ──────────

const infraProposal = (id: string, title: string): InfraProposal => ({
  id,
  title,
  content: "An infra change.",
  targetsSystem: ["https://w3id.org/jeswr/sectors/futures"],
  affectsRole: [ROLE_IMPLEMENTER],
  motivatedBy: [NEED_A],
  created: "2026-06-15T00:00:00Z",
  creator: P[0] as string,
  inDeliberation: DELIB,
});

function renderInfraRoom(r: AggregateResult) {
  return render(
    <AuthProvider controller={new DevLoginController()}>
      <Room
        scope={SCOPES.infrastructure}
        config={demoConfig("infrastructure")}
        webId={null}
        trust={asTrust({ tier: 1, roles: [] })}
        aggregate={asAggregate(r)}
      />
    </AuthProvider>,
  );
}

describe("Convergence Room in scope B (S2)", () => {
  it("an ENDORSED candidate names the measured-adoption pipeline — advisory, wire-ratified, S3 for signing", () => {
    const r = resultWith([
      vote(P[0] as string, CAND, STANCE_RESONATES),
      vote(P[1] as string, CAND, STANCE_RESONATES),
      vote(P[2] as string, CAND, STANCE_RESONATES),
      vote(P[3] as string, CAND, STANCE_RESONATES),
    ]);
    renderInfraRoom(r);
    expect(screen.getByText(/endorsed — every group leans positive/)).toBeTruthy();
    expect(screen.getByText(/Ratification is measured on the wire/)).toBeTruthy();
    expect(screen.getByText(/never asserted/)).toBeTruthy();
    expect(screen.getByText(/arrive in S3/)).toBeTruthy();
  });

  it("shows the running-code gate chip: missing on a lineage proposal without a reference implementation", () => {
    const ip = infraProposal("https://a.example/proposals/no-code.ttl", "No running code yet");
    const base = resultWith([]);
    const r: AggregateResult = {
      ...base,
      infraProposals: [ip],
      candidates: [
        { ...(base.candidates[0] as (typeof base.candidates)[0]), derivedFrom: [ip.id, NEED_A] },
      ],
      synthesizable: new Set<string>([NEED_A, NEED_B, ip.id]),
    };
    renderInfraRoom(r);
    expect(screen.getByText(/running code missing on 1 of 1 lineage proposal/)).toBeTruthy();
  });

  it("shows the running-code gate chip green when every lineage proposal carries running code", () => {
    const ip = {
      ...infraProposal("https://a.example/proposals/with-code.ttl", "Has running code"),
      referenceImplementation: "https://github.com/jeswr/unite/commit/abc123",
    };
    const base = resultWith([]);
    const r: AggregateResult = {
      ...base,
      infraProposals: [ip],
      candidates: [
        { ...(base.candidates[0] as (typeof base.candidates)[0]), derivedFrom: [ip.id, NEED_A] },
      ],
      synthesizable: new Set<string>([NEED_A, NEED_B, ip.id]),
    };
    renderInfraRoom(r);
    expect(screen.getByText(/running code ✓/)).toBeTruthy();
  });

  it("shows NO running-code chip when the lineage carries no infra proposals (nothing to gate)", () => {
    renderInfraRoom(resultWith([]));
    expect(screen.queryByText(/running code/)).toBeNull();
  });

  it("offers a CONSENTED infra proposal as a derivation input and withholds a non-consented one (fail-closed)", () => {
    const ipOk = infraProposal("https://a.example/proposals/ok.ttl", "Consented change");
    const ipNo = infraProposal("https://b.example/proposals/no.ttl", "Unconsented change");
    const base = resultWith([]);
    const r: AggregateResult = {
      ...base,
      infraProposals: [ipOk, ipNo],
      synthesizable: new Set<string>([NEED_A, NEED_B, ipOk.id]),
    };
    renderInfraRoom(r);
    fireEvent.click(screen.getByRole("button", { name: "Draft a candidate" }));
    expect(screen.getByRole("button", { name: /proposal · Consented change/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /proposal · Unconsented change/ })).toBeNull();
    expect(screen.getByText(/1 statement is not offered/)).toBeTruthy();
  });
});

describe("the C4 gate in the Room (scope C only)", () => {
  it("the SOCIETY room screens critiques (dissent may publish verbatim)", () => {
    render(
      <AuthProvider controller={new DevLoginController()}>
        <Room
          scope={SCOPES.society}
          config={demoConfig("society")}
          webId={null}
          trust={asTrust({ tier: 0, roles: [] })}
          aggregate={asAggregate(resultWith([]))}
        />
      </AuthProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(/What does this synthesis miss/), {
      target: { value: "Since my diagnosis this candidate ignores people like me." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stand this critique" }));
    expect(screen.getByText(/This looks like personal health information/)).toBeTruthy();
  });

  it("the SOCIETY room lets a CLEAN critique through its screened write boundary", async () => {
    render(
      <AuthProvider controller={new DevLoginController()}>
        <Room
          scope={SCOPES.society}
          config={demoConfig("society")}
          webId={null}
          trust={asTrust({ tier: 0, roles: [] })}
          aggregate={asAggregate(resultWith([]))}
        />
      </AuthProvider>,
    );
    const box = screen.getByPlaceholderText(/What does this synthesis miss/) as HTMLTextAreaElement;
    fireEvent.change(box, {
      target: { value: "This candidate underweights rural voices." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stand this critique" }));
    // The write is routed through the C4-screened chokepoint
    // (writeSocietyCritique) and succeeds — the form clears, no refusal shown.
    await waitFor(() => expect(box.value).toBe(""));
    expect(screen.queryByText(/This looks like personal health information/)).toBeNull();
  });

  it("the APPS room does NOT screen critiques (the gate is a society launch constraint)", async () => {
    renderRoom(asTrust({ tier: 1, roles: [] }), resultWith([]));
    const box = screen.getByPlaceholderText(/What does this synthesis miss/) as HTMLTextAreaElement;
    fireEvent.change(box, {
      target: { value: "Since my diagnosis I care about offline access." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stand this critique" }));
    // The write goes through (demo pod) — the form clears, no C4 refusal shown.
    await waitFor(() => expect(box.value).toBe(""));
    expect(screen.queryByText(/This looks like personal health information/)).toBeNull();
  });
});

// ── S5.4: the steward signing surface in the SOCIETY room ─────────────────────
// Real crypto end-to-end: a steward's click drives ui/sign-future →
// lib/shared-future (build gate + solid-vc attestation + the full verify),
// the signed artifact flows out through onSigned (the S5.5 hand-off), and an
// un-signable candidate REFUSES with the lib's reason — no artifact, no
// hand-off. A non-steward session sees the honestly labelled locked gate.

describe("the S5.4 steward signing surface (society room)", () => {
  const STEWARD = "https://hana.example/profile/card#me";
  let stewardKey: KeyPair;
  let signingCtx: StewardSigningContext;

  beforeAll(async () => {
    stewardKey = await generateKeyPairForSuite(`${STEWARD}#key`, "Ed25519");
    const keys = new Map<string, CryptoKey>([
      [stewardKey.verificationMethod, stewardKey.publicKey],
    ]);
    const resolveKey = (vm: string) => keys.get(vm);
    signingCtx = {
      steward: { webId: STEWARD, key: stewardKey },
      trustedStewards: [STEWARD, "https://farah.example/profile/card#me"],
      resolveKey,
      verifyVc: (vc) => verifyCredential(vc, { resolveKey }),
    };
  });

  /** A 6-participant endorsed room — enough distinct contributors for the
   *  k-anonymity floor (5): two clean clusters over the needs, everyone
   *  endorses the candidate, one standing critique. */
  function signableResult(): AggregateResult {
    const p5 = "https://p5.example/#me";
    const p6 = "https://p6.example/#me";
    const extraClusterVotes: Resonance[] = [
      vote(p5, NEED_A, STANCE_RESONATES),
      vote(p5, NEED_B, STANCE_CONFLICTS),
      vote(p6, NEED_A, STANCE_CONFLICTS),
      vote(p6, NEED_B, STANCE_RESONATES),
    ];
    const endorseVotes: Resonance[] = [...P, p5, p6].map((w) => vote(w, CAND, STANCE_RESONATES));
    const base = resultWith([]);
    return {
      ...base,
      resonances: [...base.resonances, ...extraClusterVotes, ...endorseVotes],
    };
  }

  function renderSocietyRoom(
    trust: SessionTrust,
    r: AggregateResult,
    signing: StewardSigningContext | null,
    onSigned?: (signed: SignedSharedFuture) => void,
    /** What the sign-time RE-AGGREGATION returns (defaults to the rendered
     *  fixture — i.e. the room did not move between review and sign). */
    freshResult?: AggregateResult,
  ) {
    return render(
      <AuthProvider controller={new DevLoginController()}>
        <Room
          scope={SCOPES.society}
          config={demoConfig("society")}
          webId={null}
          trust={trust}
          aggregate={asAggregate(r)}
          signing={signing}
          aggregateForSign={() => Promise.resolve(freshResult ?? r)}
          {...(onSigned ? { onSigned } : {})}
        />
      </AuthProvider>,
    );
  }

  it("a NON-steward session sees the locked gate, never a sign control", () => {
    renderSocietyRoom(asTrust({ tier: 0, roles: [] }), signableResult(), signingCtx);
    expect(screen.getByText("Signing is steward-gated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
  });

  it("a STEWARD signs the endorsed outcome: the lib is invoked for real, the artifact hands off, the honest 1-of-≥2 shows", async () => {
    const onSigned = vi.fn();
    renderSocietyRoom(
      asTrust({ tier: 1, roles: ["steward"] }),
      signableResult(),
      signingCtx,
      onSigned,
    );
    // The endorsed outcome + the pre-sign review render.
    expect(screen.getByText(/endorsed — every group leans positive/)).toBeTruthy();
    expect(screen.getByText(/What your signature attests/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign this shared future as steward" }));
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1), { timeout: 8000 });
    // The hand-off carries a REAL signed artifact: quads + a verified
    // credential + the lib's quorum verdict (1 distinct steward, floor 2).
    const signed = onSigned.mock.calls[0]?.[0] as SignedSharedFuture;
    expect(signed.quads.length).toBeGreaterThan(0);
    expect(signed.vcs).toHaveLength(1);
    expect(signed.verification.quorum.distinctStewards).toBe(1);
    expect(signed.view.kind).toBe("shared-future");
    expect(signed.view.quorumMet).toBe(false);
    // …and the surface shows the honest unmet progress + the hand-off link.
    expect(await screen.findByText(/1 of ≥2 stewards — quorum not met/)).toBeTruthy();
    expect(screen.getByText(/publishes once the quorum is met/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Published futures" })).toBeTruthy();
  });

  it("an UN-SIGNABLE candidate (sub-k cohort) refuses with the lib's reason — no artifact, no hand-off", async () => {
    const onSigned = vi.fn();
    // The 4-participant fixture: only 4 distinct contributors < the k floor (5).
    const r = resultWith(P.map((w) => vote(w, CAND, STANCE_RESONATES)));
    renderSocietyRoom(asTrust({ tier: 1, roles: ["steward"] }), r, signingCtx, onSigned);
    fireEvent.click(screen.getByRole("button", { name: "Sign this shared future as steward" }));
    expect(await screen.findByText(/Un-signable:/)).toBeTruthy();
    expect(screen.getByText(/below the k-threshold/)).toBeTruthy();
    expect(onSigned).not.toHaveBeenCalled();
  });

  it("STALE DISSENT is un-signable: a critique that lands AFTER review makes the D2 gate throw — no artifact", async () => {
    const onSigned = vi.fn();
    const rendered = signableResult();
    // A NEW critique lands between the steward's review and the sign click:
    // the sign-time re-aggregation sees it, the rendered annex does not.
    const fresh: AggregateResult = {
      ...rendered,
      critiques: [
        ...rendered.critiques,
        {
          id: "https://p5.example/critiques/late.ttl",
          content: "This landed after the steward reviewed the panel.",
          onStatement: CAND,
          created: "2026-06-23T00:00:00Z",
          creator: "https://p5.example/#me",
          inDeliberation: DELIB,
        },
      ],
    };
    renderSocietyRoom(
      asTrust({ tier: 1, roles: ["steward"] }),
      rendered,
      signingCtx,
      onSigned,
      fresh,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign this shared future as steward" }));
    expect(await screen.findByText(/Un-signable:/)).toBeTruthy();
    expect(screen.getByText(/DROPS a standing critique/)).toBeTruthy();
    expect(onSigned).not.toHaveBeenCalled();
  });

  it("MOVED VOTES are un-signable: a reception that changed since review refuses — review again", async () => {
    const onSigned = vi.fn();
    const rendered = signableResult();
    // An extra endorsement vote lands after review: the recomputed reception
    // no longer equals what the steward reviewed.
    const fresh: AggregateResult = {
      ...rendered,
      resonances: [...rendered.resonances, vote("https://p7.example/#me", CAND, STANCE_RESONATES)],
      verified: [...rendered.verified, { webId: "https://p7.example/#me", base: "https://p7.example/u/", tier: "T1" as const }],
    };
    renderSocietyRoom(
      asTrust({ tier: 1, roles: ["steward"] }),
      rendered,
      signingCtx,
      onSigned,
      fresh,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign this shared future as steward" }));
    expect(await screen.findByText(/moved since you reviewed/)).toBeTruthy();
    expect(onSigned).not.toHaveBeenCalled();
  });

  it("NO signing context (unresolved / pod mode without a registry) stays locked fail-closed", () => {
    renderSocietyRoom(asTrust({ tier: 1, roles: ["steward"] }), signableResult(), null);
    expect(screen.getByText("Signing is locked (fail-closed)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /as steward/ })).toBeNull();
  });
});
