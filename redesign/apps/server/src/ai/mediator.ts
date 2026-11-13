import type Anthropic from '@anthropic-ai/sdk';
import {
  MEDIATION_LIMITS,
  mediationFallback,
  mediationStep,
  replyText,
  trimToLimit,
  validateInterviewerReply,
  wordOverlap,
  type MediationDraftText,
  type MediationTurn,
  type ReactionValue,
} from '@unite/shared';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { MAX_ATTEMPTS, type Safety } from './interviewer.js';
import { MIN_OVERLAP } from './points.js';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, MEDIATION_EXTRACT_SYSTEM, MEDIATOR_FIXED, MEDIATOR_SYSTEM, mediatorStepMessage } from './prompts.js';

/**
 * The AI go-between of talk it through (section 12.1). The step machine is code; the model only
 * words the next question. Every reply passes `validateInterviewerReply` before it can be stored
 * or shown (rule 9, widened in section 12). A reply that fails is asked for again with the failure
 * named, twice; after that the fixed question for the step is used and the turn records
 * `fallback`. The model is never given the other side's reasons: only how many were shown.
 */

export const MediatorReplySchema = z.object({
  acknowledgement: z.string(),
  question: z.string(),
  step_complete: z.boolean(),
  safety: z.enum(['ok', 'distress', 'identifying']),
});
export type MediatorModelReply = z.infer<typeof MediatorReplySchema>;

export interface MediatorInput {
  /** False when the AI is not to be used for this mediation. */
  aiUsed: boolean;
  step: number;
  statement: string;
  answer: ReactionValue;
  /** The turns so far, oldest first. */
  turns: readonly Pick<MediationTurn, 'role' | 'step' | 'text' | 'skipped'>[];
  /** Person turns in this step so far (0 when asking a step's first question). */
  personTurnsInStep: number;
  /** How many of the other side's reasons were shown at step 2. */
  shownCount: number;
}

export interface MediatorResult {
  text: string;
  stepComplete: boolean;
  safety: Safety;
  /** The fixed question was used. */
  fallback?: boolean;
  /** The AI could not be used at all (no key or a spending cap): the mediation moves to fixed questions. */
  unavailable?: boolean;
}

/** The fixed question for this point in a step: the opener before any answer, then the follow-up. */
export function fixedQuestion(step: number, personTurnsInStep: number): string {
  const pair = MEDIATOR_FIXED[step];
  if (!pair) throw new Error(`There is no fixed question for step ${step}`);
  return personTurnsInStep === 0 ? pair[0] : pair[1];
}

/** With fixed questions there is no model to say a step is complete: it is complete at its maximum. */
function fixedStepComplete(step: number, personTurnsInStep: number): boolean {
  return personTurnsInStep >= (mediationStep(step)?.maxTurns ?? 1);
}

/**
 * The transcript as one block of text, then the step instructions. At step 2 the quotations the
 * person was shown are replaced by a line that says only how many there were.
 */
export function buildMediatorMessages(input: MediatorInput, repair?: string): Anthropic.MessageParam[] {
  const info = mediationStep(input.step);
  const lines: string[] = [];
  let noted = false;
  for (const t of input.turns) {
    if (t.step === 2 && !noted && input.shownCount > 0) {
      lines.push(`(Here the person was shown ${input.shownCount} reason(s) from people who answered differently.)`);
      noted = true;
    }
    if (t.role === 'person') lines.push(`Person: ${t.skipped ? '(skipped this step)' : t.text}`);
    else lines.push(`Go-between: ${t.text}`);
  }
  if (input.step === 2 && !noted && input.shownCount > 0)
    lines.push(`(Here the person was shown ${input.shownCount} reason(s) from people who answered differently.)`);
  const stepMessage = mediatorStepMessage({
    step: input.step,
    statement: input.statement,
    answer: input.answer,
    personTurnsInStep: input.personTurnsInStep,
    minTurns: info?.minTurns ?? 1,
    maxTurns: info?.maxTurns ?? 1,
    shownCount: input.shownCount,
    repair,
  });
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: lines.join('\n\n') || '(no turns yet)' },
        { type: 'text', text: stepMessage },
      ],
    },
  ];
}

function withNote(text: string, safety: Safety): string {
  return safety === 'identifying' ? `${text} ${IDENTIFYING_NOTE}` : text;
}

function fixed(input: MediatorInput, safety: Safety = 'ok', opts: { fallback?: boolean; unavailable?: boolean } = {}): MediatorResult {
  return {
    text: withNote(fixedQuestion(input.step, input.personTurnsInStep), safety),
    stepComplete: fixedStepComplete(input.step, input.personTurnsInStep),
    safety,
    fallback: true,
    ...(opts.unavailable ? { unavailable: true } : {}),
  };
}

