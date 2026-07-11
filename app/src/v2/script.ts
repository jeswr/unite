// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The NOTETAKER's static script engine (design/v2 02 §2–4, 07 §3 V1): a
// deterministic prompt/beat sequencer — NO LLM anywhere (the demo scribe rule,
// 06 §4). The notetaker's lines are pure functions of the circle state,
// recomputed on read like everything else; they are the system's own speech
// and are never written to anyone's pod. Register (02 preamble): ~grade 6–8
// plain language, warm, no exclamation marks, role-framed — the notetaker
// mirrors, asks, and summarizes; it never advocates, never opines (P6), and
// warmth never attaches to the bot itself (P9: no simulated intimacy, no
// typing-pause theater).
//
// The BOUNDARY BEAT carries the CORRECTED 02 §4.1 semantics: when nothing the
// person said survives the C4 pre-screen, the notetaker offers KEEP-IT-HERE
// or REWORD-IT-YOURSELF only — the machine never reformulates sensitive
// content into a shareable atom.

import type { SensitiveHit } from "../lib/sensitive.js";

/** The notetaker's display identity — a role, never a person (P9). */
export const NOTETAKER_NAME = "unite · notetaker";

/** Beat 0 — the one honest handshake (P5): disclosed once, at the door. */
export const HANDSHAKE =
  "Welcome. This is a place where a few people at a time talk about what they want life " +
  "around here to look like — and slowly build a shared picture of it.\n\n" +
  "Before you say anything: I'm unite's notetaker, not a person. As people chat, I listen " +
  "for what matters to them and where they agree more than they'd guess. Everything I learn " +
  "about you stays in your own notebook — you can see it, fix it, or delete it anytime, and " +
  "I'll show you exactly what I do with any of it before it goes further than this circle. " +
  "The long version is on “How unite listens”, if you want it.\n\n" +
  "No forms, no right answers. Ready when you are.";

/** Beat 1 — the opening prompt (aspirational, never positional). */
export function openingPrompt(prompt: string): string {
  return (
    `Here's what this circle is chewing on: ${prompt} ` +
    `Someone said “I want to hear kids on bikes, not brakes.” ` +
    `What comes to mind for you — a memory, a wish, a gripe? All three welcome.`
  );
}

/** Composer quick-reply chips (never chips-only — free text always open). */
export const COMPOSER_CHIPS: readonly string[] = ["A memory", "A wish", "Honestly, a gripe"];

/** The mirror's three responses (02 §4). */
export const MIRROR_ACTIONS = {
  adopt: "That's it",
  fix: "Close — let me fix it",
  discard: "No, that's not it",
} as const;

/** The visible discard acknowledgement — nothing entered the engine. */
export const DISCARD_ACK = "Scrapped — say it your way and I'll listen better.";

/** The ask beat (a cue-less long utterance: never bluff comprehension). */
export const ASK_BEAT =
  "That's a lot of life in one message — I don't want to flatten it. " +
  "What's the one line you'd put on the wall?";

/**
 * The boundary beat (02 §4.1, CORRECTED): the C4 rule said out loud at the
 * moment it matters. Keep-it-here and reword-it-yourself are the ONLY paths —
 * a refusal that states its reason, never a silent drop, and never a
 * machine-made reformulation.
 */
export function boundaryBeat(hit: SensitiveHit): string {
  return (
    "What you said stays here — in this circle and in your notebook. I can't carry it into " +
    `the shared picture, though: ${hit.domain} details are off-limits there until the privacy ` +
    "machinery deserves them — a hard rule, not a judgment (the why is on “How unite listens”). " +
    "If you'd like something taken forward, say it again in your own words without the personal " +
    `${hit.domain} part — or keep it all just here. Both are fine answers.`
  );
}

/** The boundary beat's two choices (keep / reword — NO machine take-forward). */
export const BOUNDARY_ACTIONS = {
  keep: "Keep it all just here",
  reword: "Let me reword it",
} as const;

/** The reaction row's three warm labels (03 §3 — the v1 tri-state, worn warmly). */
export const REACTION_LABELS = {
  resonates: "resonates",
  unsure: "not sure",
  conflicts: "I see it differently",
} as const;

/** The optional resonance qualifiers (the v1 dimension triple in human words). */
export const QUALIFIER_LABELS = {
  share: "that's my life too",
  aspire: "that's my hope",
  support: "I'd back others having it",
} as const;

/** "I see it differently" is always followed by a pressure-free invitation. */
export const DIVERGENCE_INVITE = "Want to say how you see it? No pressure — a divergence is data.";

/** Beat 4 — the peer-statement beat (the deck, dealt as conversation). */
export function peerBeat(authorName: string): string {
  return `Here's how ${authorName} put it — does it ring true for you?`;
}

/** After adoption: an honest micro-receipt (P3 — a truthful fate line). */
export function adoptionReceipt(): string {
  return (
    "Taken forward — it's yours, in your own pod, and it now counts in what this circle is " +
    "figuring out. You can edit or remove it anytime from your notebook."
  );
}

/** Beat 5 — the exit fate-statement (P3): where the contribution actually went. */
export function exitFate(summaryPhrase: string): string {
  return (
    `What you said is now part of what this circle is figuring out — it shows up in the ` +
    `summary as “${summaryPhrase}”. If the group's picture changes because of it, you'll see ` +
    "that in the next letter, not in a notification storm. Come back whenever."
  );
}

