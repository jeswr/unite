// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Client-side aggregation over participant pods (design/05 loop step 3). The
// participation gate is enforced HERE, not just at join: an unverified
// participant's statements never enter the aggregate. Cross-pod trust is
// fail-closed — a statement is kept only if its dct:creator matches the WebID
// the registry says the pod belongs to (a pod cannot stuff statements as
// someone else) and its fut:inDeliberation matches. One resonance is counted
// per (participant, statement): latest dct:created wins (one-person-one-voice).
//
// Failures are ISOLATED to the smallest unit: one hostile/broken member
// resource is recorded and skipped while its siblings still aggregate; a broken
// container listing degrades only that participant's stage; nothing aborts the
// whole aggregation. Bodies are read with an incremental byte cap.

import { parseRdf } from "@jeswr/fetch-rdf";
import type { DatasetCore } from "@rdfjs/types";
import { parseConsent } from "./consent.js";
import type { MembershipTier, MembershipVerifier } from "./membership.js";
import {
  type AppProposal,
  type Critique,
  type Need,
  parseCandidates,
  parseCritiques,
  parseNeeds,
  parseProposals,
  parseResonances,
  type Resonance,
  type SynthesisCandidate,
} from "./model.js";
import { DEFAULT_MAX_BODY_BYTES, isWithinBase, listContainer, readBodyCapped } from "./pod.js";
import type { DeliberationRegistry, Participant } from "./registry.js";

/** Default cap on member resources read per participant container. */
export const DEFAULT_MAX_RESOURCES = 500;
export { DEFAULT_MAX_BODY_BYTES } from "./pod.js";

/**
 * The statement kinds aggregation can collect (scope-blind — the SCOPE decides
 * which it enables via `ScopeConfig.artifactKinds` + its room view; the S0
 * seam). Resonances are ALWAYS collected. Kinds without landed machinery yet
 * ("infra-proposal" S2; "vision"/"claim"/"value" S4) are accepted but collect
 * nothing until their parsers land — honest no-ops, never a crash.
 */
export type StatementKind =
  | "need"
  | "app-proposal"
  | "infra-proposal"
  | "vision"
  | "claim"
  | "value"
  | "synthesis"
  | "critique";

/** The default collection set — the pre-S1 behaviour (needs only). */
export const DEFAULT_KINDS: readonly StatementKind[] = ["need"];

/** Options for {@link aggregateDeliberation}. */
export interface AggregateOptions {
  readonly registry: DeliberationRegistry;
  readonly verifier: MembershipVerifier;
  /** The foreign-pod read fetch (publicFetch — never the session-bound one). */
  readonly fetch: typeof fetch;
  /** Statement kinds to collect (default {@link DEFAULT_KINDS}: needs only). */
  readonly kinds?: readonly StatementKind[];
  readonly maxResourcesPerParticipant?: number;
  readonly maxBodyBytes?: number;
}

/** A per-source failure — the unit is skipped, not the whole aggregation. */
export interface SourceError {
  readonly webId: string;
  readonly base: string;
  readonly stage: "membership" | "needs" | "resonances" | "proposals" | "syntheses" | "critiques";
  /** The specific member resource that failed, when the failure was per-member. */
  readonly resource?: string;
  readonly message: string;
}

/** A verified participant + the tier that vouched them. */
export interface VerifiedParticipant {
  readonly webId: string;
  readonly base: string;
  readonly tier: MembershipTier;
}

