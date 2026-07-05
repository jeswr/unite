// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Build channel view (BL.2). Three levels:
//   • toBuildChannelView — the PURE fold: an agent turn is attributed as an agent
//     (PROV-O), a human note is NOT mislabelled, and the commission state is the
//     BL.3 fold (a verified commission advances; an UNverified one stays drafted,
//     fail-closed — INV-3);
//   • BuildChannelBoard — the presentation renders the state badge, the agent
//     attribution + owner back-link, and the honest empty state;
//   • BuildChannel — wired over the REAL demo pod: the seeded channel aggregates
//     through BL.1 + folds real, verified commissions (not a mock).

import { describeAgent } from "@jeswr/solid-agent-card";
import type { CanonicalMessage } from "@jeswr/solid-chat-interop";
import type { TaskData } from "@jeswr/solid-task-model/task";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChannelMessage, ChannelResult, ChannelThread } from "../../lib/channel.js";
import type { CommissionEvent } from "../../lib/commission.js";
import { SCOPES } from "../../scope/scopes.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import {
  type BuildChannelView,
  podChannelIri,
  resolveAgentLabels,
  toBuildChannelView,
} from "../build-channel.js";
import { demoConfig } from "../state.js";
import { BuildChannel, BuildChannelBoard } from "./BuildChannel.js";

const HUMAN = "https://alice.example/profile#me";
const AGENT = "https://agent.example/card#bot";
const OWNER = "https://alice.example/profile#me";

function msg(
  id: string,
  isAgent: boolean,
  content: string,
  extra: Partial<CanonicalMessage> = {},
): ChannelMessage {
  const message: CanonicalMessage = {
    content,
    mediaType: "text/plain",
    ...(isAgent
      ? { provenance: { attributedTo: AGENT, generatedBy: "https://agent.example/model#v1" } }
      : { author: HUMAN }),
    ...extra,
  };
  return {
    id,
    resource: `${id.replace("#it", "")}`,
    base: isAgent ? "https://agent.example/u/" : "https://alice.example/u/",
    author: isAgent ? AGENT : HUMAN,
    isAgent,
    published: "2026-07-01T09:00:00Z",
    room: "https://c.example/build/chan#thread",
    message,
  };
}

function thread(messages: ChannelMessage[]): ChannelThread {
  const task: TaskData = { title: "Add offline sync", state: "open", creator: HUMAN };
  return {
    id: "https://c.example/build/chan#thread",
    resource: "https://alice.example/u/build/threads/t1.ttl",
    creator: HUMAN,
    task,
    messages,
  };
}

function result(messages: ChannelMessage[]): ChannelResult {
  const t = thread(messages);
  return {
    channel: "https://c.example/build/chan",
    tracker: { title: "Build channel" },
    threads: [t],
    timeline: messages,
    participants: [
      { webId: HUMAN, base: "https://alice.example/u/", tier: "T1" },
      { webId: AGENT, base: "https://agent.example/u/", tier: "T1" },
    ],
    unverified: [],
    errors: [],
  };
}

const commissionEvent = (): CommissionEvent => ({
  id: "https://alice.example/u/build/threads/t1.ttl#commission",
  type: "commission",
  thread: "https://c.example/build/chan#thread",
  actor: HUMAN,
  at: "2026-07-01T08:00:00Z",
  evidence: "https://alice.example/u/build/commissions/t1.ttl",
});
const startEvent = (): CommissionEvent => ({
  id: "https://alice.example/u/build/threads/t1.ttl#start",
  type: "start",
  thread: "https://c.example/build/chan#thread",
  actor: AGENT,
  at: "2026-07-01T08:30:00Z",
});

afterEach(cleanup);

