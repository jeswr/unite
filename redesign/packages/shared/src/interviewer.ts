import { INTERVIEW_STAGES } from './stages.js';

/** Evaluative or steering phrases the interviewer and facilitator may never use (section 6.1). */
export const BANNED_PHRASES: readonly string[] = [
  'great',
  'good point',
  'wonderful',
  'I think',
  'I believe',
  'in my opinion',
  'you should',
  'have you considered',
  'many people',
  'most people',
  'other people say',
  'others have said',
  'for example',
  'such as',
  'e.g.',
  'studies show',
  'research shows',
  'the fact is',
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matched case-insensitively on word boundaries: "great" does not match "greater". */
const bannedPatterns = BANNED_PHRASES.map(
  (p) => [p, new RegExp(`(?<![\\p{L}\\p{N}])${escape(p).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu')] as const,
);

/** The banned phrases found in `text`, in list order. */
export function findBannedPhrases(text: string): string[] {
  return bannedPatterns.filter(([, re]) => re.test(text)).map(([p]) => p);
}

const URL_PATTERN = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|org|net|io|uk|gov|edu)\b/i;
const PERCENT_PATTERN = /\d\s*%/;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const MAX_REPLY_WORDS = 70;

export interface InterviewerReply {
  acknowledgement: string;
  question: string;
}

export interface ReplyCheck {
  ok: boolean;
  /** Plain descriptions of each rule broken, to send back to the model on a retry. */
  failures: string[];
}

/** The text shown to the person: the acknowledgement, a space, and the question. */
export function replyText(reply: InterviewerReply): string {
  return [reply.acknowledgement.trim(), reply.question.trim()].filter(Boolean).join(' ');
}

/**
 * Rule 9: every interviewer reply passes this before it is stored or shown. Fails when the
 * question does not have exactly one question mark, the reply is over 70 words, it uses a banned
 * phrase, or it contains a URL or a percentage.
 */
export function validateInterviewerReply(reply: InterviewerReply, stage: number): ReplyCheck {
  const failures: string[] = [];
  const info = INTERVIEW_STAGES[stage];
  if (!info?.aiTurn) failures.push(`stage ${stage} is not a stage where the interviewer speaks`);
  const marks = (reply.question.match(/\?/g) ?? []).length;
  if (marks !== 1) failures.push(`the question must contain exactly one question mark (it has ${marks})`);
  const text = replyText(reply);
  const words = countWords(text);
  if (words > MAX_REPLY_WORDS) failures.push(`the reply is ${words} words, over the limit of ${MAX_REPLY_WORDS}`);
  const banned = findBannedPhrases(text);
  if (banned.length) failures.push(`it uses words that judge or steer: ${banned.map((b) => `"${b}"`).join(', ')}`);
  if (URL_PATTERN.test(text)) failures.push('it contains a web address');
  if (PERCENT_PATTERN.test(text)) failures.push('it contains a percentage');
  return { ok: failures.length === 0, failures };
}

/* ------------------------------------------------------------- leading wording */

/** The fallback for checkLeading (section 6.3) when no AI is available. */
export const LEADING_PHRASES: readonly string[] = ["don't you", "wouldn't you agree", 'should we not', 'obviously'];
const leadingPatterns = LEADING_PHRASES.map(
  (p) => [p, new RegExp(`(?<![\\p{L}\\p{N}])${escape(p).replace(/'/g, "['’]").replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu')] as const,
);

/** The leading phrases from the fallback list found in `text`. */
export function findLeadingPhrases(text: string): string[] {
  return leadingPatterns.filter(([, re]) => re.test(text)).map(([p]) => p);
}
