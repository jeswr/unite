// "Here is what I heard": a simple, deterministic picking of points from the visitor's own words.
// No rewording: each point is a sentence (or the front of one) exactly as the visitor wrote it.
import { generalWord, hasEvent, type StageId } from './interviewer';

export interface Answer {
  stage: StageId;
  text: string;
  /** True for the answer to a follow-up question. */
  followUp?: boolean;
}

export interface Point {
  id: string;
  stage: StageId;
  label: string;
  text: string;
}

export const POINT_LABEL: Record<StageId, string> = {
  day: 'Your day',
  mattered: 'What mattered',
  inway: 'What got in the way',
  goodday: 'A good ordinary day',
  others: 'Who else has to be all right',
  tradeoff: 'What you would keep',
};

/** The order in which stages give points, most telling first. */
const ORDER: StageId[] = ['mattered', 'inway', 'goodday', 'others', 'tradeoff', 'day'];
const MAX_POINTS = 5;
const MAX_LEN = 180;

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?।])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const WANT_CUES = ['want', 'would', 'need', 'matter', 'wish', 'hope', 'keep', 'good day', 'lost', 'late', 'wait', 'afraid', 'tired', 'alone'];

function score(s: string): number {
  const lower = s.toLocaleLowerCase();
  let n = 0;
  if (s.length >= 20) n += 2;
  if (s.length > 220) n -= 1;
  if (hasEvent(s)) n += 1;
  if (generalWord(s) && !hasEvent(s)) n -= 2;
  for (const c of WANT_CUES) if (lower.includes(c)) n += 1;
  return n;
}

function trim(s: string): string {
  if (s.length <= MAX_LEN) return s;
  const cut = s.lastIndexOf(',', MAX_LEN);
  return (cut > 40 ? s.slice(0, cut) : s.slice(0, MAX_LEN).replace(/\s+\S*$/, '')) + '…';
}

export function extractPoints(answers: Answer[]): Point[] {
  const out: Point[] = [];
  for (const stage of ORDER) {
    if (out.length >= MAX_POINTS) break;
    const forStage = answers.filter((a) => a.stage === stage && a.text.trim());
    // A follow-up answer is the event the general word pointed to; prefer it.
    const ordered = [...forStage.filter((a) => a.followUp), ...forStage.filter((a) => !a.followUp)];
    let best = '';
    let bestScore = -Infinity;
    for (const [ai, a] of ordered.entries()) {
      for (const [si, s] of sentences(a.text).entries()) {
        const sc = score(s) - ai * 0.5 - si * 0.1;
        if (sc > bestScore) {
          bestScore = sc;
          best = s;
        }
      }
    }
    if (!best) continue;
    const text = trim(best);
    if (out.some((p) => p.text === text)) continue;
    // The day itself is only used when too few points came from the other stages.
    if (stage === 'day' && out.length >= 3) continue;
    out.push({ id: `p-${stage}`, stage, label: POINT_LABEL[stage], text });
  }
  return out;
}
