/**
 * The narration character budget for a recording run (walkthrough/README.md). Paid voices
 * are limited, so a run may send at most this many characters, retries included. The
 * checks themselves are in lib/tts.ts (Voice.checkBudget before anything is sent, and a
 * charge before every send).
 */

export const DEFAULT_VOICE_BUDGET = 2500;

/** The budget from --voice-budget or VOICE_CHAR_BUDGET: 2,500 when unset, undefined (no limit) for 0. */
export function parseBudget(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return DEFAULT_VOICE_BUDGET;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`The voice budget must be a whole number of characters (got "${raw}")`);
  return n || undefined;
}
