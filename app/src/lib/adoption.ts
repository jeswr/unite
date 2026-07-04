// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The scope-B adoption instrument (S2 — SCOPE-DIFFERENTIATION §3.4/§3.5):
// "the wire is the ballot box." Adoption of a governed spec version is
// MEASURED from `fedreg:acceptsSpec` advertisements read off live
// fedreg:StorageDescription documents (via @jeswr/federation-registry — the
// suite's ONE reviewed fedreg reader, never a bespoke parser), and the
// Current / Superseded / Proposed status is COMPUTED from those observations
// against the adoption bar — never asserted. There is deliberately no status
// decree anywhere in this module's outputs: a captured room can sign a
// recommendation; it cannot sign adoption.
//
// Every observation carries its re-checkable `source` IRI — an index entry is
// a cache, never authoritative (design/02 §2). Reads are fail-isolated per
// source (one broken/hostile document degrades one source, never the board),
// https-only, byte-capped, and made with a credential-free fetch.

import { parseStorage } from "@jeswr/federation-registry";
import { isHttpIri } from "./model.js";
import { DEFAULT_MAX_BODY_BYTES, readBodyCapped } from "./pod.js";

/** One version of a governed system's spec lineage. */
export interface GovernedVersion {
  /** The immutable version IRI advertisers name in `fedreg:acceptsSpec`. */
  readonly iri: string;
  /** Human label ("0.1.0"). */
  readonly label: string;
  /** Optional honest annotation (e.g. the recommendation status of a draft). */
  readonly note?: string;
}

/** A governed system: a spec lineage the scope-B deliberation governs (§3.1). */
export interface GovernedSystem {
  /** The lineage IRI (the versionless ontology / profile identity). */
  readonly id: string;
  readonly label: string;
  /** The known versions, OLDEST FIRST (order is the supersession order). */
  readonly versions: readonly GovernedVersion[];
}

/**
 * The initial governed surface (§3.1, maintainer-defaulted Q3: self-host
 * first): unite's own spec lineage — the futures sector, whose 0.2.0 bump is
 * itself the first scope-B deliberation (milestone B4). Version IRIs are the
 * immutable `owl:versionIRI`s minted by the sector contract
 * (solid-federation-vocab). Further lineages join as the process survives.
 */
export const GOVERNED_SYSTEMS: readonly GovernedSystem[] = [
  {
    id: "https://w3id.org/jeswr/sectors/futures",
    label: "futures sector (the unite deliberation vocabulary)",
    versions: [
      { iri: "https://w3id.org/jeswr/sectors/futures/0.1.0", label: "0.1.0" },
      {
        iri: "https://w3id.org/jeswr/sectors/futures/0.2.0",
        label: "0.2.0",
        note: "the scope-B layer — the version this deliberation recommends",
      },
    ],
  },
];

/**
 * The default adoption bar (design/04 §2): ≥2 communities advertising via
 * `fedreg:acceptsSpec`. NB the full design bar ALSO requires ≥2 independent
 * implementations — implementation-independence is NOT machine-observable
 * from acceptsSpec alone, so this module computes the observable half and the
 * UI says so honestly (never claims the full bar from partial evidence).
 */
export const DEFAULT_ADOPTION_BAR = 2;

/** One observed `fedreg:acceptsSpec` advertisement (fut:AdoptionObservation shape). */
export interface AdoptionObservation {
  /** The advertising storage (`fedreg:storage`) — fut:observedParty. */
  readonly party: string;
  /** The advertised spec-version IRI — fut:observedVersion. */
  readonly version: string;
  /** When WE observed it (ISO dateTime) — fut:observedAt. */
  readonly observedAt: string;
  /** The storage-description IRI the claim can be RE-CHECKED against —
   * fut:observationSource (a cache entry, never authoritative). */
  readonly source: string;
}

/** A per-source failure — that source is skipped, the board survives. */
export interface AdoptionSourceError {
  readonly source: string;
  readonly message: string;
}

/** The result of one observation sweep over the configured sources. */
export interface AdoptionSnapshot {
  readonly observations: readonly AdoptionObservation[];
  readonly errors: readonly AdoptionSourceError[];
}

/** Options for {@link observeAdoption}. */
export interface ObserveOptions {
  /** The credential-free read fetch (publicFetch / the demo sandbox fetch). */
  readonly fetch: typeof fetch;
  /** Cap on a single storage-description body (default {@link DEFAULT_MAX_BODY_BYTES}). */
  readonly maxBodyBytes?: number;
  /** Clock seam for deterministic tests (default `() => new Date()`). */
  readonly now?: () => Date;
}

/**
 * Wrap a fetch so every response body is read through the incremental byte cap
 * BEFORE the caller parses it — a hostile storage description cannot force
 * unbounded memory through the fedreg reader (which has no cap seam of its own).
 */
