import { z } from 'zod';
import { countWords, findBannedPhrases, type RoomPace } from '@unite/shared';
import type { Deps } from '../deps.js';
import type { TriggerKind } from '../services/rooms/triggers.js';
import { FACILITATOR_FALLBACK, FACILITATOR_FALLBACK_SLOW, FACILITATOR_SLOW_NOTE, FACILITATOR_SYSTEM } from './prompts.js';

/**
 * The room facilitator's wording (section 6.4). Code decides when it speaks (services/rooms/triggers.ts);
 * the model only words the one thing it has been asked to do. Every message is checked against the
 * same banned-phrase list as the interviewer, and the fixed wording is used when the model is off,
 * fails, or writes something that does not pass. A slow room (section 12.2) has its own fixed
 * wording, and the model is told the pace and the time left in words.
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
  /** Absent means live. */
  pace?: RoomPace;
  /** A slow room's time left in words ("3 days left"). */
  timeLeft?: string;
  /** How long a slow room is open, in words ("5 days"). */
  length?: string;
}

/** "5 days", or "1 day": how long a slow room is open, from its length in minutes. */
export function daysWords(minutes: number): string {
  const days = Math.max(1, Math.round(minutes / 1440));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
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

/** The fixed wording for a trigger. A slow room fills in how long it is open and the time left. */
export function fallbackWording(kind: TriggerKind, name?: string, slow?: { length: string; timeLeft: string }): string {
  const words = slow ? (FACILITATOR_FALLBACK_SLOW[kind] ?? '') : (FACILITATOR_FALLBACK[kind] ?? '');
  const filled = words.replace('{name}', name ?? 'Everyone');
  if (!slow) return filled;
  return filled.replace('{days}', slow.length).replace(/^\{left\}/, upperFirst(slow.timeLeft)).replace('{left}', lowerFirst(slow.timeLeft));
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Words one facilitator turn: the model's wording when it passes the checks, otherwise the fixed wording. */
export async function wordFacilitator(
  deps: Pick<Deps, 'ai'>,
  kind: TriggerKind,
  ctx: FacilitatorContext,
): Promise<{ text: string; source: 'ai' | 'fallback' }> {
  const slow = ctx.pace === 'slow' ? { length: ctx.length ?? 'several days', timeLeft: ctx.timeLeft ?? 'Some time left' } : undefined;
  const fallback = () => fallbackWording(kind, ctx.name, slow);
  const out = await deps.ai.withAi(
    'facilitator',
    async (ai) => {
      const data = slow
        ? {
            do: kind,
            pace: 'slow',
            topic: ctx.topic,
            ...(ctx.statement ? { statement: ctx.statement } : {}),
            open_for: slow.length,
            time_left: slow.timeLeft,
            ...(ctx.name ? { name: ctx.name } : {}),
          }
        : {
            do: kind,
            topic: ctx.topic,
            ...(ctx.statement ? { statement: ctx.statement } : {}),
            minutes_left: ctx.minutesLeft,
            ...(ctx.name ? { name: ctx.name } : {}),
          };
      const system = slow ? `${FACILITATOR_SYSTEM}\n\n${FACILITATOR_SLOW_NOTE}` : FACILITATOR_SYSTEM;
      const r = await ai.parse({ schema: FacilitatorOutput, system, messages: [{ role: 'user', content: JSON.stringify(data) }] });
      const text = r.message.trim();
      if (checkFacilitatorMessage(text, kind, ctx.name).length) return null;
      return text;
    },
    () => null,
  );
  if (out.source === 'ai' && out.value) return { text: out.value, source: 'ai' };
  return { text: fallback(), source: 'fallback' };
}
