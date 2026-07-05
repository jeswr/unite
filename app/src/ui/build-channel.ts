// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Build channel data hook + view-model mapping (BL.2 — next-phases §3.5).
// READ-ONLY: it COMPOSES the built libs' read APIs (BL.1 `aggregateChannel`,
// BL.3 `parseCommissionEvents` + `foldCommissionState`, `@jeswr/solid-agent-card`
// `verifyDataset`) and shapes their output for the presentational view. It mutates
// nothing, signs nothing, commissions nothing — the commission/merge WRITE path
// (issuing, signing, the merge gate) is the later increment.
//
// AGENT ATTRIBUTION (BL.2 core — an agent is NEVER rendered as a human): an agent
// is classified STRUCTURALLY from BL.1's PROV-O `isAgent` (authoritative, dep-free)
// AND — for the name/owner label + a thread-ONLY agent's classification — from the
// agent's OWN ANP self-description (`verifyDataset`, subject-bound to the exact
// agent WebID, fail-closed). NB this is the correct direction: `discoverAgent` reads
// a PERSON's profile → the agent representing them; an AGENT WebID instead serves
// its own description. Its `ad:owner` is a SELF-CLAIM only — rendered as "claims to
// act for X", never a verified back-link (the reciprocal owner→agent binding is the
// audit increment). Demo mode carries seeded labels; POD mode resolves them live
// over the participant WebIDs. A classified agent whose description does not resolve
// renders as an agent with no name/owner (never a human); a person (no agent
// description) renders as the human they are.
//
// The two GATED commission edges (`commission`, `merge`) only advance on VERIFIED
// signed evidence; determining that evidence is the client-side verify, supplied
// here as data (demo: seeded + verified for real; pod: fail-closed — a live
// commission shows present-but-unverified, the crypto-verify being the audit
// increment, INV-3).

import { parseRdf } from "@jeswr/fetch-rdf";
import { verifyDataset } from "@jeswr/solid-agent-card";
import type { LoginController } from "@jeswr/solid-elements/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { demoForDeliberation } from "../demo/pods.js";
import {
  aggregateChannel,
  type ChannelMessage,
  type ChannelResult,
  type ChannelSourceError,
  type ChannelThread,
  type CommissionState,
} from "../lib/channel.js";
import {
  type CommissionEvent,
  type CommissionEventType,
  foldCommissionState,
  parseCommissionEvents,
} from "../lib/commission.js";
import type { MembershipTier, MembershipVerifier } from "../lib/membership.js";
import { isHttpIri } from "../lib/model.js";
import { DEFAULT_MAX_BODY_BYTES, readBodyCapped } from "../lib/pod.js";
import type { DeliberationRegistry } from "../lib/registry.js";
import type { ScopeConfig } from "../scope/scopes.js";
import { type AgentLabel, type DemoBuildChannel, getDemoBuildChannel } from "./build-demo.js";
import { readFetchFor } from "./hooks.js";
import {
  buildRegistry,
  configReady,
  type DeliberationConfig,
  deliberationKey,
  deliberationTrust,
} from "./state.js";

export type { AgentLabel } from "./build-demo.js";

/** One message in the rendered feed (a folded, verified `CanonicalMessage`). */
export interface MessageView {
  readonly id: string;
  /** The verified authoring WebID (== the pod owner). */
  readonly author: string;
  /** True iff a PROV-O agent turn (never a human note) — attribution is mandatory. */
  readonly isAgent: boolean;
  /** The agent's self-described label (name + UNVERIFIED owner claim), when known. */
  readonly agentLabel?: AgentLabel;
  /** `prov:wasGeneratedBy` — the model/endpoint IRI, for an agent turn. */
  readonly model?: string;
  readonly content: string;
  readonly mediaType: string;
  readonly published?: string;
}

/** One applied lifecycle transition (the audit-walk chain row). */
export interface CommissionStep {
  readonly type: CommissionEventType;
  readonly actor: string;
  readonly at: string;
}

/** The commission-lifecycle read for a thread (COMPUTED by the BL.3 fold). */
export interface CommissionInfo {
  /** The authoritative state, folded from the persisted events (never asserted). */
  readonly state: CommissionState;
  /** True iff a `commission` edge was VERIFIED (a signed delegation checked out). */
  readonly verified: boolean;
  /** A `commission` event is present but its evidence did NOT verify (fail-closed). */
  readonly unverified: boolean;
  /** The commissioner (the commission event actor / credential signer), when present. */
  readonly commissioner?: string;
  /** The signed commission credential resource — the audit-walk "re-check" link. */
  readonly evidence?: string;
  /** The applied transitions in order — the "why is it here?" audit chain. */
  readonly chain: readonly CommissionStep[];
}

