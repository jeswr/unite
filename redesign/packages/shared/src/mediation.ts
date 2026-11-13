import type { MediationStep, MediationTurn, Reason, ReactionValue } from './schemas.js';

/**
 * Talk it through (section 12.1): the pure parts. The step machine's limits, the choice of the
 * other side's reasons for step 2, and the fallback that drafts a reason, a wording and a question
 * from the person's own words.
 */

export interface MediationStepInfo {
  n: MediationStep;
  key: 'why' | 'other_side' | 'wording' | 'question';
  /** The step in plain words, for the person. */
  title: string;
  /** Person turns before the step may end (when the model says it is complete). */
  minTurns: number;
  /** Person turns after which the step ends regardless. */
  maxTurns: number;
}

export const MEDIATION_STEPS: readonly MediationStepInfo[] = [
  { n: 1, key: 'why', title: 'What is behind your answer', minTurns: 1, maxTurns: 2 },
  { n: 2, key: 'other_side', title: 'Reasons from people who answered differently', minTurns: 1, maxTurns: 2 },
  { n: 3, key: 'wording', title: 'A wording others could agree with', minTurns: 1, maxTurns: 2 },
  { n: 4, key: 'question', title: 'What you would want checked', minTurns: 1, maxTurns: 1 },
];

export function mediationStep(step: number): MediationStepInfo | undefined {
  return MEDIATION_STEPS.find((s) => s.n === step);
}

/** Limits on what a person writes and on each draft item. */
export const MEDIATION_LIMITS = {
  /** One person turn, in characters. */
  turn: 1200,
  /** A reason, as on the direct route. */
  reason: 280,
  /** A question, stored as a reason with side `question`. */
  question: 280,
  /** A rewording: a statement's limits. */
  wordingChars: 300,
  wordingWords: 30,
} as const;

/** How many of the other side's reasons step 2 shows. */
export const OTHER_SIDE_MAX = 3;
/** For a person who answered "not sure": how many from each side. */
export const OTHER_SIDE_EACH_WHEN_UNSURE = 2;

type ReasonLike = Pick<Reason, 'id' | 'personId' | 'side' | 'createdAt'>;

/** The side of reasons a person who answered this way has not given: agree sees against, disagree sees for, not sure sees both. */
export function otherSides(answer: ReactionValue): ('for' | 'against')[] {
  if (answer === 'agree') return ['against'];
  if (answer === 'disagree') return ['for'];
  return ['for', 'against'];
}

const byArrival = (a: ReasonLike, b: ReasonLike) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The reasons step 2 shows (rule 8: by arrival order and distinct author, never by any count).
 * From the statement's reasons for or against, takes those on the side opposite the person's
 * answer, drops the person's own, keeps the earliest reason of each author, and returns the first
 * three by arrival; for "not sure", the first two of each side. The result is in arrival order.
 */
export function pickOtherSide<R extends ReasonLike>(reasons: readonly R[], answer: ReactionValue, personId: string): R[] {
  const sides = otherSides(answer);
  const seen = new Set<string>();
  const earliest: R[] = [];
  for (const r of [...reasons].sort(byArrival)) {
    if (r.side === 'question' || !sides.includes(r.side) || r.personId === personId) continue;
    if (seen.has(r.personId)) continue;
    seen.add(r.personId);
    earliest.push(r);
  }
  if (answer !== 'unsure') return earliest.slice(0, OTHER_SIDE_MAX);
  const each = (side: 'for' | 'against') => earliest.filter((r) => r.side === side).slice(0, OTHER_SIDE_EACH_WHEN_UNSURE);
  return [...each('for'), ...each('against')].sort(byArrival);
}

/** The side a reason from this answer defaults to. "Not sure" has none: the person chooses. */
export function defaultReasonSide(answer: ReactionValue): 'for' | 'against' | undefined {
  if (answer === 'agree') return 'for';
  if (answer === 'disagree') return 'against';
  return undefined;
}

const NOTHING = new Set(['no', 'none', 'nothing', 'nope', 'not really', 'no thanks', 'no thank you', 'nothing else', 'nothing more', 'no that is all', 'that is all']);

/** True for an answer that only says there is nothing to add: "no", "none", "nothing", "nothing else" and the like (in any case, with any punctuation). */
export function isNothingAnswer(text: string): boolean {
  const bare = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return bare === '' || NOTHING.has(bare);
}

/** Text cut to at most `maxChars` characters and `maxWords` words, at a word boundary. */
export function trimToLimit(text: string, maxChars: number, maxWords = Infinity): string {
  let words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length > maxWords) words = words.slice(0, maxWords);
  let out = words.join(' ');
  if (out.length <= maxChars) return out;
  while (words.length > 1 && words.join(' ').length > maxChars) words = words.slice(0, -1);
  out = words.join(' ');
  return out.length > maxChars ? out.slice(0, maxChars) : out;
}

export interface MediationDraftText {
  reason: string | null;
  wording: string | null;
  question: string | null;
}

/** A field kept only if it says something: null for an empty answer or one that is only "no", "none" or "nothing". */
function keep(text: string | undefined, maxChars: number, maxWords?: number): string | null {
  if (text === undefined || isNothingAnswer(text)) return null;
  const t = trimToLimit(text, maxChars, maxWords);
  return t ? t : null;
}

/**
 * The fallback drafts, in the person's own words: the first unskipped step 1 turn as the reason,
 * the last unskipped step 3 turn as the wording, and the last step 4 turn as the question, each
 * trimmed to its limit. Turns that say only "no", "none" or "nothing" are passed over, so a step
 * that was skipped or answered only that way gives nothing.
 */
export function mediationFallback(turns: readonly Pick<MediationTurn, 'role' | 'step' | 'text' | 'skipped'>[]): MediationDraftText {
  // A turn that only says "no" (to "anything you would change?") is not the answer; the one before it is.
  const said = (step: number) => turns.filter((t) => t.role === 'person' && t.step === step && !t.skipped && t.text.trim() && !isNothingAnswer(t.text));
  const step1 = said(1);
  const step3 = said(3);
  const step4 = said(4);
  return {
    reason: keep(step1[0]?.text, MEDIATION_LIMITS.reason),
    wording: keep(step3[step3.length - 1]?.text, MEDIATION_LIMITS.wordingChars, MEDIATION_LIMITS.wordingWords),
    question: keep(step4[step4.length - 1]?.text, MEDIATION_LIMITS.question),
  };
}
