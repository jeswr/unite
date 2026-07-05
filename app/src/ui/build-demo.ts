// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The DEMO build-layer seeder for the read-only Build channel view (BL.2 —
// next-phases §3.5). It seeds a real, cross-pod agentic build CHANNEL into the
// in-memory demo pod (the SAME sandboxed LDP fetch every other demo view runs
// over — NOT a mock), so the Build channel exercises the REAL BL.1 aggregator +
// BL.3 fold end-to-end:
//
//   • a `wf:Tracker` channel doc (@jeswr/solid-task-model `serializeTracker`);
//   • per-participant `wf:Task` THREADS (`serializeTask`, `wf:tracker` = the
//     channel) carrying their persisted `unite:CommissionEvent`s + the cached
//     `unite:commissionState` hint in the SAME doc — exactly what BL.4's
//     `BuildLifecycle.serialize()` writes and what BL.1 + `parseCommissionEvents`
//     read back;
//   • cross-pod `CanonicalMessage`s (@jeswr/solid-chat-interop `serializeAs2`),
//     a mix of HUMAN notes (`as:attributedTo`) and AGENT turns (PROV-O
//     `prov:wasAttributedTo` + `prov:wasGeneratedBy`, NO human author) — so the
//     BL.1 "agents never post as humans" gate is real, and the view's
//     attribution is over genuine data;
//   • a REAL signed commission per commissioned thread: an actual
//     `fedtrust:DelegationCredential` (`issueCommission`) signed by a demo
//     commissioner key, VERIFIED at seed time with the REAL `verifyCommission`
//     (solid-vc `verifyCredential`) — the verified commission-event ids become
//     the fold's `verifiedCommissions` set. The crypto lives HERE, in the demo
//     wiring; the read-only view stays a pure consumer of the fold result.
//
// The commissioner/assignee keys are generated per (in-memory) demo instance and
// never persisted; every write goes through the demo fetch, which refuses any
// origin but demo.unite.example. `discoverAgent` (@jeswr/solid-agent-card) is the
// PRODUCTION owner-back-link resolver; the demo supplies the equivalent owner
// mapping here (`agentLabels`) so the view shows the back-link without adding the
// network dependency — the MANDATORY PROV-O attribution is always shown regardless.