/** The aggregate for a deliberation. */
export interface AggregateResult {
  readonly deliberation: string;
  readonly needs: Need[];
  readonly resonances: Resonance[];
  /** Collected only when `kinds` includes "app-proposal" (S1, scope A). */
  readonly proposals: AppProposal[];
  /** Collected only when `kinds` includes "synthesis" (S1, the room). */
  readonly candidates: SynthesisCandidate[];
  /** Collected only when `kinds` includes "critique" (S1, the room). */
  readonly critiques: Critique[];
  /**
   * The ids of collected expression statements (needs / proposals) whose
   * author's inline ODRL consent policy PERMITS `fut:synthesize` — the ONLY
   * statements a Convergence-Room candidate may derive from. FAIL-CLOSED: a
   * statement with no policy, an unparseable policy, or a synthesize
   * prohibition is NOT in the set (design/01: the consent layer gates what the
   * federation may DO with a statement; deriving a synthesis is exactly the
   * governed act).
   */
  readonly synthesizable: ReadonlySet<string>;
  readonly verified: VerifiedParticipant[];
  readonly unverified: { readonly webId: string; readonly reason: string }[];
  readonly errors: SourceError[];
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Fetch + parse a single RDF resource with an incremental body-size cap. */
async function fetchGuarded(
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
 * Read one participant's statements from `<base><dir>/`, keeping only their own,
 * in-deliberation items. A failed container listing records ONE stage error; a
 * failed member records a per-member error and is skipped — siblings survive.
 */
async function readStatements<T extends { id: string; creator: string; inDeliberation: string }>(
  fetchFn: typeof fetch,
  p: Participant,
  dir: string,
  deliberation: string,
  maxResources: number,
  maxBytes: number,
  stage: Exclude<SourceError["stage"], "membership">,
  parse: (ds: DatasetCore) => T[],
  errors: SourceError[],
  /**
   * When given, each KEPT statement's inline ODRL consent is evaluated and the
   * id added iff the policy explicitly permits `fut:synthesize` (fail-closed).
   */
  synthesizable?: Set<string>,
): Promise<T[]> {
  const container = new URL(`${dir}/`, p.base).toString();
  let members: string[];
  try {
    members = (await listContainer(fetchFn, container, maxBytes)).slice(0, maxResources);
  } catch (e) {
    errors.push({ webId: p.webId, base: p.base, stage, message: messageOf(e) });
    return [];
  }
  const kept: T[] = [];
  for (const member of members) {
    // A container is untrusted data: a compromised/hostile pod could list member
    // IRIs pointing at ARBITRARY http(s) resources (SSRF / cross-pod attribution).
    // Fail-closed: only fetch members that are within this participant's own base.
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
      const ds = await fetchGuarded(fetchFn, member, maxBytes);
      for (const item of parse(ds)) {
        if (item.creator === p.webId && item.inDeliberation === deliberation) {
          kept.push(item);
          if (synthesizable && parseConsent(ds, item.id)?.synthesize === true) {
            synthesizable.add(item.id);
          }
        }
      }
    } catch (e) {
      errors.push({ webId: p.webId, base: p.base, stage, resource: member, message: messageOf(e) });
    }
  }
  return kept;
}

/**
 * Dedupe to one resonance per (creator, statement): the latest dct:created
 * wins (one-person-one-voice). A malformed date sorts as epoch 0. Deterministic
 * tie-break on equal timestamps: the lexicographically-greatest resource id.
 */
export function dedupeResonances(resonances: readonly Resonance[]): Resonance[] {
  const best = new Map<string, Resonance>();
  for (const r of resonances) {
    const key = JSON.stringify([r.creator, r.onStatement]);
    const existing = best.get(key);
    if (existing === undefined) {
      best.set(key, r);
      continue;
    }
    const rt = Date.parse(r.created);
    const et = Date.parse(existing.created);
    const rMs = Number.isNaN(rt) ? 0 : rt;
    const eMs = Number.isNaN(et) ? 0 : et;
    if (rMs > eMs || (rMs === eMs && r.id > existing.id)) best.set(key, r);
  }
  return [...best.values()];
}

/**
 * Aggregate a deliberation from its participants' pods. Membership-gated,
 * creator-verified, deduped. Never rejects on a per-source failure.
 */
export async function aggregateDeliberation(options: AggregateOptions): Promise<AggregateResult> {
  const { registry, verifier, fetch: fetchFn } = options;
  const maxResources = options.maxResourcesPerParticipant ?? DEFAULT_MAX_RESOURCES;
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const kinds = new Set(options.kinds ?? DEFAULT_KINDS);
  const deliberation = registry.deliberation;

  const participants = await registry.listParticipants();
  const needs: Need[] = [];
  const proposals: AppProposal[] = [];
  const candidates: SynthesisCandidate[] = [];
  const critiques: Critique[] = [];
  const rawResonances: Resonance[] = [];
  const synthesizable = new Set<string>();
  const verified: VerifiedParticipant[] = [];
  const unverified: { webId: string; reason: string }[] = [];
  const errors: SourceError[] = [];

  for (const p of participants) {
    let result: Awaited<ReturnType<MembershipVerifier["verify"]>>;
    try {
      result = await verifier.verify(p.webId, deliberation);
    } catch (e) {
      errors.push({ webId: p.webId, base: p.base, stage: "membership", message: messageOf(e) });
      continue;
    }
    if (!result.ok) {
      unverified.push({ webId: p.webId, reason: result.reason });
      continue;
    }
    verified.push({ webId: p.webId, base: p.base, tier: result.tier });

    const read = <T extends { id: string; creator: string; inDeliberation: string }>(
      dir: Exclude<SourceError["stage"], "membership">,
      parse: (ds: DatasetCore) => T[],
      consentSet?: Set<string>,
    ): Promise<T[]> =>
      readStatements(
        fetchFn,
        p,
        dir,
        deliberation,
        maxResources,
        maxBytes,
        dir,
        parse,
        errors,
        consentSet,
      );

    // Expression statements (needs / proposals) carry the author's inline ODRL
    // consent — their synthesize permission is evaluated here so the room can
    // fail-closed on derivation inputs.
    if (kinds.has("need")) needs.push(...(await read("needs", parseNeeds, synthesizable)));
    // The scope-A proposal layer (S1). Other proposal-shaped kinds
    // ("infra-proposal" S2; "vision"/"claim"/"value" S4) collect nothing until
    // their parsers land — an honestly-empty result, never a crash.
    if (kinds.has("app-proposal")) {
      proposals.push(...(await read("proposals", parseProposals, synthesizable)));
    }
    if (kinds.has("synthesis")) candidates.push(...(await read("syntheses", parseCandidates)));
    if (kinds.has("critique")) critiques.push(...(await read("critiques", parseCritiques)));
    rawResonances.push(...(await read("resonances", parseResonances)));
  }

  return {
    deliberation,
    needs,
    resonances: dedupeResonances(rawResonances),
    proposals,
    candidates,
    critiques,
    synthesizable,
    verified,
    unverified,
    errors,
  };
}
