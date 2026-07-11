// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The LIVING SUMMARY (design/v2 02 §6, 03 §4): "what this circle is figuring
// out together" — recomputed on aggregate read (the Remesh same-session loop,
// no overnight batch). The TWO-SCALE k RULE is structural here:
//
//   • The circle's own statements pick WHICH themes appear;
//   • every verdict/phrasing is computed over the COMMUNITY-scale matrix
//     (candidateReception: clusters from the needs matrix, verdicts from
//     characterizeReception over ALL reactions) — NEVER a circle-interior
//     tally. A 4–6-person room gets no anonymous stats at all: the output
//     type below carries NO counts, NO splits — only consented, attributed
//     words plus the community-scale verdict. A single circle-mate's
//     reaction cannot be recovered from anything this module returns.
//
// Every statement lands in EXACTLY ONE bucket (circling / differ / forming —
// the three ReceptionVerdict values are total), which is what makes the P3
// fate-trail check ("every adopted atom is reachable from at least one
// surface") a structural property, fixture-pinned in summary.test.ts.

import { candidateReception } from "../lib/convergence.js";
import { DEFAULT_K_THRESHOLD } from "../lib/fut.js";
import type { Resonance } from "../lib/model.js";

/** One summary line: attributed words + the community-scale verdict. NO tallies. */
export interface SummaryLine {
  readonly statement: string;
  /** The statement's own words (displayed like the v1 board — aggregate-consented). */
  readonly words: string;
  /** The author WebID (a circle summary is attributed, never anonymous — P11). */
  readonly author: string;
  /** "We haven't heard you on this one" (02 §5) — viewer-relative, pressure-free. */
  readonly heardFromViewer: boolean;
}

/** The living summary: every input statement in exactly one bucket. */
export interface LivingSummary {
  /** "We're circling agreement on…" (community-scale common-ground). */
  readonly circling: readonly SummaryLine[];
  /** "Where we genuinely differ" — MANDATORY rendered whenever non-empty (P7). */
  readonly differ: readonly SummaryLine[];
  /** "Still forming" — the engine's literal null verdict, said honestly. */
  readonly forming: readonly SummaryLine[];
}

/** What {@link livingSummary} composes — community-scale engine inputs. */
export interface LivingSummaryOptions {
  /** The circle's themes: statements authored by this circle's members. */
  readonly circleStatements: ReadonlyArray<{
    readonly id: string;
    readonly content: string;
    readonly creator: string;
  }>;
  /** The VERIFIED community participants (the aggregate's set — NOT the circle). */
  readonly participants: readonly string[];
  /** The need IRIs (the community opinion-space universe). */
  readonly needStatements: readonly string[];
  /** ALL deduped resonances, community-scale. */
  readonly resonances: readonly Resonance[];
  /** The viewer (for the pressure-free "we haven't heard you" marker). */
  readonly viewer: string;
  /**
   * The k-anonymity floor for a rendered COMMUNITY-scale verdict (P11):
   * fewer than k community votes → the "forming" state, never an anonymous
   * common-ground/divisive characterization. Defaults to the engine's
   * DEFAULT_K_THRESHOLD (= 5).
   */
  readonly k?: number;
}

/**
 * Compute the living summary. Pure + deterministic (ordering: bridging score
 * descending per bucket, id tie-break). Verdicts are community-scale by
 * construction — the circle's membership never reaches the reception math.
 */
export function livingSummary(options: LivingSummaryOptions): LivingSummary {
  const k = options.k ?? DEFAULT_K_THRESHOLD;
  const reactedByViewer = new Set<string>();
  for (const r of options.resonances) {
    if (r.creator === options.viewer) reactedByViewer.add(r.onStatement);
  }

  const scored: { line: SummaryLine; verdict: "circling" | "differ" | "forming"; score: number }[] =
    [];
  for (const stmt of options.circleStatements) {
    const reception = candidateReception(
      options.participants,
      options.needStatements,
      options.resonances,
      stmt.id,
    );
    // P11 k-floor: a community-scale characterization renders ONLY at/above k.
    // Below it, the statement is "still forming" — an anonymous verdict over a
    // sub-k group (a 2-vote cross-cluster split, a 3-person common ground) is
    // exactly the deanonymization P11 forbids, so it never renders as one.
    const verdict =
      reception.totalSeen < k
        ? "forming"
        : reception.outcome === "endorsed"
          ? "circling"
          : reception.outcome === "disagreement"
            ? "differ"
            : "forming";
    scored.push({
      line: {
        statement: stmt.id,
        words: stmt.content,
        author: stmt.creator,
        heardFromViewer: reactedByViewer.has(stmt.id) || stmt.creator === options.viewer,
      },
      verdict,
      score: reception.score,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.line.statement < b.line.statement ? -1 : a.line.statement > b.line.statement ? 1 : 0;
  });

  return {
    circling: scored.filter((s) => s.verdict === "circling").map((s) => s.line),
    differ: scored.filter((s) => s.verdict === "differ").map((s) => s.line),
    forming: scored.filter((s) => s.verdict === "forming").map((s) => s.line),
  };
}
