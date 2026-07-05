// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.3 — the COMMISSION LIFECYCLE state machine, the agentic build layer's WRITE
// path (design docs/design/next-phases.md §3, PLATFORM-PLAN §5). BL.1 (channel.ts)
// built the cross-pod READ foundation and left a documented seam: each
// {@link ChannelThread} carries its raw federated `wf:Task` (`task.state` = the
// binary open|closed the suite federates) + its ordered messages, and declared the
// richer {@link CommissionState} union this module folds them into. BL.3 is that
// fold + the two SIGNED gates that make a commission real and a merge safe.
//
// ── The three mechanisms (each composes SHIPPED code; mint no crypto) ────────────
//
//   1. A PURE `transition(state, event)` STATE MACHINE — the grammar of a build
//      thread's life: drafted → commissioned → in-progress → pr-open → in-review →
//      merged | rejected. FAIL-CLOSED on every illegal edge (throws
//      {@link CommissionTransitionError}), mirroring the model-society.buildClaimQuads
//      / adoption-decision build-time throw discipline. The two SECURITY-GATED edges
//      (`commission`, `merge`) additionally refuse unless their required signed
//      evidence verified — the gate is inside the primitive, so no caller can reach
//      `commissioned`/`merged` without it. The computed state persists as ONE RDF
//      triple on the `wf:Task` (`unite:commissionState`); but it is a HINT — the
//      authoritative state is always RECOMPUTED by folding the events (INV-3:
//      computed, never asserted — a spoofed state triple is never trusted).
//
//   2. THE COMMISSION (`drafted → commissioned`). A deliberation outcome commissions
//      a build ONLY when a builder-credentialed human SIGNS a
//      `fedtrust:DelegationCredential` (composing @jeswr/federation-trust
//      `issueDelegation` + @jeswr/solid-vc for the Data-Integrity proof) binding the
//      COMMISSIONER (delegator) → the ASSIGNEE (delegate) → the exact ARTIFACT SPEC
//      (the delegation scope). PER-ARTIFACT ONLY: {@link verifyCommission} refuses a
//      credential whose scope is not EXACTLY the commissioned artifact IRI — there are
//      no blanket "build whatever" delegations (PLATFORM-PLAN §5.2 / §4.3). A
//      forged/unsigned/off-artifact/untrusted-issuer credential cannot commission.
//
//   3. THE MERGE-GATE (`in-review → merged`). Transitioning to `merged` REQUIRES a
//      ≥2-steward QUORUM attestation over the artifact — reusing the S3.3 keystone
//      (lib/quorum.ts `buildQuorumAttestation`) with S3's REQUIRED-non-empty
//      `trustedStewards` allowlist gate (mirroring adoption-decision's
//      verifyAdoptionDecisionQuorum): {@link verifyMergeQuorum} THROWS fail-closed
//      when no allowlist is supplied, so a merge NEVER runs an unprotected quorum.
//      Plus the "≥1 reviewer distinct from the builder" rule (design/04 §4.3): the
//      assignee cannot be the SOLE reviewer of its own work. NO valid quorum ⇒ NO
//      merge.
//
// ── Load-bearing invariants (do NOT weaken) ──────────────────────────────────────
//   • aggregate.ts's synthesize-consent gate (INV-1) is UNTOUCHED — this module reads
//     the build channel, it does not re-collect deliberation candidates.
//   • The ≥2 floor is inherited from lib/quorum's QUORUM_FLOOR (a caller may RAISE it,
//     never lower it) and enforced with the REQUIRED steward allowlist (INV-5).
//   • FAIL-CLOSED on untrusted foreign RDF (guarded model.ts readers — isHttpIri
//     filtering, drop-the-field/drop-the-item, bounded fan-out) AND on illegal
//     transitions; the fold is FAIL-ISOLATED (a hostile/illegal event is skipped +
//     recorded, never aborting the whole computation — channel.ts's discipline).
//   • The commission credential must be VERIFIABLE: a forged/unsigned delegation can't
//     authorize a build; a merge without a valid quorum can't happen. The crypto is
//     delegated wholesale to solid-vc / federation-trust via injected seams, so this
//     module is network-free + exhaustively unit-testable.
//
// SERIALISE with n3.Writer (via model.serializeTurtle) ONLY — never hand-built RDF.
// PARSE via the guarded model.ts accessors — foreign RDF is hostile input.
//
// The ODRL usage-policy layer (`odrl:Agreement` chained via `odrld:delegatedUnder`,
// evaluated with @jeswr/solid-odrl) and the zero-credential audit-walk expander
// (`verifyAgentAuthority` / `auditArtifact`) are the DEEPER build-layer surfaces
// (design §3.2 / §3.4); this module carries the lifecycle + the two signed gates and
// leaves those as documented seams (the commission credential is the authority root
// they compose over).