/** One thread in the channel (a `wf:Task`) + its ordered messages + its state. */
export interface ThreadView {
  readonly id: string;
  readonly resource: string;
  readonly creator: string;
  /** True iff the thread's creator is a known agent — an agent-opened thread is
   *  labelled as such (never shown as an unmarked human). */
  readonly creatorIsAgent: boolean;
  /** The creator's self-described agent label (name + unverified owner claim), when
   *  the creator is a self-describing agent. */
  readonly creatorLabel?: AgentLabel;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly commission: CommissionInfo;
  readonly messages: readonly MessageView[];
}

/** The fully-resolved, render-ready read of a build channel. */
export interface BuildChannelView {
  readonly channel: string;
  readonly title?: string;
  readonly threads: readonly ThreadView[];
  /** Channel-root messages (posted to the channel, not a specific thread). */
  readonly rootMessages: readonly MessageView[];
  readonly participants: readonly { readonly webId: string; readonly tier: MembershipTier }[];
  readonly unverified: readonly { readonly webId: string; readonly reason: string }[];
  readonly errors: readonly ChannelSourceError[];
  /** True iff the demo agent-attribution back-links are present (demo mode). */
  readonly demo: boolean;
}

/** The evidence + labels a {@link toBuildChannelView} fold needs. */
export interface BuildChannelEvidence {
  readonly eventsByThread: ReadonlyMap<string, readonly CommissionEvent[]>;
  readonly verifiedCommissions: ReadonlySet<string>;
  readonly approvedMerges: ReadonlySet<string>;
  readonly agentLabels: ReadonlyMap<string, AgentLabel>;
  readonly demo: boolean;
}

const EMPTY_EVIDENCE: BuildChannelEvidence = {
  eventsByThread: new Map(),
  verifiedCommissions: new Set(),
  approvedMerges: new Set(),
  agentLabels: new Map(),
  demo: false,
};

function mapMessage(m: ChannelMessage, agentLabels: ReadonlyMap<string, AgentLabel>): MessageView {
  const label = m.isAgent ? agentLabels.get(m.author) : undefined;
  const model = m.isAgent ? m.message.provenance?.generatedBy : undefined;
  return {
    id: m.id,
    author: m.author,
    isAgent: m.isAgent,
    content: m.message.content,
    mediaType: m.message.mediaType,
    ...(m.published !== undefined ? { published: m.published } : {}),
    ...(label !== undefined ? { agentLabel: label } : {}),
    ...(model !== undefined ? { model } : {}),
  };
}

/** Fold ONE thread's commission events into its {@link CommissionInfo}. */
function commissionOf(thread: ChannelThread, evidence: BuildChannelEvidence): CommissionInfo {
  const events = evidence.eventsByThread.get(thread.id) ?? [];
  const fold = foldCommissionState(events, {
    verifiedCommissions: evidence.verifiedCommissions,
    approvedMerges: evidence.approvedMerges,
  });
  const appliedCommission = fold.applied.find((a) => a.event.type === "commission");
  const rejectedCommission = fold.rejected.find((r) => r.event.type === "commission");
  const commissionEvent = appliedCommission?.event ?? rejectedCommission?.event;
  const chain: CommissionStep[] = fold.applied.map((a) => ({
    type: a.event.type,
    actor: a.event.actor,
    at: a.event.at,
  }));
  return {
    state: fold.state,
    verified: appliedCommission !== undefined,
    unverified: appliedCommission === undefined && rejectedCommission !== undefined,
    chain,
    ...(commissionEvent?.actor !== undefined ? { commissioner: commissionEvent.actor } : {}),
    ...(commissionEvent?.evidence !== undefined ? { evidence: commissionEvent.evidence } : {}),
  };
}

/**
 * PURE view-model mapping: shape a BL.1 {@link ChannelResult} + the per-thread
 * commission evidence into the render-ready {@link BuildChannelView}. Exported so
 * the fold (agent attribution, human-vs-agent, computed commission state) is
 * provable as a unit test on plain data, no DOM/network involved.
 */
