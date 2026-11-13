import { z } from 'zod';
import type { Deps } from '../deps.js';
import { HOST_INTAKE_SYSTEM } from './prompts.js';

/**
 * One turn of the host intake interview (section 6.5) through `withAi`. The model is given, as
 * data, the topic just asked, the next topic, whether a follow-up is still allowed, and the
 * conversation so far; it returns whether to ask a follow-up and the question to ask. The
 * scripted fallback asks no follow-up and moves to the next fixed topic question.
 */

export const IntakeReplySchema = z.object({
  follow_up: z.boolean(),
  question: z.string(),
});

export interface IntakeTurnArgs {
  topic: { key: string; question: string };
  next: { key: string; question: string } | null;
  followUpAllowed: boolean;
  messages: { role: 'interviewer' | 'person'; text: string }[];
}

export interface IntakeTurnResult {
  followUp: boolean;
  /** Null when the interview is over. */
  question: string | null;
  source: 'ai' | 'fallback';
}

export const MAX_INTAKE_QUESTION_WORDS = 50;

/** A question the host can be shown: one question, under the word limit, no links. */
export function usableIntakeQuestion(q: string): boolean {
  const t = q.trim();
  return t.length > 0 && (t.match(/\?/g)?.length ?? 0) >= 1 && t.split(/\s+/).length <= MAX_INTAKE_QUESTION_WORDS && !/https?:\/\//i.test(t);
}

export async function intakeTurn(deps: Pick<Deps, 'ai'>, args: IntakeTurnArgs): Promise<IntakeTurnResult> {
  const fallback = (): IntakeTurnResult => ({ followUp: false, question: args.next?.question ?? null, source: 'fallback' });
  if (!args.followUpAllowed) return fallback();
  const outcome = await deps.ai.withAi(
    'host-intake',
    async (ai) => {
      const out = await ai.parse({
        schema: IntakeReplySchema,
        system: HOST_INTAKE_SYSTEM,
        effort: 'low',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              topic_just_asked: args.topic.question,
              next_topic: args.next?.question ?? null,
              follow_up_allowed: args.followUpAllowed,
              conversation: args.messages.map((m) => ({ speaker: m.role === 'person' ? 'host' : 'interviewer', text: m.text })),
            }),
          },
        ],
      });
      if (out.follow_up) {
        if (!usableIntakeQuestion(out.question)) throw new Error('The follow-up question did not fit the rules');
        return { followUp: true, question: out.question.trim(), source: 'ai' as const };
      }
      if (!args.next) return { followUp: false, question: null, source: 'ai' as const };
      return { followUp: false, question: usableIntakeQuestion(out.question) ? out.question.trim() : args.next.question, source: 'ai' as const };
    },
    fallback,
  );
  return outcome.value;
}
