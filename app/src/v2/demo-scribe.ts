// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE DEMO SCRIBE OVERLAY (design/v2 06 §4): canned, high-quality mirrors for
// the PERSONA seats' seeded statements ONLY — labeled as demo voice. The
// honesty rule is structural here:
//
//   • the overlay is keyed by SEEDED persona message name (demo-circle.ts's
//     stable seed names) — a visitor's free-text message has no seed name,
//     so it can NEVER hit this table: free text always goes through the real,
//     UN-TUNED drafter (lib/mirror-draft.ts), checkable behind the curtain;
//   • every overlay line renders with the demo-voice label and the scribe
//     seam (the 06 §4 sentence, verbatim below).

/** The 06 §4 seam sentence, verbatim — every demo mirror carries it. */
export const SCRIBE_SEAM =
  "drafted by a deterministic reference listener — a live community would choose its own " +
  "helper, human or model, and its choice would be recorded on every draft.";

/** The demo-voice label persona-side scripted content wears (06 §2). */
export const DEMO_VOICE_LABEL = "demo voice";

/** Canned persona mirrors, keyed by SEED MESSAGE NAME (never visitor text). */
export const PERSONA_MIRRORS: Readonly<Record<string, string>> = {
  "cm-farah-drive":
    "Hearing Farah: driving 900 metres isn't a choice, it's the missing crossing — sounds like it's about the kids being safe. Close?",
  "cm-chidi-ratrun":
    "Hearing Chidi: the cut-through traffic has taken the street from the people on it — safety first, but also whose street it is. Close?",
  "cm-gus-evening":
    "Hearing Gus: calm mornings, yes — but not at the price of a street that's dead by nine. Close?",
  "cm-hana-assembly":
    "Hearing Hana: the people who walk it want a real say before decisions land, not after. Close?",
  "cm-farah-wish":
    "Hearing Farah: kids on bikes, not brakes — one safe crossing, wide pavements, and this isn't anti-car. Close?",
  "cm-gus-agree":
    "Hearing Gus: the crossing done right serves the lively street too — that's common ground, not compromise. Close?",
};

/**
 * The canned mirror for a circle-message RESOURCE url, or null. Matches only
 * the seeded persona resources (`…/circle-messages/<seed-name>.ttl`) — the
 * key set above is closed, so nothing a visitor writes can resolve here.
 */
export function personaMirrorFor(resourceUrl: string): string | null {
  const m = /\/circle-messages\/([^/]+)\.ttl$/.exec(resourceUrl);
  const name = m?.[1];
  if (name === undefined) return null;
  return PERSONA_MIRRORS[name] ?? null;
}