export function toBuildChannelView(
  result: ChannelResult,
  evidence: BuildChannelEvidence = EMPTY_EVIDENCE,
): BuildChannelView {
  // The AGENT WEBID SET, so an agent-created thread is NEVER rendered as an
  // unmarked human. Two independent signals, unioned:
  //  1. STRUCTURAL (BL.1, authoritative, dep-free): every WebID that authored a
  //     PROV-O agent turn (`ChannelMessage.isAgent`) is an agent — BL.1's XOR gate
  //     already refused any message wearing both a human author and an agent
  //     attribution, so this is a verified per-pod assertion, not a heuristic.
  //  2. SELF-DESCRIBED (an entry in `agentLabels`): every WebID that serves a valid,
  //     subject-bound ANP agent self-description (`verifyDataset`) — this also
  //     catches a thread-ONLY agent that never posted a message. Its label carries
  //     the agent's name + a SELF-CLAIMED owner (unverified — see MessageView).
  // Either signal marks a WebID an agent (never a human); the self-described ones
  // additionally carry a name + an unverified owner CLAIM.
  const agentWebIds = new Set<string>();
  for (const m of result.timeline) if (m.isAgent) agentWebIds.add(m.author);
  for (const w of evidence.agentLabels.keys()) agentWebIds.add(w);

  const threadMessageIds = new Set<string>();
  const threads: ThreadView[] = result.threads.map((t) => {
    for (const m of t.messages) threadMessageIds.add(m.id);
    const creatorLabel = evidence.agentLabels.get(t.creator);
    return {
      id: t.id,
      resource: t.resource,
      creator: t.creator,
      creatorIsAgent: agentWebIds.has(t.creator),
      title: t.task.title,
      state: t.task.state,
      commission: commissionOf(t, evidence),
      messages: t.messages.map((m) => mapMessage(m, evidence.agentLabels)),
      ...(creatorLabel !== undefined ? { creatorLabel } : {}),
    };
  });
  const rootMessages = result.timeline
    .filter((m) => !threadMessageIds.has(m.id))
    .map((m) => mapMessage(m, evidence.agentLabels));
  return {
    channel: result.channel,
    ...(result.tracker?.title !== undefined ? { title: result.tracker.title } : {}),
    threads,
    rootMessages,
    participants: result.participants.map((p) => ({ webId: p.webId, tier: p.tier })),
    unverified: result.unverified,
    errors: result.errors,
    demo: evidence.demo,
  };
}

/** Upper bound on agent-descriptor resolution fan-out per channel read — a
 *  hostile/large roster cannot force unbounded profile fetches (bounded, INV-4). */
export const MAX_AGENT_RESOLVE = 64;

const RDF_ACCEPT = "text/turtle, application/ld+json;q=0.9";

/** The fragmentless document IRI of a (possibly fragment-carrying) WebID. */
function docOf(iri: string): string {
  const u = new URL(iri);
  u.hash = "";
  return u.toString();
}

/**
 * Resolve name + (SELF-CLAIMED) owner labels for candidate AGENT WebIDs — the
 * CORRECT direction: for a WebID that is itself an agent, read its OWN
 * self-description. (`discoverAgent` is the OTHER direction — a PERSON's profile →
 * the agent that represents them, checking `ad:owner === the person`; wrong for an
 * agent WebID.) For each candidate we fetch its WebID document (via the
 * credential-free/guarded `fetchFn` — the SSRF boundary), parse it, and
 * {@link verifyDataset} it REQUIRING the single `ad:AgentDescription` subject to
 * equal the WebID (`requireSubjectMatch` — the anti-spoof binding: a document
 * cannot describe a DIFFERENT agent). A valid description ⇒ this WebID IS an agent;
 * its `ad:owner` is taken as an UNVERIFIED `ownerClaim` (the agent's own doc
 * asserts it — a hostile doc could name any WebID, so it is NEVER a verified
 * back-link; the reciprocal owner→agent check is the audit increment).
 *
 * FAIL-CLOSED + fail-isolated: a WebID that serves NO valid agent description (a
 * person, or an unreachable/hostile/oversize doc) yields NO entry — so a person is
 * never mislabelled an agent, and a structurally-classified PROV-O agent that
 * doesn't resolve here stays an agent with no name/owner (never a human). Bounded
 * (`MAX_AGENT_RESOLVE`); non-http(s) WebIDs skip the fetch; byte-capped body.
 *
 * This ALSO CLASSIFIES a thread-ONLY agent (an agent that opened a thread but
 * posted no PROV-O message, so the structural signal is silent): its WebID serving
 * a valid agent description marks it an agent — without which it would fall back to
 * a human creator.
 */
