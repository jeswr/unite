/**
 * Screenshots of the rooms and priorities pages, for looking at them during the build (not a test).
 * Boots the built app in this process on a memory store in demo mode with the clock fixed, adds the
 * fixture data the pages need through the builders, and saves full-page screenshots at 375, 768 and
 * 1280 wide into e2e/shots/rooms/.
 *
 *   pnpm --filter @unite/web build
 *   apps/server/node_modules/.bin/tsx e2e/dev/rooms-shots.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type BrowserContext } from '@playwright/test';
import { stableId } from '../../packages/shared/src/index.js';
import { createApp } from '../../apps/server/src/app.js';
import { boot } from '../../apps/server/src/boot.js';
import { loadConfig } from '../../apps/server/src/config.js';
import { ASSEMBLY_IDS } from '../../apps/server/src/seed/assemblies.js';
import {
  choosePriorities,
  makeConversationWithPoints,
  makeEvidenceCard,
  makeMembership,
  makePerson,
  makeRoom,
  makeRoomAnswer,
  makeRoomMessage,
  makeStatement,
} from '../../apps/server/src/seed/builders.js';

const OUT = path.resolve(import.meta.dirname, '../shots/rooms');
fs.mkdirSync(OUT, { recursive: true });

const config = loadConfig({ ...process.env, UNITE_DATA_DIR: 'memory', UNITE_DEMO: '1', UNITE_NOW: '2026-11-13T09:00:00Z', NODE_ENV: 'test', ANTHROPIC_API_KEY: '', UNITE_RATE_LIMITS: '0' });
const deps = await boot(config);
const ctx = { store: deps.store, clock: deps.clock };
const ASM = ASSEMBLY_IDS.earning;
const SLUG = 'earning-and-learning';
const at = (min: number) => new Date(Date.parse('2026-11-13T09:00:00Z') + min * 60_000).toISOString();

const NAMES = ['Amina', 'Bogdan', 'Carys', 'Dev', 'Eilidh', 'Femi', 'Grace', 'Hamid', 'Ines', 'Jun', 'Kofi', 'Lena'];
async function heardPerson(key: string, name?: string, invited = true): Promise<string> {
  const id = stableId('per', `shots/${key}`);
  await makePerson(ctx, { id, ...(name ? { displayName: name } : {}) });
  await makeMembership(ctx, { id: stableId('mem', `shots/${key}`), personId: id, assemblyId: ASM, invited });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `shots/${key}`),
    personId: id,
    assemblyId: ASM,
    points: [{ id: stableId('pt', `shots/${key}`), type: 'barrier', text: 'Courses run when I am at work or asleep.' }],
  });
  return id;
}

const people: string[] = [];
for (let i = 0; i < 48; i++) people.push(await heardPerson(`p${i}`, NAMES[i]));
const pt = stableId('pt', 'shots/p0');

const S = [
  ['S1', 'People who work nights or rotating shifts should be able to take any core course at a time that fits their shift.', 'common_ground'],
  ['S2', 'Nobody should have to lose pay to retrain for a job that is disappearing.', 'differ'],
  ['S2b', 'Workers in roles their employer expects to change should get paid learning hours, with the cost shared between the employer and the skills fund.', 'common_ground'],
  ['S3', 'Skills people already have from work and from caring should count toward a qualification without sitting the course again.', 'common_ground'],
  ['S4', 'The college should teach in workplaces and community halls, and not only on campus.', 'common_ground'],
  ['S5', 'Everyone should be taught to use AI tools as a basic skill, like reading.', 'differ'],
  ['S6', 'Childcare should be available during any funded class.', 'common_ground'],
  ['S7', 'Courses should be chosen by what local employers say they need.', 'common_ground'],
] as const;
const st: Record<string, string> = {};
for (const [key, text, status] of S) {
  st[key] = stableId('st', `shots/${key}`);
  await makeStatement(ctx, { id: st[key], assemblyId: ASM, text, status, pointIds: [pt] });
}

// 31 people choose: a large group picks S1 and S6, a smaller one S2b and S3, a few S4.
const pattern = [
  ...Array(16).fill([st.S1, st.S6, st.S4]),
  ...Array(10).fill([st.S2b, st.S3]),
  ...Array(5).fill([st.S4, st.S2b, st.S7]),
] as string[][];
for (const [i, ids] of pattern.entries())
  await choosePriorities(ctx, { id: stableId('pc', `shots/${i}`), assemblyId: ASM, personId: people[i + 12]!, statementIds: ids });

const E1 = stableId('evd', 'shots/1');
const E2 = stableId('evd', 'shots/2');
await makeEvidenceCard(ctx, {
  id: E1,
  assemblyId: ASM,
  question: 'Do people who learn to use AI tools at work earn more?',
  answer: 'In the studies so far, some workers in office jobs saw small gains. There is little evidence yet for manual or care work.',
  sources: [{ title: 'Survey of workplace AI use, 2025', url: 'https://example.org/ai-work-survey' }],
  confidence: 'low',
  disputed: 'Some economists say the gains disappear once everyone has the same tools.',
  expertName: 'Dr Rosa Mendes',
  expertRole: 'labour economist',
});
await makeEvidenceCard(ctx, {
  id: E2,
  assemblyId: ASM,
  question: 'How long does it take an adult to learn basic AI tools?',
  answer: 'Short courses of six to ten hours cover the basics for most adults who already use a phone or computer.',
  sources: [{ title: 'Adult digital skills pilot, final report', url: 'https://example.org/digital-pilot' }],
  confidence: 'medium',
  expertName: 'Tom Okafor',
  expertRole: 'adult education lecturer',
});

const briefing = {
  summary: 'People in this assembly see this statement differently. This room is for hearing why, and for finding a wording more people could agree with.',
  forSide: ['More and more jobs expect it, and people who cannot use it get left behind.', 'Learning it with others is easier than alone on a screen.'],
  againstSide: ['Reading, maths and a trade come first; AI tools change every year.', 'It should be a choice, not something everyone is told to do.'],
  evidenceIds: [E1, E2],
};

// A closed room on S2 with its outcome and private answers.
const closedRoom = stableId('room', 'shots/closed');
await makeRoom(ctx, {
  id: closedRoom,
  assemblyId: ASM,
  statementId: st.S2,
  topic: 'Losing pay to retrain',
  briefing: { ...briefing, evidenceIds: [] },
  status: 'closed',
  memberIds: people.slice(40, 46),
  minutes: 45,
  startedAt: at(-24 * 60),
  endsAt: at(-24 * 60 + 45),
  outcome: {
    reasonsFor: ['If I stop earning for a month my rent does not stop.', 'The people whose jobs are going are the ones least able to pay.'],
    reasonsAgainst: ['Small employers cannot pay for staff to be away.', 'Who decides which jobs are disappearing?'],
    proposedWording: 'Workers in roles their employer expects to change should get paid learning hours, with the cost shared between the employer and the skills fund.',
    questionsForExperts: ['What did paid learning hours cost where they have been tried?'],
  },
});
for (const [i, v] of (['agree', 'agree', 'agree', 'agree', 'unsure', 'disagree'] as const).entries())
  await makeRoomAnswer(ctx, { id: stableId('ra', `shots/${i}`), roomId: closedRoom, personId: people[40 + i]!, value: v });

const BASE = await new Promise<string>((resolve) => {
  const server = createApp(deps).listen(0, () => resolve(`http://localhost:${(server.address() as AddressInfo).port}`));
});

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });

/** A browser context with its own person, made heard and invited in the assembly. */
async function viewer(name: string): Promise<{ context: BrowserContext; id: string }> {
  const context = await browser.newContext();
  const res = await context.request.patch(`${BASE}/api/me`, { data: { displayName: name } });
  const id = (await res.json()).person.id as string;
  await makeMembership(ctx, { id: stableId('mem', `shots/v/${id}`), personId: id, assemblyId: ASM, invited: true });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `shots/v/${id}`),
    personId: id,
    assemblyId: ASM,
    points: [{ id: stableId('pt', `shots/v/${id}`), type: 'matters', text: 'Being good at something people need.' }],
  });
  return { context, id };
}

