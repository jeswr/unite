// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE PRIVATE ACTION-TEAM NUDGE (design/v2 05 §3, 07 §3 V4): the most
// persuasion-shaped move the engine makes, so it carries the strongest seam
// in the system. This module is the surface half over lib/readiness.ts (the
// deterministic detection — UNCHANGED):
//
//   • RECIPIENT-ONLY: `nudgeFor` returns null unless the viewer is one of
//     the signal's named recipients — a non-recipient's render is nothing,
//     structurally (the fixture pins it);
//   • ONCE PER THEME PER PERSON: the readiness signal's stable `themeKey`
//     is the dedupe key; a session-scoped memory keeps the promise (and the
//     promise is STATED in the nudge itself);
//   • the "why me?" seam cites the literal matched evidence — the viewer's
//     own recurring turns and offers, each one linked (readiness already
//     scopes evidence to recipients; this module narrows it to the VIEWER —
//     a nudge never shows you anyone else's turns);
//   • declining (or ignoring) is sticky and consequence-free: the same
//     session memory, nothing rendered to anyone else, no re-asks.

import type { ConversationTurn } from "../lib/questions.js";
import { detectReadiness, type OfferHit, type ReadinessSignal } from "../lib/readiness.js";

/** What the circle renders for a nudge-recipient viewer. */
export interface NudgeView {
  /** The stable dedupe key ("once per theme per person"). */
  readonly themeKey: string;
  /** The warm, small, time-boxed ask (05 §3's register). */
  readonly ask: string;
  /** The three standing promises, stated in the nudge itself. */
  readonly promises: string;
  /** The viewer's OWN matched offers (the "why me?" evidence, linked). */
  readonly yourOffers: readonly OfferHit[];
  /** The viewer's recurring theme turns (turn ids, linkable in-thread). */
  readonly yourTurnIds: readonly string[];
  /** How many people were nudged (named recipients only see it). */
  readonly recipientCount: number;
}

/** The nudge ask — one small together-step, never a broadcast CTA. */
export function nudgeAsk(theme: readonly string[], recipientCount: number): string {
  const themeWords = theme.slice(0, 2).join(" ");
  const who = recipientCount === 2 ? "You two" : recipientCount === 3 ? "You three" : "You four";
  return (
    `${who} keep coming back to the ${themeWords}. Fancy having a look together this weekend — ` +
    "just to look? One small step, time-boxed, nothing signed."
  );
}

/** The three standing promises (05 §3 — stated in the nudge, not a policy page). */
export const NUDGE_PROMISES =
  "Only the people named here are seeing this; it is sent at most once per theme per person; " +
  "and saying no — or nothing — is a fine answer that sticks: no re-asks, nothing shown to " +
  "anyone else.";

/**
 * The seen-memory key: PER PERSON per theme ("once per theme per PERSON" —
 * one recipient seeing a theme must never suppress another recipient's nudge).
 */
export function seenKey(viewer: string, themeKey: string): string {
  return `${viewer}::${themeKey}`;
}

/**
 * The nudge for THIS viewer, or null. Null when: no readiness signal exists,
 * the viewer is not a named recipient, or THIS VIEWER already saw/declined
 * the theme this session (`seenKeys` holds viewer-scoped {@link seenKey}s).
 * Pure given its inputs.
 */
export function nudgeFor(
  viewer: string,
  turns: readonly ConversationTurn[],
  seenKeys: ReadonlySet<string>,
): NudgeView | null {
  for (const signal of detectReadiness(turns)) {
    if (!signal.recipients.includes(viewer)) continue;
    if (seenKeys.has(seenKey(viewer, signal.themeKey))) continue;
    return toView(viewer, signal);
  }
  return null;
}

function toView(viewer: string, signal: ReadinessSignal): NudgeView {
  return {
    themeKey: signal.themeKey,
    ask: nudgeAsk(signal.theme, signal.recipients.length),
    promises: NUDGE_PROMISES,
    // The viewer sees ONLY their own evidence — never anyone else's turns.
    yourOffers: signal.offers.filter((o) => o.author === viewer),
    yourTurnIds: signal.recurringTurns.filter((t) => t.author === viewer).map((t) => t.turnId),
    recipientCount: signal.recipients.length,
  };
}

// ── The session memory (once per theme per PERSON; declines sticky) ─────────
// In-memory, session-scoped: the demo evaporates on reload by design (06 §7),
// so the promise's scope is the session. Keys are viewer-scoped (seenKey) so
// one recipient's sighting never suppresses another's. A live deployment
// would persist each person's seen-set to their own pod.

const seen = new Set<string>();

export function seenThemes(): ReadonlySet<string> {
  return seen;
}

export function markThemeSeen(viewer: string, themeKey: string): void {
  seen.add(seenKey(viewer, themeKey));
}

/** TEST-ONLY: reset the session memory. */
export function resetNudgeMemory(): void {
  seen.clear();
}
