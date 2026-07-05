// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.1 — the cross-pod CHANNEL AGGREGATOR for unite's agentic build layer
// (design docs/PLATFORM-PLAN §5, next-phases §3.5). This is the STRUCTURAL SIBLING
// of aggregate.ts: a pure, fail-isolated, creator-verified, SSRF-guarded fold over
// participant pods — here reading a build-layer CHANNEL (a `wf:Tracker`), its
// THREADS (`wf:Task`), and every participant's pod MESSAGES (`CanonicalMessage`)
// into ONE ordered, deduped, cross-pod timeline.
//
// Composition — mint nothing, reuse the SHARED suite models (never a bespoke RDF
// parser; house rule). Grounded on each package's ACTUAL exported API:
//   • channel  = `wf:Tracker` → `@jeswr/solid-task-model` `parseTracker(docUrl, ds)`
//                (subject `${docUrl}#this`), typed `TrackerData`.
//   • thread   = `wf:Task`    → `@jeswr/solid-task-model` `parseTask(resourceUrl, ds)`
//                (subject `${resourceUrl}#it`), typed `TaskData`; a task links to
//                its channel via `wf:tracker` (`TaskData.project`).
//   • message  = `CanonicalMessage` → `@jeswr/solid-chat-interop`
//                `parseAs2Message(subject, ds)` (subject `${resourceUrl}#it`) — the
//                canonical AS2.0 `as:Note`, with `as:inReplyTo` threading, PROV-O
//                `MessageProvenance` AI-attribution, the `wf:Task` `MessageTask`
//                overlay, the `dct:isReplacedBy` edit pointer and the
//                `schema:dateDeleted` tombstone. Its IRI-valued fields are ALREADY
//                filtered http(s)-only on read by the package (untrusted input),
//                so a `javascript:`/`file:` author/room is dropped upstream.
//   • agent participant = an `AgentDescriptor` (`@jeswr/solid-agent-card`
//                `discoverAgent`) — resolved from a message's authoring WebID by
//                the read-only view (BL.2), NOT here: see the seam note below.
//
// Load-bearing invariants (INV-4 / INV-6 of the design; identical posture to
// aggregate.ts):
//   • CREATOR-OWNS-THE-POD. A thread counts only if its `dct:creator` is the pod
//     owner; a message counts only if it asserts EXACTLY ONE authoring identity —
//     a human note (`as:attributedTo`) XOR an agent turn (the PROV-O agent
//     `prov:wasAttributedTo`), never both — and that identity is the pod owner. A
//     pod cannot stuff a thread/message as someone else, and a message that wears
//     BOTH a human author and an agent attribution is refused outright — "agents
//     never post as humans" enforced structurally, not just labelled.
//   • FAIL-CLOSED, FAIL-ISOLATED. A hostile/broken member resource is recorded and
//     skipped while its siblings still aggregate; a broken container listing
//     degrades only that participant's stage; a malformed literal drops the field
//     (the package parsers) or, at worst, the member (this fold's try/catch) —
//     nothing aborts the whole aggregation. Bodies are read with an incremental
//     byte cap.
//   • SSRF-GUARDED. The only fetch targets are (1) the caller-supplied channel
//     (`wf:Tracker`) doc — a trusted config IRI, http(s)-validated + byte-capped —
//     and (2) container members STRICTLY WITHIN a participant's own base
//     (`isWithinBase`). No fetch target is EVER taken from untrusted message/thread
//     CONTENT (a message's `room`/`inReplyTo`, a thread's `project` are used only
//     to MATCH the channel, never to fetch).
//   • DETERMINISTIC, EDIT-SAFE ORDERING. The timeline is folded order-INDEPENDENTLY
//     (a newest-first read cannot overwrite a newer edit): a message is superseded
//     ONLY by a `dct:isReplacedBy` replacement that ITSELF survives — is eligible
//     (not tombstoned, in-channel) AND same-author + same-thread — so a hidden,
//     orphan, or foreign replacement never erases a still-valid original. Computed
//     from the data, never from read order; survivors sort by `as:published` with a
//     deterministic id tie-break.
//
// ── The commission-lifecycle SEAM (left clean for lib/quorum.ts + BL.3/BL.4) ─────
// BL.1 is the channel-READ foundation ONLY. It deliberately does NOT build the
// commission lifecycle, the draft-commission→signed-delegation binding, or the
// human merge gate — those need `lib/quorum.ts` (the S3.3 quorum keystone, landing
// separately) and are BL.3/BL.4. This file exposes exactly what those need without
// implementing them:
//   • each {@link ChannelThread} carries its raw federated `wf:Task` (`task.state`
//     is the binary open|closed the suite federates) + its ordered messages — the
//     input a BL.3 `lib/commission.ts` folds into the richer {@link CommissionState}
//     machine;
//   • {@link ChannelMessage.isAgent} + `message.provenance` label an agent turn so
//     BL.2 can resolve the author WebID to an `AgentDescriptor` via
//     `@jeswr/solid-agent-card` `discoverAgent` (the agent-participant seam);
//   • {@link BUILD_THREADS_DIR}/{@link BUILD_MESSAGES_DIR} are the pod write
//     convention BL.3's own-pod writer + LDN-announce path MUST reuse, so what BL.3
//     writes is exactly what this reads.
// No signing, no delegation, no state mutation happens here.