const me = await viewer('Sam');
const late = await viewer('Priya');
const outsider = await viewer('Noor');

// My open room on S5: started 14 minutes ago, 45 minutes long, so 31 minutes left.
const openRoom = stableId('room', 'shots/open');
await makeRoom(ctx, {
  id: openRoom,
  assemblyId: ASM,
  statementId: st.S5,
  topic: 'Teaching AI tools as a basic skill',
  briefing,
  status: 'open',
  memberIds: [me.id, ...people.slice(0, 5)],
  minutes: 45,
  startedAt: at(-14),
  endsAt: at(31),
});
const msgs: [string | null, string, number][] = [
  [null, 'Welcome. I am the facilitator, and I am an AI. I keep time and turns and take no side. The question is in the briefing above. Who would like to start?', -14],
  [people[0]!, 'I clean offices at night. Nobody has ever asked me to use AI and I do not see why I would need it.', -13],
  [people[1]!, 'My warehouse brought in a scheduling app last year and half of us could not use it at first. So I think it matters.', -12],
  [me.id, 'For me it depends whether it is offered or forced. I would go if it was in the evening.', -11],
  [people[2]!, 'Forced is the problem. Reading I agree everyone needs. This changes every year.', -10],
  [people[3]!, 'Could it be part of the digital skills course that already exists, instead of something new?', -9],
  [people[4]!, 'That is what I was going to say. I did that course and it was mostly email.', -8],
  [null, 'We are half way through the time.', -7],
];
for (const [i, [who, text, min]] of msgs.entries())
  await makeRoomMessage(ctx, {
    id: stableId('msg', `shots/${i}`),
    roomId: openRoom,
    authorType: who ? 'person' : 'facilitator',
    ...(who ? { personId: who } : {}),
    text,
    createdAt: at(min),
  });