import { parseRdf } from "@jeswr/fetch-rdf";
import { type CanonicalMessage, serializeAs2 } from "@jeswr/solid-chat-interop";
import { serializeTask, type TaskData, taskSubject } from "@jeswr/solid-task-model/task";
import { serializeTracker } from "@jeswr/solid-task-model/tracker";
import {
  credentialToTurtle,
  generateKeyPairForSuite,
  type KeyPair,
  type VerifiableCredential,
  verifyCredential,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { DEMO_ORIGIN, demoBase, demoWebId } from "../demo/fixtures.js";
import type { CommissionState } from "../lib/channel.js";
import {
  buildCommissionEventQuads,
  buildCommissionStateQuads,
  type CommissionEvent,
  type CommissionEventType,
  foldCommissionState,
  issueCommission,
  verifyCommission,
} from "../lib/commission.js";
import { type MembershipVerifier, StubMembershipVerifier } from "../lib/membership.js";
import { serializeTurtle } from "../lib/model.js";
import { type DeliberationRegistry, StaticRegistry } from "../lib/registry.js";
import type { ScopeId } from "../scope/scopes.js";

/** An agent participant's label, read from its OWN ANP self-description: its
 *  self-described name + the SELF-CLAIMED owner WebID. `ownerClaim` is an
 *  UNVERIFIED CLAIM — the agent's own document asserts it, and a hostile agent
 *  doc could name any WebID, so the UI renders it as "claims to act for X", never
 *  as a verified back-link. The BIDIRECTIONAL-verified owner (the reciprocal
 *  `discoverAgent(owner, requireOwnerMatch)` check that the owner's profile points
 *  BACK to this agent) is deferred to the audit increment. */
export interface AgentLabel {
  readonly name?: string;
  readonly ownerClaim?: string;
}

/** The seeded demo build channel + the verified-evidence the fold needs. */
export interface DemoBuildChannel {
  /** The channel (`wf:Tracker`) IRI to aggregate. */
  readonly channel: string;
  /** The channel roster (the humans + the agent). */
  readonly registry: DeliberationRegistry;
  /** The channel-membership gate (a demo allowlist — the deliberation's real
   *  credential gate governs VOTERS; channel membership is a distinct roster). */
  readonly verifier: MembershipVerifier;
  /** The commission-event ids whose signed `fedtrust:DelegationCredential`
   *  VERIFIED at seed time (real `verifyCommission`) — the fold's evidence. */
  readonly verifiedCommissions: ReadonlySet<string>;
  /** Approved merge-event ids (empty in the demo — no `merged` threads; the
   *  merge quorum is the deeper BL.4 write surface). */
  readonly approvedMerges: ReadonlySet<string>;
  /** Agent WebID → its owner-back-link label. */
  readonly agentLabels: ReadonlyMap<string, AgentLabel>;
}

const UNITE_NS = "https://w3id.org/jeswr/unite/build#";

/** The demo build agent — a first-class channel participant with its own pod. */
const AGENT_WEBID = `${DEMO_ORIGIN}/agents/suite/card#bot`;
const AGENT_MODEL = `${DEMO_ORIGIN}/agents/suite/model#reference`;
const agentBase = (scope: ScopeId): string => `${DEMO_ORIGIN}/pods/agent-suite/unite/${scope}/`;
const channelIri = (scope: ScopeId): string =>
  `${DEMO_ORIGIN}/deliberations/${scope}/build/channel`;

/** Idempotent PUT into the demo pod (a repeat write is a 412, tolerated). */
async function put(fetchFn: typeof fetch, url: string, body: string): Promise<void> {
  await fetchFn(url, {
    method: "PUT",
    headers: { "content-type": "text/turtle", "if-none-match": "*" },
    body,
  });
}

const threadUrl = (base: string, name: string): string => `${base}build/threads/${name}.ttl`;
const messageUrl = (base: string, name: string): string => `${base}build/messages/${name}.ttl`;

/** One planned build-layer message (author-side; the pod owner is the author). */
interface MsgPlan {
  readonly base: string;
  readonly name: string;
  readonly content: string;
  readonly room: string;
  readonly published: string;
  /** A human note (the pod owner's WebID). */
  readonly human?: string;
  /** An agent turn (the pod owner's agent WebID) — mutually exclusive with `human`. */
  readonly agent?: string;
}

/** One planned thread (a `wf:Task`) + the lifecycle events persisted on it. */
interface ThreadPlan {
  readonly base: string;
  readonly name: string;
  readonly title: string;
  readonly creator: string;
  /** Whether this thread is commissioned (issues a signed commission + events). */
  readonly commissioned: boolean;
  /** The ungated steps AFTER `commission` (e.g. start, open-pr, request-review). */
  readonly steps: readonly { type: CommissionEventType; actor: string }[];
}

/** Build a thread doc = the `wf:Task` + its `unite:CommissionEvent`s + the cached
 *  state hint, serialised through the REAL serialisers (never hand-built RDF). */
async function threadDoc(
  url: string,
  task: TaskData,
  events: readonly CommissionEvent[],
  state: CommissionState,
): Promise<string> {
  const taskTtl = await serializeTask(url, task);
  const taskDs = await parseRdf(taskTtl, "text/turtle", { baseIRI: url });
  const quads: Quad[] = [...taskDs];
  for (const ev of events) quads.push(...buildCommissionEventQuads(ev));
  quads.push(...buildCommissionStateQuads(taskSubject(url), state));
  return serializeTurtle(quads, { unite: UNITE_NS });
}

/** The verify seam over the demo commissioner/assignee keys. */
function demoVerify(
  keys: ReadonlyMap<string, CryptoKey>,
): (vc: VerifiableCredential) => ReturnType<typeof verifyCredential> {
  const resolveKey = (vm: string): CryptoKey | undefined => keys.get(vm);
  return (vc) => verifyCredential(vc, { resolveKey });
}

/**
 * Seed the demo build channel for `scope` into the demo pod, issuing + verifying
 * real signed commissions. Returns the channel handle the view aggregates over.
 */
async function seedDemoBuildChannel(
  fetchFn: typeof fetch,
  scope: ScopeId,
): Promise<DemoBuildChannel> {
  const channel = channelIri(scope);
  const commissioner = demoWebId("amara"); // a builder-credentialed human
  const reviewer = demoWebId("ben");
  const amaraBase = demoBase("amara", scope);
  const benBase = demoBase("ben", scope);
  const agBase = agentBase(scope);
  const artifactNoun = scope === "infrastructure" ? "spec" : "app";

  // Real crypto: the commissioner signs the delegation; the assignee (agent) is
  // the delegate. Keys are per demo instance and never persisted.
  const commissionerKey: KeyPair = await generateKeyPairForSuite(
    `${commissioner}#build-key`,
    "Ed25519",
  );
  const assigneeKey: KeyPair = await generateKeyPairForSuite(`${AGENT_WEBID}#key`, "Ed25519");
  const verifyVc = demoVerify(
    new Map<string, CryptoKey>([
      [commissionerKey.verificationMethod, commissionerKey.publicKey],
      [assigneeKey.verificationMethod, assigneeKey.publicKey],
    ]),
  );

  // The channel config doc (a wf:Tracker).
  await put(
    fetchFn,
    channel,
    await serializeTracker(channel, {
      title: `Build channel — co-designed ${artifactNoun}s`,
    }),
  );

  const threads: ThreadPlan[] = [
    {
      base: amaraBase,
      name: "offline-sync",
      title: `Offline-first sync for the reader ${artifactNoun}`,
      creator: commissioner,
      commissioned: true,
      steps: [{ type: "start", actor: AGENT_WEBID }],
    },
    {
      base: agBase,
      name: "conflict-spec",
      title: "Draft the sync-conflict resolution section",
      creator: AGENT_WEBID,
      commissioned: false,
      steps: [],
    },
    {
      base: benBase,
      name: "type-index",
      title: "Review round: type-index registration",
      creator: reviewer,
      commissioned: true,
      steps: [
        { type: "start", actor: AGENT_WEBID },
        { type: "open-pr", actor: AGENT_WEBID },
        { type: "request-review", actor: reviewer },
      ],
    },
  ];

  const verifiedCommissions = new Set<string>();
  const baseTime = Date.parse("2026-07-01T09:00:00Z");
  let clock = 0;
  const nextAt = (): string => new Date(baseTime + clock++ * 3_600_000).toISOString();

  for (const plan of threads) {
    const url = threadUrl(plan.base, plan.name);
    const subject = taskSubject(url); // ${url}#it
    const task: TaskData = {
      title: plan.title,
      state: "open",
      creator: plan.creator,
      project: `${channel}#this`, // wf:tracker — the trackerSubject of the channel
      created: new Date(baseTime),
    };

    const events: CommissionEvent[] = [];
    if (plan.commissioned) {
      // A REAL signed commission naming THIS thread's deliverable as its scope.
      const artifact = subject;
      const vc = await issueCommission({
        commissioner,
        assignee: AGENT_WEBID,
        assigneeKey: assigneeKey.publicKey,
        artifact,
        key: commissionerKey,
      });
      const evidence = `${DEMO_ORIGIN}/deliberations/${scope}/build/commissions/${plan.name}.ttl`;
      await put(fetchFn, evidence, await credentialToTurtle(vc));

      const commissionEventId = `${url}#commission`;
      events.push({
        id: commissionEventId,
        type: "commission",
        thread: subject,
        actor: commissioner,
        at: nextAt(),
        evidence,
      });

      // VERIFY the commission for real — its id joins the fold's verified set iff
      // the signature, issuer allowlist and per-artifact scope all pass.
      const verification = await verifyCommission(vc, {
        verifyVc,
        trustedCommissioners: [commissioner],
        artifact,
      });
      if (verification.verified) verifiedCommissions.add(commissionEventId);
    }
    for (const step of plan.steps) {
      events.push({
        id: `${url}#${step.type}`,
        type: step.type,
        thread: subject,
        actor: step.actor,
        at: nextAt(),
      });
    }

    // The cached state hint is what the fold recomputes; write it (INV-3: the
    // view never trusts it, it recomputes from the events).
    const { state } = foldCommissionState(events, { verifiedCommissions });
    await put(fetchFn, url, await threadDoc(url, task, events, state));
  }

  // Cross-pod messages: human notes + agent turns, each authored by its pod owner.
  const t1 = `${taskSubject(threadUrl(amaraBase, "offline-sync"))}`;
  const t2 = `${taskSubject(threadUrl(agBase, "conflict-spec"))}`;
  const t3 = `${taskSubject(threadUrl(benBase, "type-index"))}`;
  const messages: MsgPlan[] = [
    {
      base: amaraBase,
      name: "m-kickoff",
      content: `Kicking this off — the room endorsed the offline-first ${artifactNoun}. Commissioning the build.`,
      room: t1,
      published: "2026-07-01T09:10:00Z",
      human: commissioner,
    },
    {
      base: agBase,
      name: "m-onit",
      content: "On it. Opening a branch and wiring the service worker; I'll post the PR here.",
      room: t1,
      published: "2026-07-01T10:30:00Z",
      agent: AGENT_WEBID,
    },
    {
      base: agBase,
      name: "m-drafting",
      content: "Drafting the conflict-resolution section for the room to review.",
      room: t2,
      published: "2026-07-01T11:00:00Z",
      agent: AGENT_WEBID,
    },
    {
      base: benBase,
      name: "m-review",
      content: "PR looks good — one note on the registration path, otherwise ready to merge.",
      room: t3,
      published: "2026-07-01T13:00:00Z",
      human: reviewer,
    },
  ];
  for (const m of messages) {
    const url = messageUrl(m.base, m.name);
    const msg: CanonicalMessage = {
      content: m.content,
      mediaType: "text/plain",
      room: m.room,
      published: m.published,
      ...(m.human !== undefined ? { author: m.human } : {}),
      ...(m.agent !== undefined
        ? { provenance: { attributedTo: m.agent, generatedBy: AGENT_MODEL } }
        : {}),
    };
    await put(fetchFn, url, await serializeAs2(msg, `${url}#it`));
  }

  const registry = new StaticRegistry(channel, [
    { webId: commissioner, base: amaraBase },
    { webId: reviewer, base: benBase },
    { webId: AGENT_WEBID, base: agBase },
  ]);
  const verifier = new StubMembershipVerifier([commissioner, reviewer, AGENT_WEBID]);
  const agentLabels = new Map<string, AgentLabel>([
    [AGENT_WEBID, { name: "unite build agent", ownerClaim: commissioner }],
  ]);

  return {
    channel,
    registry,
    verifier,
    verifiedCommissions,
    approvedMerges: new Set<string>(),
    agentLabels,
  };
}

// Memoise per (demo fetch, scope): a fresh demo instance ⇒ a fresh fetch ⇒ a
// re-seed, so the crypto runs once per demo instance and repeat mounts are free.
// Keyed by scope too (not just fetch) so that even if a single demo fetch were
// ever shared across scopes, `infrastructure` never returns the `apps` channel
// (the channel/registry/labels/text are scope-specific) — the fetch is 1:1 with
// a scope in practice, but the scope key makes that non-load-bearing.
const cache = new WeakMap<typeof fetch, Map<ScopeId, Promise<DemoBuildChannel>>>();

/** The (memoised, lazily seeded) demo build channel for the demo pod `fetchFn`. */
export function getDemoBuildChannel(
  fetchFn: typeof fetch,
  scope: ScopeId,
): Promise<DemoBuildChannel> {
  let byScope = cache.get(fetchFn);
  if (!byScope) {
    byScope = new Map();
    cache.set(fetchFn, byScope);
  }
  let inst = byScope.get(scope);
  if (!inst) {
    inst = seedDemoBuildChannel(fetchFn, scope);
    byScope.set(scope, inst);
  }
  return inst;
}
