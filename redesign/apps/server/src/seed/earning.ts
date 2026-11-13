import { stableId } from '@unite/shared';
import { FACILITATOR_FALLBACK } from '../ai/prompts.js';
import { ASSEMBLY_IDS } from './assemblies.js';
import {
  choosePriorities,
  makeEvidenceCard,
  makeObjection,
  makeReason,
  makeReport,
  makeRoom,
  makeRoomAnswer,
  makeRoomMessage,
  makeStatement,
  react,
  type SeedCtx,
} from './builders.js';
import {
  EARNING_GROUP_B,
  EARNING_PRIORITIES,
  EARNING_REACTIONS,
  EARNING_REASONS,
  EARNING_STATEMENTS,
  EVIDENCE,
  OBJECTION_S4,
  REACTION_WINDOWS,
  REPORT_COUNTS,
  ROOM_S2,
  ROOM_S5,
  type StatementKey,
} from './content/earningDebate.js';
import { EARNING_PEOPLE, EARNING_THEMES } from './content/earningPeople.js';
import { addHours, at, finishedAt, idsFor, writePeople, writeThemes } from './content/write.js';

export const EARNING_SCOPE = 'earning';
const ids = idsFor(EARNING_SCOPE);
const A = ASSEMBLY_IDS.earning;

/** Fixed ids of the Riverbend records other code and tests refer to. */
export const EARNING_IDS = {
  statement: (key: StatementKey) => ids.statement(key),
  theme: (key: string) => ids.theme(key),
  person: (key: string) => ids.person(key),
  point: (ref: string) => ids.point(ref),
  roomS2: stableId('room', 'earning/S2'),
  roomS5: stableId('room', 'earning/S5'),
  evidence: (key: string) => stableId('evd', `earning/${key}`),
  objectionS4: stableId('obj', 'earning/S4'),
  report: stableId('rpt', 'earning/counts'),
};

/** Who answered a statement, and how, from the plan in the content file. */
export function plannedReactions(key: StatementKey): { person: string; value: 'agree' | 'disagree' | 'unsure' }[] {
  const plan = EARNING_REACTIONS[key];
  const groupB = new Set(EARNING_GROUP_B);
  return EARNING_PEOPLE.map((p) => p.key)
    .filter((k) => (plan.only ? plan.only.includes(k) : !(plan.skip ?? []).includes(k)))
    .map((k) => ({ person: k, value: plan.except[k] ?? (groupB.has(k) ? plan.b : plan.a) }));
}

/**
 * Riverbend: 48 invited participants with completed conversations (listening from 16 September
 * to 14 October 2026), the picture (confirmed 20 October), statements S1 to S8 with reactions,
 * reasons, the closed room on S2 that wrote S2b, the scheduled room on S5 with its evidence, an
 * answered objection, an upheld report and 31 people's priority choices. No decisions yet.
 */
