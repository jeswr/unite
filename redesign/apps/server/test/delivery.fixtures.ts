import request from 'supertest';
import { stableId, type Pledge } from '@unite/shared';
import {
  makeAssembly,
  makeConversationWithPoints,
  makeDecision,
  makeMembership,
  makePerson,
  makeStatement,
  makeTheme,
  type SeedCtx,
} from '../src/seed/builders.js';
import { cookiesOf, type TestEnv } from './helpers.js';

/** Small fixtures for the delivery, register and host tests. Independent of the seed. */

export const PLEDGE: Pledge = {
  setAside: 'A build budget of £80,000 and a named product owner.',
  remit: 'What the shared volunteering tool does.',
  offTable: 'Funding of member groups, which the network does not control.',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 20,
  capacity: 5,
  replyBy: '2026-11-01',
  checkBody: 'panel',
  reviewAfterDays: 365,
};

export const IDS = {
  tool: stableId('asm', 'test/tool'),
  alpha: stableId('asm', 'test/alpha'),
  statement: stableId('st', 'test/s1'),
  theme: stableId('thm', 'test/t1'),
  theme2: stableId('thm', 'test/t2'),
  d1: stableId('dec', 'test/d1'),
  d2: stableId('dec', 'test/d2'),
  d3: stableId('dec', 'test/d3'),
  people: [1, 2, 3].map((i) => stableId('per', `test/p${i}`)),
  points: [1, 2, 3, 4].map((i) => stableId('pt', `test/pt${i}`)),
};

export const TESTS = [
  { n: 1, text: 'A volunteer checked by one group can start with a second group without a new check.' },
  { n: 2, text: 'The volunteer can see which groups have looked at their record.' },
];

export async function deliveryFixture(env: TestEnv) {
  const ctx: SeedCtx = { store: env.deps.store, clock: env.clock };
  await makeAssembly(ctx, {
    id: IDS.tool,
    slug: 'tool',
    title: 'Volunteering tool',
    question: 'What should a shared volunteering tool do?',
    kind: 'technology',
    scale: 'sector',
    hostName: 'Northern Network',
    hostSlug: 'northern-network',
    stage: 'answered',
    isExample: false,
    pledge: PLEDGE,
  });
  await makeAssembly(ctx, {
    id: IDS.alpha,
    slug: 'alpha',
    title: 'Allotments',
    question: 'What should happen to the allotments?',
    kind: 'advisory',
    scale: 'local',
    hostName: 'Alpha Council',
    hostSlug: 'alpha-council',
    stage: 'answered',
    isExample: false,
    pledge: { ...PLEDGE, replyBy: '2026-12-18' },
  });
  for (const [i, id] of IDS.people.entries())
    await makePerson(ctx, { id, isExample: false, ...(i === 0 ? { displayName: 'Amina' } : { displayName: `Secret${i}` }) });
  // Three people's points behind the statement; person 3 has two points.
  await makeConversationWithPoints(ctx, {
    id: stableId('con', 'test/c1'),
    personId: IDS.people[0]!,
    assemblyId: IDS.tool,
    points: [{ id: IDS.points[0]!, type: 'matters', text: 'Proving who I am again for every group wears me out.', visibility: 'named' }],
  });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', 'test/c2'),
    personId: IDS.people[1]!,
    assemblyId: IDS.tool,
    points: [{ id: IDS.points[1]!, type: 'barrier', text: 'Every group wants the same forms filled in.', visibility: 'count' }],
  });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', 'test/c3'),
    personId: IDS.people[2]!,
    assemblyId: IDS.tool,
    points: [
      { id: IDS.points[2]!, type: 'barrier', text: 'The checks take weeks each time.', visibility: 'anonymous' },
      { id: IDS.points[3]!, type: 'idea', text: 'One check that I carry with me.', visibility: 'anonymous' },
    ],
  });
  await makeTheme(ctx, { id: IDS.theme, assemblyId: IDS.tool, kind: 'barrier', name: 'Proving who I am again and again', pointIds: IDS.points.slice(0, 3), sentences: [{ text: 'People repeat the same checks.', pointIds: IDS.points.slice(0, 2) }] });
  await makeTheme(ctx, { id: IDS.theme2, assemblyId: IDS.tool, kind: 'idea', name: 'One check I carry with me', pointIds: [IDS.points[3]!] });
  await makeStatement(ctx, {
    id: IDS.statement,
    assemblyId: IDS.tool,
    text: 'A volunteer proves who they are once and can share that proof with any group they choose.',
    themeIds: [IDS.theme, IDS.theme2],
    pointIds: IDS.points,
    status: 'decided',
  });
  const base = { assemblyId: IDS.tool, statementId: IDS.statement, reviewDate: '2027-11-01', delivery: ['technology' as const] };
  await makeDecision(ctx, { ...base, id: IDS.d1, number: 1, rank: 1, title: 'Prove who you are once', why: 'Repeating checks puts people off.', options: ['One shared check', 'A check per group'], dissent: 'Some groups want their own check.', tests: TESTS, dueDate: '2026-11-01' });
  await makeDecision(ctx, { ...base, id: IDS.d2, number: 2, rank: 2, title: 'Hours belong to the volunteer', tests: [TESTS[0]!], dueDate: '2026-12-18' });
  await makeDecision(ctx, { ...base, id: IDS.d3, number: 1, rank: 1, assemblyId: IDS.alpha, title: 'Keep the allotments', tests: [TESTS[0]!], dueDate: '2026-12-18' });
  return ctx;
}

export const roleCookie = async (env: TestEnv, role: 'host' | 'steward') =>
  cookiesOf(await request(env.app).post('/api/role').send({ role, code: role }));

/** A new person (with a session cookie), not heard anywhere. */
export async function newPerson(env: TestEnv) {
  const res = await request(env.app).patch('/api/me').send({ displayName: 'Tester' });
  return { cookie: cookiesOf(res), id: res.body.person.id as string };
}

/** A new person on the check panel of the tool assembly. */
export async function checker(env: TestEnv, ctx: SeedCtx) {
  const p = await newPerson(env);
  await makeMembership(ctx, { id: stableId('mem', `test/checker/${p.id}`), personId: p.id, assemblyId: IDS.tool, role: 'checker', invited: true });
  return p;
}

export const REASONS = 'We have the budget for this and it sits inside the remit we pledged.';

/** A new person with a completed conversation in the tool assembly. */
export async function heardPerson(env: TestEnv, ctx: SeedCtx) {
  const p = await newPerson(env);
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `test/heard/${p.id}`),
    personId: p.id,
    assemblyId: IDS.tool,
    points: [{ id: stableId('pt', `test/heard/${p.id}`), type: 'idea', text: 'A record I own.' }],
  });
  return p;
}
