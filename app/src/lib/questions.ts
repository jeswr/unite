// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The question-inbox detector (design/v2/05 §1; build plan design/v2/07 §3
// V4): a DETERMINISTIC, conservative lexical heuristic — in the
// `sensitive.ts` mold — that finds recurring question-shaped needs in a
// conversation which a practitioner/expert could answer ("has anyone done
// this?" / "what would it cost?" / "is that even legal?"). No ML anywhere:
// interrogative FORM (a sentence ending in "?") plus a RECURRENCE floor
// (the same theme asked across ≥ `recurrenceFloor` distinct turns).
//
// HONESTY (no over-claim): a lexical scan catches the obvious cases; it is
// not a classifier. False negatives are accepted (the notetaker refines by
// ASKING — 05 §1); false positives on room-directed social questions are the
// failure mode to avoid, so a question addressed to the room ("what do YOU
// think?") is conservatively excluded — an expert answers the community's
// factual questions, not its conversational ones.
//
// This module also exports the shared turn-scanning toolkit (sentence
// segmentation, content keywords) that `readiness.ts` — the same mold —
// composes.

/** One conversation turn (a circle chat message), as the caller reads it. */
export interface ConversationTurn {
  /** The message resource IRI (the evidence link target). */
  readonly id: string;
  /** The author's WebID. */
  readonly author: string;
  /** The message free text. */
  readonly text: string;
  /** `dct:created` ISO dateTime (ordering only — never a clock read). */
  readonly created: string;
}

/** A sentence with its terminal punctuation (segmentation like 03 §2's). */
export interface Sentence {
  /** The trimmed sentence text, terminal punctuation included. */
  readonly text: string;
  /** True when the sentence ends in a question mark. */
  readonly interrogative: boolean;
}

/** Split free text into trimmed sentences on `.`/`!`/`?` and newlines. */
export function segmentSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const matches = text.match(/[^.!?\n]+[.!?]*/g) ?? [];
  for (const raw of matches) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    out.push({ text: trimmed, interrogative: /\?\s*$/.test(trimmed) });
  }
  return out;
}

// Function words + interrogative leads + chat noise, dropped before theme
// matching. Deliberately curated and fixture-pinned — NOT a general NLP
// stopword list; content words ("crossing", "cost", "garden") must survive.
const STOPWORDS: ReadonlySet<string> = new Set([
  // articles / conjunctions / prepositions
  "the",
  "and",
  "but",
  "for",
  "nor",
  "not",
  "with",
  "about",
  "into",
  "onto",
  "from",
  "over",
  "under",
  "again",
  "once",
  "out",
  "off",
  "than",
  "too",
  "very",
  "just",
  // interrogatives + auxiliaries
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "when",
  "where",
  "whether",
  "are",
  "was",
  "were",
  "been",
  "being",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "having",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "ought",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "don't",
  "doesn't",
  "didn't",
  "can't",
  "couldn't",
  "wouldn't",
  "shouldn't",
  "won't",
  "hasn't",
  "haven't",
  // pronouns / determiners
  "i'm",
  "i've",
  "i'll",
  "i'd",
  "you",
  "your",
  "yours",
  "yourself",
  "we're",
  "we've",
  "we'll",
  "our",
  "ours",
  "they",
  "they're",
  "their",
  "them",
  "she",
  "he's",
  "she's",
  "it's",
  "its",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "some",
  "any",
  "all",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "others",
  "such",
  "only",
  "own",
  "same",
  "let's",
  "lets",
  // people-placeholders (the interrogative leads of 05 §1's examples)
  "anyone",
  "anybody",
  "someone",
  "somebody",
  "everyone",
  "everybody",
  "nobody",
  "something",
  "anything",
  "everything",
  "nothing",
  // chat noise
  "also",
  "even",
  "ever",
  "never",
  "always",
  "really",
  "actually",
  "maybe",
  "perhaps",
  "please",
  "thanks",
  "thank",
  "okay",
  "yes",
  "well",
  "still",
  "yet",
  "now",
  "then",
  "else",
  "get",
  "got",
  "gets",
  "getting",
  "going",
  "goes",
  "went",
  "one",
  "two",
  "know",
  "knows",
  "think",
  "thinks",
  "thought",
  "like",
  "likes",
  "want",
  "wants",
  "wanted",
  "sure",
  "people",
  "thing",
  "things",
  "way",
  "lot",
  "bit",
  "kind",
  "sort",
  "much",
  "many",
  "quite",
  "right",
]);

/**
 * The content keywords of a text: lowercased word tokens (≥3 chars, apostrophes
 * kept) minus the curated stopword list — sorted, unique. The deterministic
 * theme signature recurrence is measured over.
 */
