// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The MIRROR DRAFTER (design/v2 03 §2 — NEW at V1): the deterministic
// utterance→atom pipeline behind the lib/decompose DecompositionAssistant
// seam. `MANUAL_DECOMPOSITION` intentionally proposes nothing (it is v1's
// select-your-own-text path — the identity element of the seam); the v2
// conversational mirror needs a real drafter, and this is it — pure,
// deterministic, lexical, in the sensitive.ts mold. Good enough for the
// five-minute demo arc, honest about its quality ceiling (08 C-v2-5): a
// template must never bluff comprehension, so a cue-less long utterance
// drafts NOTHING and the notetaker asks instead.
//
// The six steps (03 §2), each fixture-pinned in mirror-draft.test.ts:
//   1. SEGMENT the utterance into sentences.
//   2. SELECT THE CLAIM: score sentences against the fixed cue lexicon
//      (want / gripe / memory cues); highest score wins, earliest-sentence
//      tie-break; ≤500-char fut:Claim cap. No cue + short utterance → the
//      whole utterance IS the claim; no cue + long → NO claim ("ask").
//   3. CODE THE NEED: a fixture-pinned keyword→Max-Neef table over the whole
//      utterance; the top concept becomes the drafted fut:Need, rendered as
//      plain talk (never a taxonomy). No match → claim-only.
//   4. VALUES ARE CONSERVATIVE: a fut:ValueStatement only on an explicit,
//      concept-pinned value cue — absent otherwise.
//   5. C4 PRE-SCREEN: a candidate that trips screenSensitiveDomain is
//      re-selected from non-tripping sentences; when none survives, NO atom
//      is drafted and the boundary beat runs (design/v2 02 §4.1 — CORRECTED
//      semantics: the beat offers KEEP-IT-HERE or REWORD-IT-YOURSELF only;
//      the machine NEVER auto-sanitizes sensitive content into a shareable
//      atom — selection among the person's own non-tripping sentences is the
//      drafter's entire repertoire, rewriting is not in it).
//   6. RENDER THE MIRROR: one deterministic template — same utterance, same
//      mirror, every time.
//
// Provenance (C6 — assistance is never invisible): every result carries
// {tool: "mirror-draft", plan: <lexicon version>}; adopted atoms carry
// fut:decomposedBy → a prov:Activity recording it (the adoption path's job).
// Statements are DATA, never instructions: hostile text in an utterance can
// become at most a hostile STRING inside an atom's content.

import type { DecompositionAssistant, DecompositionPlan, DraftAtom } from "./decompose.js";
import { MAXNEEF_CONCEPTS } from "./fut.js";
import { MAX_CLAIM_LENGTH, SCHWARTZ_CONCEPTS } from "./fut-society.js";
import { type SensitiveHit, screenSensitiveDomain } from "./sensitive.js";

/** The tool id carried in PROV (fut:decomposedBy → prov:hadPlan). */
export const MIRROR_DRAFT_TOOL = "mirror-draft";

/** The lexicon version — bump when any table below changes (the PROV plan). */
export const MIRROR_DRAFT_PLAN = "mirror-draft-lexicon/1";

/** The disclosure every drafter result carries (C6). */
export const MIRROR_PROVENANCE: DecompositionPlan = {
  tool: MIRROR_DRAFT_TOOL,
  plan: MIRROR_DRAFT_PLAN,
};

/** A cue-less utterance at or under this length is mirrored whole (step 2). */
export const SHORT_UTTERANCE_MAX = 160;

/** Mirror clause cap: the compressed claim is cut at a word boundary past this. */
const MIRROR_CLAUSE_MAX = 90;

// ── Step 2's cue lexicon (fixed, fixture-pinned) ─────────────────────────────

const WANT_CUES: readonly string[] = [
  "i want",
  "i wish",
  "i'd love",
  "i hope",
  "should",
  "needs to",
  "it would be",
];

const GRIPE_CUES: readonly string[] = [
  "can't",
  "cannot",
  "unsafe",
  "too fast",
  "scares",
  "terrifying",
  "never works",
  "fed up",
  "sick of",
];

const MEMORY_CUES: readonly string[] = ["i remember", "used to", "back when"];

/** The full claim-cue lexicon (exported for the behind-the-curtain page, V5). */
export const CLAIM_CUES: Readonly<Record<"want" | "gripe" | "memory", readonly string[]>> = {
  want: WANT_CUES,
  gripe: GRIPE_CUES,
  memory: MEMORY_CUES,
};

const ALL_CUES: readonly string[] = [...WANT_CUES, ...GRIPE_CUES, ...MEMORY_CUES];

// ── Step 3's keyword→Max-Neef table (fixture-pinned DATA, not code) ──────────
// A trailing "-" marks a stem (prefix match); everything matches on word
// boundaries, case-insensitively. Concept names are the canonical fut.ts
// Max-Neef seed names; ties break in MAXNEEF_CONCEPTS' canonical order.

