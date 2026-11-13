import { countWords, findBannedPhrases, type Feedback } from '@unite/shared';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import type { ChangeSince } from '../services/feedback/releases.js';
import { FEEDBACK_FIXED, FEEDBACK_FREE_QUESTION, FEEDBACK_REFUSED_PHRASES, FEEDBACK_SYSTEM, FEEDBACK_TOPICS, feedbackTurnMessage } from './prompts.js';

export { feedbackTurnMessage };

/**
 * The feedback interviewer (section 6.5). Code decides which question comes next; the model only
 * words it, and may ask one follow-up on a topic (two in the free mode). Every reply is checked
 * before it is stored or shown; one that fails is replaced by the fixed question. The person's
 * words go into `answers` unedited.
 *
 * Progress is kept in the record itself: every question asked adds one entry to `answers` (empty
 * until answered), so the last entry is the question waiting for an answer. The closing message
 * adds none, so the interview is finished when there are more interviewer messages than entries.
 */

export type FeedbackMode = Feedback['mode'];
type Answer = Feedback['answers'][number];
type Message = Feedback['messages'][number];

export interface FeedbackStep {
  key: string;
  question: string;
  /** How many follow-ups the model may ask on this step. */
  followUps: number;
}

export interface FeedbackPlan {
  /** Said before the first question. */
  intro: string;
  steps: FeedbackStep[];
}

// The wording itself is in prompts.ts, so that it is published with the rest.
export const GUIDED_INTRO = FEEDBACK_FIXED.guidedIntro;
export const FREE_INTRO = FEEDBACK_FIXED.freeIntro;
export const CHANGES_ELSE_QUESTION = FEEDBACK_FIXED.changesElse;
export const CLOSING_MESSAGE = FEEDBACK_FIXED.closing;
export const AFTER_CLOSING_MESSAGE = FEEDBACK_FIXED.afterClosing;

