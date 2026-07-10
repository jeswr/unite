// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// An in-memory pod federation for the demo deliberation. This is NOT a mock of
// the engine — it is a tiny LDP-shaped resource server behind a `fetch`
// function, and everything above it is the REAL production pipeline:
// serialisation via model.ts (n3.Writer), container listings parsed by
// @solid/object, aggregation via aggregateDeliberation, dedupe + membership
// gating + ranking untouched. The demo writes (Compose / resonance) go through
// the SAME writeNeed/writeResonance code paths as a live pod session.
//
// Sandbox guarantee: the served origin is the reserved `demo.unite.example`,
// and the fetch NEVER touches the network — an out-of-scope URL just 404s.

import { describeStorage } from "@jeswr/federation-registry";
import { DataFactory, Writer } from "n3";
import { consentQuads, DEFAULT_CONSENT, ODRL_NS } from "../lib/consent.js";
import {
  fut,
  MAXNEEF_CONCEPTS,
  NS,
  STANCE_CONFLICTS,
  STANCE_RESONATES,
  STANCE_UNSURE,
  type Stance,
} from "../lib/fut.js";
import { isProposalKind, isStakeholderRole } from "../lib/fut-draft.js";
import { SCHWARTZ_CONCEPTS, VISION_SCOPES } from "../lib/fut-society.js";
import { buildInfraProposalQuads, type InfraProposal } from "../lib/infra.js";
import {
  type AppProposal,
  buildCandidateQuads,
  buildCritiqueQuads,
  buildNeedQuads,
  buildProposalQuads,
  type Critique,
  type Need,
  type Resonance,
  type SynthesisCandidate,
  serializeResonance,
  serializeTurtle,
} from "../lib/model.js";
import {
  buildClaimQuads,
  buildValueQuads,
  buildVisionQuads,
  type Claim,
  type ValueStatement,
  type VisionStatement,
} from "../lib/model-society.js";
import type { ScopeId } from "../scope/scopes.js";
import {
  type CandidateSpec,
  type ClaimSpec,
  type CritiqueSpec,
  DEMO_CANDIDATES,
  DEMO_CLAIMS,
  DEMO_CRITIQUES,
  DEMO_INFRA_PROPOSALS,
  DEMO_NAMES,
  DEMO_NEEDS,
  DEMO_ORIGIN,
  DEMO_PEOPLE,
  DEMO_PROPOSALS,
  DEMO_STORAGES,
  DEMO_VALUES,
  DEMO_VISIONS,
  DEMO_YOU_KEY,
  demoBase,
  demoDeliberationIri,
  demoWebId,
  type InfraProposalSpec,
  type NeedSpec,
  type ProposalSpec,
  type ValueSpec,
  type VisionSpec,
  type VoteCode,
} from "./fixtures.js";
import { type DemoTrust, seedDemoTrust } from "./trust.js";

const { namedNode, quad } = DataFactory;

const LDP = "http://www.w3.org/ns/ldp#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/** A participant row (mirrors ui/state's ParticipantConfig without the import cycle). */
export interface DemoParticipant {
  readonly webId: string;
  readonly base: string;
}

/** A live demo deliberation: seeded content behind a real fetch. */
export interface DemoDeliberation {
  readonly scope: ScopeId;
  readonly deliberation: string;
  /** The demo session identity — composes + resonances are written as this. */
  readonly you: DemoParticipant;
  /** Every participant (including `you`). */
  readonly participants: readonly DemoParticipant[];
  /** The in-memory pod fetch — safe for both read + write paths. */
  readonly fetch: typeof fetch;
  /** The seeded governance layer: anchors, resolver, steward issuance seam. */
  readonly trust: DemoTrust;
}

/** True iff `iri` is a demo deliberation IRI. */
export function isDemoDeliberation(iri: string): boolean {
  return iri.startsWith(`${DEMO_ORIGIN}/deliberations/`);
}