// Priya's room: its time is up, so the final answer and outcome forms show.
const lateRoom = stableId('room', 'shots/late');
await makeRoom(ctx, {
  id: lateRoom,
  assemblyId: ASM,
  statementId: st.S7,
  topic: 'Who chooses the courses',
  briefing: { ...briefing, evidenceIds: [] },
  status: 'open',
  memberIds: [late.id, ...people.slice(5, 10)],
  minutes: 45,
  startedAt: at(-46),
  endsAt: at(-1),
  outcome: { reasonsFor: ['Employers know which jobs are hiring.'], reasonsAgainst: [], questionsForExperts: [] },
});
await makeRoomMessage(ctx, { id: stableId('msg', 'shots/late1'), roomId: lateRoom, authorType: 'facilitator', text: 'We are half way through the time.', createdAt: at(-23) });

const shots: { name: string; ctx: BrowserContext; path: string }[] = [
  { name: 'rooms', ctx: me.context, path: `/a/${SLUG}/rooms` },
  { name: 'room-live', ctx: me.context, path: `/a/${SLUG}/rooms/${openRoom}` },
  { name: 'room-time-up', ctx: late.context, path: `/a/${SLUG}/rooms/${lateRoom}` },
  { name: 'room-closed', ctx: me.context, path: `/a/${SLUG}/rooms/${closedRoom}` },
  { name: 'room-not-member', ctx: outsider.context, path: `/a/${SLUG}/rooms/${openRoom}` },
  { name: 'rooms-not-drawn', ctx: outsider.context, path: `/a/${SLUG}/rooms` },
  { name: 'priorities', ctx: me.context, path: `/a/${SLUG}/priorities` },
];

const problems: string[] = [];
for (const width of [375, 768, 1280]) {
  for (const s of shots) {
    const page = await s.ctx.newPage();
    await page.setViewportSize({ width, height: width < 700 ? 800 : 900 });
    page.on('console', (m) => m.type() === 'error' && problems.push(`${s.name}@${width}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${s.name}@${width}: ${e.message}`));
    await page.goto(`${BASE}${s.path}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.waitForTimeout(1200);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (scroll > client) problems.push(`${s.name}@${width}: scrolls sideways (${scroll} > ${client})`);
    await page.screenshot({ path: path.join(OUT, `${s.name}-${width}.png`), fullPage: true });
    if (s.name === 'room-live') await page.screenshot({ path: path.join(OUT, `${s.name}-${width}-viewport.png`) });
    await page.close();
  }
}

await browser.close();
await deps.store.close();
console.log(problems.length ? `Problems:\n${problems.join('\n')}` : 'No console errors and no sideways scrolling.');
console.log(`Screenshots in ${OUT}`);
process.exit(problems.length ? 1 : 0);
