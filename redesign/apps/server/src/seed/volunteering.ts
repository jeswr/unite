import { stableId } from '@unite/shared';
import { ASSEMBLY_IDS } from './assemblies.js';
import { choosePriorities, makeCheck, makeDecision, makeDeliveryItem, makeProposal, makeStatement, react, type SeedCtx } from './builders.js';
import {
  CHECK_D1,
  DECISIONS,
  DELIVERY,
  PRODUCT_OWNER,
  PROPOSALS,
  VOLUNTEERING_PRIORITIES,
  VOLUNTEERING_REACTIONS,
  VOLUNTEERING_STATEMENTS,
  type VKey,
} from './content/volunteeringDecisions.js';
import { VOLUNTEERING_PEOPLE, VOLUNTEERING_THEMES } from './content/volunteeringPeople.js';
import { at, finishedAt, idsFor, writePeople, writeThemes } from './content/write.js';

export const VOLUNTEERING_SCOPE = 'volunteering';
const ids = idsFor(VOLUNTEERING_SCOPE);
const A = ASSEMBLY_IDS.volunteering;

export const VOLUNTEERING_IDS = {
  statement: (key: VKey) => ids.statement(key),
  person: (key: string) => ids.person(key),
  point: (ref: string) => ids.point(ref),
  theme: (key: string) => ids.theme(key),
  decision: (n: number) => stableId('dec', `volunteering/${n}`),
  proposal: (key: string) => stableId('prop', `volunteering/${key}`),
  delivery: (key: string) => stableId('dlv', `volunteering/${key}`),
  checkD1: stableId('chk', 'volunteering/1'),
};

const STATEMENTS_AT = '2026-04-14T10:00:00.000Z';
const DECIDED_AT = '2026-05-20T10:00:00.000Z';

/** Who answered a statement, and how. */
export function plannedVolunteeringReactions(key: VKey): { person: string; value: 'agree' | 'disagree' | 'unsure' }[] {
  const plan = VOLUNTEERING_REACTIONS[key];
  return VOLUNTEERING_PEOPLE.map((p) => ({ person: p.key, value: plan.except[p.key] ?? plan.usual }));
}

/**
 * The volunteering tool: 36 participants, a confirmed picture, settled statements, closed
 * priorities, the five decisions with answers, proposals, delivery items and the check of Decision 1.
 */
export async function seedVolunteering(ctx: SeedCtx): Promise<void> {
  await writePeople(ctx, { scope: VOLUNTEERING_SCOPE, assemblyId: A, people: VOLUNTEERING_PEOPLE, start: '2026-02-17T00:00:00.000Z', end: '2026-03-31T22:00:00.000Z', invited: true });
  await writeThemes(ctx, { scope: VOLUNTEERING_SCOPE, assemblyId: A, people: VOLUNTEERING_PEOPLE, themes: VOLUNTEERING_THEMES, at: '2026-04-09T10:00:00.000Z' });

  for (const [i, s] of VOLUNTEERING_STATEMENTS.entries()) {
    const created = new Date(new Date(STATEMENTS_AT).getTime() + i * 60_000).toISOString();
    await makeStatement(at(ctx, created), {
      id: ids.statement(s.key),
      assemblyId: A,
      text: s.text,
      themeIds: s.themes.map((t) => ids.theme(t)),
      pointIds: s.from.map((r) => ids.point(r)),
      status: s.status,
      updatedAt: DECIDED_AT,
    });
    const planned = plannedVolunteeringReactions(s.key);
    for (const [j, r] of planned.entries()) {
      await react(at(ctx, finishedAt(j, planned.length, '2026-04-14T12:00:00.000Z', '2026-05-08T20:00:00.000Z')), {
        id: ids.reaction(s.key, r.person),
        statementId: ids.statement(s.key),
        assemblyId: A,
        personId: ids.person(r.person),
        value: r.value,
      });
    }
  }

  for (const [i, [person, keys]] of VOLUNTEERING_PRIORITIES.entries()) {
    await choosePriorities(at(ctx, finishedAt(i, VOLUNTEERING_PRIORITIES.length, '2026-05-01T00:00:00.000Z', '2026-05-15T20:00:00.000Z')), {
      id: ids.choice(person),
      assemblyId: A,
      personId: ids.person(person),
      statementIds: keys.map((k) => ids.statement(k)),
    });
  }

  const statementText = (k: VKey) => VOLUNTEERING_STATEMENTS.find((s) => s.key === k)!.text;
  for (const d of DECISIONS) {
    await makeDecision(at(ctx, DECIDED_AT), {
      id: VOLUNTEERING_IDS.decision(d.n),
      assemblyId: A,
      statementId: ids.statement(d.statement),
      number: d.n,
      title: statementText(d.statement),
      why: d.why,
      options: d.options,
      dissent: d.dissent,
      tests: d.tests.map((text, i) => ({ n: i + 1, text })),
      delivery: d.delivery,
      rank: d.n,
      dueDate: '2026-06-30',
      reviewDate: '2027-06-30',
      status: d.status,
      answer: { ...d.answer, answeredAt: '2026-06-24T15:00:00.000Z', answeredBy: PRODUCT_OWNER },
      updatedAt: d.updatedAt,
    });
  }

  for (const p of PROPOSALS) {
    await makeProposal(ctx, {
      id: VOLUNTEERING_IDS.proposal(p.key),
      decisionId: VOLUNTEERING_IDS.decision(p.decision),
      assemblyId: A,
      proposerName: p.proposerName,
      proposerRole: p.proposerRole,
      summary: p.summary,
      plan: p.plan,
      cost: p.cost,
      testCoverage: p.testCoverage,
      status: p.status,
      ...('faithfulConfirmedAt' in p ? { faithfulConfirmedAt: p.faithfulConfirmedAt } : {}),
    });
  }

  for (const item of DELIVERY) {
    await makeDeliveryItem(ctx, {
      id: VOLUNTEERING_IDS.delivery(item.key),
      decisionId: VOLUNTEERING_IDS.decision(item.decision),
      assemblyId: A,
      title: item.title,
      kind: item.kind,
      owner: item.owner,
      dueDate: item.dueDate,
      status: item.status,
      updates: item.updates,
    });
  }

  await makeCheck(ctx, {
    id: VOLUNTEERING_IDS.checkD1,
    decisionId: VOLUNTEERING_IDS.decision(1),
    assemblyId: A,
    checkBody: CHECK_D1.checkBody,
    panel: CHECK_D1.panel.map((k) => ids.person(k)),
    results: CHECK_D1.results,
    classification: CHECK_D1.classification,
    summary: CHECK_D1.summary,
    checkedAt: CHECK_D1.checkedAt,
  });
}