/** Human display name for a demo WebID (undefined for real WebIDs). */
export function demoDisplayName(webId: string): string | undefined {
  return DEMO_NAMES.get(webId);
}

// ── The in-memory LDP-shaped store ───────────────────────────────────────────

interface StoredDoc {
  readonly body: string;
  readonly contentType: string;
}

class MemoryPods {
  readonly #docs = new Map<string, StoredDoc>();

  set(url: string, body: string, contentType = "text/turtle"): void {
    this.#docs.set(new URL(url).toString(), { body, contentType });
  }

  has(url: string): boolean {
    return this.#docs.has(new URL(url).toString());
  }

  /** Direct children of a container URL (members without a deeper "/"). */
  children(container: string): string[] {
    const c = new URL(container).toString();
    if (!c.endsWith("/")) return [];
    const out: string[] = [];
    for (const key of this.#docs.keys()) {
      if (!key.startsWith(c) || key === c) continue;
      const rest = key.slice(c.length);
      if (rest.length > 0 && !rest.includes("/")) out.push(key);
    }
    return out.sort();
  }

  /** Serialise an LDP container listing for `container` (its direct children). */
  async containerTurtle(container: string): Promise<string> {
    const subject = namedNode(new URL(container).toString());
    const quads = [
      quad(subject, namedNode(RDF_TYPE), namedNode(`${LDP}Container`)),
      quad(subject, namedNode(RDF_TYPE), namedNode(`${LDP}BasicContainer`)),
      ...this.children(container).map((child) =>
        quad(subject, namedNode(`${LDP}contains`), namedNode(child)),
      ),
    ];
    const writer = new Writer({ prefixes: { ldp: LDP } });
    writer.addQuads(quads);
    return new Promise((resolve, reject) => {
      writer.end((err, result) => (err ? reject(err) : resolve(result)));
    });
  }