describe("toBuildChannelView (the pure fold)", () => {
  it("attributes an agent turn as an agent and never mislabels a human note", () => {
    const view = toBuildChannelView(
      result([msg("a#it", true, "PR opened"), msg("h#it", false, "kick off")]),
    );
    const messages = view.threads[0]?.messages ?? [];
    const agentMsg = messages.find((m) => m.content === "PR opened");
    const humanMsg = messages.find((m) => m.content === "kick off");
    expect(agentMsg?.isAgent).toBe(true);
    expect(agentMsg?.model).toBe("https://agent.example/model#v1");
    expect(humanMsg?.isAgent).toBe(false);
    expect(humanMsg?.model).toBeUndefined();
  });

  it("carries the agent owner back-link label when supplied (discoverAgent-shaped)", () => {
    const view = toBuildChannelView(result([msg("a#it", true, "hi")]), {
      eventsByThread: new Map(),
      verifiedCommissions: new Set(),
      approvedMerges: new Set(),
      agentLabels: new Map([[AGENT, { name: "build agent", ownerClaim: OWNER }]]),
      demo: true,
    });
    const m = view.threads[0]?.messages[0];
    expect(m?.agentLabel).toEqual({ name: "build agent", ownerClaim: OWNER });
  });

  it("labels an agent-CREATED thread as agent (never an unmarked human)", () => {
    const agentThread: ChannelThread = {
      id: "https://c.example/build/chan#t2",
      resource: "https://agent.example/u/build/threads/t2.ttl",
      creator: AGENT,
      task: { title: "Draft the spec", state: "open", creator: AGENT },
      messages: [],
    };
    const r: ChannelResult = {
      channel: "https://c.example/build/chan",
      tracker: undefined,
      threads: [agentThread],
      timeline: [],
      participants: [{ webId: AGENT, base: "https://agent.example/u/", tier: "T1" }],
      unverified: [],
      errors: [],
    };
    const view = toBuildChannelView(r, {
      eventsByThread: new Map(),
      verifiedCommissions: new Set(),
      approvedMerges: new Set(),
      agentLabels: new Map([[AGENT, { name: "build agent", ownerClaim: OWNER }]]),
      demo: true,
    });
    expect(view.threads[0]?.creatorIsAgent).toBe(true);
    expect(view.threads[0]?.creatorLabel?.name).toBe("build agent");
  });

  it("marks an agent-created thread as agent from the STRUCTURAL signal alone (pod mode, NO labels)", () => {
    // The roborev/pod-mode case: an agent created a thread AND posted a PROV-O
    // agent turn, but discoverAgent resolved NO owner back-link (empty agentLabels).
    // It must STILL be marked an agent (never a human creator) — just UNVERIFIED.
    const agentMsg = msg("am#it", true, "opened + working");
    const agentThread: ChannelThread = {
      id: "https://c.example/build/chan#t2",
      resource: "https://agent.example/u/build/threads/t2.ttl",
      creator: AGENT,
      task: { title: "Agent task", state: "open", creator: AGENT },
      messages: [agentMsg],
    };
    const r: ChannelResult = {
      channel: "https://c.example/build/chan",
      tracker: undefined,
      threads: [agentThread],
      timeline: [agentMsg],
      participants: [{ webId: AGENT, base: "https://agent.example/u/", tier: "T1" }],
      unverified: [],
      errors: [],
    };
    const view = toBuildChannelView(r); // EMPTY_EVIDENCE — no discoverAgent labels
    expect(view.threads[0]?.creatorIsAgent).toBe(true); // structural signal, not labels
    expect(view.threads[0]?.creatorLabel).toBeUndefined(); // unverified: no back-link
    expect(view.threads[0]?.messages[0]?.isAgent).toBe(true);
  });

  it("folds a VERIFIED commission to commissioned/in-progress (BL.3), computed not asserted", () => {
    const view = toBuildChannelView(result([]), {
      eventsByThread: new Map([[thread([]).id, [commissionEvent(), startEvent()]]]),
      verifiedCommissions: new Set([commissionEvent().id]),
      approvedMerges: new Set(),
      agentLabels: new Map(),
      demo: false,
    });
    const c = view.threads[0]?.commission;
    expect(c?.state).toBe("in-progress");
    expect(c?.verified).toBe(true);
    expect(c?.commissioner).toBe(HUMAN);
    expect(c?.evidence).toBe("https://alice.example/u/build/commissions/t1.ttl");
  });

  it("fails CLOSED: an UNVERIFIED commission event stays drafted (INV-3)", () => {
    const view = toBuildChannelView(result([]), {
      eventsByThread: new Map([[thread([]).id, [commissionEvent(), startEvent()]]]),
      verifiedCommissions: new Set(), // NOT verified
      approvedMerges: new Set(),
      agentLabels: new Map(),
      demo: false,
    });
    const c = view.threads[0]?.commission;
    expect(c?.state).toBe("drafted");
    expect(c?.verified).toBe(false);
    expect(c?.unverified).toBe(true);
  });
});