export const NEED_KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["subsistence", ["afford-", "housing", "fares", "rent", "food", "wage-", "bills"]],
  [
    "protection",
    [
      "safe",
      "safely",
      "safety",
      "unsafe",
      "crossing",
      "traffic",
      "danger-",
      "speeding",
      "scares",
      "terrifying",
    ],
  ],
  ["affection", ["friends", "together", "neighbours", "neighbors", "kindness"]],
  ["understanding", ["understand-", "learn-", "curious"]],
  ["participation", ["a say", "asked", "decide-", "decision-", "council", "vote-", "heard"]],
  ["idleness", ["play-", "rest", "relax-", "leisure"]],
  ["creation", ["repair-", "fix-", "build-", "craft-", "create-"]],
  ["identity", ["ours", "belong-", "neighbourhood", "neighborhood", "community"]],
  ["freedom", ["choose", "choice", "on my own", "independen-", "freely"]],
];

/** Plain-talk phrasing per Max-Neef concept (step 3: never a taxonomy). */
export const NEED_PHRASES: Readonly<Record<string, string>> = {
  subsistence: "making everyday life affordable and workable",
  protection: "feeling safe",
  affection: "being with people you care about",
  understanding: "making sense of things",
  participation: "having a say",
  idleness: "room to rest and play",
  creation: "making and fixing things yourself",
  identity: "belonging here",
  freedom: "deciding things for yourself",
};

// ── Step 4's value cues (conservative: only concept-pinned cues draft) ───────

export const VALUE_CUES: ReadonlyArray<readonly [string, string]> = [
  ["treat each other", "benevolence"],
  ["look after each other", "benevolence"],
  ["fair", "universalism"],
  ["fairness", "universalism"],
  ["fairly", "universalism"],
  ["everyone counts", "universalism"],
];

// Canonical concept lookups (typed accessors over the fut.ts / fut-society
// seed schemes — the drafter never mints an IRI by hand).
const MAXNEEF_IRI_BY_NAME: ReadonlyMap<string, string> = new Map(
  MAXNEEF_CONCEPTS.map((c) => [c.name, c.iri]),
);
const SCHWARTZ_IRI_BY_NAME: ReadonlyMap<string, string> = new Map(
  SCHWARTZ_CONCEPTS.map((c) => [c.name, c.iri]),
);

// ── Step 1: segmentation ─────────────────────────────────────────────────────

/** Split an utterance into sentences (./!/? + newlines), trimmed, no empties. */
export function segmentSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── Matching helpers (pure, deterministic) ───────────────────────────────────

/** Case-insensitive substring cue count for one sentence (each cue once). */
function cueScore(sentence: string): number {
  const hay = sentence.toLowerCase();
  let score = 0;
  for (const cue of ALL_CUES) if (hay.includes(cue)) score++;
  return score;
}