  /** The fetch facade. GET/HEAD resources + containers; PUT with If-None-Match. */
  readonly fetch: typeof fetch = async (input, init) => {
    let url: string;
    try {
      const raw =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      url = new URL(raw).toString();
    } catch {
      return new Response("bad request", { status: 400 });
    }
    // Sandbox boundary: ONLY the reserved demo origin is served or writable —
    // a request for any other origin is refused before any method handling, so
    // out-of-sandbox URLs can neither be stored (PUT) nor served back (GET).
    if (new URL(url).origin !== DEMO_ORIGIN) {
      return new Response("outside the demo sandbox", { status: 403 });
    }
    const method = (
      init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase();

    if (method === "GET" || method === "HEAD") {
      const doc = this.#docs.get(url);
      if (doc) {
        return new Response(method === "HEAD" ? null : doc.body, {
          status: 200,
          headers: { "content-type": doc.contentType },
        });
      }
      if (url.endsWith("/")) {
        const kids = this.children(url);
        if (kids.length > 0) {
          const body = await this.containerTurtle(url);
          return new Response(method === "HEAD" ? null : body, {
            status: 200,
            headers: { "content-type": "text/turtle" },
          });
        }
      }
      return new Response("not found", { status: 404 });
    }

    if (method === "PUT") {
      const headers = new Headers(init?.headers);
      if (headers.get("if-none-match") === "*" && this.#docs.has(url)) {
        return new Response("precondition failed", { status: 412 });
      }
      const body = typeof init?.body === "string" ? init.body : "";
      this.set(url, body, headers.get("content-type") ?? "text/turtle");
      return new Response(null, { status: 201 });
    }

    // LDP-shaped resource deletion (the v2 notebook's remove path — 03 §7:
    // deletion propagates because every aggregate recomputes on read; the v1
    // surface never issues DELETE, so its behaviour is unchanged).
    if (method === "DELETE") {
      if (this.#docs.delete(url)) return new Response(null, { status: 204 });
      return new Response("not found", { status: 404 });
    }

    return new Response("method not allowed", { status: 405 });
  };
}

// ── Seeding ──────────────────────────────────────────────────────────────────

const CONCEPT_NAMES = new Set(MAXNEEF_CONCEPTS.map((c) => c.name));

const STANCE_OF: Record<VoteCode, Stance> = {
  r: STANCE_RESONATES,
  c: STANCE_CONFLICTS,
  u: STANCE_UNSURE,
};

/** A deterministic per-voter reaction time shortly after the need was created. */
function voteCreated(needCreated: string, voterIndex: number): string {
  const t = new Date(needCreated).getTime() + (voterIndex + 1) * 3_600_000;
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Seed each voter's resonance on `statementUrl` (their own pod, own voice). */
async function seedVotes(
  pods: MemoryPods,
  scope: ScopeId,
  slug: string,
  statementUrl: string,
  statementCreated: string,
  votes: Readonly<Record<string, VoteCode>>,
  deliberation: string,
): Promise<void> {
  for (const [voter, code] of Object.entries(votes)) {
    const voterIndex = DEMO_PEOPLE.findIndex((p) => p.key === voter);
    if (voterIndex < 0) throw new Error(`demo fixture ${slug}: unknown voter ${voter}`);
    const vBase = demoBase(voter, scope);
    const vUrl = new URL(`resonances/re-${slug}.ttl`, vBase).toString();
    const resonance: Resonance = {
      id: vUrl,
      onStatement: statementUrl,
      stance: STANCE_OF[code],
      created: voteCreated(statementCreated, voterIndex),
      creator: demoWebId(voter),
      inDeliberation: deliberation,
    };
    pods.set(vUrl, await serializeResonance(resonance));
  }
}

async function seedNeed(
  pods: MemoryPods,
  scope: ScopeId,
  spec: NeedSpec,
  deliberation: string,
): Promise<string> {
  if (!CONCEPT_NAMES.has(spec.concept)) {
    throw new Error(`demo fixture ${spec.slug}: unknown Max-Neef concept ${spec.concept}`);
  }
  const base = demoBase(spec.author, scope);
  const url = new URL(`needs/${spec.slug}.ttl`, base).toString();
  const need: Need = {
    id: url,
    content: spec.content,
    needConcept: fut(`maxneef-${spec.concept}`),
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
    ...(spec.intensity !== undefined ? { intensity: spec.intensity } : {}),
  };
  // Same shape a live Compose writes: the need + its ODRL consent policy.
  const quads = [...buildNeedQuads(need), ...consentQuads(url, DEFAULT_CONSENT, need.creator)];
  pods.set(url, await serializeTurtle(quads, { odrl: ODRL_NS }));
  await seedVotes(pods, scope, spec.slug, url, spec.created, spec.votes, deliberation);
  return url;
}

/** Seed one proposal (same shape the Proposals board writes) + its votes. */
async function seedProposal(
  pods: MemoryPods,
  scope: ScopeId,
  spec: ProposalSpec,
  deliberation: string,
  needUrls: ReadonlyMap<string, string>,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`proposals/${spec.slug}.ttl`, base).toString();
  const serves = spec.serves.map((slug) => {
    const needUrl = needUrls.get(slug);
    if (!needUrl) throw new Error(`demo fixture ${spec.slug}: unknown need slug ${slug}`);
    return needUrl;
  });
  const proposal: AppProposal = {
    id: url,
    title: spec.title,
    content: spec.content,
    motivatedBy: serves,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
    ...(spec.stakeholders !== undefined ? { indirectStakeholders: spec.stakeholders } : {}),
  };
  const quads = [
    ...buildProposalQuads(proposal),
    ...consentQuads(url, DEFAULT_CONSENT, proposal.creator),
  ];
  pods.set(url, await serializeTurtle(quads, { wf: NS.wf, odrl: ODRL_NS }));
  await seedVotes(pods, scope, spec.slug, url, spec.created, spec.votes, deliberation);
  return url;
}

/** Seed one INFRASTRUCTURE proposal (the S2 wizard's write shape) + its votes. */
async function seedInfraProposal(
  pods: MemoryPods,
  scope: ScopeId,
  spec: InfraProposalSpec,
  deliberation: string,
  needUrls: ReadonlyMap<string, string>,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`proposals/${spec.slug}.ttl`, base).toString();
  const serves = spec.serves.map((slug) => {
    const needUrl = needUrls.get(slug);
    if (!needUrl) throw new Error(`demo fixture ${spec.slug}: unknown need slug ${slug}`);
    return needUrl;
  });
  const kind = fut(spec.kind);
  if (!isProposalKind(kind)) {
    throw new Error(`demo fixture ${spec.slug}: unknown proposal kind ${spec.kind}`);
  }
  const roles = spec.roles.map((r) => {
    const iri = fut(r);
    if (!isStakeholderRole(iri)) {
      throw new Error(`demo fixture ${spec.slug}: unknown stakeholder role ${r}`);
    }
    return iri;
  });
  const proposal: InfraProposal = {
    id: url,
    title: spec.title,
    content: spec.content,
    targetsSystem: spec.targets,
    proposalKind: kind,
    affectsRole: roles,
    motivatedBy: serves,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
    ...(spec.breaking !== undefined ? { breakingChange: spec.breaking } : {}),
    ...(spec.migration !== undefined ? { migrationPath: spec.migration } : {}),
    ...(spec.referenceImplementation !== undefined
      ? { referenceImplementation: spec.referenceImplementation }
      : {}),
    ...(spec.stakeholders !== undefined ? { indirectStakeholders: spec.stakeholders } : {}),
  };
  const quads = [
    ...buildInfraProposalQuads(proposal),
    ...consentQuads(url, DEFAULT_CONSENT, proposal.creator),
  ];
  pods.set(url, await serializeTurtle(quads, { wf: NS.wf, odrl: ODRL_NS }));
  await seedVotes(pods, scope, spec.slug, url, spec.created, spec.votes, deliberation);
  return url;
}

/** Seed one Convergence-Room candidate + its endorsement votes. */
async function seedCandidate(
  pods: MemoryPods,
  scope: ScopeId,
  spec: CandidateSpec,
  deliberation: string,
  statementUrls: ReadonlyMap<string, string>,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`syntheses/${spec.slug}.ttl`, base).toString();
  const derivedFrom = spec.derivedFrom.map((ref) => {
    const resolved = statementUrls.get(ref);
    if (!resolved) throw new Error(`demo fixture ${spec.slug}: unknown input ref ${ref}`);
    return resolved;
  });
  const candidate: SynthesisCandidate = {
    id: url,
    content: spec.content,
    derivedFrom,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
    ...(spec.title !== undefined ? { title: spec.title } : {}),
  };
  // A candidate is a DERIVED process-layer artifact: no consent policy of its
  // own (its inputs' policies gate what may derive into it) — writeCandidate's shape.
  pods.set(url, await serializeTurtle(buildCandidateQuads(candidate), { prov: NS.prov }));
  await seedVotes(pods, scope, spec.slug, url, spec.created, spec.votes, deliberation);
  return url;
}