import { parseRdf } from "@jeswr/fetch-rdf";
import type { CanonicalMessage } from "@jeswr/solid-chat-interop";
import { as2MessageSubject, parseAs2Message } from "@jeswr/solid-chat-interop";
import type { TaskData } from "@jeswr/solid-task-model/task";
import { parseTask } from "@jeswr/solid-task-model/task";
import type { TrackerData } from "@jeswr/solid-task-model/tracker";
import { parseTracker, trackerSubject } from "@jeswr/solid-task-model/tracker";
import type { DatasetCore } from "@rdfjs/types";
import { DEFAULT_MAX_RESOURCES } from "./aggregate.js";
import type { MembershipTier, MembershipVerifier } from "./membership.js";
import { isHttpIri } from "./model.js";
import { DEFAULT_MAX_BODY_BYTES, isWithinBase, listContainer, readBodyCapped } from "./pod.js";
import type { DeliberationRegistry, Participant } from "./registry.js";

/**
 * The pod containers a participant writes build-layer resources under. BL.3's
 * own-pod writer MUST use these SAME dirs so `aggregateChannel` reads what it
 * wrote. Each is a per-participant container `<base>build/threads/` /
 * `<base>build/messages/`; the resource itself declares which channel/thread it
 * belongs to (`wf:tracker` on a task, `as:context` on a message), so ONE pair of
 * dirs serves every channel the participant is in.
 */
export const BUILD_THREADS_DIR = "build/threads";
export const BUILD_MESSAGES_DIR = "build/messages";

/**
 * The commission lifecycle a build-layer thread moves through — the vocabulary the
 * BL.3 `lib/commission.ts` machine (unbuilt) will compute and BL.4's merge gate
 * (via `lib/quorum.ts`) will enforce. BL.1 reads ONLY the federated `wf:Task`
 * binary state (`ChannelThread.task.state` = open|closed); this richer machine is
 * NOT derived here. Exported now purely so the next bead has a stable, documented
 * type and this file stays a pure reader. (`drafted`→`commissioned` binds a signed
 * `fedtrust:DelegationCredential`; `pr-open`→`merged` requires the ≥2-reviewer
 * quorum — both BL.4, both reuse the S3.3 keystone.)
 */
export type CommissionState =
  | "drafted"
  | "commissioned"
  | "in-progress"
  | "pr-open"
  | "in-review"
  | "merged"
  | "rejected";

/** A per-source failure — the unit is skipped, not the whole aggregation. */
export interface ChannelSourceError {
  readonly webId: string;
  readonly base: string;
  readonly stage: "channel" | "membership" | "threads" | "messages";
  /** The specific member resource that failed, when the failure was per-member. */
  readonly resource?: string;
  readonly message: string;
}

/** A verified channel participant + the tier that vouched them. */
export interface ChannelParticipant {
  readonly webId: string;
  readonly base: string;
  readonly tier: MembershipTier;
}

