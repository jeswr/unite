// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The drafter CHARACTERIZATION SET (design/v2 03 §2 fixture plan + 07 §5):
// persona and crafted utterances — cue-hit, cue-less short, cue-less long,
// multi-sentence, sensitive-tripping, hostile-string — each pinning the EXACT
// expected DraftAtoms and the rendered mirror sentence. Deterministic: same
// utterance, same mirror, byte for byte.

import { describe, expect, it } from "vitest";
import { fut, MAXNEEF_CONCEPTS } from "./fut.js";
import {
  codeNeed,
  compressClaim,
  draftMirror,
  MIRROR_DRAFT_ASSISTANT,
  MIRROR_DRAFT_PLAN,
  MIRROR_DRAFT_TOOL,
  NEED_KEYWORDS,
  SHORT_UTTERANCE_MAX,
  segmentSentences,
} from "./mirror-draft.js";

describe("segmentSentences (step 1)", () => {
  it("splits on ./!/? + newlines, trims, drops empties", () => {
    expect(segmentSentences("One. Two!  Three?\nFour\n\n")).toEqual([
      "One.",
      "Two!",
      "Three?",
      "Four",
    ]);
    expect(segmentSentences("   ")).toEqual([]);
  });

  it("keeps simple prose intact within a sentence", () => {
    expect(segmentSentences("I want kids on bikes, not brakes.")).toEqual([
      "I want kids on bikes, not brakes.",
    ]);
  });
});

describe("draftMirror — the persona utterances (exact pins)", () => {
  it("a want-cue utterance drafts claim + coded need and renders the mirror", () => {
    const r = draftMirror("I want to hear kids on bikes, not brakes, crossing safely to school.");
    expect(r.kind).toBe("draft");
    expect(r.atoms).toEqual([
      {
        kind: "claim",
        content: "I want to hear kids on bikes, not brakes, crossing safely to school.",
      },
      {
        kind: "need",
        content: "I want to hear kids on bikes, not brakes, crossing safely to school.",
        needConcept: fut("maxneef-protection"),
      },
    ]);
    expect(r.mirror).toBe(
      "Hearing you: i want to hear kids on bikes, not brakes, crossing safely to school — sounds like it's about feeling safe. Close?",
    );
    expect(r.provenance).toEqual({ tool: MIRROR_DRAFT_TOOL, plan: MIRROR_DRAFT_PLAN });
  });

  it("the 02 §4 morning-gripe utterance (multi-sentence claim selection)", () => {
    const r = draftMirror(
      "Mornings are chaos here. The crossing is unsafe and the cars go too fast. My kids walk it every day.",
    );
    expect(r.kind).toBe("draft");
    // Sentence 2 carries two gripe cues (unsafe + too fast) — highest score.
    expect(r.atoms[0]).toEqual({
      kind: "claim",
      content: "The crossing is unsafe and the cars go too fast.",
    });
    expect(r.atoms[1]).toEqual({
      kind: "need",
      content: "The crossing is unsafe and the cars go too fast.",
      needConcept: fut("maxneef-protection"),
    });
    expect(r.mirror).toBe(
      "Hearing you: the crossing is unsafe and the cars go too fast — sounds like it's about feeling safe. Close?",
    );
  });

  it("earliest-sentence tie-break between equal cue scores", () => {
    const r = draftMirror("I want a bench on the corner. I wish the bus ran later.");
    expect(r.atoms[0]?.content).toBe("I want a bench on the corner.");
  });

  it("a memory-cue utterance drafts (memory cues are claims too)", () => {
    const r = draftMirror("I remember when the street was full of kids playing out after school.");
    expect(r.kind).toBe("draft");
    expect(r.atoms[0]?.content).toBe(
      "I remember when the street was full of kids playing out after school.",
    );
    // "playing" → idleness (play- stem).
    expect(r.atoms[1]).toMatchObject({ kind: "need", needConcept: fut("maxneef-idleness") });
  });

  it("a participation utterance codes participation", () => {
    const r = draftMirror("Nobody asked us. We should get a say before the council decides.");
    expect(r.kind).toBe("draft");
    expect(r.atoms[1]).toMatchObject({ kind: "need", needConcept: fut("maxneef-participation") });
  });

  it("a value cue drafts a conservative ValueStatement", () => {
    const r = draftMirror(
      "The street should be shared fairly. What I care about is how we treat each other out there.",
    );
    expect(r.kind).toBe("draft");
    const value = r.atoms.find((a) => a.kind === "value");
    // Cue-list order is the deterministic tie-break: "treat each other"
    // (benevolence) precedes the fairness cues in VALUE_CUES.
    expect(value).toEqual({
      kind: "value",
      content: "What I care about is how we treat each other out there.",
      valueConcept: fut("schwartz-benevolence"),
    });
  });

  it("a fairness cue alone drafts universalism", () => {
    const r = draftMirror("The street should be shared fairly.");
    expect(r.atoms.find((a) => a.kind === "value")).toEqual({
      kind: "value",
      content: "The street should be shared fairly.",
      valueConcept: fut("schwartz-universalism"),
    });
  });

  it("no value atom without an explicit value cue (step 4 conservatism)", () => {
    const r = draftMirror("I want the crossing fixed before winter.");
    expect(r.atoms.some((a) => a.kind === "value")).toBe(false);
  });
});