const SCOPE_LADDER_BY_NAME = new Map(VISION_SCOPES.map((s) => [s.name, s.iri]));
const SCHWARTZ_BY_NAME = new Map(SCHWARTZ_CONCEPTS.map((c) => [c.name, c.iri]));

/** Seed one whole-narrative vision (the writeVision shape — S4, scope C). */
async function seedVision(
  pods: MemoryPods,
  scope: ScopeId,
  spec: VisionSpec,
  deliberation: string,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`visions/${spec.slug}.ttl`, base).toString();
  const scopeIri = spec.scope === undefined ? undefined : SCOPE_LADDER_BY_NAME.get(spec.scope);
  if (spec.scope !== undefined && scopeIri === undefined) {
    throw new Error(`demo fixture ${spec.slug}: unknown vision scope ${spec.scope}`);
  }
  const vision: VisionStatement = {
    id: url,
    content: spec.content,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    ...(scopeIri !== undefined ? { scope: scopeIri } : {}),
    ...(spec.horizon !== undefined ? { horizon: spec.horizon } : {}),
  };
  const quads = [
    ...buildVisionQuads(vision),
    ...consentQuads(url, DEFAULT_CONSENT, vision.creator),
  ];
  pods.set(url, await serializeTurtle(quads, { odrl: ODRL_NS }));
  return url;
}