/** One cross-pod message in the channel feed (a folded, verified `CanonicalMessage`). */
export interface ChannelMessage {
  /** The message subject IRI (`${resource}#it`) — the identity `as:inReplyTo`/`room` reference. */
  readonly id: string;
  /** The pod resource URL the message was read from (STRICTLY within {@link base}). */
  readonly resource: string;
  /** The participant pod base it was read from. */
  readonly base: string;
  /** The verified authoring WebID (== the pod owner; every asserted identity matched it). */
  readonly author: string;
  /** True iff attributed via PROV-O (`prov:wasAttributedTo`) with no human `as:attributedTo` — an agent turn. */
  readonly isAgent: boolean;
  /** `as:published` ISO-8601 stamp, when present (drives ordering; absent sorts as epoch 0). */
  readonly published: string | undefined;
  /** `as:context` — the thread ({@link ChannelThread.id}) or the channel root this belongs to. */
  readonly room: string | undefined;
  /** The full parsed canonical message (content/inReplyTo/provenance/task overlay/…). */
  readonly message: CanonicalMessage;
}

/** One thread in the channel (a verified `wf:Task`) + its ordered messages. */
export interface ChannelThread {
  /** The thread subject IRI (`${resource}#it`, i.e. `taskSubject(resource)`). */
  readonly id: string;
  /** The pod resource URL the thread was read from. */
  readonly resource: string;
  /** The thread creator's WebID (== the pod owner; verified). */
  readonly creator: string;
  /** The raw federated task (binary open|closed state — the BL.3 commission-machine input). */
  readonly task: TaskData;
  /** The thread's messages (the subset of {@link ChannelResult.timeline} whose `room` is this thread), ordered. */
  readonly messages: ChannelMessage[];
}

/** The aggregated read of a build-layer channel. */
export interface ChannelResult {
  /** The channel (`wf:Tracker`) IRI this was aggregated for. */
  readonly channel: string;
  /** The parsed channel config, or `undefined` if the tracker doc is missing/unreadable (not an error). */
  readonly tracker: TrackerData | undefined;
  /** The channel's threads (verified `wf:Task`s), ordered by creation. */
  readonly threads: ChannelThread[];
  /** The flat, ordered, deduped, edit-folded cross-pod message feed. */
  readonly timeline: ChannelMessage[];
  readonly participants: ChannelParticipant[];
  readonly unverified: { readonly webId: string; readonly reason: string }[];
  readonly errors: ChannelSourceError[];
}

