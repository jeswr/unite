// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// THE EXPERT SURFACE's data + honesty model (design/v2 05 §1–2, 07 §3 V4):
//
//   • Experts enter LATE, summoned by the room's own recurring questions —
//     the question-inbox is lib/questions.ts (deterministic detection), and
//     the affordance simply DOES NOT EXIST until a stable question does
//     (`stableQuestion` returns null → nothing renders anywhere);
//   • the "verified" chip renders EXACTLY the strength of what was actually
//     verified, in two honest tiers (05 §2): STEWARD-INVITED (a social vouch
//     + the expert's own name-backed self-description — most pilot and ALL
//     demo experts) and INSTITUTION-ATTESTED (a federation-trust credential
//     whose seam NAMES ITS ISSUER). A ✓ never renders stronger than its
//     issuer — the steward-invited tier carries NO checkmark at all;
//   • the contribution grammar is options-with-trade-offs (the honest
//     broker): attributable, questionable, never "you should";
//   • the demo's expert is a PERSONA (Maria), staged and labeled as demo
//     voice (06 §2) — whether real supply sustains beyond invited pilots is
//     an open question the pitch names.

import { type ConversationTurn, type DetectedQuestion, detectQuestions } from "../lib/questions.js";

/** The two honest verification tiers (05 §2). */
export type ExpertTier = "steward-invited" | "institution-attested";

/** One expert record, as the surface renders it. */
export interface ExpertRecord {
  readonly name: string;
  /** The name-backed experience line ("8 years building these for two councils"). */
  readonly experience: string;
  readonly tier: ExpertTier;
  /** REQUIRED at institution-attested tier: the credential's named issuer. */
  readonly issuer?: string;
  /** Keywords this expert's experience matches (the question-inbox match). */
  readonly matches: readonly string[];
  /** True when this expert is demo staging (a persona, labeled). */
  readonly demoVoice: boolean;
}

/** The chip line for an expert — tier-honest, never stronger than its issuer. */
export function expertChipLabel(expert: ExpertRecord): string {
  if (expert.tier === "institution-attested" && expert.issuer !== undefined) {
    return `attested by ${expert.issuer} — checkable ✓`;
  }
  // Steward-invited: a social vouch, name-backed — NO checkmark to overclaim.
  return `invited by your stewards · ${expert.experience} — her account, her name behind it`;
}

/** The chip's seam: who stands behind the chip, literally (03 §6 row). */
export function expertChipSeam(expert: ExpertRecord): string {
  if (expert.tier === "institution-attested" && expert.issuer !== undefined) {
    return (
      `The ✓ is a credential from ${expert.issuer} — it names its issuer and is checkable; ` +
      "it says nothing more than that issuer verified."
    );
  }
  return (
    "No institution attested this — and unite won't fake a checkmark: what you see is a " +
    "steward's invitation plus the expert's own name-backed description of their experience."
  );
}

/** The demo's staged expert (06 §2: Maria is a persona and says so). */
export const MARIA: ExpertRecord = {
  name: "Maria",
  experience: "8 years building exactly these for two councils",
  tier: "steward-invited",
  matches: ["crossing", "crossings", "cost", "costs", "raised", "table", "zebra"],
  demoVoice: true,
};

/**
 * Maria's staged reply — the options-with-trade-offs grammar (05 §2):
 * options, costs, honest downsides; never "you should". Persona-side demo
 * content, labeled by the view.
 */
export const MARIA_REPLY =
  "There are three ways councils usually do this. Paint and signs is the cheap one — quick, " +
  "and it genuinely slows drivers for a while, but it floods in winter and fades by spring. " +
  "A zebra with a buildout costs more and takes a season of process. A raised table is the " +
  "one that changes driver behaviour for good, and it is the one budget committees defer. " +
  "Ask me why on any of these — that's what I'm here for.";

/**
 * The room's stable question, if one exists: the top recurring question-shaped
 * theme that MATCHES the expert's experience. Null until the conversation has
 * actually asked it in ≥2 distinct turns (05 §1's timing rule, structural:
 * no stable question → the expert affordance does not exist). Pure.
 */
export function stableQuestion(
  turns: readonly ConversationTurn[],
  expert: ExpertRecord,
): DetectedQuestion | null {
  const matches = new Set(expert.matches);
  for (const q of detectQuestions(turns, { recurrenceFloor: 2 })) {
    if (q.theme.some((kw) => matches.has(kw))) return q;
  }
  return null;
}

/** The notetaker's expert introduction (05 §2's exact register). */
export function expertIntro(expert: ExpertRecord, questionGloss: string): string {
  return (
    `You asked ${questionGloss}. The stewards invited ${expert.name} — she's spent ` +
    `${expert.experience.replace(/^8 years/, "eight years")}. She'll answer in this thread, ` +
    `in plain words. Ask her anything — "ask ${expert.name} why" works on anything she says.`
  );
}

/** The in-context consent ask before anything reaches the expert (02 §7). */
export function expertConsentAsk(expert: ExpertRecord): string {
  return (
    `We're asking ${expert.name} about the crossing. She'd see the group's question and the ` +
    "summary behind it — not the chat itself. Okay?"
  );
}

/** What the expert sees — stated on the surface, not implied (05 §2, P12). */
export const EXPERT_SEES =
  "She sees the question and the consented summary, with dissent and provenance attached — never the chat itself.";