import {
  FEDTRUST_DELEGATE,
  FEDTRUST_DELEGATION_CREDENTIAL,
  FEDTRUST_FEDERATION,
  issueDelegation,
} from "@jeswr/federation-trust";
import type { CredentialSubject, VerifiableCredential, VerificationResult } from "@jeswr/solid-vc";
import type { DatasetCore, Quad } from "@rdfjs/types";
import { DataFactory } from "n3";
import type { CommissionState } from "./channel.js";
import { DCT_CREATED, DCT_CREATOR, NS, RDF_TYPE } from "./fut.js";
import {
  isHttpIri,
  isValidXsdDateTime,
  readCoded,
  readDateTime,
  readIri,
  serializeTurtle,
  typedSubjects,
} from "./model.js";
import {
  buildQuorumAttestation,
  QUORUM_FLOOR,
  type QuorumAttestation,
  type ResolveKey,
} from "./quorum.js";

const { namedNode, literal, quad } = DataFactory;

const XSD_DATETIME = `${NS.xsd}dateTime`;

// ── The unite-local build-layer vocabulary ───────────────────────────────────
// The suite build-layer data model (design §3.2) reuses shipped vocabulary for the
// channel (`wf:Tracker`), thread (`wf:Task`), message (`CanonicalMessage`) and the
// signed commission (`fedtrust:DelegationCredential`). The one thing NO shipped
// vocab provides is the richer commission LIFECYCLE — `MessageTask.state` is only
// binary open|closed and design §3.3(3) explicitly lists the
// `drafted → commissioned → …` machine as unbuilt. So this module mints a MINIMAL,
// unite-local set of coded IRIs for the event + state — homed under the suite
// `w3id.org/jeswr` namespace, consumed ONLY through model.ts's n3.Writer serialiser
// + guarded readers (never hand-built), exactly as fut.ts mints the `fut:` constants.
// Provisional / unite-local (a `w3id.org/jeswr/unite` redirect is a `needs:user`
// follow-up), flagged like fut-draft.ts's not-yet-published terms.
const UNITE = "https://w3id.org/jeswr/unite/build#";
const unite = (local: string): string => `${UNITE}${local}`;

/** `unite:CommissionEvent` — a single, persisted lifecycle transition record. */
export const UNITE_COMMISSION_EVENT = unite("CommissionEvent");
/** `unite:eventType` — the coded event kind this record carries. */
export const UNITE_EVENT_TYPE = unite("eventType");
/** `unite:onThread` — the `wf:Task` (thread) this event advances. */
export const UNITE_ON_THREAD = unite("onThread");
/** `unite:evidence` — the signed credential / attestation resource a GATED event
 *  points at (the commission's `fedtrust:DelegationCredential`, the merge's quorum). */
export const UNITE_EVIDENCE = unite("evidence");
/** `unite:commissionState` — the COMPUTED state cached on the `wf:Task` (a hint;
 *  the fold is authoritative — INV-3). */
export const UNITE_COMMISSION_STATE = unite("commissionState");

// ── The state machine ─────────────────────────────────────────────────────────

/**
 * The events that DRIVE the commission lifecycle. Two are SECURITY-GATED — they
 * carry a signed-evidence requirement enforced by {@link transition}:
 *   • `commission` (drafted → commissioned) — needs a verified
 *     `fedtrust:DelegationCredential` (see {@link verifyCommission});
 *   • `merge` (in-review → merged) — needs a met ≥2-steward quorum (see
 *     {@link verifyMergeQuorum}).
 * The rest are ungated workflow steps.
 */
export type CommissionEventType =
  | "commission"
  | "start"
  | "open-pr"
  | "request-review"
  | "request-changes"
  | "merge"
  | "reject";

/** The event types whose transition additionally requires verified signed evidence. */
const GATED_EVENTS: ReadonlySet<CommissionEventType> = new Set(["commission", "merge"]);

/**
 * The allowed edges — the WHOLE grammar. A `(state, eventType)` pair absent here is
 * an illegal transition (fail-closed). `merged` and `rejected` are TERMINAL (no
 * outgoing edges): a merged/rejected thread cannot be moved again. `reject` is
 * available from every non-terminal working state; `request-changes` sends a review
 * back to `in-progress` (a bounded review loop).
 */
const TRANSITIONS: Readonly<
  Record<CommissionState, Partial<Record<CommissionEventType, CommissionState>>>
> = {
  drafted: { commission: "commissioned" },
  commissioned: { start: "in-progress", reject: "rejected" },
  "in-progress": { "open-pr": "pr-open", reject: "rejected" },
  "pr-open": { "request-review": "in-review", reject: "rejected" },
  "in-review": { merge: "merged", "request-changes": "in-progress", reject: "rejected" },
  merged: {},
  rejected: {},
};

/** The complete set of lifecycle states (the terminal ones flagged). */
export const COMMISSION_STATES: readonly CommissionState[] = [
  "drafted",
  "commissioned",
  "in-progress",
  "pr-open",
  "in-review",
  "merged",
  "rejected",
];

/** The terminal states — no transition leaves them. */
export const TERMINAL_STATES: ReadonlySet<CommissionState> = new Set(["merged", "rejected"]);