function cappedFetch(fetchFn: typeof fetch, maxBytes: number): typeof fetch {
  return async (input, init) => {
    const res = await fetchFn(input, init);
    if (!res.ok || res.body === null) return res;
    const text = await readBodyCapped(res, maxBytes);
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

/**
 * Observe the network: read each configured `fedreg:StorageDescription` source
 * and record one {@link AdoptionObservation} per advertised spec version.
 * Fail-isolated per source; https-only (a non-https source is refused before
 * any request fires); every party/version IRI from the foreign document is
 * http(s)-validated before it is kept (hostile RDF drops values, never throws).
 */
export async function observeAdoption(
  sources: readonly string[],
  options: ObserveOptions,
): Promise<AdoptionSnapshot> {
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const now = options.now ?? (() => new Date());
  const fetchFn = cappedFetch(options.fetch, maxBytes);
  const observations: AdoptionObservation[] = [];
  const errors: AdoptionSourceError[] = [];
  for (const source of sources) {
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(source);
    } catch {
      errors.push({ source, message: "not a valid URL (skipped)" });
      continue;
    }
    if (sourceUrl.protocol !== "https:") {
      errors.push({ source, message: "adoption sources must be https (skipped)" });
      continue;
    }
    try {
      const verification = await parseStorage(sourceUrl.toString(), { fetch: fetchFn });
      if (!verification.valid || !verification.storage) {
        const detail = verification.issues.map((i) => i.message).join("; ");
        errors.push({ source, message: detail || "not a valid storage description" });
        continue;
      }
      const party = verification.storage.storage;
      if (!isHttpIri(party)) {
        errors.push({ source, message: "storage description names a non-http(s) party" });
        continue;
      }
      const observedAt = now().toISOString();
      for (const version of verification.storage.acceptsSpec) {
        if (!isHttpIri(version)) continue; // hostile value → drop the value
        observations.push({ party, version, observedAt, source: sourceUrl.toString() });
      }
    } catch (e) {
      errors.push({ source, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { observations, errors };
}

/** One version column of the matrix: who advertises it, and the computed bar. */
export interface VersionAdoption {
  readonly version: GovernedVersion;
  /** Distinct advertising parties, sorted (deterministic). */
  readonly parties: readonly string[];
  /** Every observation backing this column (each cell re-checkable). */
  readonly observations: readonly AdoptionObservation[];
  /** Whether the OBSERVABLE half of the adoption bar is met (≥bar parties). */
  readonly barMet: boolean;
  /**
   * The COMPUTED lifecycle status (never asserted anywhere):
   *  • "current"    — the newest version in this lineage whose bar is met;
   *  • "superseded" — bar met, but a NEWER version's bar is also met;
   *  • "proposed"   — bar not met (published ≠ adopted; the wire hasn't voted).
   */
  readonly status: "current" | "superseded" | "proposed";
}

/** The versions × advertisers matrix for one governed system. */
export interface AdoptionMatrix {
  readonly system: GovernedSystem;
  /** Per declared version (lineage order), the computed adoption column. */
  readonly versions: readonly VersionAdoption[];
  /** All distinct advertisers seen for this lineage, sorted (the matrix rows). */
  readonly advertisers: readonly string[];
}

/**
 * Compute the adoption matrices from a snapshot — PURE (the only inputs are
 * the declared lineages, the observations, and the bar; same in ⇒ same out).
 * An observation whose version is not a declared version of any lineage is
 * returned in `undeclared` — shown honestly, never silently dropped.
 */
export function computeAdoption(
  systems: readonly GovernedSystem[],
  observations: readonly AdoptionObservation[],
  bar: number = DEFAULT_ADOPTION_BAR,
): { matrices: readonly AdoptionMatrix[]; undeclared: readonly AdoptionObservation[] } {
  const declared = new Set<string>();
  for (const sys of systems) for (const v of sys.versions) declared.add(v.iri);
  const undeclared = observations.filter((o) => !declared.has(o.version));

  const matrices = systems.map((system): AdoptionMatrix => {
    const columns = system.versions.map((version) => {
      const obs = observations.filter((o) => o.version === version.iri);
      const parties = [...new Set(obs.map((o) => o.party))].sort();
      return { version, observations: obs, parties, barMet: parties.length >= bar };
    });
    // The newest bar-met version is "current"; earlier bar-met versions are
    // "superseded"; a version below the bar is "proposed" — all COMPUTED.
    let currentIdx = -1;
    for (let i = columns.length - 1; i >= 0; i--) {
      const col = columns[i];
      if (col?.barMet) {
        currentIdx = i;
        break;
      }
    }
    const versions = columns.map((col, i): VersionAdoption => {
      const status: VersionAdoption["status"] = col.barMet
        ? i === currentIdx
          ? "current"
          : "superseded"
        : "proposed";
      return { ...col, status };
    });
    const advertisers = [...new Set(versions.flatMap((v) => v.parties))].sort();
    return { system, versions, advertisers };
  });
  return { matrices, undeclared };
}
