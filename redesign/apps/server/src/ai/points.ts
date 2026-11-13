import { countWords, PointType, wordOverlap, type Turn } from '@unite/shared';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { EXTRACT_POINTS_SYSTEM } from './prompts.js';

/**
 * Points from a conversation (section 6.2). The model proposes 3 to 7 points built from the
 * person's own phrases. Code keeps only those with at least one real source turn, at most 30
 * words, and `wordOverlap(text, sources) >= 0.6`. If fewer than 3 remain, the scripted extractor
 * fills in.
 */

export const MIN_POINTS = 3;
export const MAX_POINTS = 7;
export const MAX_POINT_WORDS = 30;
export const MIN_OVERLAP = 0.6;

export interface ExtractedPoint {
  type: PointType;
  text: string;
  sourceTurnIds: string[];
}

export const ExtractedPointsSchema = z.object({
  points: z.array(
    z.object({
      type: PointType,
      text: z.string(),
      source_turn_ids: z.array(z.string()),
    }),
  ),
});

type PersonTurn = Pick<Turn, 'id' | 'role' | 'text' | 'stage'>;

/** Keeps the candidates that pass every check, at most seven. */
export function filterPoints(candidates: readonly ExtractedPoint[], turns: readonly PersonTurn[]): ExtractedPoint[] {
  const byId = new Map(turns.filter((t) => t.role === 'person').map((t) => [t.id, t]));
  const out: ExtractedPoint[] = [];
  for (const c of candidates) {
    const text = c.text.trim();
    const sources = [...new Set(c.sourceTurnIds)].filter((id) => byId.has(id));
    if (!text || sources.length === 0) continue;
    if (countWords(text) > MAX_POINT_WORDS) continue;
    if (wordOverlap(text, sources.map((id) => byId.get(id)!.text)) < MIN_OVERLAP) continue;
    out.push({ type: c.type, text, sourceTurnIds: sources });
    if (out.length === MAX_POINTS) break;
  }
  return out;
}

/** The first sentence of a text, cut to 30 words. */
export function firstSentence(text: string): string {
  return sentences(text)[0] ?? '';
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((s) => limitWords(s.trim()))
    .filter(Boolean);
}

function limitWords(s: string): string {
  const w = s.split(/\s+/).filter(Boolean);
  return w.length > MAX_POINT_WORDS ? w.slice(0, MAX_POINT_WORDS).join(' ') : s;
}

/** Stages the scripted extractor reads, and the type each gives. */
const SCRIPTED_STAGE_TYPES: [number, PointType][] = [
  [1, 'moment'],
  [2, 'matters'],
  [3, 'barrier'],
  [4, 'wish'],
  [7, 'idea'],
];

/** Types given, in order, to the sentences of a single written answer (the free-writing route). */
const FREETEXT_TYPES: PointType[] = ['moment', 'matters', 'barrier', 'wish', 'idea', 'tradeoff', 'doubt'];

/**
 * The scripted extractor: the first sentence of the person's longest turn in stages 1, 2, 3, 4
 * and 7, typed moment, matters, barrier, wish and idea. On the free-writing route, where there is
 * only one turn, its first sentences are used instead, up to three.
 */
export function scriptedPoints(turns: readonly PersonTurn[], opts: { freetext?: boolean } = {}): ExtractedPoint[] {
  const person = turns.filter((t) => t.role === 'person' && t.text.trim());
  if (opts.freetext && person.length === 1) {
    const only = person[0]!;
    return sentences(only.text)
      .slice(0, MIN_POINTS)
      .map((text, i) => ({ type: FREETEXT_TYPES[i]!, text, sourceTurnIds: [only.id] }));
  }
  const out: ExtractedPoint[] = [];
  for (const [stage, type] of SCRIPTED_STAGE_TYPES) {
    const longest = person.filter((t) => t.stage === stage).sort((a, b) => b.text.length - a.text.length)[0];
    if (!longest) continue;
    const text = firstSentence(longest.text);
    if (text) out.push({ type, text, sourceTurnIds: [longest.id] });
  }
  return out;
}

/** Adds scripted points until there are at least three, skipping any that repeat a point already there. */
export function fillIn(points: readonly ExtractedPoint[], scripted: readonly ExtractedPoint[]): ExtractedPoint[] {
  const out = [...points];
  for (const s of scripted) {
    if (out.length >= MIN_POINTS) break;
    if (out.some((p) => wordOverlap(s.text, p.text) >= 0.8)) continue;
    out.push(s);
  }
  return out;
}

/** The person's turns as numbered lines for the model. */
function pointsMessage(turns: readonly PersonTurn[]): string {
  return turns
    .filter((t) => t.role === 'person' && t.text.trim())
    .map((t) => `[${t.id}] ${t.text}`)
    .join('\n\n');
}

/** Draft points for a conversation, in the person's own words. */
export async function extractPoints(
  deps: Pick<Deps, 'ai'>,
  turns: readonly PersonTurn[],
  opts: { mode: 'claude' | 'scripted'; freetext?: boolean },
): Promise<{ points: ExtractedPoint[]; source: 'ai' | 'scripted' }> {
  const person = turns.filter((t) => t.role === 'person' && t.text.trim());
  if (person.length === 0) return { points: [], source: 'scripted' };
  const scripted = scriptedPoints(person, { freetext: opts.freetext });
  if (opts.mode === 'scripted') return { points: scripted.slice(0, MAX_POINTS), source: 'scripted' };

  const outcome = await deps.ai.withAi<ExtractedPoint[] | null>(
    'extract_points',
    async (ai) => {
      const out = await ai.parse({
        schema: ExtractedPointsSchema,
        system: EXTRACT_POINTS_SYSTEM,
        messages: [{ role: 'user', content: pointsMessage(person) }],
        effort: 'low',
      });
      return out.points.map((p) => ({ type: p.type, text: p.text, sourceTurnIds: p.source_turn_ids }));
    },
    () => null,
  );
  if (!outcome.value) return { points: scripted.slice(0, MAX_POINTS), source: 'scripted' };
  const kept = filterPoints(outcome.value, person);
  return { points: fillIn(kept, scripted), source: kept.length ? 'ai' : 'scripted' };
}