export function contentKeywords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  const out = new Set<string>();
  for (const raw of tokens) {
    const token = raw.replace(/^['-]+|['-]+$/g, "");
    if (token.length < 3) continue;
    if (STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return [...out].sort();
}

const ROOM_DIRECTED = /\b(you|your|yours|yourself|yourselves)\b/;

/**
 * Is this sentence a question an expert could be summoned for? Conservative:
 * interrogative form (ends in "?") and NOT room-directed (second-person
 * questions are the circle talking to itself, not a knowledge need).
 */
export function isAnswerableQuestion(sentence: Sentence): boolean {
  if (!sentence.interrogative) return false;
  if (ROOM_DIRECTED.test(sentence.text.toLowerCase())) return false;
  return true;
}

/** One matched question sentence, linked to the turn it came from. */
export interface QuestionInstance {
  readonly turnId: string;
  readonly author: string;
  readonly created: string;
  /** The question sentence verbatim. */
  readonly text: string;
  /** Its content keywords (the grouping signature). */
  readonly keywords: readonly string[];
}

/** A recurring question-shaped need — one question-inbox entry (05 §1). */
export interface DetectedQuestion {
  /** The recurring theme keywords (each in ≥2 distinct turns), sorted. */
  readonly theme: readonly string[];
  /** Distinct turns the theme was asked in (the recurrence count). */
  readonly turnCount: number;
  /** Distinct askers, sorted. */
  readonly askers: readonly string[];
  /** Every matched question, each linked to its turn (the evidence). */
  readonly instances: readonly QuestionInstance[];
}

export interface DetectQuestionsOptions {
  /** Surface a theme only when asked in ≥ this many DISTINCT turns (default 2). */
  readonly recurrenceFloor?: number;
}

/** Canonical instance ordering: created, then turn id, then sentence text. */
function compareInstances(a: QuestionInstance, b: QuestionInstance): number {
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  if (a.turnId !== b.turnId) return a.turnId < b.turnId ? -1 : 1;
  return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
}

/**
 * Detect the recurring question-shaped needs in a conversation (the
 * question-inbox signal, 05 §1). Pure + deterministic — invariant to input
 * ordering. Grouping is lexical: questions sharing ≥1 content keyword form a
 * theme (connected components); a theme surfaces only when asked in
 * ≥ `recurrenceFloor` distinct turns. Keyword-less questions ("Why?") cannot
 * recur and are never surfaced alone — the notetaker's job, not the machine's.
 */
export function detectQuestions(
  turns: readonly ConversationTurn[],
  options: DetectQuestionsOptions = {},
): DetectedQuestion[] {
  const recurrenceFloor = Math.max(1, options.recurrenceFloor ?? 2);

  // Canonical order first, so output is invariant to input ordering.
  const instances: QuestionInstance[] = [];
  for (const turn of turns) {
    for (const sentence of segmentSentences(turn.text)) {
      if (!isAnswerableQuestion(sentence)) continue;
      instances.push({
        turnId: turn.id,
        author: turn.author,
        created: turn.created,
        text: sentence.text,
        keywords: contentKeywords(sentence.text),
      });
    }
  }
  instances.sort(compareInstances);

  // Union-find over instances sharing ≥1 keyword (order-invariant grouping).
  const parent = instances.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== undefined && parent[r] !== r) r = parent[r] ?? r;
    // path compression
    let c = x;
    while (parent[c] !== undefined && parent[c] !== r) {
      const next = parent[c] ?? r;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const byKeyword = new Map<string, number>();
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    if (inst === undefined) continue;
    for (const kw of inst.keywords) {
      const first = byKeyword.get(kw);
      if (first === undefined) byKeyword.set(kw, i);
      else union(first, i);
    }
  }

  const components = new Map<number, QuestionInstance[]>();
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    if (inst === undefined) continue;
    const root = find(i);
    const list = components.get(root);
    if (list === undefined) components.set(root, [inst]);
    else list.push(inst);
  }

  const out: DetectedQuestion[] = [];
  for (const member of components.values()) {
    const turnIds = new Set(member.map((m) => m.turnId));
    if (turnIds.size < recurrenceFloor) continue;
    // Theme = keywords recurring across ≥2 distinct turns of the component
    // (for a single-turn component below the floor this never runs).
    const turnsPerKeyword = new Map<string, Set<string>>();
    for (const m of member) {
      for (const kw of m.keywords) {
        const set = turnsPerKeyword.get(kw);
        if (set === undefined) turnsPerKeyword.set(kw, new Set([m.turnId]));
        else set.add(m.turnId);
      }
    }
    const theme = [...turnsPerKeyword.entries()]
      .filter(([, ids]) => ids.size >= 2)
      .map(([kw]) => kw)
      .sort();
    const askers = [...new Set(member.map((m) => m.author))].sort();
    out.push({ theme, turnCount: turnIds.size, askers, instances: member });
  }

  out.sort((a, b) => {
    if (b.turnCount !== a.turnCount) return b.turnCount - a.turnCount;
    if (b.askers.length !== a.askers.length) return b.askers.length - a.askers.length;
    const at = a.theme.join(" ");
    const bt = b.theme.join(" ");
    if (at !== bt) return at < bt ? -1 : 1;
    const ai = a.instances[0]?.turnId ?? "";
    const bi = b.instances[0]?.turnId ?? "";
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  return out;
}
