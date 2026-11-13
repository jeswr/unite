import type Anthropic from '@anthropic-ai/sdk';
import { replyText, validateInterviewerReply, type Turn } from '@unite/shared';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { stageLimits } from '../services/conversation/machine.js';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, INTERVIEWER_SYSTEM, interviewerStageMessage } from './prompts.js';
import { scriptedQuestion, scriptedStageComplete } from './scripted.js';

/**
 * The AI interviewer (section 6.1). Builds the request from INTERVIEWER_SYSTEM and
 * interviewerStageMessage, calls the model through withAi, and checks every reply with
 * validateInterviewerReply before it can be stored or shown (rule 9). A reply that fails is asked
 * for again with the failure named, twice; after that the scripted question for the stage is used
 * and the turn records meta.fallback.
 */

/** The model's output (section 6.1). */
export const InterviewerReplySchema = z.object({
  acknowledgement: z.string(),
  question: z.string(),
  stage_complete: z.boolean(),
  safety: z.enum(['ok', 'distress', 'identifying']),
});
export type InterviewerModelReply = z.infer<typeof InterviewerReplySchema>;

/** Attempts in all: the first, then two more with the failure named. */
export const MAX_ATTEMPTS = 3;

export type Safety = InterviewerModelReply['safety'];

export interface InterviewerInput {
  mode: 'claude' | 'scripted';
  stage: number;
  /** The whole transcript so far, oldest first. */
  turns: readonly Pick<Turn, 'role' | 'text'>[];
  /** Person turns in this stage so far (0 when asking a stage's first question). */
  personTurnsInStage: number;
  assemblyQuestion?: string;
  probe?: string;
}

export interface InterviewerResult {
  /** The text to store and show. For distress, the fixed distress message. */
  text: string;
  stageComplete: boolean;
  safety: Safety;
  meta?: { regenerated?: number; fallback?: boolean };
  /** True when the AI could not be used at all (no key or a spending cap): the conversation moves to scripted mode. */
  unavailable?: boolean;
}

/** The transcript as one block of text, followed by the stage instructions from prompts.ts. */
export function buildInterviewerMessages(input: InterviewerInput, repair?: string): Anthropic.MessageParam[] {
  const { min, max } = stageLimits(input.stage);
  const transcript = input.turns.map((t) => `${t.role === 'interviewer' ? 'Interviewer' : 'Person'}: ${t.text}`).join('\n\n');
  const stageMessage = interviewerStageMessage({
    stage: input.stage,
    assemblyQuestion: input.assemblyQuestion,
    probe: input.probe,
    personTurnsInStage: input.personTurnsInStage,
    minTurns: min,
    maxTurns: max,
    repair,
  });
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: transcript || '(no turns yet)' },
        { type: 'text', text: stageMessage },
      ],
    },
  ];
}

function withNote(text: string, safety: Safety): string {
  return safety === 'identifying' ? `${text} ${IDENTIFYING_NOTE}` : text;
}

function scripted(input: InterviewerInput, meta?: InterviewerResult['meta'], safety: Safety = 'ok', unavailable = false): InterviewerResult {
  const text = scriptedQuestion(input.stage, input.personTurnsInStage, input.probe);
  return {
    text: withNote(text, safety),
    stageComplete: scriptedStageComplete(input.personTurnsInStage),
    safety,
    ...(meta ? { meta } : {}),
    ...(unavailable ? { unavailable } : {}),
  };
}

type Attempt =
  | { kind: 'ok'; reply: InterviewerModelReply; regenerated: number }
  | { kind: 'distress' }
  | { kind: 'invalid'; safety: Safety }
  | { kind: 'unavailable' };

/** One interviewer turn: the next question for the given stage, checked against the rules. */
export async function interviewerTurn(deps: Pick<Deps, 'ai'>, input: InterviewerInput): Promise<InterviewerResult> {
  if (input.mode === 'scripted') return scripted(input);

  const outcome = await deps.ai.withAi<Attempt>(
    'interviewer',
    async (ai) => {
      let repair: string | undefined;
      let lastSafety: Safety = 'ok';
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const reply = await ai.parse({
          schema: InterviewerReplySchema,
          system: INTERVIEWER_SYSTEM,
          messages: buildInterviewerMessages(input, repair),
          effort: 'low',
        });
        // The question is never shown when the person seems to be in distress.
        if (reply.safety === 'distress') return { kind: 'distress' };
        lastSafety = reply.safety;
        const check = validateInterviewerReply(reply, input.stage);
        if (check.ok) return { kind: 'ok', reply, regenerated: attempt };
        repair = check.failures.join('; ');
        console.warn(`[interviewer] reply refused (attempt ${attempt + 1}): ${repair}`);
      }
      return { kind: 'invalid', safety: lastSafety };
    },
    () => ({ kind: 'unavailable' }),
  );

  const value = outcome.value;
  switch (value.kind) {
    case 'distress':
      return { text: DISTRESS_MESSAGE, stageComplete: false, safety: 'distress' };
    case 'ok':
      return {
        text: withNote(replyText(value.reply), value.reply.safety),
        stageComplete: value.reply.stage_complete,
        safety: value.reply.safety,
        ...(value.regenerated ? { meta: { regenerated: value.regenerated } } : {}),
      };
    case 'invalid':
      return scripted(input, { regenerated: MAX_ATTEMPTS - 1, fallback: true }, value.safety);
    case 'unavailable': {
      const reason = outcome.source === 'fallback' ? outcome.reason : 'error';
      return scripted(input, { fallback: true }, 'ok', reason === 'no_key' || reason === 'cap');
    }
  }
}
