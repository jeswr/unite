import { z } from 'zod';
import { newId, type AssemblyKind, type Intake, type Pledge } from '@unite/shared';
import { intakeTurn } from '../../ai/hostIntake.js';
import { HOST_INTAKE_TOPICS } from '../../ai/prompts.js';
import type { Deps } from '../../deps.js';
import { HttpError, notFound } from '../../errors.js';
import { parseBody } from '../../validate.js';

/**
 * The host intake interview (section 6.5): seven fixed topics, each with at most one follow-up,
 * then a draft pledge and question filled from the host's own words, for the pledge editor.
 */

/** The draft the intake ends with. Text fields are the host's answers, word for word. */
export interface IntakeDraft {
  question: string;
  /** Who is affected, as the host said it. */
  affected: string;
  /** The same, split into groups at commas, semicolons and new lines, for the editor to start from. */
  groups: string[];
  /** How the host wants it decided, as they said it. */
  rule: string;
  kind: Extract<AssemblyKind, 'advisory' | 'codecided'>;
  /** The pledge so far. Numbers are starting values the host is asked to confirm or change. */
  pledge: Partial<Pledge>;
}

export interface IntakeView {
  intake: Pick<Intake, 'id' | 'messages' | 'answers' | 'status'>;
  /** The question to answer next; null when the interview is over. */
  question: string | null;
  topic: { n: number; of: number };
  done: boolean;
  draft: IntakeDraft | null;
  source: 'ai' | 'fallback';
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n: number) => String(n).padStart(2, '0');

/** A calendar date found in what the host said ("18 December 2026", "2026-12-18"), or undefined. */
export function findDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso && !Number.isNaN(Date.parse(`${iso[0]}T00:00:00Z`))) return iso[0];
  const m = text.toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\s+(\d{4})\b/);
  const n = text.toLowerCase().match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  const parts = m ? { d: +m[1]!, mon: m[2]!, y: +m[3]! } : n ? { d: +n[2]!, mon: n[1]!, y: +n[3]! } : undefined;
  if (!parts) return undefined;
  const month = MONTHS.findIndex((x) => x.startsWith(parts.mon.slice(0, 3)) && parts.mon.length >= 3);
  if (month < 0 || parts.d < 1 || parts.d > 31) return undefined;
  const d = new Date(Date.UTC(parts.y, month, parts.d));
  if (d.getUTCMonth() !== month) return undefined;
  return `${parts.y}-${pad(month + 1)}-${pad(parts.d)}`;
}

/** Starting values for the numbers in a pledge; the editor shows them for the host to confirm. */
export const PLEDGE_STARTING_VALUES = {
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 30,
  capacity: 5,
  checkBody: 'panel',
  reviewAfterDays: 365,
} as const satisfies Partial<Pledge>;

/** Builds the draft from the answers, keeping the host's words. */
export function draftFromAnswers(answers: Intake['answers']): IntakeDraft {
  const get = (key: string) => answers.find((a) => a.key === key)?.answer.trim() ?? '';
  const rule = get('rule');
  const binding = /\bcarr(y|ied)\s+out\b|\bbinding\b|\bwe will (do|implement|deliver)\b|\bwhat people decide\b/i.test(rule) && !/\badvi[cs]e\b/i.test(rule);
  const replyBy = findDate(get('replyBy'));
  return {
    question: get('question'),
    affected: get('affected'),
    groups: get('affected')
      .split(/[,;\n]+/)
      .map((g) => g.trim().replace(/^(and|or)\s+/i, '').replace(/[.]+$/, ''))
      .filter(Boolean)
      .slice(0, 12),
    rule,
    kind: binding ? 'codecided' : 'advisory',
    pledge: {
      setAside: get('setAside'),
      remit: get('remit'),
      offTable: get('offTable'),
      ...PLEDGE_STARTING_VALUES,
      ...(replyBy ? { replyBy } : {}),
    },
  };
}

function viewOf(intake: Intake, source: 'ai' | 'fallback', question: string | null): IntakeView {
  return {
    intake: { id: intake.id, messages: intake.messages, answers: intake.answers, status: intake.status },
    question,
    topic: { n: Math.min(intake.topicIndex + 1, HOST_INTAKE_TOPICS.length), of: HOST_INTAKE_TOPICS.length },
    done: intake.status === 'complete',
    draft: intake.status === 'complete' ? draftFromAnswers(intake.answers) : null,
    source,
  };
}

/** POST /api/host/intake: starts the interview with the first fixed question. */
export async function startIntake(deps: Pick<Deps, 'store' | 'clock'>): Promise<IntakeView> {
  const now = deps.clock.iso();
  const first = HOST_INTAKE_TOPICS[0]!;
  const intake = await deps.store.put('intakes', {
    id: newId('ink'),
    messages: [{ role: 'interviewer', text: first.question }],
    answers: [],
    topicIndex: 0,
    followUpAsked: false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return viewOf(intake, 'fallback', first.question);
}

export const IntakeTurnBody = z.strictObject({ text: z.string().trim().min(1, 'must not be empty').max(4000) });

/**
 * POST /api/host/intake/:id/turns: records the answer under the current topic (a follow-up's
 * answer is added to the first), then asks a follow-up or the next topic, or ends with the draft.
 */
export async function intakeAnswer(deps: Pick<Deps, 'store' | 'clock' | 'ai'>, id: string, raw: unknown): Promise<IntakeView> {
  const { text } = parseBody(IntakeTurnBody, raw);
  const intake = await deps.store.get('intakes', id);
  if (!intake) throw notFound('That intake interview');
  if (intake.status === 'complete') throw new HttpError(409, 'intake_complete', 'This interview is finished. Carry on in the pledge editor.');
  const topic = HOST_INTAKE_TOPICS[intake.topicIndex]!;
  const next = HOST_INTAKE_TOPICS[intake.topicIndex + 1] ?? null;
  const messages = [...intake.messages, { role: 'person' as const, text }];
  const existing = intake.answers.find((a) => a.key === topic.key);
  const answers = existing
    ? intake.answers.map((a) => (a.key === topic.key ? { ...a, answer: `${a.answer}\n${text}` } : a))
    : [...intake.answers, { key: topic.key, question: topic.question, answer: text }];

  const turn = await intakeTurn(deps, { topic, next, followUpAllowed: !intake.followUpAsked, messages });
  const now = deps.clock.iso();
  const updated: Intake = turn.followUp
    ? { ...intake, messages: [...messages, { role: 'interviewer', text: turn.question! }], answers, followUpAsked: true, updatedAt: now }
    : next
      ? {
          ...intake,
          messages: [...messages, { role: 'interviewer', text: turn.question ?? next.question }],
          answers,
          topicIndex: intake.topicIndex + 1,
          followUpAsked: false,
          updatedAt: now,
        }
      : { ...intake, messages, answers, status: 'complete', draftPledge: draftFromAnswers(answers).pledge, updatedAt: now };
  const saved = await deps.store.put('intakes', updated);
  return viewOf(saved, turn.source, saved.status === 'complete' ? null : saved.messages[saved.messages.length - 1]!.text);
}
