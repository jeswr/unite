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

import { DataFactory, Writer } from "n3";
import { consentQuads, DEFAULT_CONSENT, ODRL_NS } from "../lib/consent.js";
import {
  fut,
  MAXNEEF_CONCEPTS,
  STANCE_CONFLICTS,
  STANCE_RESONATES,
  STANCE_UNSURE,
  type Stance,
} from "../lib/fut.js";
import {
  buildNeedQuads,
  type Need,
  type Resonance,
  serializeResonance,
  serializeTurtle,
} from "../lib/model.js";
import type { ScopeId } from "../scope/scopes.js";
import {
  DEMO_NAMES,
  DEMO_NEEDS,
  DEMO_ORIGIN,
  DEMO_PEOPLE,
  DEMO_YOU_KEY,
  demoBase,
  demoDeliberationIri,
  demoWebId,
  type NeedSpec,
  type VoteCode,
} from "./fixtures.js";

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

async function seedNeed(
  pods: MemoryPods,
  scope: ScopeId,
  spec: NeedSpec,
  deliberation: string,
): Promise<void> {
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

  const voters = Object.entries(spec.votes);
  for (const [voter, code] of voters) {
    const voterIndex = DEMO_PEOPLE.findIndex((p) => p.key === voter);
    if (voterIndex < 0) throw new Error(`demo fixture ${spec.slug}: unknown voter ${voter}`);
    const vBase = demoBase(voter, scope);
    const vUrl = new URL(`resonances/re-${spec.slug}.ttl`, vBase).toString();
    const resonance: Resonance = {
      id: vUrl,
      onStatement: url,
      stance: STANCE_OF[code],
      created: voteCreated(spec.created, voterIndex),
      creator: demoWebId(voter),
      inDeliberation: deliberation,
    };
    pods.set(vUrl, await serializeResonance(resonance));
  }
}

async function buildDemo(scope: ScopeId): Promise<DemoDeliberation> {
  const pods = new MemoryPods();
  const deliberation = demoDeliberationIri(scope);
  for (const spec of DEMO_NEEDS[scope]) {
    await seedNeed(pods, scope, spec, deliberation);
  }
  const participants = DEMO_PEOPLE.map((p) => ({
    webId: demoWebId(p.key),
    base: demoBase(p.key, scope),
  }));
  const you = participants[DEMO_PEOPLE.findIndex((p) => p.key === DEMO_YOU_KEY)];
  if (!you) throw new Error("demo fixtures: missing the `you` participant");
  return { scope, deliberation, you, participants, fetch: pods.fetch };
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