/** Options for {@link aggregateChannel}. */
export interface ChannelOptions {
  /** The channel (`wf:Tracker`) IRI — a TRUSTED config value (the only non-member fetch target). */
  readonly channel: string;
  /** The participant-listing seam (who is in the channel + where their pods are). */
  readonly registry: DeliberationRegistry;
  /** The participation gate (fail-closed; an unvouched participant contributes nothing). */
  readonly verifier: MembershipVerifier;
  /** The foreign-pod read fetch (publicFetch — never the session-bound one). */
  readonly fetch: typeof fetch;
  readonly maxResourcesPerParticipant?: number;
  readonly maxBodyBytes?: number;
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The document IRI of a (possibly fragment-carrying) IRI — the fragmentless form. */
function docOf(iri: string): string {
  const u = new URL(iri);
  u.hash = "";
  return u.toString();
}

/** Fetch + parse a single RDF resource with an incremental body-size cap (sibling of aggregate.ts). */
async function fetchDataset(
  fetchFn: typeof fetch,
  url: string,
  maxBytes: number,
): Promise<DatasetCore> {
  const res = await fetchFn(url, {
    headers: { accept: "text/turtle, application/ld+json;q=0.9" },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const text = await readBodyCapped(res, maxBytes);
  return parseRdf(text, res.headers.get("content-type"), { baseIRI: url });
}

/**
 * Read one participant's build-layer members from `<base><dir>/`, parsing each with
 * `parseOne` (the subject-rooted package parser). A member outside the participant's
 * OWN base is refused (SSRF / cross-pod attribution); a failed listing records one
 * stage error; a failed member records a per-member error and is skipped — siblings
 * survive. Returns `{ resource, item }` for every member that parsed to a value.
 */
async function readMembers<T>(
  fetchFn: typeof fetch,
  p: Participant,
  dir: string,
  maxResources: number,
  maxBytes: number,
  stage: "threads" | "messages",
  parseOne: (resource: string, ds: DatasetCore) => T | undefined,
  errors: ChannelSourceError[],
): Promise<{ resource: string; item: T }[]> {
  const container = new URL(`${dir}/`, p.base).toString();
  let members: string[];
  try {
    members = (await listContainer(fetchFn, container, maxBytes)).slice(0, maxResources);
  } catch (e) {
    errors.push({ webId: p.webId, base: p.base, stage, message: messageOf(e) });
    return [];
  }
  const kept: { resource: string; item: T }[] = [];
  for (const member of members) {
    // A container lists untrusted IRIs: a hostile pod could point a member at an
    // ARBITRARY http(s) resource. Fail-closed — only fetch members within this
    // participant's own base (identical to aggregate.ts).
    if (!isWithinBase(p.base, member)) {
      errors.push({
        webId: p.webId,
        base: p.base,
        stage,
        resource: member,
        message: "container member outside participant base (out-of-scope, skipped)",
      });
      continue;
    }
    try {
      const ds = await fetchDataset(fetchFn, member, maxBytes);
      const item = parseOne(member, ds);
      if (item !== undefined) kept.push({ resource: member, item });
    } catch (e) {
      errors.push({ webId: p.webId, base: p.base, stage, resource: member, message: messageOf(e) });
    }
  }
  return kept;
}

/**
 * Does a message assert exactly ONE authoring identity, and is it the pod owner?
 * Fail-closed, and the "agents never post as humans" gate in one predicate. A
 * message is EITHER a human note (the human `as:attributedTo`, {@link
 * CanonicalMessage.author}) OR an agent turn (the PROV-O agent
 * `prov:wasAttributedTo`, {@link MessageProvenance.attributedTo}) — NEVER both:
 * the contradictory both-set shape is rejected outright, EVEN when both name the
 * pod owner, so an agent turn can never also wear a human author and the
 * human-vs-agent classification ({@link ChannelMessage.isAgent}) is unambiguous.
 *
 * Rejects: an unauthored message; a message asserting both a human author AND an
 * agent attribution (the "agent posting as a human" shape); and any authoring
 * identity ≠ the pod owner (cross-pod spoof). (Non-http(s) identities are already
 * dropped to `undefined` by `parseAs2Message`.)
 */
function assertsOnlyOwner(msg: CanonicalMessage, webId: string): boolean {
  const human = msg.author;
  const agent = msg.provenance?.attributedTo;
  // A message is a human note XOR an agent turn — both-set is the forbidden shape.
  if (human !== undefined && agent !== undefined) return false;
  const asserted = human ?? agent;
  if (asserted === undefined) return false; // unauthored → drop
  return asserted === webId; // the sole authoring identity must be the pod owner
}

/**
 * Aggregate a build-layer channel from its participants' pods: read the channel
 * (`wf:Tracker`) config, every verified participant's own threads (`wf:Task`) and
 * messages (`CanonicalMessage`), and fold the messages into one ordered,
 * edit-safe, cross-pod timeline. Membership-gated, creator-verified, SSRF-guarded,
 * fail-isolated. Never throws on a per-source failure; an empty/missing channel
 * yields an empty timeline, not an error.
 */
export async function aggregateChannel(options: ChannelOptions): Promise<ChannelResult> {
  const { channel, registry, verifier, fetch: fetchFn } = options;
  const maxResources = options.maxResourcesPerParticipant ?? DEFAULT_MAX_RESOURCES;
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  const errors: ChannelSourceError[] = [];
  const participants: ChannelParticipant[] = [];
  const unverified: { webId: string; reason: string }[] = [];

  // The channel IRIs a thread's `wf:tracker` / a message's `as:context` may name to
  // count as "in this channel" — the caller's IRI, its fragmentless doc, and the
  // conventional `#this` tracker subject. Used ONLY for matching, never to fetch.
  const channelIris = new Set<string>([channel]);
  let channelDoc: string | undefined;
  if (isHttpIri(channel)) {
    channelDoc = docOf(channel);
    channelIris.add(channelDoc);
    channelIris.add(trackerSubject(channelDoc));
  } else {
    // A non-http(s) channel IRI is a caller misconfiguration: record it and read no
    // tracker doc (never fetch a non-http(s) target), but still fold whatever the
    // participants' pods hold that references this channel string.
    errors.push({
      webId: channel,
      base: channel,
      stage: "channel",
      message: `channel is not an http(s) IRI: ${channel}`,
    });
  }

  // (1) The channel config — the ONE trusted, caller-supplied fetch target. A 404
  // (config not published yet) is a valid empty state, not an error; any other
  // failure is fail-isolated (tracker stays undefined, the feed still builds).
  let tracker: TrackerData | undefined;
  if (channelDoc !== undefined) {
    try {
      const res = await fetchFn(channelDoc, {
        headers: { accept: "text/turtle, application/ld+json;q=0.9" },
      });
      if (res.status !== 404) {
        if (!res.ok) throw new Error(`GET ${channelDoc} → ${res.status}`);
        const text = await readBodyCapped(res, maxBytes);
        const ds = await parseRdf(text, res.headers.get("content-type"), { baseIRI: channelDoc });
        tracker = parseTracker(channelDoc, ds);
      }
    } catch (e) {
      errors.push({ webId: channelDoc, base: channelDoc, stage: "channel", message: messageOf(e) });
    }
  }

  // (2) Fold every verified participant's threads + messages.
  const threadEntries: { resource: string; task: TaskData }[] = [];
  const rawMessages: ChannelMessage[] = [];

  const roster = await registry.listParticipants();
  for (const p of roster) {
    let result: Awaited<ReturnType<MembershipVerifier["verify"]>>;
    try {
      result = await verifier.verify(p.webId, channel);
    } catch (e) {
      errors.push({ webId: p.webId, base: p.base, stage: "membership", message: messageOf(e) });
      continue;
    }
    if (!result.ok) {
      unverified.push({ webId: p.webId, reason: result.reason });
      continue;
    }
    participants.push({ webId: p.webId, base: p.base, tier: result.tier });

    // Threads: a `wf:Task` counts only if the pod owner created it AND it names this
    // channel via `wf:tracker` (the analogue of aggregate.ts's inDeliberation gate).
    const threads = await readMembers(
      fetchFn,
      p,
      BUILD_THREADS_DIR,
      maxResources,
      maxBytes,
      "threads",
      (resource, ds) => parseTask(resource, ds),
      errors,
    );
    for (const { resource, item } of threads) {
      if (item.creator === p.webId && item.project !== undefined && channelIris.has(item.project)) {
        threadEntries.push({ resource, task: item });
      }
    }

    // Messages: a `CanonicalMessage` counts only if every authoring identity it
    // asserts is the pod owner (creator-owns-the-pod + agents-never-post-as-humans).
    // Channel/thread membership is applied AFTER the loop (a message may reply into a
    // thread another participant created), so collect all owner-asserted messages here.
    const messages = await readMembers(
      fetchFn,
      p,
      BUILD_MESSAGES_DIR,
      maxResources,
      maxBytes,
      "messages",
      (resource, ds) => parseAs2Message(as2MessageSubject(resource), ds),
      errors,
    );
    for (const { resource, item } of messages) {
      if (!assertsOnlyOwner(item, p.webId)) continue;
      rawMessages.push({
        id: as2MessageSubject(resource),
        resource,
        base: p.base,
        author: p.webId,
        isAgent: item.author === undefined && item.provenance?.attributedTo !== undefined,
        published: item.published,
        room: item.room,
        message: item,
      });
    }
  }

  // Threads: dedupe by subject id, keep the deterministic first-by-id, sort by
  // creation (undefined → epoch 0) then id.
  const threadById = new Map<string, ChannelThread>();
  for (const { resource, task } of threadEntries) {
    const id = as2MessageSubject(resource); // ${resource}#it — same subject convention as taskSubject
    if (!threadById.has(id)) {
      threadById.set(id, {
        id,
        resource,
        creator: task.creator as string,
        task,
        messages: [],
      });
    }
  }
  // The set of IRIs a message's `room` may name to belong to a KNOWN thread: each
  // thread's subject id AND its bare resource url (robust to either write convention).
  const threadRefs = new Map<string, ChannelThread>();
  for (const t of threadById.values()) {
    threadRefs.set(t.id, t);
    threadRefs.set(t.resource, t);
  }

  // Messages: keep only ELIGIBLE ones first — visible (not `schema:dateDeleted`
  // tombstoned) AND in-channel (`as:context` names the channel root OR a known
  // thread). Dedupe by message subject id (deterministic first). Supersession is
  // then computed AGAINST THE ELIGIBLE SET ONLY, so a hidden (tombstoned),
  // orphan-room, or foreign replacement can never erase a still-valid original
  // (roborev job Medium — the replacement must itself survive).
  const eligibleById = new Map<string, ChannelMessage>();
  for (const m of rawMessages) {
    if (m.message.deletedAt !== undefined) continue;
    const room = m.room;
    const inChannel = room !== undefined && (channelIris.has(room) || threadRefs.has(room));
    if (!inChannel) continue;
    if (!eligibleById.has(m.id)) eligibleById.set(m.id, m);
  }
  // Resolve a `dct:isReplacedBy` IRI (subject-`#it` OR bare resource) to its message.
  const eligibleByRef = new Map<string, ChannelMessage>();
  for (const m of eligibleById.values()) {
    eligibleByRef.set(m.id, m);
    eligibleByRef.set(m.resource, m);
  }

  // Edit-fold ORDER-INDEPENDENTLY (a newest-first read cannot overwrite a newer
  // edit). A message is superseded iff its replacement is an ELIGIBLE (surviving,
  // in-channel) message, distinct from it, BY THE SAME AUTHOR IN THE SAME THREAD —
  // an edit stays same-author/same-thread, so a cross-author or cross-thread
  // `replacedBy` never hides another participant's message. Chain-safe (M1→M2→M3
  // leaves only M3). Computed from the data, never from read order.
  const superseded = new Set<string>();
  for (const m of eligibleById.values()) {
    const replacedBy = m.message.replacedBy;
    if (replacedBy === undefined) continue;
    const repl = eligibleByRef.get(replacedBy);
    if (
      repl !== undefined &&
      repl.id !== m.id &&
      repl.author === m.author &&
      repl.room === m.room
    ) {
      superseded.add(m.id);
    }
  }

  const timeline = [...eligibleById.values()]
    .filter((m) => !superseded.has(m.id))
    .sort(sortMessages);

  // Attach each timeline message to its thread (by `room`).
  for (const m of timeline) {
    const t = m.room !== undefined ? threadRefs.get(m.room) : undefined;
    if (t !== undefined) t.messages.push(m);
  }

  const threads = [...threadById.values()].sort(sortThreads);

  return { channel, tracker, threads, timeline, participants, unverified, errors };
}

/** Deterministic message order: oldest `as:published` first (malformed/absent → 0), tie-break by id. */
function sortMessages(a: ChannelMessage, b: ChannelMessage): number {
  const at = a.published === undefined ? 0 : Date.parse(a.published);
  const bt = b.published === undefined ? 0 : Date.parse(b.published);
  const am = Number.isNaN(at) ? 0 : at;
  const bm = Number.isNaN(bt) ? 0 : bt;
  if (am !== bm) return am - bm;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Deterministic thread order: oldest `dct:created` first (absent → 0), tie-break by id. */
function sortThreads(a: ChannelThread, b: ChannelThread): number {
  const at = a.task.created?.getTime() ?? 0;
  const bt = b.task.created?.getTime() ?? 0;
  const am = Number.isNaN(at) ? 0 : at;
  const bm = Number.isNaN(bt) ? 0 : bt;
  if (am !== bm) return am - bm;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
