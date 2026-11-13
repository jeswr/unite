import { defaultReasonSide, pickOtherSide, stableId, type Mediation, type MediationStep, type MediationTurn } from '@unite/shared';
import { MEDIATOR_FIXED, MEDIATOR_NO_OTHER_SIDE } from '../ai/prompts.js';
import { ASSEMBLY_IDS } from './assemblies.js';
import type { SeedCtx } from './builders.js';
import { EARNING_IDS } from './earning.js';

/**
 * Talk it through in Riverbend (section 12.3): four people who talked through the statement about
 * AI tools on fixed questions and approved only their reason. Each approved reason is the one
 * already in the seed (EARNING_REASONS), so no public record changes. The other side's reasons
 * they were shown are chosen by `pickOtherSide` from the reasons that existed when they started.
 * Everyone here is fictional.
 */

const A = ASSEMBLY_IDS.earning;
const STATEMENT = EARNING_IDS.statement('S5');

type Said = string | null; // null: "Skip this"

interface Script {
  person: string;
  /** The seeded reason the person approved (its key in EARNING_REASONS). */
  reason: string;
  answer: 'agree' | 'disagree';
  /** Roughly when they started; the turns are then moved to end when their reason was written. */
  startedAt: string;
  /** The person's answers in each step; step 2 is left out when there was nothing to show. */
  steps: Partial<Record<MediationStep, Said[]>>;
}

/** Each person's first answer in step 1 is the reason they went on to approve. */
const SCRIPTS: Script[] = [
  {
    person: 'owen',
    reason: 'S5-1',
    answer: 'agree',
    startedAt: '2026-10-22T18:58:00.000Z',
    steps: {
      1: [
        'I’d rather know how to use these tools than be replaced by someone who does. Teach it early and to everyone.',
        'The new lad at the depot used one to sort the rota in ten minutes. It took me all morning.',
      ],
      3: [null],
      4: ['Would it be taught in work time?'],
    },
  },
  {
    person: 'kev',
    reason: 'S5-2',
    answer: 'disagree',
    startedAt: '2026-10-22T23:21:00.000Z',
    steps: {
      1: [
        'Like reading? Reading doesn’t change every six months. Teach people to think and check, not to use this year’s app.',
        'I did a course on a booking system in 2019 and it was gone a year later.',
      ],
      2: ['Fair enough, nobody wants to be the one replaced.', 'They leave out that the tools keep changing.'],
      3: ['Teach people to check what a computer tells them.', 'Teach everyone to check what a computer tells them, whatever the tool.'],
      4: ['nothing'],
    },
  },
  {
    person: 'jo',
    reason: 'S5-3',
    answer: 'agree',
    startedAt: '2026-10-23T11:48:00.000Z',
    steps: {
      1: ['If I understand the software, I’m the one who checks it. That’s a job. If I don’t, I’m the one it replaces.'],
      2: ['It’s true the apps change.', 'They leave out that the checking job stays.'],
      3: [null],
      4: ['Who decides which tools get taught?'],
    },
  },
  {
    person: 'sandra',
    reason: 'S5-4',
    answer: 'disagree',
    startedAt: '2026-10-24T09:12:00.000Z',
    steps: {
      1: [
        'I need a level 3 in care, not a lesson on chatbots. Please don’t spend the care money on this.',
        'The course I need has a waiting list of a year.',
      ],
      2: ['Being the one who checks the software makes sense for some jobs.', 'They leave out care work. Nobody checks a chatbot in a care home.'],
      3: ['Teach AI tools where a job needs them, not to everyone.', 'Teach AI tools where a job needs them, and fund care courses first.'],
      4: ['How much of the money would this take from care courses?'],
    },
  },
];

const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

/** The turns of a conversation on fixed questions, a minute or two apart. */
function turnsFor(script: Script, otherSideShown: boolean): { turns: MediationTurn[]; endedAt: string } {
  const turns: MediationTurn[] = [];
  let minute = 0;
  const at = () => plus(script.startedAt, (minute += 1 + (turns.length % 3)));
  for (const step of [1, 2, 3, 4] as MediationStep[]) {
    if (step === 2 && !otherSideShown) {
      turns.push({ role: 'mediator', step, text: MEDIATOR_NO_OTHER_SIDE, skipped: true, createdAt: at() });
      continue;
    }
    const said = script.steps[step] ?? [];
    for (const [i, answer] of said.entries()) {
      turns.push({ role: 'mediator', step, text: MEDIATOR_FIXED[step]![i === 0 ? 0 : 1]!, fallback: true, createdAt: at() });
      turns.push(answer === null ? { role: 'person', step, text: '', skipped: true, createdAt: at() } : { role: 'person', step, text: answer, createdAt: at() });
    }
  }
  return { turns, endedAt: at() };
}

export async function seedMediations(ctx: SeedCtx): Promise<void> {
  const reasons = await ctx.store.list('reasons', { statementId: STATEMENT });
  for (const s of SCRIPTS) {
    const personId = EARNING_IDS.person(s.person);
    const reasonId = stableId('rsn', `earning/${s.reason}`);
    const approvedReason = reasons.find((r) => r.id === reasonId);
    if (!approvedReason || approvedReason.personId !== personId) throw new Error(`The seeded reason ${s.reason} is not ${s.person}’s`);
    const shown = pickOtherSide(
      reasons.filter((r) => r.createdAt < s.startedAt),
      s.answer,
      personId,
    );
    const draft = turnsFor(s, shown.length > 0);
    // The reason was written when the person approved it: the conversation is moved so it ends then.
    const completedAt = approvedReason.createdAt;
    const shift = new Date(completedAt).getTime() - new Date(draft.endedAt).getTime();
    const moved = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
    const startedAt = moved(s.startedAt);
    const turns = draft.turns.map((t) => ({ ...t, createdAt: moved(t.createdAt) }));
    if (pickOtherSide(reasons.filter((r) => r.createdAt < startedAt), s.answer, personId).length !== shown.length)
      throw new Error(`Moving ${s.person}’s conversation changes the reasons it showed`);
    const m: Mediation = {
      id: stableId('med', `earning/${s.person}`),
      assemblyId: A,
      statementId: STATEMENT,
      personId,
      status: 'complete',
      step: 4,
      answer: s.answer,
      turns,
      shownReasonIds: shown.map((r) => r.id),
      drafts: { reason: approvedReason.text, reasonSide: defaultReasonSide(s.answer)! },
      approved: { reasonId },
      aiUsed: false,
      startedAt,
      updatedAt: completedAt,
      completedAt,
    };
    await ctx.store.put('mediations', m);
  }
}