/** Seed one ADOPTED claim (the writeClaim shape) + its votes (S4, scope C). */
async function seedClaim(
  pods: MemoryPods,
  scope: ScopeId,
  spec: ClaimSpec,
  deliberation: string,
  visionUrls: ReadonlyMap<string, string>,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`claims/${spec.slug}.ttl`, base).toString();
  let derivedFrom: string | undefined;
  if (spec.from !== undefined) {
    derivedFrom = visionUrls.get(spec.from);
    if (!derivedFrom)
      throw new Error(`demo fixture ${spec.slug}: unknown vision slug ${spec.from}`);
  }
  const creator = demoWebId(spec.author);
  const claim: Claim = {
    id: url,
    content: spec.content,
    adoptedBy: creator, // the C6 adoption invariant — the serialiser enforces it
    created: spec.created,
    creator,
    inDeliberation: deliberation,
    ...(derivedFrom !== undefined ? { derivedFrom } : {}),
  };
  const quads = [...buildClaimQuads(claim), ...consentQuads(url, DEFAULT_CONSENT, creator)];
  pods.set(url, await serializeTurtle(quads, { prov: NS.prov, odrl: ODRL_NS }));
  await seedVotes(pods, scope, spec.slug, url, spec.created, spec.votes, deliberation);
  return url;
}

/** Seed one value statement (the writeValueStatement shape — S4, scope C). */
async function seedValue(
  pods: MemoryPods,
  scope: ScopeId,
  spec: ValueSpec,
  deliberation: string,
): Promise<string> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`values/${spec.slug}.ttl`, base).toString();
  const valueConcept = SCHWARTZ_BY_NAME.get(spec.value);
  if (!valueConcept)
    throw new Error(`demo fixture ${spec.slug}: unknown Schwartz value ${spec.value}`);
  const value: ValueStatement = {
    id: url,
    content: spec.content,
    valueConcept,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
  };
  const quads = [...buildValueQuads(value), ...consentQuads(url, DEFAULT_CONSENT, value.creator)];
  pods.set(url, await serializeTurtle(quads, { odrl: ODRL_NS }));
  return url;
}

/** Seed one standing critique on a candidate (the Room's writeCritique shape). */
async function seedCritique(
  pods: MemoryPods,
  scope: ScopeId,
  spec: CritiqueSpec,
  deliberation: string,
  candidateUrls: ReadonlyMap<string, string>,
): Promise<void> {
  const base = demoBase(spec.author, scope);
  const url = new URL(`critiques/${spec.slug}.ttl`, base).toString();
  const on = candidateUrls.get(spec.on);
  if (!on) throw new Error(`demo fixture ${spec.slug}: unknown candidate slug ${spec.on}`);
  const critique: Critique = {
    id: url,
    content: spec.content,
    onStatement: on,
    created: spec.created,
    creator: demoWebId(spec.author),
    inDeliberation: deliberation,
  };
  pods.set(url, await serializeTurtle(buildCritiqueQuads(critique)));
}