export async function seedEarning(ctx: SeedCtx): Promise<void> {
  await writePeople(ctx, { scope: EARNING_SCOPE, assemblyId: A, people: EARNING_PEOPLE, start: '2026-09-16T00:00:00.000Z', end: '2026-10-14T23:00:00.000Z', invited: true });
  await writeThemes(ctx, { scope: EARNING_SCOPE, assemblyId: A, people: EARNING_PEOPLE, themes: EARNING_THEMES, at: '2026-10-18T10:30:00.000Z' });

  await makeReport(at(ctx, REPORT_COUNTS.at), {
    id: EARNING_IDS.report,
    assemblyId: A,
    targetType: 'theme',
    targetId: ids.theme('counts'),
    kind: REPORT_COUNTS.kind,
    text: REPORT_COUNTS.text,
    personId: ids.person(REPORT_COUNTS.person),
    status: 'upheld',
    outcomeNote: REPORT_COUNTS.outcomeNote,
    resolvedAt: REPORT_COUNTS.resolvedAt,
  });

  for (const s of EARNING_STATEMENTS) {
    await makeStatement(at(ctx, s.createdAt), {
      id: ids.statement(s.key),
      assemblyId: A,
      text: s.text,
      themeIds: s.themes.map((t) => ids.theme(t)),
      pointIds: s.from.map((r) => ids.point(r)),
      status: s.status,
      ...(s.key === 'S2b' ? { version: 2, previousId: ids.statement('S2'), origin: 'room' as const } : { origin: 'ai' as const }),
    });
    const [from, to] = REACTION_WINDOWS[s.key];
    const planned = plannedReactions(s.key);
    for (const [i, r] of planned.entries()) {
      await react(at(ctx, finishedAt(i, planned.length, `${from}T00:00:00.000Z`, `${to}T23:00:00.000Z`)), {
        id: ids.reaction(s.key, r.person),
        statementId: ids.statement(s.key),
        assemblyId: A,
        personId: ids.person(r.person),
        value: r.value,
      });
    }
  }

  for (const r of EARNING_REASONS) {
    await makeReason(at(ctx, r.at), { id: ids.reason(r.key), statementId: ids.statement(r.statement), assemblyId: A, personId: ids.person(r.person), side: r.side, text: r.text });
  }

  await makeObjection(at(ctx, OBJECTION_S4.at), {
    id: EARNING_IDS.objectionS4,
    statementId: ids.statement('S4'),
    assemblyId: A,
    personId: ids.person(OBJECTION_S4.person),
    text: OBJECTION_S4.text,
    status: 'answered',
    reply: OBJECTION_S4.reply,
    repliedBy: OBJECTION_S4.repliedBy,
    resolvedAt: OBJECTION_S4.resolvedAt,
  });

  // The closed room on S2. Its members wrote the wording that became S2b.
  const s2b = EARNING_STATEMENTS.find((s) => s.key === 'S2b')!;
  await makeRoom(at(ctx, ROOM_S2.startedAt), {
    id: EARNING_IDS.roomS2,
    assemblyId: A,
    statementId: ids.statement('S2'),
    topic: ROOM_S2.topic,
    briefing: { ...ROOM_S2.briefing, evidenceIds: [] },
    status: 'closed',
    memberIds: ROOM_S2.members.map((m) => ids.person(m)),
    minutes: 45,
    startedAt: ROOM_S2.startedAt,
    endsAt: ROOM_S2.endsAt,
    outcome: { ...ROOM_S2.outcome, proposedWording: s2b.text },
  });
  for (const [i, [minute, author, text]] of ROOM_S2.messages.entries()) {
    const when = addHours(ROOM_S2.startedAt, minute / 60);
    const id = stableId('msg', `earning/S2/${i}`);
    if (author === 'facilitator') {
      const [trigger, name] = text.split(':');
      const words = FACILITATOR_FALLBACK[trigger!]!.replace('{name}', name ?? '');
      await makeRoomMessage(at(ctx, when), { id, roomId: EARNING_IDS.roomS2, authorType: 'facilitator', text: words });
    } else {
      await makeRoomMessage(at(ctx, when), { id, roomId: EARNING_IDS.roomS2, authorType: 'person', personId: ids.person(author), text });
    }
  }
  for (const [person, value, note] of ROOM_S2.answers) {
    await makeRoomAnswer(ctx, { id: stableId('ra', `earning/S2/${person}`), roomId: EARNING_IDS.roomS2, personId: ids.person(person), value, ...(note ? { note } : {}) });
  }

  // The scheduled room on S5, with its two evidence cards.
  for (const e of EVIDENCE) {
    await makeEvidenceCard(ctx, {
      id: EARNING_IDS.evidence(e.key),
      assemblyId: A,
      question: e.question,
      answer: e.answer,
      sources: e.sources,
      confidence: e.confidence,
      disputed: e.disputed,
      expertName: e.expertName,
      expertRole: e.expertRole,
    });
  }
  await makeRoom(ctx, {
    id: EARNING_IDS.roomS5,
    assemblyId: A,
    statementId: ids.statement('S5'),
    topic: ROOM_S5.topic,
    briefing: { ...ROOM_S5.briefing, evidenceIds: EVIDENCE.map((e) => EARNING_IDS.evidence(e.key)) },
    status: 'scheduled',
    memberIds: ROOM_S5.members.map((m) => ids.person(m)),
    minutes: 45,
  });

  for (const [i, [person, keys]] of EARNING_PRIORITIES.entries()) {
    await choosePriorities(at(ctx, finishedAt(i, EARNING_PRIORITIES.length, '2026-11-01T00:00:00.000Z', '2026-11-12T22:00:00.000Z')), {
      id: ids.choice(person),
      assemblyId: A,
      personId: ids.person(person),
      statementIds: keys.map((k) => ids.statement(k)),
    });
  }
}
