// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Action-team readiness detection (design/v2/05 §3; build plan design/v2/07
// §3 V4): a DETERMINISTIC lexical scan in the `sensitive.ts`/`questions.ts`
// mold — recurrence of first-person offer/ownership turns ("someone
// should…", "I could…", named skills, offered time) over a converging
// theme. No ML anywhere in it.
//
// The output feeds THE most persuasion-shaped move the engine makes — the
// private 2–4-person nudge — so it carries the strongest seam in the system:
// every signal is EVIDENCE-LINKED to the specific matched turns (the
// recurring turns + the offers of time/skill that matched, each one linked)
// so the "why me?" tap can cite them literally (03 §6's nudge row).
// Privacy by construction: the evidence lists ONLY the named recipients'
// turns — a signal renders nothing about anyone else.
//
// The "at most once per theme per person" promise is the SURFACE's to keep;
// this module makes it keepable by minting a stable `themeKey` the caller
// dedupes on (same theme, same key — recomputation-safe).

import { type ConversationTurn, contentKeywords, segmentSentences } from "./questions.js";

/** The kind of matched cue. Only a SELF-offer (offer/time/skill) qualifies a
 * recipient — "someone should…" names a theme, it doesn't volunteer. */
export type OfferKind = "ownership" | "offer" | "time" | "skill";

// The cue lexicon (fixture-pinned data, not code — the 05 §3 list).
// Matching is word-boundary-aware ("i could" never matches "i couldn't").
const CUES: ReadonlyArray<readonly [OfferKind, readonly string[]]> = [
  [
    "ownership",
    ["someone should", "somebody should", "someone ought to", "we should", "we ought to"],
  ],
  [
    "offer",
    [
      "i could",
      "i can help",
      "i can do",
      "i can take",
      "i can bring",
      "i can make",
      "i can organise",
      "i can organize",
      "i'll take",
      "i'll bring",
      "i'll help",
      "i'll do",
      "i'd be happy to",
      "i'd be glad to",
      "happy to help",
      "count me in",
      "i'm in",
      "i'm up for",
      "sign me up",
      "i volunteer",
    ],
  ],
  [
    "time",
    [
      "i'm free",
      "i have time",
      "i've got time",
      "i can make time",
      "this weekend",
      "on saturday",
      "on sunday",
      "after work",
      "in the evenings",
      "an hour a week",
    ],
  ],
  [
    "skill",
    [
      "i work as",
      "i used to work",
      "i've built",
      "i've done this",
      "i've made",
      "i know how to",
      "i can design",
      "i can draw",
      "i do this for a living",
      "my day job",
      "i'm trained",
    ],
  ],
];

const isLetter = (ch: string | undefined): boolean => ch !== undefined && /[a-z0-9']/.test(ch);

/** Word-boundary-aware term search over a lowercased haystack. */
function matchesTerm(haystack: string, term: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(term, from);
    if (at < 0) return false;
    const before = at === 0 ? undefined : haystack[at - 1];
    const after = haystack[at + term.length];
    if (!isLetter(before) && !isLetter(after)) return true;
    from = at + 1;
  }
}

/** One matched offer/ownership sentence, linked to the turn it came from. */
export interface OfferHit {
  readonly turnId: string;
  readonly author: string;
  readonly created: string;
  /** The matched sentence verbatim (the "why me?" evidence text). */
  readonly sentence: string;
  readonly kind: OfferKind;
  /** The cue term that matched (for the seam's literal restatement). */
  readonly term: string;
  /** The sentence's content keywords (the theme signature). */
  readonly keywords: readonly string[];
}

/** Canonical hit ordering: created, turn id, sentence, kind. */
function compareHits(a: OfferHit, b: OfferHit): number {
  if (a.created !== b.created) return a.created < b.created ? -1 : 1;
  if (a.turnId !== b.turnId) return a.turnId < b.turnId ? -1 : 1;
  if (a.sentence !== b.sentence) return a.sentence < b.sentence ? -1 : 1;
  return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
}

/**
 * Scan a conversation for offer/ownership cues. Pure + deterministic;
 * exported for the seam and for characterization tests. At most one hit per
 * (sentence, kind): the FIRST matching term in lexicon order.
 */
export function scanOffers(turns: readonly ConversationTurn[]): OfferHit[] {
  const hits: OfferHit[] = [];
  for (const turn of turns) {
    for (const sentence of segmentSentences(turn.text)) {
      const lower = sentence.text.toLowerCase();
      for (const [kind, terms] of CUES) {
        for (const term of terms) {
          if (!matchesTerm(lower, term)) continue;
          hits.push({
            turnId: turn.id,
            author: turn.author,
            created: turn.created,
            sentence: sentence.text,
            kind,
            term,
            keywords: contentKeywords(sentence.text),
          });
          break; // one hit per (sentence, kind)
        }
      }
    }
  }
  hits.sort(compareHits);
  return hits;
}

/** A recurring theme turn a recipient "kept coming back to" (linked). */
export interface ThemeTurnRef {
  readonly turnId: string;
  readonly author: string;
  readonly created: string;
}

/** One action-team readiness signal — the private-nudge input (05 §3). */
export interface ReadinessSignal {
  /** Stable dedupe key (sorted theme keywords) — "once per theme per person". */
  readonly themeKey: string;
  /** The converging theme keywords (each in ≥2 distinct offer turns), sorted. */
  readonly theme: readonly string[];
  /** The 2–4 specific people to nudge — each with a self-offer + recurrence. */
  readonly recipients: readonly string[];
  /** The recipients' matched offer/ownership turns, each one linked. */
  readonly offers: readonly OfferHit[];
  /** The recipients' recurring theme turns (the "kept coming back" evidence). */
  readonly recurringTurns: readonly ThemeTurnRef[];
}