/**
 * A transition request: the event type + (for a GATED type) whether the required
 * signed evidence verified. `gatePassed` is IGNORED for ungated types and MUST be
 * `true` for a gated type to be applied — anything else is refused fail-closed, so
 * the commission/merge security requirement is unrepresentable to bypass.
 */
export interface CommissionTransitionEvent {
  readonly type: CommissionEventType;
  /** For `commission`/`merge`: did the signed evidence verify? Default (undefined) ⇒
   *  NOT verified ⇒ the gated transition is refused. */
  readonly gatePassed?: boolean;
}

/** Why a {@link transition} was refused. */
export type CommissionTransitionErrorCode = "illegal-transition" | "unverified-evidence";

/** A fail-closed refusal of an illegal or unverified-evidence transition. */
export class CommissionTransitionError extends Error {
  readonly code: CommissionTransitionErrorCode;
  readonly from: CommissionState;
  readonly eventType: CommissionEventType;
  constructor(
    from: CommissionState,
    eventType: CommissionEventType,
    code: CommissionTransitionErrorCode,
  ) {
    super(
      code === "illegal-transition"
        ? `illegal commission transition: no '${eventType}' edge from '${from}'`
        : `commission transition '${eventType}' from '${from}' requires verified signed ` +
            `evidence (a signed commission / a met ≥2-steward quorum) — refused fail-closed`,
    );
    this.name = "CommissionTransitionError";
    this.code = code;
    this.from = from;
    this.eventType = eventType;
  }
}

/**
 * The PURE state machine: given the current state + an event, return the next state
 * or THROW {@link CommissionTransitionError} (fail-closed). An edge absent from
 * {@link TRANSITIONS} throws `illegal-transition`; a GATED edge (`commission`/`merge`)
 * whose `gatePassed !== true` throws `unverified-evidence` — so `commissioned` is
 * unreachable without a verified commission and `merged` unreachable without a met
 * quorum, at the primitive itself. Deterministic; no I/O.
 */
export function transition(
  state: CommissionState,
  event: CommissionTransitionEvent,
): CommissionState {
  const next = TRANSITIONS[state]?.[event.type];
  if (next === undefined) {
    throw new CommissionTransitionError(state, event.type, "illegal-transition");
  }
  if (GATED_EVENTS.has(event.type) && event.gatePassed !== true) {
    throw new CommissionTransitionError(state, event.type, "unverified-evidence");
  }
  return next;
}

/** Total, non-throwing companion to {@link transition} (for UI): whether the event
 *  is applicable in `state` AND (for a gated type) has verified evidence. */
export function canTransition(state: CommissionState, event: CommissionTransitionEvent): boolean {
  const next = TRANSITIONS[state]?.[event.type];
  if (next === undefined) return false;
  if (GATED_EVENTS.has(event.type) && event.gatePassed !== true) return false;
  return true;
}

// ── The commission-event RDF model (persist + guarded read) ───────────────────

const EVENT_TYPE_IRI: Readonly<Record<CommissionEventType, string>> = {
  commission: unite("Commission"),
  start: unite("Start"),
  "open-pr": unite("OpenPr"),
  "request-review": unite("RequestReview"),
  "request-changes": unite("RequestChanges"),
  merge: unite("Merge"),
  reject: unite("Reject"),
};
const EVENT_TYPE_BY_IRI: ReadonlyMap<string, CommissionEventType> = new Map(
  (Object.entries(EVENT_TYPE_IRI) as [CommissionEventType, string][]).map(([k, v]) => [v, k]),
);
const isEventTypeIri = (v: string): v is string => EVENT_TYPE_BY_IRI.has(v);

const STATE_IRI: Readonly<Record<CommissionState, string>> = {
  drafted: unite("Drafted"),
  commissioned: unite("Commissioned"),
  "in-progress": unite("InProgress"),
  "pr-open": unite("PrOpen"),
  "in-review": unite("InReview"),
  merged: unite("Merged"),
  rejected: unite("Rejected"),
};
const STATE_BY_IRI: ReadonlyMap<string, CommissionState> = new Map(
  (Object.entries(STATE_IRI) as [CommissionState, string][]).map(([k, v]) => [v, k]),
);
const isStateIri = (v: string): v is string => STATE_BY_IRI.has(v);

/** Upper bound on the events folded from one channel/thread (bounded fan-out — a
 *  hostile pod cannot force unbounded parsing; well above any real thread's length). */
export const MAX_COMMISSION_EVENTS = 500;

/** One persisted lifecycle event (a `unite:CommissionEvent`). */
export interface CommissionEvent {
  /** The event resource IRI (subject; https). */
  readonly id: string;
  /** The coded event kind. */
  readonly type: CommissionEventType;
  /** The `wf:Task` (thread) this event advances (https). */
  readonly thread: string;
  /** `dct:creator` — the actor's WebID (https). */
  readonly actor: string;
  /** `dct:created` — the event's xsd:dateTime stamp (drives the deterministic fold order). */
  readonly at: string;
  /** `unite:evidence` — the signed credential / attestation this event points at
   *  (present on `commission`/`merge`; the caller verifies it out-of-band). */
  readonly evidence?: string;
}