/** Escape a literal for RegExp embedding. */
function escapeRe(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary matcher for a table token ("danger-" = stem/prefix). */
function tokenMatches(token: string, hayLower: string): boolean {
  const stem = token.endsWith("-");
  const body = escapeRe(stem ? token.slice(0, -1) : token);
  const re = new RegExp(`\\b${body}${stem ? "\\w*" : "\\b"}`, "i");
  return re.test(hayLower);
}

/**
 * The top-scoring Max-Neef concept name for an utterance, or null (step 3).
 * NEED_KEYWORDS is kept in the canonical MAXNEEF_CONCEPTS order (test-pinned),
 * so a strict-greater scan tie-breaks to the earlier canonical concept.
 */
export function codeNeed(utterance: string): string | null {
  const hay = utterance.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [concept, keywords] of NEED_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) if (tokenMatches(kw, hay)) score++;
    if (score > bestScore) {
      best = concept;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

// ── Step 6: the mirror template ──────────────────────────────────────────────

const LEADING_CONNECTIVES: readonly string[] = [
  "and",
  "but",
  "so",
  "well",
  "also",
  "then",
  "honestly",
  "anyway",
  "i mean",
  "you know",
  "like",
];

/** Compress a claim for the mirror: strip leading connectives, lowercase the
 * lead, drop trailing sentence punctuation, cap the clause at a word boundary. */
export function compressClaim(claim: string): string {
  let s = claim.trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    const lower = s.toLowerCase();
    for (const c of LEADING_CONNECTIVES) {
      if (lower.startsWith(`${c} `) || lower.startsWith(`${c},`)) {
        s = s.slice(c.length).replace(/^[\s,]+/, "");
        stripped = true;
        break;
      }
    }
  }
  s = s.replace(/[.!?]+$/, "").trim();
  if (s.length > 0) s = s.charAt(0).toLowerCase() + s.slice(1);
  if (s.length > MIRROR_CLAUSE_MAX) {
    const cut = s.lastIndexOf(" ", MIRROR_CLAUSE_MAX);
    s = `${s.slice(0, cut > 0 ? cut : MIRROR_CLAUSE_MAX)}…`;
  }
  return s;
}

/** Render the one mirror template (deterministic: same input, same mirror). */
export function renderMirror(claim: string, needConceptName: string | null): string {
  const clause = compressClaim(claim);
  const phrase = needConceptName === null ? undefined : NEED_PHRASES[needConceptName];
  return phrase === undefined
    ? `Hearing you: ${clause}. Close?`
    : `Hearing you: ${clause} — sounds like it's about ${phrase}. Close?`;
}

// ── The drafter ──────────────────────────────────────────────────────────────

/** What a drafter run concluded (the notetaker's next move). */
export type MirrorOutcomeKind =
  /** Atoms drafted; the mirror sentence is offered for adopt / fix / discard. */
  | "draft"
  /** No cue in a long utterance — the notetaker ASKS instead of bluffing. */
  | "ask"
  /** Every candidate tripped the C4 screen — the boundary beat runs
   * (keep-it-here / reword-it-yourself ONLY; nothing is drafted). */
  | "boundary"
  /** Empty/whitespace input — nothing to do. */
  | "nothing";

/** One drafter run's full result. */
export interface MirrorDraftResult {
  readonly kind: MirrorOutcomeKind;
  /** Candidate atoms — non-empty iff kind === "draft". */
  readonly atoms: readonly DraftAtom[];
  /** The rendered mirror sentence — present iff kind === "draft". */
  readonly mirror: string | null;
  /** The C4 hit that ran the boundary beat — present iff kind === "boundary". */
  readonly boundary: SensitiveHit | null;
  /** The C6 disclosure ({tool, plan}) — always present. */
  readonly provenance: DecompositionPlan;
}

/**
 * Draft the mirror for one utterance. Pure + fully deterministic (03 §2).
 * The utterance itself is NEVER screened here (utterances are ungated, §2a) —
 * the C4 pre-screen runs on what the drafter would CARRY FORWARD, and the
 * fail-closed chokepoint (pod-society's assertNotSensitive) still stands
 * behind this whatever the UI does.
 */
export function draftMirror(utterance: string): MirrorDraftResult {
  const provenance = MIRROR_PROVENANCE;
  const trimmed = utterance.trim();
  if (trimmed.length === 0) {
    return { kind: "nothing", atoms: [], mirror: null, boundary: null, provenance };
  }

  const sentences = segmentSentences(trimmed);
  const candidates = sentences
    .map((s, i) => ({ s, i, score: cueScore(s) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.i - b.i));

  let claimText: string | null = null;
  let boundary: SensitiveHit | null = null;

  if (candidates.length > 0) {
    // Step 5: re-select from non-tripping sentences; never rewrite anything.
    const surviving = candidates.find((c) => screenSensitiveDomain(c.s) === null);
    if (surviving) {
      claimText = surviving.s.slice(0, MAX_CLAIM_LENGTH).trim();
    } else {
      const first = candidates[0];
      boundary = first === undefined ? null : screenSensitiveDomain(first.s);
    }
  } else if (trimmed.length <= SHORT_UTTERANCE_MAX) {
    const hit = screenSensitiveDomain(trimmed);
    if (hit) boundary = hit;
    else claimText = trimmed;
  } else {
    // No cue and it is long: never bluff comprehension — ask.
    return { kind: "ask", atoms: [], mirror: null, boundary: null, provenance };
  }

  if (claimText === null) {
    return { kind: "boundary", atoms: [], mirror: null, boundary, provenance };
  }

  const atoms: DraftAtom[] = [{ kind: "claim", content: claimText }];

  // Step 3: code the need over the whole utterance; the CONTENT carried
  // forward stays the (already-screened) claim text — matched words feed only
  // the pinned plain phrasing, never the atom body.
  const needConceptName = codeNeed(trimmed);
  if (needConceptName !== null) {
    const needConcept = MAXNEEF_IRI_BY_NAME.get(needConceptName);
    if (needConcept !== undefined) {
      atoms.push({ kind: "need", content: claimText, needConcept });
    }
  }

  // Step 4: a value only on an explicit cue, from the cue's own (screened)
  // sentence; a tripping value sentence is simply not offered.
  valueScan: for (const [cue, conceptName] of VALUE_CUES) {
    for (const s of sentences) {
      if (!tokenMatches(cue, s.toLowerCase())) continue;
      if (screenSensitiveDomain(s) !== null) continue;
      const valueConcept = SCHWARTZ_IRI_BY_NAME.get(conceptName);
      if (valueConcept !== undefined) {
        atoms.push({ kind: "value", content: s.slice(0, MAX_CLAIM_LENGTH).trim(), valueConcept });
      }
      break valueScan;
    }
  }

  return {
    kind: "draft",
    atoms,
    mirror: renderMirror(claimText, needConceptName),
    boundary: null,
    provenance,
  };
}

/**
 * The drafter as a {@link DecompositionAssistant} (the lib/decompose seam):
 * proposes atoms, never adopts them — the author's explicit adopt/edit/discard
 * decision downstream is what makes an atom theirs, identically to the manual
 * path. Always returns its provenance (an assisted decomposition is never
 * invisible — C6).
 */
export const MIRROR_DRAFT_ASSISTANT: DecompositionAssistant = {
  decompose(narrative: string) {
    const result = draftMirror(narrative);
    return Promise.resolve({ atoms: result.atoms, provenance: result.provenance });
  },
};