export async function resolveAgentLabels(
  webIds: Iterable<string>,
  fetchFn: typeof fetch,
): Promise<Map<string, AgentLabel>> {
  const labels = new Map<string, AgentLabel>();
  const distinct = [...new Set(webIds)].filter((w) => isHttpIri(w)).slice(0, MAX_AGENT_RESOLVE);
  await Promise.all(
    distinct.map(async (webId) => {
      try {
        const doc = docOf(webId);
        const res = await fetchFn(doc, { headers: { accept: RDF_ACCEPT } });
        if (!res.ok) return;
        const text = await readBodyCapped(res, DEFAULT_MAX_BODY_BYTES);
        const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: doc });
        // The agent's OWN self-description, subject-bound to this exact WebID.
        const v = verifyDataset(ds, webId, { requireSubjectMatch: true });
        if (v.valid && v.descriptor !== undefined) {
          // The description proves this WebID IS a self-describing agent (used for
          // classification + the name). Its `ad:owner` is a SELF-CLAIM only — the
          // agent's own doc asserts it, unverified — so it is carried as
          // `ownerClaim` and rendered as "claims to act for X", never a verified
          // back-link (the reciprocal owner→agent check is the audit increment).
          labels.set(webId, {
            ...(v.descriptor.name ? { name: v.descriptor.name } : {}),
            ...(v.descriptor.owner !== undefined ? { ownerClaim: v.descriptor.owner } : {}),
          });
        }
      } catch {
        // fail-closed: an unresolvable / hostile description yields no label
      }
    }),
  );
  return labels;
}

/** Fetch + parse one thread's persisted `unite:CommissionEvent`s (guarded, byte-capped,
 *  fail-isolated — a broken/oversize doc yields no events, never throws). The thread
 *  resource was already validated within-base by the BL.1 aggregator. */
async function fetchThreadEvents(
  fetchFn: typeof fetch,
  thread: ChannelThread,
): Promise<CommissionEvent[]> {
  try {
    const res = await fetchFn(thread.resource, {
      headers: { accept: "text/turtle, application/ld+json;q=0.9" },
    });
    if (!res.ok) return [];
    const text = await readBodyCapped(res, DEFAULT_MAX_BODY_BYTES);
    const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: thread.resource });
    return parseCommissionEvents(ds, { thread: thread.id });
  } catch {
    return [];
  }
}

/**
 * The pod-mode channel IRI: the deliberation's conventional `build/channel`
 * CHILD. The channel derives from the deliberation's PATH — the deliberation
 * IRI is parsed FIRST, its query/fragment cleared (a hash IRI like
 * `…/deliberations/apps#this` names the deliberation *within* its document;
 * the build channel still lives under the document's path), and a trailing
 * "/" ensured on the PATHNAME so a slashless deliberation
 * (`…/deliberations/apps`) yields `…/deliberations/apps/build/channel`, not
 * `…/deliberations/build/channel` (which `new URL(rel, base)` would produce by
 * replacing the last path segment, silently reading the wrong — usually empty —
 * channel). Appending "/" to the RAW string instead would glue it onto the
 * fragment/query (`…apps#this/`) and resolve against the WRONG parent path.
 * The result stays same-origin and strictly under the deliberation's path
 * (INV-4): the base is the parsed deliberation origin+path and the relative
 * `build/channel` contains no `..`/authority.
 */
export function podChannelIri(deliberation: string): string | undefined {
  if (!isHttpIri(deliberation)) return undefined;
  try {
    const base = new URL(deliberation);
    base.hash = "";
    base.search = "";
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    return new URL("build/channel", base).toString();
  } catch {
    return undefined;
  }
}