export interface DetectReadinessOptions {
  /** A team needs at least this many qualifying people (default 2). */
  readonly minRecipients?: number;
  /** Nudge at most this many people (default 4 — 05 §3's "2–4"). */
  readonly maxRecipients?: number;
  /** "Kept coming back": theme turns required per recipient (default 2). */
  readonly minThemeTurnsPerPerson?: number;
}

/**
 * Detect action-team readiness (05 §3). Pure + deterministic — invariant to
 * input ordering. A theme is READY when ≥ `minRecipients` people each have
 * (a) a first-person SELF-offer (offer/time/skill — ownership alone never
 * qualifies anyone) on the theme and (b) ≥ `minThemeTurnsPerPerson` turns
 * matching the theme (recurrence). Recipients are capped at `maxRecipients`,
 * picked deterministically (most self-offers, then most theme turns, then
 * earliest offer, then WebID).
 */
export function detectReadiness(
  turns: readonly ConversationTurn[],
  options: DetectReadinessOptions = {},
): ReadinessSignal[] {
  const minRecipients = Math.max(1, options.minRecipients ?? 2);
  const maxRecipients = Math.max(minRecipients, options.maxRecipients ?? 4);
  const minThemeTurns = Math.max(1, options.minThemeTurnsPerPerson ?? 2);

  const hits = scanOffers(turns);
  if (hits.length === 0) return [];

  // Union-find over hits sharing ≥1 keyword — the converging-theme grouping
  // (the questions.ts mold; order-invariant).
  const parent = hits.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== undefined && parent[r] !== r) r = parent[r] ?? r;
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
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (hit === undefined) continue;
    for (const kw of hit.keywords) {
      const first = byKeyword.get(kw);
      if (first === undefined) byKeyword.set(kw, i);
      else union(first, i);
    }
  }
  const components = new Map<number, OfferHit[]>();
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (hit === undefined) continue;
    const root = find(i);
    const list = components.get(root);
    if (list === undefined) components.set(root, [hit]);
    else list.push(hit);
  }

  // Pre-compute every turn's keywords once (theme-turn matching), in
  // canonical turn order.
  const canonicalTurns = [...turns].sort((a, b) => {
    if (a.created !== b.created) return a.created < b.created ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const turnKeywords = canonicalTurns.map((t) => ({
    turn: t,
    keywords: new Set(contentKeywords(t.text)),
  }));

  const signals: ReadinessSignal[] = [];
  for (const member of components.values()) {
    // Theme = keywords recurring across ≥2 distinct offer turns.
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
    if (theme.length === 0) continue; // nothing converging here
    const themeSet = new Set(theme);

    // Theme turns: every turn (offer or not) touching the theme, per author.
    const themeTurnsByAuthor = new Map<string, ThemeTurnRef[]>();
    for (const { turn, keywords } of turnKeywords) {
      let touches = false;
      for (const kw of keywords) {
        if (themeSet.has(kw)) {
          touches = true;
          break;
        }
      }
      if (!touches) continue;
      const ref: ThemeTurnRef = { turnId: turn.id, author: turn.author, created: turn.created };
      const list = themeTurnsByAuthor.get(turn.author);
      if (list === undefined) themeTurnsByAuthor.set(turn.author, [ref]);
      else list.push(ref);
    }

    // Qualify recipients: a SELF-offer on the theme + recurrence.
    const selfOffersByAuthor = new Map<string, OfferHit[]>();
    for (const m of member) {
      if (m.kind === "ownership") continue;
      const list = selfOffersByAuthor.get(m.author);
      if (list === undefined) selfOffersByAuthor.set(m.author, [m]);
      else list.push(m);
    }
    const qualified: string[] = [];
    for (const author of [...selfOffersByAuthor.keys()].sort()) {
      const themeTurns = themeTurnsByAuthor.get(author) ?? [];
      if (themeTurns.length >= minThemeTurns) qualified.push(author);
    }
    if (qualified.length < minRecipients) continue;

    qualified.sort((a, b) => {
      const ao = selfOffersByAuthor.get(a)?.length ?? 0;
      const bo = selfOffersByAuthor.get(b)?.length ?? 0;
      if (bo !== ao) return bo - ao;
      const at = themeTurnsByAuthor.get(a)?.length ?? 0;
      const bt = themeTurnsByAuthor.get(b)?.length ?? 0;
      if (bt !== at) return bt - at;
      const ae = selfOffersByAuthor.get(a)?.[0]?.created ?? "";
      const be = selfOffersByAuthor.get(b)?.[0]?.created ?? "";
      if (ae !== be) return ae < be ? -1 : 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const recipients = qualified.slice(0, maxRecipients).sort();
    const recipientSet = new Set(recipients);

    // Evidence is RECIPIENT-SCOPED: nothing about anyone else leaves here.
    const offers = member.filter((m) => recipientSet.has(m.author)).sort(compareHits);
    const recurringTurns = recipients
      .flatMap((r) => themeTurnsByAuthor.get(r) ?? [])
      .sort((a, b) => {
        if (a.created !== b.created) return a.created < b.created ? -1 : 1;
        return a.turnId < b.turnId ? -1 : a.turnId > b.turnId ? 1 : 0;
      });

    signals.push({ themeKey: theme.join("+"), theme, recipients, offers, recurringTurns });
  }

  signals.sort((a, b) => {
    if (b.recipients.length !== a.recipients.length) {
      return b.recipients.length - a.recipients.length;
    }
    if (b.offers.length !== a.offers.length) return b.offers.length - a.offers.length;
    return a.themeKey < b.themeKey ? -1 : a.themeKey > b.themeKey ? 1 : 0;
  });
  return signals;
}