/**
 * Beat 3's honesty rule (06 §3): when a mirror happens to land clean (adopted
 * unedited), the notetaker invites the visitor to STRESS the drafter rather
 * than letting a lucky template pass for subtlety. Appended to the receipt.
 */
export const STRESS_INVITE =
  "That one landed. Try me on something harder — I'd rather show you the fix button than " +
  "pretend I don't need one.";

/** The "borrow this memory" prop (06 §3 beat 2) — visibly a prop, never a rail. */
export const BORROW_MEMORY =
  "I remember when the fruit van parked on the corner and half the street came out to talk.";

/** The borrow chip's label — names itself a prop. */
export const BORROW_MEMORY_LABEL = "borrow this memory";

/**
 * AIRTIME EQUITY, repaired conversationally (04 §4): the notetaker's gentle
 * open-door for the quietest voice. The talk-share metric behind it is
 * HIDDEN — this line is the only rendered artifact, and it carries no
 * numbers, no ranking, no leaderboard. Optimize silently; display never.
 */
export function airtimeOpenDoor(quietestName: string): string {
  return (
    `We haven't heard from everyone — no pressure, ${quietestName}, but the floor's yours ` +
    "if you want it."
  );
}

/**
 * HIDDEN-PROFILE correction (04 §4): a cross-cluster story routed in as a
 * person, never raw opposing content — the gallery's contact prior worn as
 * an introduction.
 */
export function hiddenProfileIntro(authorName: string): string {
  return `${authorName} sees this differently — want to hear why, in their own words?`;
}

/**
 * The airtime rule behind {@link airtimeOpenDoor} — pure and HIDDEN (04 §4):
 * given per-member message counts (viewer excluded by the caller), return the
 * member to open the door for, or null. Fires only when the conversation has
 * body (≥6 messages all told) and the quietest voice has at most HALF the
 * busiest's turns — a wide spread, not everyday variance. Deterministic
 * tie-break: lexicographically least id. The counts themselves NEVER render.
 */
export function quietestVoice(
  counts: ReadonlyArray<readonly [string, number]>,
  totalMessages: number,
): string | null {
  if (totalMessages < 6 || counts.length === 0) return null;
  let quiet: readonly [string, number] | null = null;
  let busiest = 0;
  for (const entry of counts) {
    if (quiet === null || entry[1] < quiet[1] || (entry[1] === quiet[1] && entry[0] < quiet[0])) {
      quiet = entry;
    }
    if (entry[1] > busiest) busiest = entry[1];
  }
  if (quiet === null) return null;
  return quiet[1] * 2 <= busiest ? quiet[0] : null;
}

// ── Beat sequencing (pure, deterministic, testable) ──────────────────────────

/** What the notetaker should say NEXT, given the visitor's session state. */
export type NotetakerBeat =
  | { readonly kind: "handshake"; readonly text: string }
  | { readonly kind: "opening"; readonly text: string }
  | { readonly kind: "ask"; readonly text: string }
  | { readonly kind: "boundary"; readonly text: string; readonly hit: SensitiveHit }
  | { readonly kind: "peer"; readonly text: string; readonly statement: string }
  | { readonly kind: "fate"; readonly text: string };

/** The visitor-session state the sequencer reads (all derivable on render). */
export interface ScriptState {
  /** Messages the visitor has sent this session. */
  readonly visitorMessageCount: number;
  /** The unresolved drafter outcome for the visitor's last message, if any. */
  readonly pending: "draft" | "ask" | "boundary" | null;
  readonly boundaryHit: SensitiveHit | null;
  /** Atoms adopted this session. */
  readonly adoptedCount: number;
  /** Has the visitor reacted to a peer statement this session? */
  readonly reacted: boolean;
  /** The deck's top card for this viewer (null when none remain). */
  readonly peerCard: { readonly statement: string; readonly authorName: string } | null;
  /** The summary phrase the fate line quotes (the top theme's words). */
  readonly summaryPhrase: string | null;
}

/**
 * The notetaker's TRAILING beats for the current state, in render order.
 * Deterministic; mirrors are rendered separately (attached under the person's
 * message, not as notetaker beats). At most one substantive beat at a time —
 * mirrors are punctuation, not surveillance.
 */
export function notetakerBeats(state: ScriptState): NotetakerBeat[] {
  const beats: NotetakerBeat[] = [];
  if (state.pending === "ask") {
    beats.push({ kind: "ask", text: ASK_BEAT });
    return beats;
  }
  if (state.pending === "boundary" && state.boundaryHit !== null) {
    beats.push({ kind: "boundary", text: boundaryBeat(state.boundaryHit), hit: state.boundaryHit });
    return beats;
  }
  if (state.pending === "draft") return beats; // the mirror card is showing — say nothing else
  // Beat 4: after the visitor's first adoption, deal ONE peer statement.
  if (state.adoptedCount > 0 && !state.reacted && state.peerCard !== null) {
    beats.push({
      kind: "peer",
      text: peerBeat(state.peerCard.authorName),
      statement: state.peerCard.statement,
    });
    return beats;
  }
  // Beat 5: the exit fate line, once the loop has closed.
  if (state.adoptedCount > 0 && state.reacted && state.summaryPhrase !== null) {
    beats.push({ kind: "fate", text: exitFate(state.summaryPhrase) });
  }
  return beats;
}