/**
 * Serialise ONE commission event to quads (n3.Writer via model.serializeTurtle —
 * never hand-built). Validates every IRI (http(s)) + the timestamp the SAME way the
 * parser reads them, so a built event never round-trips a value the parser drops.
 * Throws on an invalid field (build-time fail-closed, mirroring buildAdoptionDecisionQuads).
 */
export function buildCommissionEventQuads(event: CommissionEvent): Quad[] {
  const kind = "buildCommissionEvent";
  for (const [f, iri] of [
    ["id", event.id],
    ["thread", event.thread],
    ["actor", event.actor],
  ] as const) {
    if (!isHttpIri(iri)) throw new Error(`${kind}: ${f} is not an http(s) IRI: ${iri}`);
  }
  if (event.evidence !== undefined && !isHttpIri(event.evidence)) {
    throw new Error(`${kind}: evidence is not an http(s) IRI: ${event.evidence}`);
  }
  const typeIri = EVENT_TYPE_IRI[event.type];
  if (typeIri === undefined) throw new Error(`${kind}: unknown event type: ${event.type}`);
  if (!isValidXsdDateTime(event.at)) {
    throw new Error(`${kind}: at is not a valid xsd:dateTime: ${event.at}`);
  }
  const s = namedNode(event.id);
  const quads: Quad[] = [
    quad(s, namedNode(RDF_TYPE), namedNode(UNITE_COMMISSION_EVENT)),
    quad(s, namedNode(UNITE_EVENT_TYPE), namedNode(typeIri)),
    quad(s, namedNode(UNITE_ON_THREAD), namedNode(event.thread)),
    quad(s, namedNode(DCT_CREATOR), namedNode(event.actor)),
    quad(s, namedNode(DCT_CREATED), literal(event.at, namedNode(XSD_DATETIME))),
  ];
  if (event.evidence !== undefined) {
    quads.push(quad(s, namedNode(UNITE_EVIDENCE), namedNode(event.evidence)));
  }
  return quads;
}

/** Serialise a commission event to Turtle. Throws on any invalid field. */
export function serializeCommissionEvent(event: CommissionEvent): Promise<string> {
  return serializeTurtle(buildCommissionEventQuads(event), { unite: UNITE });
}

/** Options for {@link parseCommissionEvents}. */
export interface ParseCommissionEventsOptions {
  /** Keep only events whose `unite:onThread` equals this `wf:Task` IRI (a channel view
   *  reads many threads from one pod doc; filter to the thread being folded). */
  readonly thread?: string;
  /** Cap on the events returned (default {@link MAX_COMMISSION_EVENTS}). */
  readonly max?: number;
}

/**
 * Parse every WELL-FORMED `unite:CommissionEvent` in a dataset. Foreign RDF is
 * hostile: a missing/malformed required field (a non-http(s) IRI, a non-coded event
 * type, a malformed dateTime) DROPS that event; siblings survive (field/item-level
 * isolation, the model.ts discipline). BOUNDED: at most `max` events are returned.
 * Never throws.
 */
export function parseCommissionEvents(
  ds: DatasetCore,
  options: ParseCommissionEventsOptions = {},
): CommissionEvent[] {
  const max = options.max ?? MAX_COMMISSION_EVENTS;
  const out: CommissionEvent[] = [];
  for (const s of typedSubjects(ds, UNITE_COMMISSION_EVENT)) {
    if (out.length >= max) break;
    const typeIri = readCoded(ds, s, UNITE_EVENT_TYPE, isEventTypeIri);
    const thread = readIri(ds, s, UNITE_ON_THREAD);
    const actor = readIri(ds, s, DCT_CREATOR);
    const at = readDateTime(ds, s, DCT_CREATED);
    if (typeIri === undefined || thread === undefined || actor === undefined || at === undefined) {
      continue; // a required field is malformed → drop this event, keep siblings
    }
    if (options.thread !== undefined && thread !== options.thread) continue;
    const type = EVENT_TYPE_BY_IRI.get(typeIri);
    if (type === undefined) continue; // (isEventTypeIri already guarantees this — defensive)
    const evidence = readIri(ds, s, UNITE_EVIDENCE); // optional
    out.push({
      id: s.value,
      type,
      thread,
      actor,
      at,
      ...(evidence !== undefined ? { evidence } : {}),
    });
  }
  return out;
}

/**
 * Build the single triple that CACHES the computed commission state on the `wf:Task`
 * (`<task> unite:commissionState <coded>`). This is a display convenience; consumers
 * MUST recompute the authoritative state with {@link foldCommissionState} (INV-3 —
 * a spoofed state triple is never trusted). Throws on an invalid task IRI / state.
 */
export function buildCommissionStateQuads(taskIri: string, state: CommissionState): Quad[] {
  if (!isHttpIri(taskIri)) {
    throw new Error(`buildCommissionState: task is not an http(s) IRI: ${taskIri}`);
  }
  const stateIri = STATE_IRI[state];
  if (stateIri === undefined) throw new Error(`buildCommissionState: unknown state: ${state}`);
  return [quad(namedNode(taskIri), namedNode(UNITE_COMMISSION_STATE), namedNode(stateIri))];
}