/** The Build channel data state. */
export interface BuildChannelState {
  readonly view: BuildChannelView | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

/**
 * Aggregate + resolve the build channel for the active config/scope. Demo mode
 * seeds + reads the in-memory pod (agent attribution back-links + REAL verified
 * commissions). Pod mode reads the deliberation's conventional build channel over
 * the credential-free publicFetch and folds the commission events fail-CLOSED —
 * a real signed commission is surfaced as PRESENT-BUT-UNVERIFIED (never as
 * "commission absent"), because verifying a live commission needs a
 * `trustedCommissioners` trust root (which community may commission a build) +
 * key resolution — the fedreg community-registry wiring that is the audit
 * increment's domain, NOT yet in `DeliberationConfig` (state.ts marks it Phase
 * 5). So this view NEVER runs an unprotected verify; it reports the commission's
 * existence honestly and defers the crypto verdict.
 *
 * The rendered `view` is DERIVED AT RENDER, keyed to the exact (config, scope) it
 * was resolved for (the useTrustProfile / AdoptionBoard pattern): a view resolved
 * for a previous config/scope resolves to `null` in the very same render — so
 * switching deliberations never briefly shows the OLD channel under the new
 * config (no effect-timing window). A superseded/stale read can never clobber a
 * newer one (monotonic request id + the render key).
 */
export function useBuildChannel(
  config: DeliberationConfig,
  controller: LoginController,
  scope: ScopeConfig,
): BuildChannelState {
  const [stored, setStored] = useState<{ key: string; view: BuildChannelView } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqId = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;
  // The FULL config/scope value key (mode, deliberation, ownBase, participants,
  // participationFloor, scope) — a change in ANY of these locks the old view.
  const key = JSON.stringify([deliberationKey(config), scope.id]);

  const refresh = useCallback(async () => {
    reqId.current += 1;
    const id = reqId.current;
    const started = config;
    const startedKey = JSON.stringify([deliberationKey(started), scope.id]);
    const isCurrent = () => id === reqId.current && configRef.current === started;

    if (!scope.buildLayer) {
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let channel: string;
      let registry: DeliberationRegistry;
      let verifier: MembershipVerifier;
      let fetchFn: typeof fetch;
      let evidence: BuildChannelEvidence;

      if (config.mode === "demo") {
        const demo = await demoForDeliberation(config.deliberation);
        if (!demo)
          throw new Error(`demo mode requires a demo deliberation IRI: ${config.deliberation}`);
        const seeded: DemoBuildChannel = await getDemoBuildChannel(demo.fetch, scope.id);
        channel = seeded.channel;
        registry = seeded.registry;
        verifier = seeded.verifier;
        fetchFn = demo.fetch;
        evidence = {
          eventsByThread: new Map(),
          verifiedCommissions: seeded.verifiedCommissions,
          approvedMerges: seeded.approvedMerges,
          agentLabels: seeded.agentLabels,
          demo: true,
        };
      } else {
        const derived = podChannelIri(config.deliberation);
        if (!configReady(config) || derived === undefined) {
          if (isCurrent()) setLoading(false);
          return;
        }
        channel = derived;
        registry = buildRegistry(config);
        verifier = (await deliberationTrust(config)).gate;
        fetchFn = await readFetchFor(config, controller);
        // Fail-closed: no verified-commission set (see the header) — a live
        // commission folds to present-but-unverified, never silently advanced.
        evidence = {
          eventsByThread: new Map(),
          verifiedCommissions: new Set(),
          approvedMerges: new Set(),
          agentLabels: new Map(),
          demo: false,
        };
      }

      const result = await aggregateChannel({ channel, registry, verifier, fetch: fetchFn });
      // Read each thread's persisted commission events (exercises the REAL parser).
      const eventsByThread = new Map<string, readonly CommissionEvent[]>();
      for (const thread of result.threads) {
        eventsByThread.set(thread.id, await fetchThreadEvents(fetchFn, thread));
      }
      // Agent attribution back-links. Demo mode carries seeded (verified) labels;
      // pod mode RESOLVES them from each agent's OWN self-description (verifyDataset,
      // fail-closed) over the candidate WebIDs — thread creators (to catch a
      // thread-only agent) ∪ the PROV-O agent-message authors. A WebID that serves no
      // valid agent description gets no label; the structural signal in
      // toBuildChannelView still marks a PROV-O agent as an (unverified) agent, so it
      // is never rendered as a human.
      let agentLabels = evidence.agentLabels;
      if (!evidence.demo) {
        const candidates = new Set<string>();
        for (const t of result.threads) candidates.add(t.creator);
        for (const m of result.timeline) if (m.isAgent) candidates.add(m.author);
        agentLabels = await resolveAgentLabels(candidates, fetchFn);
      }
      const next = toBuildChannelView(result, { ...evidence, agentLabels, eventsByThread });
      if (!isCurrent()) return;
      setStored({ key: startedKey, view: next });
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [config, controller, scope]);

  // On a config/scope change: supersede any in-flight read + reset loading (the
  // stale VIEW is already hidden by the keyed derivation below — a superseded
  // request's finally no longer owns the id, so it must not stick loading=true).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by VALUE — re-run on the config/scope value change to supersede in-flight reads.
  useEffect(() => {
    reqId.current += 1;
    setLoading(false);
  }, [key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Derived AT RENDER: a view resolved for a different config/scope is never
  // returned (no stale-channel window while the effect catches up).
  const view = stored !== null && stored.key === key ? stored.view : null;
  return { view, loading, error, refresh };
}