/** Phrases that argue with feedback or defend the product. A reply containing any is refused. */
export const DEFENSIVE_PHRASES = FEEDBACK_REFUSED_PHRASES;
export const MAX_FEEDBACK_REPLY_WORDS = 50;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defensivePatterns = DEFENSIVE_PHRASES.map(
  (p) =>
    [
      p,
      new RegExp(`(?<![\\p{L}\\p{N}])${escape(p).replace(/'/g, "['’]").replace(/that\['’\]s/, "that(?:['’]s|\\s+is)").replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu'),
    ] as const,
);

export function findDefensivePhrases(text: string): string[] {
  return defensivePatterns.filter(([, re]) => re.test(text)).map(([p]) => p);
}

/** The rules every feedback interviewer reply must pass. */
export function checkFeedbackReply(text: string): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const marks = (text.match(/\?/g) ?? []).length;
  if (marks > 1) failures.push(`it asks more than one question (${marks} question marks)`);
  if (marks === 0) failures.push('it does not ask a question');
  const words = countWords(text);
  if (words > MAX_FEEDBACK_REPLY_WORDS) failures.push(`it is ${words} words, over the limit of ${MAX_FEEDBACK_REPLY_WORDS}`);
  const defensive = findDefensivePhrases(text);
  if (defensive.length) failures.push(`it argues or defends the product: ${defensive.map((d) => `"${d}"`).join(', ')}`);
  const banned = findBannedPhrases(text);
  if (banned.length) failures.push(`it uses words that judge or steer: ${banned.map((b) => `"${b}"`).join(', ')}`);
  return { ok: failures.length === 0, failures };
}

/** A change's key in `answers`: stable across releases, so the steward's summary groups it. */
export const changeKey = (c: Pick<ChangeSince, 'version' | 'index'>) => `change_${c.version}_${c.index + 1}`;

/** The fixed questions for a mode. In the changes mode, `changes` is what changed since `sinceVersion`. */
export function feedbackPlan(mode: FeedbackMode, changes: ChangeSince[] = [], sinceVersion?: string): FeedbackPlan {
  if (mode === 'guided') return { intro: GUIDED_INTRO, steps: FEEDBACK_TOPICS.map((t) => ({ ...t, followUps: 1 })) };
  if (mode === 'free') return { intro: FREE_INTRO, steps: [{ key: 'free', question: FEEDBACK_FREE_QUESTION, followUps: 2 }] };
  if (!changes.length)
    return {
      intro: sinceVersion ? `Nothing has changed since version ${sinceVersion}.` : 'There are no changes listed yet.',
      steps: [{ key: 'free', question: FEEDBACK_FREE_QUESTION, followUps: 2 }],
    };
  const list = changes.map((c) => `• ${c.text}`).join('\n');
  return {
    intro: `${sinceVersion ? `Here is what has changed since version ${sinceVersion}:` : 'Here is everything that has changed so far:'}\n${list}`,
    steps: [
      ...changes.filter((c) => c.question).map((c) => ({ key: changeKey(c), question: c.question!, followUps: 1 })),
      { key: 'changes_else', question: CHANGES_ELSE_QUESTION, followUps: 0 },
    ],
  };
}

/** The opening of a new feedback record: the first message and the first (empty) answer. */
export function openingTurn(plan: FeedbackPlan): { message: Message; answer: Answer } {
  const first = plan.steps[0]!;
  return {
    message: { role: 'interviewer', text: `${plan.intro}\n\n${first.question}` },
    answer: { key: first.key, question: first.question, answer: '' },
  };
}

/** True once the closing message has been said. */
export function isFinished(fb: Pick<Feedback, 'messages' | 'answers'>): boolean {
  return fb.messages.filter((m) => m.role === 'interviewer').length > fb.answers.length;
}

/** What the model returns. */
export const FeedbackReplySchema = z.object({
  acknowledgement: z.string(),
  question: z.string(),
  /** True when `question` is a follow-up on the current topic; false when it asks the next topic. */
  follow_up: z.boolean(),
  /** The person's answer to the current topic, in their own words. */
  answer: z.string(),
});
export type FeedbackReply = z.infer<typeof FeedbackReplySchema>;

export interface FeedbackTurnResult {
  answers: Answer[];
  reply: string;
  done: boolean;
  /** 'ai' when the model's wording was used; 'fixed' when the fixed question was. */
  source: 'ai' | 'fixed';
  /** Why the model's reply was not used, when it was refused. */
  refused?: string[];
}

/**
 * One person turn: records their words against the question waiting for an answer, then decides
 * what comes next. Pure apart from the AI call.
 */
export async function feedbackTurn(deps: Pick<Deps, 'ai'>, fb: Feedback, plan: FeedbackPlan, text: string): Promise<FeedbackTurnResult> {
  const answers = fb.answers.map((a) => ({ ...a }));
  const add = (a: Answer) => (a.answer ? `${a.answer}\n\n${text}` : text);

  if (isFinished(fb) || !answers.length) {
    const last = answers[answers.length - 1];
    if (last) last.answer = add(last);
    else answers.push({ key: 'more', question: 'Anything you added', answer: text });
    return { answers, reply: AFTER_CLOSING_MESSAGE, done: true, source: 'fixed' };
  }

  const pending = answers[answers.length - 1]!;
  pending.answer = add(pending);
  const stepIndex = Math.max(0, plan.steps.findIndex((s) => s.key === pending.key));
  const current = plan.steps[stepIndex]!;
  const followUpsUsed = answers.filter((a) => a.key === current.key).length - 1;
  const canFollow = followUpsUsed < current.followUps;
  const next = plan.steps[stepIndex + 1];

  const fixed = (): FeedbackTurnResult => {
    if (!next) return { answers, reply: CLOSING_MESSAGE, done: true, source: 'fixed' };
    answers.push({ key: next.key, question: next.question, answer: '' });
    return { answers, reply: next.question, done: false, source: 'fixed' };
  };

  // Nothing for the model to word: the last topic, with no follow-up left.
  if (!next && !canFollow) return fixed();

  const messages: Message[] = [...fb.messages, { role: 'person', text }];
  const outcome = await deps.ai.withAi<FeedbackReply | null>(
    'feedback',
    (ai) =>
      ai.parse({
        schema: FeedbackReplySchema,
        system: FEEDBACK_SYSTEM,
        messages: [{ role: 'user', content: feedbackTurnMessage({ mode: fb.mode, current, followUpsUsed, next, messages }) }],
        effort: 'low',
      }),
    () => null,
  );
  const out = outcome.value;
  if (!out) return fixed();

  const reply = [out.acknowledgement.trim(), out.question.trim()].filter(Boolean).join(' ');
  const check = checkFeedbackReply(reply);
  const refused = [...check.failures];
  if (out.follow_up && !canFollow) refused.push('it asks a follow-up when none is left');
  if (!out.follow_up && !next) {
    // The model chose to move on from the last topic: the interview is over.
    return { ...fixed(), refused: refused.length ? refused : undefined };
  }
  if (refused.length) {
    console.warn(`[ai:feedback] reply refused: ${refused.join('; ')}`);
    return { ...fixed(), refused };
  }

  if (out.follow_up) {
    answers.push({ key: current.key, question: out.question.trim(), answer: '' });
  } else {
    answers.push({ key: next!.key, question: next!.question, answer: '' });
  }
  return { answers, reply, done: false, source: 'ai' };
}