/**
 * Read the CACHED `unite:commissionState` off a `wf:Task` (a hint only — the fold is
 * authoritative). Guarded: a non-coded / multi-valued / hostile value drops to
 * `undefined`. NEVER use this in place of {@link foldCommissionState} for a security
 * decision (INV-3).
 */
export function readCommissionState(ds: DatasetCore, taskIri: string): CommissionState | undefined {
  const iri = readCoded(ds, namedNode(taskIri), UNITE_COMMISSION_STATE, isStateIri);
  return iri === undefined ? undefined : STATE_BY_IRI.get(iri);
}

// ── The pure fold over the thread's events + signed credentials ───────────────

/** A transition that WAS applied during the fold. */
export interface AppliedCommissionTransition {
  readonly event: CommissionEvent;
  readonly from: CommissionState;
  readonly to: CommissionState;
}

/** An event the fold REFUSED (skipped, fail-isolated) with the reason. */
export interface RejectedCommissionTransition {
  readonly event: CommissionEvent;
  readonly from: CommissionState;
  readonly reason: CommissionTransitionErrorCode;
}

/** The outcome of folding a thread's events into its current commission state. */
export interface CommissionFold {
  /** The computed authoritative state (from `from`, default `drafted`). */
  readonly state: CommissionState;
  /** The transitions that advanced the state, in applied order. */
  readonly applied: readonly AppliedCommissionTransition[];
  /** The events refused (illegal edge, or a gated event lacking verified evidence). */
  readonly rejected: readonly RejectedCommissionTransition[];
}

/** Options for {@link foldCommissionState}. */
export interface FoldCommissionOptions {
  /**
   * The ids of `commission` events whose `fedtrust:DelegationCredential` VERIFIED
   * (via {@link verifyCommission}). A `commission` event NOT in this set is refused
   * (`unverified-evidence`) — so an unsigned/forged/off-artifact commission cannot
   * advance the thread. Computed by the caller (async crypto) so this fold stays a
   * pure, deterministic, synchronous function.
   */
  readonly verifiedCommissions?: ReadonlySet<string>;
  /**
   * The ids of `merge` events whose ≥2-steward quorum was ALLOWED (via
   * {@link verifyMergeQuorum} — met AND ≥1 reviewer distinct from the builder). A
   * `merge` event NOT in this set is refused (`unverified-evidence`) — NO merge
   * without a valid quorum.
   */
  readonly approvedMerges?: ReadonlySet<string>;
  /** The initial state to fold from (default `drafted`). */
  readonly from?: CommissionState;
}

/**
 * FOLD a thread's parsed lifecycle events into its current commission state — a PURE,
 * DETERMINISTIC, ORDER-INDEPENDENT computation (INV-3: the state is computed from the
 * events, never read from an asserted triple). Events are first sorted CANONICALLY (by
 * `dct:created`, malformed/absent → epoch 0, tie-broken by event id — channel.ts's
 * ordering), so the result depends ONLY on the events' content, never on the input
 * array order. It is FAIL-ISOLATED: an illegal edge, or a gated event (`commission`/
 * `merge`) whose signed evidence did not verify, is SKIPPED and recorded in `rejected`
 * (never aborting the fold — one hostile event cannot deny-service the whole thread).
 *
 * The two security gates are enforced through {@link transition}: a `commission` event
 * only advances if its id is in `verifiedCommissions`, a `merge` event only if its id
 * is in `approvedMerges` — the caller populates those by running the async
 * {@link verifyCommission} / {@link verifyMergeQuorum} over the actual credentials, so
 * a thread reaches `commissioned`/`merged` ONLY over verified signatures.
 */