async function buildDemo(scope: ScopeId): Promise<DemoDeliberation> {
  const pods = new MemoryPods();
  const deliberation = demoDeliberationIri(scope);
  const needUrls = new Map<string, string>();
  for (const spec of DEMO_NEEDS[scope]) {
    needUrls.set(spec.slug, await seedNeed(pods, scope, spec, deliberation));
  }
  // The S4 scope-C expression layer: visions first (claims derive from them),
  // then claims + values — all through the production build/serialise shapes.
  const visionUrls = new Map<string, string>();
  for (const spec of DEMO_VISIONS[scope]) {
    visionUrls.set(spec.slug, await seedVision(pods, scope, spec, deliberation));
  }
  // The S1 artifact spine: proposals answer seeded needs; candidates derive
  // from needs/proposals/claims; critiques stand on candidates. Refs resolve
  // against what was actually seeded — an unknown slug is a fixture bug, fail-loud.
  const statementUrls = new Map<string, string>();
  for (const [slug, url] of needUrls) statementUrls.set(`need:${slug}`, url);
  for (const spec of DEMO_PROPOSALS[scope]) {
    const url = await seedProposal(pods, scope, spec, deliberation, needUrls);
    statementUrls.set(`proposal:${spec.slug}`, url);
  }
  for (const spec of DEMO_INFRA_PROPOSALS[scope]) {
    const url = await seedInfraProposal(pods, scope, spec, deliberation, needUrls);
    statementUrls.set(`infra:${spec.slug}`, url);
  }
  // The Adoption-board seed (scope B): sandboxed fedreg:StorageDescription
  // documents, authored through the REAL typed builder (never hand-built
  // triples) and read back through the REAL fedreg parse pipeline.
  if (scope === "infrastructure") {
    for (const s of DEMO_STORAGES) {
      const doc = describeStorage({
        id: `${DEMO_ORIGIN}/registry/${s.name}.ttl`,
        storage: s.storage,
        acceptsSpec: s.acceptsSpec,
        ...(s.supportsSector ? { supportsSector: s.supportsSector } : {}),
      });
      pods.set(`${DEMO_ORIGIN}/registry/${s.name}.ttl`, await doc.toString());
    }
  }
  // The S4 scope-C expression layer: claims (derive from visions) + values.
  for (const spec of DEMO_CLAIMS[scope]) {
    const url = await seedClaim(pods, scope, spec, deliberation, visionUrls);
    statementUrls.set(`claim:${spec.slug}`, url);
  }
  for (const spec of DEMO_VALUES[scope]) {
    await seedValue(pods, scope, spec, deliberation);
  }
  const candidateUrls = new Map<string, string>();
  for (const spec of DEMO_CANDIDATES[scope]) {
    candidateUrls.set(
      spec.slug,
      await seedCandidate(pods, scope, spec, deliberation, statementUrls),
    );
  }
  for (const spec of DEMO_CRITIQUES[scope]) {
    await seedCritique(pods, scope, spec, deliberation, candidateUrls);
  }
  // The governance layer: real steward keys + real signed credentials, written
  // through the same sandboxed fetch the statements use (src/demo/trust.ts).
  const trust = await seedDemoTrust(pods.fetch, scope, deliberation);
  const participants = DEMO_PEOPLE.map((p) => ({
    webId: demoWebId(p.key),
    base: demoBase(p.key, scope),
  }));
  const you = participants[DEMO_PEOPLE.findIndex((p) => p.key === DEMO_YOU_KEY)];
  if (!you) throw new Error("demo fixtures: missing the `you` participant");
  return { scope, deliberation, you, participants, fetch: pods.fetch, trust };
}

const instances = new Map<ScopeId, Promise<DemoDeliberation>>();

/** The (memoised, lazily seeded) demo deliberation for a scope. */
export function getDemoDeliberation(scope: ScopeId): Promise<DemoDeliberation> {
  let inst = instances.get(scope);
  if (!inst) {
    inst = buildDemo(scope);
    instances.set(scope, inst);
  }
  return inst;
}

/** Resolve a demo deliberation from its IRI (null for non-demo IRIs). */
export function demoForDeliberation(iri: string): Promise<DemoDeliberation> | null {
  if (!isDemoDeliberation(iri)) return null;
  const scope = iri.slice(`${DEMO_ORIGIN}/deliberations/`.length);
  if (scope !== "apps" && scope !== "infrastructure" && scope !== "society") return null;
  return getDemoDeliberation(scope);
}

/** TEST-ONLY: drop the memoised instances (fresh seed per test). */
export function resetDemoInstances(): void {
  instances.clear();
}