type Attempt = { kind: 'ok'; reply: MediatorModelReply } | { kind: 'distress' } | { kind: 'invalid'; safety: Safety } | { kind: 'unavailable' };

/** One mediator turn: the next question for the step, checked against the rules. */
export async function mediatorTurn(deps: Pick<Deps, 'ai'>, input: MediatorInput): Promise<MediatorResult> {
  if (!input.aiUsed) return fixed(input);
  const outcome = await deps.ai.withAi<Attempt>(
    'mediator',
    async (ai) => {
      let repair: string | undefined;
      let lastSafety: Safety = 'ok';
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const reply = await ai.parse({ schema: MediatorReplySchema, system: MEDIATOR_SYSTEM, messages: buildMediatorMessages(input, repair), effort: 'low' });
        if (reply.safety === 'distress') return { kind: 'distress' };
        lastSafety = reply.safety;
        // Steps 1 to 4 are all stages where the interviewer speaks, so the interviewer's check applies as it is.
        const check = validateInterviewerReply(reply, input.step);
        if (check.ok) return { kind: 'ok', reply };
        repair = check.failures.join('; ');
        console.warn(`[mediator] reply refused (attempt ${attempt + 1}): ${repair}`);
      }
      return { kind: 'invalid', safety: lastSafety };
    },
    () => ({ kind: 'unavailable' }),
  );
  const value = outcome.value;
  switch (value.kind) {
    case 'distress':
      return { text: DISTRESS_MESSAGE, stepComplete: false, safety: 'distress' };
    case 'ok':
      return { text: withNote(replyText(value.reply), value.reply.safety), stepComplete: value.reply.step_complete, safety: value.reply.safety };
    case 'invalid':
      return fixed(input, value.safety);
    case 'unavailable': {
      const reason = outcome.source === 'fallback' ? outcome.reason : 'error';
      return fixed(input, 'ok', { unavailable: reason === 'no_key' || reason === 'cap' });
    }
  }
}

/* ------------------------------------------------------------------ the review */

export const MediationExtractSchema = z.object({
  reason: z.string().nullable(),
  wording: z.string().nullable(),
  question: z.string().nullable(),
});

type Turnish = Pick<MediationTurn, 'role' | 'step' | 'text' | 'skipped'>;

const LIMITS = {
  reason: [MEDIATION_LIMITS.reason, Infinity],
  wording: [MEDIATION_LIMITS.wordingChars, MEDIATION_LIMITS.wordingWords],
  question: [MEDIATION_LIMITS.question, Infinity],
} as const;

/**
 * Keeps each extracted field whose words come from the person's own turns (`wordOverlap` at the
 * points' threshold) and that fits its limit; a field that fails is replaced by the fallback.
 */
export function checkExtracted(candidate: MediationDraftText, turns: readonly Turnish[]): MediationDraftText {
  const own = turns.filter((t) => t.role === 'person' && !t.skipped && t.text.trim()).map((t) => t.text);
  const fallback = mediationFallback(turns);
  const out = { ...fallback };
  for (const key of ['reason', 'wording', 'question'] as const) {
    const text = candidate[key]?.trim();
    // Null is an answer: the person did not give one.
    if (!text) {
      out[key] = null;
      continue;
    }
    const [chars, words] = LIMITS[key];
    if (trimToLimit(text, chars, words) !== text.replace(/\s+/g, ' ')) continue;
    if (wordOverlap(text, own) < MIN_OVERLAP) continue;
    out[key] = text.replace(/\s+/g, ' ');
  }
  return out;
}

function extractMessage(turns: readonly Turnish[]): string {
  return turns
    .filter((t) => t.role === 'person' && !t.skipped && t.text.trim())
    .map((t) => `[step ${t.step}] ${t.text}`)
    .join('\n\n');
}

/** "Here is what I heard": a reason, a wording and a question in the person's own words, each possibly empty. */
export async function extractMediation(
  deps: Pick<Deps, 'ai'>,
  turns: readonly Turnish[],
  opts: { aiUsed: boolean },
): Promise<{ drafts: MediationDraftText; source: 'ai' | 'fallback' }> {
  const fallback = mediationFallback(turns);
  const said = turns.some((t) => t.role === 'person' && !t.skipped && t.text.trim());
  if (!opts.aiUsed || !said) return { drafts: fallback, source: 'fallback' };
  const outcome = await deps.ai.withAi<MediationDraftText | null>(
    'extract_mediation',
    (ai) => ai.parse({ schema: MediationExtractSchema, system: MEDIATION_EXTRACT_SYSTEM, messages: [{ role: 'user', content: extractMessage(turns) }], effort: 'low' }),
    () => null,
  );
  if (!outcome.value) return { drafts: fallback, source: 'fallback' };
  return { drafts: checkExtracted(outcome.value, turns), source: 'ai' };
}