/** A fetch serving url→turtle agent-description docs (missing → 404). */
function agentDocFetch(docs: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = docs[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  }) as unknown as typeof fetch;
}

describe("resolveAgentLabels (the CORRECT agent-descriptor direction)", () => {
  it("resolves an AGENT WebID's OWN description → {name, owner}; a person → NO label", async () => {
    // The agent serves its own ANP self-description at its WebID doc (real builder).
    const ttl = await describeAgent({
      id: AGENT,
      name: "unite build agent",
      owner: OWNER,
    }).agentDescription.toTurtle();
    const fetchFn = agentDocFetch({ "https://agent.example/card": ttl });
    const labels = await resolveAgentLabels([AGENT, "https://carol.example/profile#me"], fetchFn);
    expect(labels.get(AGENT)).toEqual({ name: "unite build agent", ownerClaim: OWNER });
    // A person serves no agent description → NEVER mislabelled as an agent.
    expect(labels.has("https://carol.example/profile#me")).toBe(false);
  });

  it("fail-closed anti-spoof: a doc describing a DIFFERENT agent subject does not resolve", async () => {
    // Serve, at AGENT's doc, a description of a DIFFERENT agent — the subject-match
    // guard (requireSubjectMatch) rejects it, so AGENT gets no forged label.
    const ttl = await describeAgent({
      id: "https://evil.example/card#bot",
      name: "evil",
      owner: OWNER,
    }).agentDescription.toTurtle();
    const fetchFn = agentDocFetch({ "https://agent.example/card": ttl });
    const labels = await resolveAgentLabels([AGENT], fetchFn);
    expect(labels.has(AGENT)).toBe(false);
  });

  it("fail-closed: an unreachable WebID doc yields no label (fail-isolated, never throws)", async () => {
    const labels = await resolveAgentLabels([AGENT], agentDocFetch({}));
    expect(labels.size).toBe(0);
  });
});

describe("podChannelIri (the pod-mode channel derivation)", () => {
  it("appends build/channel as a CHILD of a slashless deliberation (no dropped segment)", () => {
    // The bug roborev caught: new URL('build/channel', '…/deliberations/apps')
    // would drop "apps". The deliberation is a container base.
    expect(podChannelIri("https://d.example/deliberations/apps")).toBe(
      "https://d.example/deliberations/apps/build/channel",
    );
  });

  it("is idempotent for a slash-terminated deliberation", () => {
    expect(podChannelIri("https://d.example/deliberations/apps/")).toBe(
      "https://d.example/deliberations/apps/build/channel",
    );
  });

  it("rejects a non-http(s) deliberation IRI (fail-closed)", () => {
    expect(podChannelIri("urn:not-a-web-iri")).toBeUndefined();
    expect(podChannelIri("")).toBeUndefined();
  });
});

