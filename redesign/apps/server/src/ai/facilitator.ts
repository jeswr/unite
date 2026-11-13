import { z } from 'zod';
import { countWords, findBannedPhrases } from '@unite/shared';
import type { Deps } from '../deps.js';
import type { TriggerKind } from '../services/rooms/triggers.js';
import { FACILITATOR_FALLBACK, FACILITATOR_SYSTEM } from './prompts.js';

/**
 * The room facilitator's wording (section 6.4). Code decides when it speaks (services/rooms/triggers.ts);
 * the model only words the one thing it has been asked to do. Every message is checked against the
 * same banned-phrase list as the interviewer, and the fixed wording is used when the model is off,
 * fails, or writes something that does not pass.
 */

export const FacilitatorOutput = z.object({ message: z.string() });

export const FACILITATOR_MAX_WORDS = 40;

export interface FacilitatorContext {
  topic: string;
  /** The statement the room is working on, if it has one. */
  statement?: string;
  minutesLeft: number;
  /** For an invitation: the person's display name. */
  name?: string;
}

/** What is wrong with a facilitator message, in plain words; empty when it may be shown. */
export function checkFacilitatorMessage(text: string, kind: TriggerKind, name?: string): string[] {
  const failures: string[] = [];
  if (!text.trim()) failures.push('the message is empty');
  const words = countWords(text);
  if (words > FACILITATOR_MAX_WORDS) failures.push(`the message is ${words} words, over the limit of ${FACILITATOR_MAX_WORDS}`);
  const banned = findBannedPhrases(text);
  if (banned.length) failures.push(`it uses words that judge or steer: ${banned.map((b) => `"${b}"`).join(', ')}`);
  if (kind === 'invite' && name && !text.includes(name)) failures.push('an invitation must use the person’s display name');
  return failures;
}

/** The fixed wording for a trigger. */
export function fallbackWording(kind: TriggerKind, name?: string): string {
  return (FACILITATOR_FALLBACK[kind] ?? '').replace('{name}', name ?? 'Everyone');
}

/** Words one facilitator turn: the model's wording when it passes the checks, otherwise the fixed wording. */
export async function wordFacilitator(
  deps: Pick<Deps, 'ai'>,
  kind: TriggerKind,
  ctx: FacilitatorContext,
): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  const fallback = () => fallbackWording(kind, ctx.name);
  const out = await deps.ai.withAi(
    'facilitator',
    async (ai) => {
      const data = {
        do: kind,
        topic: ctx.topic,
        ...(ctx.statement ? { statement: ctx.statement } : {}),
        minutes_left: ctx.minutesLeft,
        ...(ctx.name ? { name: ctx.name } : {}),
      };
      const r = await ai.parse({ schema: FacilitatorOutput, system: FACILITATOR_SYSTEM, messages: [{ role: 'user', content: JSON.stringify(data) }] });
      const text = r.message.trim();
      if (checkFacilitatorMessage(text, kind, ctx.name).length) return null;
      return text;
    },
    () => null,
  );
  if (out.source === 'ai' && out.value) return { text: out.value, source: 'ai' };
  return { text: fallback(), source: 'fallback' };
}