describe("draftMirror — cue-less input (never bluff)", () => {
  it("cue-less SHORT input mirrors the whole utterance, claim-only when uncodeable", () => {
    const r = draftMirror("Quiet corners matter to me");
    expect(r.kind).toBe("draft");
    expect(r.atoms).toEqual([{ kind: "claim", content: "Quiet corners matter to me" }]);
    expect(r.mirror).toBe("Hearing you: quiet corners matter to me. Close?");
  });

  it(`cue-less LONG input (> ${SHORT_UTTERANCE_MAX} chars) drafts NOTHING and asks`, () => {
    const long = `${"When the light comes over the rooftops in June the whole road glows and everyone walks differently, ".repeat(3)}that is the town I know`;
    expect(long.length).toBeGreaterThan(SHORT_UTTERANCE_MAX);
    const r = draftMirror(long);
    expect(r.kind).toBe("ask");
    expect(r.atoms).toEqual([]);
    expect(r.mirror).toBeNull();
  });

  it("empty input is nothing", () => {
    expect(draftMirror("").kind).toBe("nothing");
    expect(draftMirror("   \n ").kind).toBe("nothing");
  });
});

describe("draftMirror — the C4 pre-screen (step 5; corrected 02 §4.1 semantics)", () => {
  it("re-selects the claim from a NON-TRIPPING sentence (never rewrites)", () => {
    const r = draftMirror(
      "My disability makes this crossing terrifying. The crossing needs to be safe for everyone.",
    );
    expect(r.kind).toBe("draft");
    // The tripping sentence ("my disability…") is NOT the claim even though it
    // scores cues; the surviving sentence — the person's own words, unedited —
    // is selected instead.
    expect(r.atoms[0]).toEqual({
      kind: "claim",
      content: "The crossing needs to be safe for everyone.",
    });
    for (const atom of r.atoms) {
      expect(atom.content.toLowerCase()).not.toContain("my disability");
    }
  });

  it("when EVERY candidate trips, nothing is drafted and the boundary beat runs", () => {
    const r = draftMirror("My disability makes this crossing terrifying.");
    expect(r.kind).toBe("boundary");
    expect(r.atoms).toEqual([]);
    expect(r.mirror).toBeNull();
    expect(r.boundary).toMatchObject({ domain: "health", term: "my disability" });
  });

  it("a short cue-less sensitive utterance is boundary too, not a whole-utterance claim", () => {
    const r = draftMirror("This street and my anxiety do not mix");
    expect(r.kind).toBe("boundary");
    expect(r.atoms).toEqual([]);
    expect(r.boundary).toMatchObject({ domain: "health" });
  });

  it("a tripping VALUE sentence is dropped without vetoing the claim", () => {
    const r = draftMirror(
      "The crossing needs to be safe. People should treat each other well despite my anxiety about it.",
    );
    expect(r.kind).toBe("draft");
    expect(r.atoms[0]).toEqual({ kind: "claim", content: "The crossing needs to be safe." });
    expect(r.atoms.some((a) => a.kind === "value")).toBe(false);
  });
});

describe("draftMirror — hostile input stays data (03 §2)", () => {
  it("a hostile string becomes at most a hostile STRING in an atom", () => {
    const hostile = '<script>alert("x")</script> should never decide anything here.';
    const r = draftMirror(hostile);
    expect(r.kind).toBe("draft");
    expect(r.atoms[0]?.content).toBe(hostile); // data, verbatim, not executed
  });

  it("caps the claim at the fut:Claim limit (≤500 chars)", () => {
    const r = draftMirror(`It should ${"really ".repeat(120)}change.`);
    expect(r.kind).toBe("draft");
    expect((r.atoms[0]?.content ?? "").length).toBeLessThanOrEqual(500);
  });
});

describe("determinism + the seam", () => {
  it("same utterance, same result, byte for byte", () => {
    const u = "I want to hear kids on bikes, not brakes. What matters is how we treat each other.";
    expect(draftMirror(u)).toEqual(draftMirror(u));
  });

  it("the DecompositionAssistant seam returns atoms + provenance (C6)", async () => {
    const res = await MIRROR_DRAFT_ASSISTANT.decompose("I want the crossing fixed.");
    expect(res.atoms.length).toBeGreaterThan(0);
    expect(res.provenance).toEqual({ tool: "mirror-draft", plan: MIRROR_DRAFT_PLAN });
  });

  it("an ask outcome proposes nothing through the seam either", async () => {
    const long = `${"the light in June over the rooftops and the way everyone walks differently in it, ".repeat(3)}that is the town`;
    const res = await MIRROR_DRAFT_ASSISTANT.decompose(long);
    expect(res.atoms).toEqual([]);
  });
});

describe("the lexicon tables (fixture-pinned data)", () => {
  it("NEED_KEYWORDS stays in the canonical MAXNEEF order (the tie-break proof)", () => {
    expect(NEED_KEYWORDS.map(([name]) => name)).toEqual(MAXNEEF_CONCEPTS.map((c) => c.name));
  });

  it("codeNeed picks the top-scoring concept; null with no match", () => {
    expect(codeNeed("the crossing is unsafe and the traffic is dangerous")).toBe("protection");
    expect(codeNeed("we can not afford the fares or the rent")).toBe("subsistence");
    expect(codeNeed("the moon is nice")).toBeNull();
  });

  it("keyword matching is word-bounded (no 'essay' → 'a say')", () => {
    expect(codeNeed("an essay about restaurants")).toBeNull();
  });
});

describe("compressClaim (step 6)", () => {
  it("strips leading connectives, lowercases the lead, drops trailing punctuation", () => {
    expect(compressClaim("And honestly, The crossing needs fixing!")).toBe(
      "the crossing needs fixing",
    );
  });

  it("caps the clause at a word boundary with an ellipsis", () => {
    const long = compressClaim(`the ${"very ".repeat(40)}long clause`);
    expect(long.length).toBeLessThanOrEqual(91);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toContain("  ");
  });
});