describe("BuildChannelBoard (presentation)", () => {
  const view: BuildChannelView = {
    channel: "https://c.example/build/chan",
    title: "Build channel",
    threads: [
      {
        id: "t1",
        resource: "https://alice.example/u/build/threads/t1.ttl",
        creator: HUMAN,
        creatorIsAgent: false,
        title: "Add offline sync",
        state: "open",
        commission: {
          state: "in-progress",
          verified: true,
          unverified: false,
          commissioner: HUMAN,
          evidence: "https://alice.example/u/build/commissions/t1.ttl",
          chain: [
            { type: "commission", actor: HUMAN, at: "2026-07-01T08:00:00Z" },
            { type: "start", actor: AGENT, at: "2026-07-01T08:30:00Z" },
          ],
        },
        messages: [
          {
            id: "h#it",
            author: HUMAN,
            isAgent: false,
            content: "kicking this off",
            mediaType: "text/plain",
            published: "2026-07-01T09:00:00Z",
          },
          {
            id: "a#it",
            author: AGENT,
            isAgent: true,
            agentLabel: { name: "build agent", ownerClaim: OWNER },
            model: "https://agent.example/model#v1",
            content: "on it, opening a PR",
            mediaType: "text/plain",
            published: "2026-07-01T10:00:00Z",
          },
        ],
      },
    ],
    rootMessages: [],
    participants: [
      { webId: HUMAN, tier: "T1" },
      { webId: AGENT, tier: "T1" },
    ],
    unverified: [],
    errors: [],
    demo: true,
  };

  it("renders the commission state badge, the feed, and attributes the agent (not the human)", () => {
    render(<BuildChannelBoard scope={SCOPES.apps} view={view} loading={false} error={null} />);
    expect(screen.getByText("in progress")).toBeTruthy();
    // Both messages render...
    expect(screen.getByText("kicking this off")).toBeTruthy();
    expect(screen.getByText("on it, opening a PR")).toBeTruthy();
    // ...but ONLY the agent one carries the agent badge + owner back-link.
    const agentCard = screen.getByText("on it, opening a PR").closest("li");
    const humanCard = screen.getByText("kicking this off").closest("li");
    expect(agentCard).not.toBeNull();
    expect(humanCard).not.toBeNull();
    expect(within(agentCard as HTMLElement).getByText("agent")).toBeTruthy();
    expect(within(humanCard as HTMLElement).queryByText("agent")).toBeNull();
    // The mandatory PROV-O attribution (agent WebID + model) is visible.
    expect(within(agentCard as HTMLElement).getByText(AGENT)).toBeTruthy();
  });

  it("renders the audit-walk affordance pointing at the signed commission", () => {
    render(<BuildChannelBoard scope={SCOPES.apps} view={view} loading={false} error={null} />);
    const link = screen.getByRole("link", { name: /re-check the signed commission/ });
    expect(link.getAttribute("href")).toBe("https://alice.example/u/build/commissions/t1.ttl");
  });

  it("marks a structural agent (no self-description) as an agent — never a human", () => {
    const podView: BuildChannelView = {
      channel: "https://c.example/build/chan",
      threads: [
        {
          id: "t2",
          resource: "https://agent.example/u/build/threads/t2.ttl",
          creator: AGENT,
          creatorIsAgent: true, // classified structurally (PROV-O), no resolved label
          title: "Agent-opened task",
          state: "open",
          commission: { state: "drafted", verified: false, unverified: false, chain: [] },
          messages: [
            {
              id: "am#it",
              author: AGENT,
              isAgent: true, // no agentLabel → no name/owner, still an agent
              model: "https://agent.example/model#v1",
              content: "on it",
              mediaType: "text/plain",
              published: "2026-07-01T09:00:00Z",
            },
          ],
        },
      ],
      rootMessages: [],
      participants: [{ webId: AGENT, tier: "T1" }],
      unverified: [],
      errors: [],
      demo: false,
    };
    render(<BuildChannelBoard scope={SCOPES.apps} view={podView} loading={false} error={null} />);
    // Both the thread creator AND the message are marked agent — never human.
    expect(screen.getAllByText("agent").length).toBe(2);
    // The agent WebID is still shown (mandatory PROV-O attribution).
    expect(screen.getByText(AGENT)).toBeTruthy();
  });

  it("renders a self-claimed owner as an UNVERIFIED CLAIM, never a verified back-link", () => {
    // The round-6 trust fix: the agent's self-descriptor `ad:owner` is a CLAIM.
    const claimView: BuildChannelView = {
      channel: "https://c.example/build/chan",
      threads: [
        {
          id: "t1",
          resource: "https://agent.example/u/build/threads/t1.ttl",
          creator: HUMAN,
          creatorIsAgent: false,
          title: "Task",
          state: "open",
          commission: { state: "drafted", verified: false, unverified: false, chain: [] },
          messages: [
            {
              id: "a#it",
              author: AGENT,
              isAgent: true,
              agentLabel: { name: "build agent", ownerClaim: OWNER },
              content: "on it",
              mediaType: "text/plain",
              published: "2026-07-01T09:00:00Z",
            },
          ],
        },
      ],
      rootMessages: [],
      participants: [{ webId: AGENT, tier: "T1" }],
      unverified: [],
      errors: [],
      demo: false,
    };
    const { container } = render(
      <BuildChannelBoard scope={SCOPES.apps} view={claimView} loading={false} error={null} />,
    );
    // The owner is a CLAIM, explicitly marked unverified — NOT a verified "acting for".
    expect(container.textContent).toContain("claims to act for");
    expect(screen.getByText("unverified")).toBeTruthy();
    expect(container.textContent).not.toContain("acting for"); // never the verified phrasing
  });

  it("shows a PRESENT-but-unverified commission distinctly (not a bare 'drafted')", () => {
    const unverifiedView: BuildChannelView = {
      channel: "https://c.example/build/chan",
      threads: [
        {
          id: "t1",
          resource: "https://alice.example/u/build/threads/t1.ttl",
          creator: HUMAN,
          creatorIsAgent: false,
          title: "Live commissioned work",
          state: "open",
          commission: {
            state: "drafted", // the fold stays drafted when the commission is unverified
            verified: false,
            unverified: true,
            commissioner: HUMAN,
            evidence: "https://alice.example/u/build/commissions/t1.ttl",
            chain: [],
          },
          messages: [],
        },
      ],
      rootMessages: [],
      participants: [],
      unverified: [],
      errors: [],
      demo: false,
    };
    render(
      <BuildChannelBoard scope={SCOPES.apps} view={unverifiedView} loading={false} error={null} />,
    );
    // A live commission is surfaced as present-but-unverified, NOT as if absent.
    expect(screen.getByText("commission · unverified")).toBeTruthy();
    expect(screen.queryByText("drafted")).toBeNull();
    expect(screen.getByText(/verifying live commissions is the audit increment/)).toBeTruthy();
  });

  it("renders the honest empty state for an empty channel", () => {
    const empty: BuildChannelView = {
      channel: "https://c.example/build/chan",
      threads: [],
      rootMessages: [],
      participants: [],
      unverified: [],
      errors: [],
      demo: true,
    };
    render(<BuildChannelBoard scope={SCOPES.apps} view={empty} loading={false} error={null} />);
    expect(screen.getByText(/No build work in this channel yet/)).toBeTruthy();
  });
});

describe("BuildChannel (wired, over the real demo pod)", () => {
  it("renders the seeded demo channel: agent-attributed turns + REAL verified commission states", async () => {
    render(
      <AuthProvider controller={new DevLoginController()}>
        <BuildChannel scope={SCOPES.apps} config={demoConfig("apps")} />
      </AuthProvider>,
    );
    // The seeded threads appear (BL.1 aggregated them from the demo pods).
    await waitFor(
      () => {
        expect(screen.getByText(/Offline-first sync for the reader app/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
    // A REAL signed commission verified → the fold reached in-progress / in-review
    // (never reachable without a verified commission — proves the crypto ran).
    expect(screen.getByText("in progress")).toBeTruthy();
    expect(screen.getByText("in review")).toBeTruthy();
    // The uncommissioned thread is honestly drafted.
    expect(screen.getByText("drafted")).toBeTruthy();
    // The agent turn is present and attributed (at least one "agent" badge).
    expect(screen.getByText(/Opening a branch and wiring the service worker/)).toBeTruthy();
    expect(screen.getAllByText("agent").length).toBeGreaterThan(0);
  });
});