export function foldCommissionState(
  events: readonly CommissionEvent[],
  options: FoldCommissionOptions = {},
): CommissionFold {
  const verifiedCommissions = options.verifiedCommissions ?? EMPTY_SET;
  const approvedMerges = options.approvedMerges ?? EMPTY_SET;

  const sorted = [...events].sort(sortEvents);
  let state: CommissionState = options.from ?? "drafted";
  const applied: AppliedCommissionTransition[] = [];
  const rejected: RejectedCommissionTransition[] = [];

  for (const event of sorted) {
    // Always a boolean (ungated types ⇒ `false`, which {@link transition} ignores) —
    // so the gated types' verified-evidence requirement is the ONLY thing this drives.
    const gatePassed = GATED_EVENTS.has(event.type)
      ? event.type === "commission"
        ? verifiedCommissions.has(event.id)
        : approvedMerges.has(event.id)
      : false;
    try {
      const to = transition(state, { type: event.type, gatePassed });
      applied.push({ event, from: state, to });
      state = to;
    } catch (e) {
      if (e instanceof CommissionTransitionError) {
        rejected.push({ event, from: state, reason: e.code });
        continue; // fail-isolated: skip this event, keep folding
      }
      throw e; // an unexpected error is a real bug — surface it
    }
  }
  return { state, applied, rejected };
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Deterministic event order: oldest `dct:created` first (malformed/absent → 0),
 *  tie-broken by event id — identical to channel.ts's message ordering. */
function sortEvents(a: CommissionEvent, b: CommissionEvent): number {
  const at = Date.parse(a.at);
  const bt = Date.parse(b.at);
  const am = Number.isNaN(at) ? 0 : at;
  const bm = Number.isNaN(bt) ? 0 : bt;
  if (am !== bm) return am - bm;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── The COMMISSION: the signed fedtrust:DelegationCredential ──────────────────

/** Inputs to {@link issueCommission}. */
export interface IssueCommissionInput {
  /** The COMMISSIONER (delegator) — the builder-credentialed human's WebID (issuer). */
  readonly commissioner: string;
  /** The ASSIGNEE (delegate) — the agent/steward authorized to build (WebID). */
  readonly assignee: string;
  /** The assignee's PUBLIC key — embedded as a signed `fedtrust:delegateKey` so the
   *  delegation is self-certifying (pass the PUBLIC key, never the private one). */
  readonly assigneeKey: CryptoKey;
  /** The exact ARTIFACT SPEC IRI the commission authorizes building — the delegation
   *  SCOPE. Per-artifact only: this is what {@link verifyCommission} pins. */
  readonly artifact: string;
  /** The commissioner's signing key (a solid-vc KeyPair; its `verificationMethod`
   *  MUST be controlled by `commissioner`). */
  readonly key: Parameters<typeof issueDelegation>[0]["key"];
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly id?: string;
  readonly created?: Date;
}

/**
 * ISSUE the signed COMMISSION — a `fedtrust:DelegationCredential` binding
 * commissioner → assignee → the exact artifact spec (as the delegation scope),
 * composing @jeswr/federation-trust `issueDelegation` (+ solid-vc for the
 * Data-Integrity proof). This is the "builder-credentialed human signs" step
 * (PLATFORM-PLAN §5.2): a `drafted` commission becomes real only with this signature.
 * Thin composition — mints no vocabulary, adds no crypto. Verify with
 * {@link verifyCommission}.
 */
export function issueCommission(input: IssueCommissionInput): Promise<VerifiableCredential> {
  for (const [f, iri] of [
    ["commissioner", input.commissioner],
    ["assignee", input.assignee],
    ["artifact", input.artifact],
  ] as const) {
    if (!isHttpIri(iri)) throw new Error(`issueCommission: ${f} is not an http(s) IRI: ${iri}`);
  }
  return issueDelegation({
    delegator: input.commissioner,
    authority: input.assignee,
    delegateKey: input.assigneeKey,
    // The delegation SCOPE is the exact artifact spec — per-artifact commissioning.
    federation: input.artifact,
    key: input.key,
    ...(input.validFrom !== undefined ? { validFrom: input.validFrom } : {}),
    ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
    ...(input.id !== undefined ? { id: input.id } : {}),
    ...(input.created !== undefined ? { created: input.created } : {}),
  });
}

/** Why a presented commission credential did NOT authorize the build. */
export type CommissionRejectReason =
  /** Not a credential object (or the verify seam threw). */
  | "malformed"
  /** The VC is not typed `fedtrust:DelegationCredential` — not a commission at all. */
  | "not-a-delegation"
  /** solid-vc verification failed (bad signature / expired / not-yet-valid / revoked
   *  / issuer-binding mismatch). A forged/unsigned commission lands here. */
  | "unverified"
  /** Verified, but the issuer (commissioner) is not on the REQUIRED
   *  `trustedCommissioners` allowlist — an unknown signer cannot commission. */
  | "untrusted-commissioner"
  /** No `fedtrust:federation` scope claim — cannot confirm WHAT it authorizes. */
  | "no-scope"
  /** The scope is not EXACTLY the commissioned artifact IRI — a delegation for a
   *  DIFFERENT (or blanket) artifact can never authorize THIS build (per-artifact). */
  | "scope-mismatch"
  /** No `fedtrust:delegate` claim — cannot confirm WHO is authorized. */
  | "no-assignee"
  /** The delegate is not the expected assignee (when one was supplied). */
  | "assignee-mismatch";

/** The outcome of verifying a commission credential against an artifact. */
export interface CommissionVerification {
  /** `true` IFF EVERY gate passed — the commission genuinely authorizes the build. */
  readonly verified: boolean;
  /** The verified commissioner (issuer / delegator), when present. */
  readonly commissioner?: string;
  /** The authorized assignee (delegate), when present. */
  readonly assignee?: string;
  /** The scope the credential names (`fedtrust:federation`), when present. */
  readonly artifact?: string;
  /** EVERY reason it did not authorize (empty IFF `verified`) — a security surface
   *  must never collapse all failures into one. */
  readonly reasons: readonly CommissionRejectReason[];
}

/** Options for {@link verifyCommission}. */
export interface VerifyCommissionOptions {
  /**
   * Verify ONE credential — the crypto boundary (signature + issuer-binding +
   * validity + revocation, all in the injected seam). In production close over
   * `verifyCredential(vc, { resolveKey, isControlledBy, resolveStatus, … })`.
   * Injecting it keeps this module network-free + exhaustively testable.
   */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /**
   * REQUIRED, non-empty. The recognised COMMISSIONERS (builder-credentialed humans'
   * WebIDs) whose signature can commission a build. A missing / empty allowlist
   * THROWS fail-closed (mirroring S3's verifyAdoptionDecisionQuorum): a commission
   * verification NEVER runs without knowing WHO may commission — a validly-signed
   * credential from an unknown issuer must not authorize a build.
   */
  readonly trustedCommissioners: readonly string[];
  /** The exact artifact spec IRI the commission must be scoped to (per-artifact). */
  readonly artifact: string;
  /** The expected assignee (delegate) WebID. When supplied, a delegation to a
   *  different party fails `assignee-mismatch`; omit to accept any delegate. */
  readonly assignee?: string;
}

/**
 * VERIFY a commission credential — does it genuinely authorize building THIS artifact?
 * Fail-closed on every axis; `verified` is true ONLY when ALL pass:
 *   1. it is a credential object (else `malformed`);
 *   2. it is typed `fedtrust:DelegationCredential` (else `not-a-delegation`);
 *   3. it verifies cryptographically via the injected seam — signature, issuer-binding,
 *      validity, revocation (else `unverified` — a forged/unsigned/expired/revoked
 *      credential lands here);
 *   4. its issuer (commissioner) is on the REQUIRED `trustedCommissioners` allowlist
 *      (else `untrusted-commissioner`);
 *   5. its `fedtrust:federation` scope is EXACTLY the commissioned artifact (else
 *      `scope-mismatch`/`no-scope` — no blanket or wrong-artifact delegation);
 *   6. its `fedtrust:delegate` is the expected assignee, when one was supplied (else
 *      `assignee-mismatch`/`no-assignee`).
 * THROWS fail-closed (never returns) if `trustedCommissioners` is absent/empty or the
 * `artifact` is not http(s) — a configuration error, not a data error.
 */
export async function verifyCommission(
  vc: VerifiableCredential,
  options: VerifyCommissionOptions,
): Promise<CommissionVerification> {
  const allowlist = Array.isArray(options.trustedCommissioners)
    ? options.trustedCommissioners
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];
  if (allowlist.length === 0) {
    throw new TypeError(
      "verifyCommission: a non-empty `trustedCommissioners` allowlist is REQUIRED — a commission " +
        "verification must not run without knowing who may commission a build (fail-closed)",
    );
  }
  if (!isHttpIri(options.artifact)) {
    throw new TypeError(`verifyCommission: artifact is not an http(s) IRI: ${options.artifact}`);
  }
  const allowed = new Set(allowlist);

  if (vc === null || typeof vc !== "object") {
    return { verified: false, reasons: ["malformed"] };
  }

  const reasons: CommissionRejectReason[] = [];

  // (2) typed as a delegation credential.
  if (!(Array.isArray(vc.type) && vc.type.includes(FEDTRUST_DELEGATION_CREDENTIAL))) {
    reasons.push("not-a-delegation");
  }

  // (3) cryptographic verification (the injected crypto boundary).
  let cryptoOk = false;
  try {
    const result = await options.verifyVc(vc);
    cryptoOk = result.verified === true;
  } catch {
    cryptoOk = false;
  }
  if (!cryptoOk) reasons.push("unverified");

  // (4) the issuer (commissioner) must be a recognised commissioner.
  const commissioner = typeof vc.issuer === "string" ? vc.issuer.trim() : "";
  if (commissioner.length === 0 || !allowed.has(commissioner)) {
    reasons.push("untrusted-commissioner");
  }

  // (5) the scope must be EXACTLY the commissioned artifact (per-artifact binding).
  const scope = readVcClaim(vc.credentialSubject, FEDTRUST_FEDERATION);
  if (scope === undefined) {
    reasons.push("no-scope");
  } else if (scope !== options.artifact) {
    reasons.push("scope-mismatch");
  }

  // (6) the delegate must be the expected assignee (when supplied).
  const assignee = readVcClaim(vc.credentialSubject, FEDTRUST_DELEGATE);
  if (options.assignee !== undefined) {
    if (assignee === undefined) reasons.push("no-assignee");
    else if (assignee !== options.assignee) reasons.push("assignee-mismatch");
  }

  return {
    verified: reasons.length === 0,
    reasons,
    ...(commissioner.length > 0 ? { commissioner } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    ...(scope !== undefined ? { artifact: scope } : {}),
  };
}

/** Read a single string/IRI claim off a credentialSubject (object or array), tolerant
 *  of the string / `{"@id"|id|"@value"|value}` JSON-LD shapes. Fail-closed → undefined.
 *  Mirrors federation-trust's own `strClaim` reader over the VC object. */
function readVcClaim(
  subject: CredentialSubject | readonly CredentialSubject[] | undefined,
  predicate: string,
): string | undefined {
  const subjects: readonly CredentialSubject[] = Array.isArray(subject)
    ? subject
    : subject != null
      ? [subject as CredentialSubject]
      : [];
  for (const s of subjects) {
    if (s == null || typeof s !== "object") continue;
    const value = coerceClaimString((s as Record<string, unknown>)[predicate]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function coerceClaimString(v: unknown): string | undefined {
  if (typeof v === "string") return v.length > 0 ? v : undefined;
  if (v != null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["@id", "id", "@value", "value"]) {
      const inner = o[k];
      if (typeof inner === "string" && inner.length > 0) return inner;
    }
  }
  return undefined;
}

// ── The MERGE-GATE: the ≥2-steward quorum over the artifact ───────────────────

/** Options for {@link verifyMergeQuorum}. */
export interface VerifyMergeQuorumOptions {
  /** Verify ONE reviewer credential — the crypto boundary (see quorum.ts). */
  readonly verifyVc: (vc: VerifiableCredential) => Promise<VerificationResult>;
  /** REQUIRED. The signing-key resolver — the quorum's anti-Sybil distinctness anchor. */
  readonly resolveKey: ResolveKey;
  /**
   * REQUIRED, non-empty. The recognised REVIEWER/steward identities. Mirrors S3's
   * load-bearing gate: {@link verifyMergeQuorum} THROWS fail-closed when this is
   * absent/empty — a merge NEVER runs an unprotected quorum (the "distinct verified
   * key = distinct real reviewer" trust decision lives here, INV-5).
   */
  readonly trustedStewards: readonly string[];
  /**
   * The BUILDER/assignee WebID (from the verified commission). Used for the
   * "≥1 reviewer distinct from the builder" rule (design/04 §4.3): the assignee cannot
   * be the SOLE reviewer of its own work.
   */
  readonly builder: string;
  /**
   * The reviewer-signature floor (default + minimum {@link QUORUM_FLOOR} = 2). A
   * community/scope may RAISE it (e.g. from `EndorsementGate.stewardSignatures`), never
   * lower it — the quorum clamps up to the floor.
   */
  readonly threshold?: number;
  /** Optional digest seam (tests). Defaults to solid-vc `digestQuads`. */
  readonly digest?: (quads: readonly Quad[]) => Promise<string>;
}

/** The merge-gate decision over one artifact. */
export interface MergeGateResult {
  /** The full ≥2-steward quorum attestation over the artifact digest. */
  readonly attestation: QuorumAttestation;
  /** `true` IFF ≥1 counted reviewer is DISTINCT from the builder (no lone self-review).
   *  With a single builder identity this is implied by `attestation.met` (≥2 distinct
   *  issuers ⇒ ≥1 ≠ builder); it also carries a raised-threshold policy the same way. */
  readonly reviewerDistinctFromBuilder: boolean;
  /** `true` IFF the quorum is MET AND ≥1 reviewer is distinct from the builder — the
   *  merge is allowed. Fail-closed: anything less refuses the `merged` transition. */
  readonly allowed: boolean;
}

/**
 * VERIFY the MERGE-GATE: a ≥2-steward QUORUM over the artifact graph, reusing the S3.3
 * keystone (lib/quorum `buildQuorumAttestation`) with S3's REQUIRED-non-empty
 * `trustedStewards` allowlist. THROWS fail-closed when the allowlist is absent/empty
 * (a merge never runs an unprotected quorum — the load-bearing property, g9p4), then
 * additionally requires ≥1 reviewer distinct from the builder (design/04 §4.3). The
 * result's `allowed` is what gates the `in-review → merged` transition — no valid
 * quorum ⇒ no merge.
 */
export async function verifyMergeQuorum(
  artifactQuads: readonly Quad[],
  reviewerVCs: readonly VerifiableCredential[],
  options: VerifyMergeQuorumOptions,
): Promise<MergeGateResult> {
  const allowlist = Array.isArray(options.trustedStewards)
    ? options.trustedStewards.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  if (allowlist.length === 0) {
    throw new TypeError(
      "verifyMergeQuorum: a non-empty `trustedStewards` allowlist is REQUIRED — a merge must not " +
        "run an unprotected quorum (derive it from the community's reviewer/steward fedreg:Registry)",
    );
  }
  const attestation = await buildQuorumAttestation(artifactQuads, reviewerVCs, {
    verifyVc: options.verifyVc,
    resolveKey: options.resolveKey,
    trustedStewards: allowlist,
    ...(options.threshold !== undefined ? { threshold: options.threshold } : {}),
    ...(options.digest !== undefined ? { digest: options.digest } : {}),
  });
  const builder = typeof options.builder === "string" ? options.builder.trim() : "";
  const reviewerDistinctFromBuilder = attestation.stewards.some((s) => s.issuer !== builder);
  return {
    attestation,
    reviewerDistinctFromBuilder,
    allowed: attestation.met && reviewerDistinctFromBuilder,
  };
}
