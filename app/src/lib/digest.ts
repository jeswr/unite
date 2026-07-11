// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The LETTER assembler (design/v2 02 §6, 03 §4 — NEW at V2): the monthly
// community digest, assembled as a PURE composition of engine outputs. It
// contains no new judgment: every theme is a statement whose reception the
// engine computed (candidateReception — clusters from the needs matrix,
// verdicts from characterizeReception), every quoted word is consent-gated,
// and every sentence the view renders is traceable to a field here.
//
// The four-part structure (02 §6), covenant-enforced:
//   (a) EMERGED     — common-ground themes, k-thresholded (P11);
//   (b) DIFFER      — "where people genuinely differ, in their own words":
//                     MANDATORY whenever any k-cleared reception is divisive
//                     (P7 — dissent is the interesting part, never smoothed);
//   (c) CHANGED     — what happened because people spoke (fate deltas —
//                     caller-derived; the full fate-trail read lands at V4);
//   (d) INVITATION  — exactly one, personal, never a growth mechanic.
//
// The k floor (P11): NO anonymized characterization below k — a statement
// whose community-wide reception has fewer than k votes is never labelled
// common-ground/divisive; it contributes only to the count-free
// `hasForming` flag (no number renders below k — fuzzing would be theater).

import { candidateReception } from "./convergence.js";
import { DEFAULT_K_THRESHOLD } from "./fut.js";
import type { Resonance } from "./model.js";

/** One candidate theme (a claim/need statement) + its consent posture. */
export interface DigestStatement {
  readonly id: string;
  readonly content: string;
  /** Display attribution when quoted (a demo name / profile name). */
  readonly authorName?: string;
  /**
   * May the letter carry the words VERBATIM? (The author's ODRL
   * fut:quoteVerbatim consent — fail-closed: unknown = false.)
   */
  readonly quotable: boolean;
}

/** One theme the letter carries, with its engine-computed reception. */
export interface DigestTheme {
  readonly statement: string;
  /**
   * The verbatim words when the author's consent permits quoting; null
   * otherwise (the view renders an unquoted theme line — never a paraphrase
   * the machine made up).
   */
  readonly words: string | null;
  readonly authorName?: string;
  readonly reception: "common-ground" | "divisive";
  /** Community-wide votes behind the characterization (always ≥ k here). */
  readonly seen: number;
}

/** The assembled letter. */
export interface Digest {
  /** (a) what emerged — common ground, k-cleared, best-bridging first. */
  readonly emerged: readonly DigestTheme[];
  /** (b) where people genuinely differ — mandatory whenever non-empty data exists (P7). */
  readonly differ: readonly DigestTheme[];
  /**
   * Whether themes exist below the characterization floor (sub-k or
   * still-shapeless). COUNT-FREE by design (P11): the letter says "some
   * themes are still forming", never how many.
   */
  readonly hasForming: boolean;
  /** (c) what changed because people spoke (plain sentences, caller-derived). */
  readonly changed: readonly string[];
  /** (d) the one invitation. */
  readonly invitation: string;
  /** The k floor this digest enforced. */
  readonly k: number;
}

/** The standing default invitation (02 §6(d)). */
export const DEFAULT_INVITATION =
  "This month: bring someone who sees the street differently — one person, personally asked.";

/** What {@link assembleDigest} needs — all engine outputs or consented data. */
export interface DigestOptions {
  /** The VERIFIED participant WebIDs (the aggregate's set). */
  readonly participants: readonly string[];
  /** The need IRIs — the opinion-space clustering universe (v1 convention). */
  readonly needStatements: readonly string[];
  /** ALL deduped resonances, community-scale. */
  readonly resonances: readonly Resonance[];
  /** The candidate themes (claims + their consent posture). */
  readonly statements: readonly DigestStatement[];
  /** The k-anonymity floor (default the engine's DEFAULT_K_THRESHOLD = 5). */
  readonly k?: number;
  /** Part (c) sentences (adopted-atom deltas now; fate-trails at V4). */
  readonly changed?: readonly string[];
  readonly invitation?: string;
}

/**
 * Assemble the letter. Pure + deterministic: same inputs, same digest.
 * Every characterization is computed by the engine (candidateReception) over
 * COMMUNITY-scale data and floored at k; ordering is bridging-score
 * descending with an id tie-break.
 */
export function assembleDigest(options: DigestOptions): Digest {
  const k = options.k ?? DEFAULT_K_THRESHOLD;
  const emerged: (DigestTheme & { score: number })[] = [];
  const differ: (DigestTheme & { score: number })[] = [];
  let hasForming = false;

  for (const stmt of options.statements) {
    const reception = candidateReception(
      options.participants,
      options.needStatements,
      options.resonances,
      stmt.id,
    );
    // P11: no anonymized characterization below the k floor.
    if (reception.totalSeen < k || reception.outcome === "open") {
      hasForming = true;
      continue;
    }
    const theme: DigestTheme & { score: number } = {
      statement: stmt.id,
      words: stmt.quotable ? stmt.content : null,
      ...(stmt.authorName !== undefined ? { authorName: stmt.authorName } : {}),
      reception: reception.outcome === "endorsed" ? "common-ground" : "divisive",
      seen: reception.totalSeen,
      score: reception.score,
    };
    if (theme.reception === "common-ground") emerged.push(theme);
    else differ.push(theme);
  }

  const order = (a: { score: number; statement: string }, b: typeof a): number => {
    if (b.score !== a.score) return b.score - a.score;
    return a.statement < b.statement ? -1 : a.statement > b.statement ? 1 : 0;
  };
  emerged.sort(order);
  differ.sort(order);

  const strip = ({ score: _score, ...theme }: DigestTheme & { score: number }): DigestTheme =>
    theme;
  return {
    emerged: emerged.map(strip),
    differ: differ.map(strip),
    hasForming,
    changed: options.changed ?? [],
    invitation: options.invitation ?? DEFAULT_INVITATION,
    k,
  };
}
