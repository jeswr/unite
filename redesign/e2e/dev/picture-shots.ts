/**
 * Screenshots of the picture and statements pages, for looking at by eye (not a test).
 *
 *   pnpm build && pnpm --filter @unite/server exec tsx ../../e2e/dev/picture-shots.ts
 *
 * Boots the built app in this process on a memory store in demo mode with the clock fixed, adds
 * the fixture data these pages need through the builders, and saves full-page screenshots at 375,
 * 768 and 1280 wide into e2e/shots/picture/.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type BrowserContext } from '@playwright/test';
import { stableId, type PointType } from '../../packages/shared/src/index.js';
import { createApp } from '../../apps/server/src/app.js';
import { boot } from '../../apps/server/src/boot.js';
import { loadConfig } from '../../apps/server/src/config.js';
import { ASSEMBLY_IDS } from '../../apps/server/src/seed/assemblies.js';
import {
  makeConversationWithPoints,
  makeMembership,
  makeObjection,
  makePerson,
  makeReason,
  makeReport,
  makeStatement,
  makeTheme,
  react,
  type SeedCtx,
} from '../../apps/server/src/seed/builders.js';

const OUT = path.resolve(import.meta.dirname, '../shots/picture');
const WIDTHS = [375, 768, 1280];
fs.mkdirSync(OUT, { recursive: true });

const config = loadConfig({ ...process.env, UNITE_DATA_DIR: 'memory', UNITE_DEMO: '1', UNITE_NOW: '2026-11-13T09:00:00Z', ANTHROPIC_API_KEY: '', NODE_ENV: 'test' });
const deps = await boot(config);
const ctx: SeedCtx = { store: deps.store, clock: deps.clock };
const E = ASSEMBLY_IDS.earning;
const O = ASSEMBLY_IDS.open;

/* ------------------------------------------------------------------ fixtures */

type P = [key: string, type: PointType, text: string, visibility?: 'count' | 'anonymous' | 'named'];
const people: { key: string; name: string; about: Record<string, string>; points: P[] }[] = [
  { key: 'amina', name: 'Amina', about: { work: 'I work shifts or nights', care: 'Yes', age: '25 to 49' }, points: [
    ['amina1', 'barrier', 'Every course at the college starts at six, which is when my shift starts'],
    ['amina2', 'matters', 'Being home when my boy gets back from school'],
    ['amina3', 'tradeoff', 'I could do the course or the overtime, not both'],
  ] },
  { key: 'dev', name: 'Dev', about: { work: 'I work shifts or nights', care: 'No', age: '50 or over' }, points: [
    ['dev1', 'barrier', 'Nights on the line mean I sleep through the daytime classes', 'named'],
    ['dev2', 'idea', 'Put the courses online at three in the morning, I would do them on my break'],
  ] },
  { key: 'grace', name: 'Grace', about: { work: 'I am out of work', care: 'Yes', age: '25 to 49' }, points: [
    ['grace1', 'barrier', 'Nobody minds the kids while I sit in a class'],
    ['grace2', 'matters', 'Time with my family that is not just tired time'],
    ['grace3', 'idea', 'A crèche in the same building as the classes'],
  ] },
  { key: 'tomasz', name: 'Tomasz', about: { work: 'I work regular daytime hours', care: 'No', age: '50 or over' }, points: [
    ['tomasz1', 'barrier', 'Twenty years fixing boilers and none of it counts as a qualification'],
    ['tomasz2', 'doubt', 'I am not sure the jobs they train for will be there in five years'],
  ] },
  { key: 'li', name: 'Li', about: { work: 'I work shifts or nights', care: 'Yes', age: '25 to 49' }, points: [
    ['li1', 'barrier', 'The rota comes out on Friday for the next week, so I cannot plan a course', 'count'],
    ['li2', 'matters', 'Being good at something people actually need'],
  ] },
  { key: 'rosa', name: 'Rosa', about: { work: 'I run or manage a local business', care: 'No', age: '50 or over' }, points: [
    ['rosa1', 'idea', 'Teach in the workplace, in the canteen after the shift'],
    ['rosa2', 'matters', 'Keeping my staff rather than training them for someone else'],
  ] },
  { key: 'kwame', name: 'Kwame', about: { work: 'I am studying', care: 'No', age: 'Under 25' }, points: [
    ['kwame1', 'matters', 'Learning with other people and not alone on a screen'],
    ['kwame2', 'moment', 'Fixed the neighbour’s bike with my little brother on Saturday'],
  ] },
];
for (const p of people) {
  const personId = stableId('per', `shots/${p.key}`);
  await makePerson(ctx, { id: personId, displayName: p.name, about: p.about });
  await makeMembership(ctx, { id: stableId('mem', `shots/${p.key}`), personId, assemblyId: E });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `shots/${p.key}`),
    personId,
    assemblyId: E,
    points: p.points.map(([key, type, text, visibility]) => ({ id: stableId('pt', `shots/${key}`), type, text, visibility })),
  });
}
const pt = (key: string) => stableId('pt', `shots/${key}`);
const thm = (key: string) => stableId('thm', `shots/${key}`);
await makeTheme(ctx, {
  id: thm('times'), assemblyId: E, kind: 'barrier', name: 'courses run when I am at work or asleep',
  pointIds: [pt('amina1'), pt('dev1'), pt('li1')],
  sentences: [
    { text: 'Courses start when shifts start, or in the day when night workers sleep.', pointIds: [pt('amina1'), pt('dev1')] },
    { text: 'Rotas come out too late to plan a course around them.', pointIds: [pt('li1')] },
  ],
});
await makeTheme(ctx, { id: thm('childcare'), assemblyId: E, kind: 'barrier', name: 'nobody minds the kids', pointIds: [pt('grace1')], sentences: [{ text: 'Classes need someone to look after children.', pointIds: [pt('grace1')] }] });
await makeTheme(ctx, { id: thm('counts'), assemblyId: E, kind: 'barrier', name: 'what I already know does not count', pointIds: [pt('tomasz1')] });
await makeTheme(ctx, { id: thm('family'), assemblyId: E, kind: 'matters', name: 'time with my family', pointIds: [pt('amina2'), pt('grace2')], sentences: [{ text: 'Time at home with children matters, and not only tired time.', pointIds: [pt('amina2'), pt('grace2')] }] });
await makeTheme(ctx, { id: thm('needed'), assemblyId: E, kind: 'matters', name: 'being good at something people need', pointIds: [pt('li2'), pt('rosa2'), pt('kwame1')] });
await makeTheme(ctx, { id: thm('day'), assemblyId: E, kind: 'day', name: 'fixed the neighbour’s bike', pointIds: [pt('kwame2')] });
await makeTheme(ctx, { id: thm('where'), assemblyId: E, kind: 'idea', name: 'teach in the workplace', pointIds: [pt('rosa1'), pt('dev2'), pt('grace3')], sentences: [{ text: 'Teach where people already are: at work, online at night, next to a crèche.', pointIds: [pt('rosa1'), pt('dev2'), pt('grace3')] }] });
await makeReport(ctx, { id: stableId('rpt', 'shots/1'), assemblyId: E, targetType: 'theme', targetId: thm('times'), kind: 'emphasis', text: 'It is the rota changing that stops me, not the time itself.', status: 'upheld', outcomeNote: 'The second sentence now names the rota.' });

const st = (k: string) => stableId('st', `shots/${k}`);
await makeStatement(ctx, { id: st('s1'), assemblyId: E, text: 'People who work nights or rotating shifts should be able to take any core course at a time that fits their shift.', pointIds: [pt('amina1'), pt('dev1'), pt('li1')], themeIds: [thm('times')], status: 'common_ground' });
await makeStatement(ctx, { id: st('s2'), assemblyId: E, text: 'Nobody should have to lose pay to retrain for a job that is disappearing.', pointIds: [pt('amina3'), pt('tomasz2')], status: 'differ' });
await makeStatement(ctx, { id: st('s6'), assemblyId: E, text: 'Childcare should be available during any funded class.', pointIds: [pt('grace1'), pt('grace3')], themeIds: [thm('childcare')], status: 'common_ground' });
await makeStatement(ctx, { id: st('s8'), assemblyId: E, text: 'People under 25 should help choose what the college teaches.', pointIds: [pt('kwame1')], status: 'not_enough' });
const values = { s1: ['agree', 'agree', 'agree', 'agree', 'unsure', 'agree', 'agree'], s2: ['agree', 'agree', 'agree', 'disagree', 'agree', 'disagree', 'disagree'], s6: ['agree', 'agree', 'agree', 'unsure', 'agree', 'agree', 'agree'], s8: ['agree', 'unsure'] } as const;
for (const [s, vs] of Object.entries(values))
  for (const [i, v] of vs.entries())
    await react(ctx, { id: stableId('rx', `shots/${s}/${i}`), statementId: st(s), assemblyId: E, personId: stableId('per', `shots/${people[i]!.key}`), value: v });
const per = (k: string) => stableId('per', `shots/${k}`);
await makeReason(ctx, { id: stableId('rsn', 'shots/1'), statementId: st('s2'), assemblyId: E, personId: per('amina'), side: 'for', text: 'I cannot pay the rent on a training allowance.' });
await makeReason(ctx, { id: stableId('rsn', 'shots/2'), statementId: st('s2'), assemblyId: E, personId: per('rosa'), side: 'against', text: 'Small firms cannot pay people to be away. It would have to come from somewhere else.' });
await makeReason(ctx, { id: stableId('rsn', 'shots/3'), statementId: st('s2'), assemblyId: E, personId: per('tomasz'), side: 'question', text: 'Who decides which jobs are disappearing?' });
await makeObjection(ctx, { id: stableId('obj', 'shots/1'), statementId: st('s2'), assemblyId: E, personId: per('rosa'), text: 'This puts the whole cost on employers, and that is off the table in the pledge.', status: 'answered', reply: 'The statement does not say who pays. A room will work on a wording that does.', repliedBy: 'Sam, steward' });

// Open listening: a few themes, one of them answered by the AI and care assembly.
for (const [i, [text, type]] of ([
  ['Looking after my mother after my shift, every single day', 'barrier'],
  ['Cars going too fast past the school gate', 'barrier'],
  ['Breakfast outside with my daughter before school', 'wish'],
  ['Walking to the market and knowing everyone on the way', 'wish'],
  ['Mi abuela necesita ayuda y yo trabajo todo el día', 'barrier'],
] as const).entries()) {
  const personId = stableId('per', `shots/open${i}`);
  await makePerson(ctx, { id: personId });
  await makeConversationWithPoints(ctx, {
    id: stableId('con', `shots/open${i}`), personId, assemblyId: O,
    points: [{ id: pt(`open${i}`), type, text, ...(i === 4 ? { textEn: 'My grandmother needs help and I work all day' } : {}) }],
  });
}
await makeTheme(ctx, { id: thm('ocare'), assemblyId: O, kind: 'barrier', name: 'looking after my mother', pointIds: [pt('open0'), pt('open4')] });
await makeTheme(ctx, { id: thm('ostreets'), assemblyId: O, kind: 'barrier', name: 'cars going too fast', pointIds: [pt('open1')] });
await makeTheme(ctx, { id: thm('oday'), assemblyId: O, kind: 'day', name: 'knowing everyone on the way', pointIds: [pt('open2'), pt('open3')] });
const care = await deps.store.get('assemblies', ASSEMBLY_IDS.aiAndCare);
if (care) await deps.store.put('assemblies', { ...care, fromThemeId: thm('ocare') });

/* ------------------------------------------------------------------ server and browser */

const server = createApp(deps).listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });

/** A browser context whose person has a completed conversation in the earning assembly and in open listening. */
async function heardContext(width: number): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 } });
  const me = await (await context.request.patch(`${base}/api/me`, { data: { displayName: 'You' } })).json();
  const personId: string = me.person.id;
  await makeMembership(ctx, { id: stableId('mem', `shots/me/${personId}`), personId, assemblyId: E });
  for (const a of [E, O])
    await makeConversationWithPoints(ctx, {
      id: stableId('con', `shots/me/${personId}/${a}`), personId, assemblyId: a,
      points: [{ id: stableId('pt', `shots/me/${personId}/${a}`), type: 'barrier', text: a === E ? 'My shifts change every fortnight' : 'Caring for my dad after work' }],
    });
  const add = async (themeId: string, a: string) => {
    const t = await deps.store.get('themes', themeId);
    await deps.store.put('themes', { ...t!, pointIds: [...t!.pointIds, stableId('pt', `shots/me/${personId}/${a}`)] });
  };
  await add(thm('times'), E);
  await add(thm('ocare'), O);
  await react(ctx, { id: stableId('rx', `shots/me/${personId}`), statementId: st('s6'), assemblyId: E, personId, value: 'agree' });
  return context;
}

const problems: string[] = [];
async function shoot(context: BrowserContext, url: string, name: string, width: number, act?: (page: import('@playwright/test').Page) => Promise<void>) {
  const page = await context.newPage();
  // A 403 is expected where rule 1 refuses someone not heard yet; the page explains it.
  page.on('console', (m) => m.type() === 'error' && !/status of 403/.test(m.text()) && problems.push(`${name}@${width}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}@${width}: ${e.message}`));
  await page.goto(base + url);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForLoadState('networkidle');
  if (act) await act(page);
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (scroll > client) problems.push(`${name}@${width}: scrolls sideways (${scroll} > ${client})`);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
  await page.close();
}

try {
  for (const width of WIDTHS) {
    const heard = await heardContext(width);
    await shoot(heard, '/a/earning-and-learning/picture', 'picture', width);
    await shoot(heard, '/a/earning-and-learning/picture', 'picture-sources', width, async (page) => {
      await page.getByText(/^Sources:/).first().click();
      await page.getByRole('button', { name: 'This is not what was said' }).first().click();
    });
    await shoot(heard, '/listening', 'listening', width);
    await shoot(heard, '/a/earning-and-learning/statements', 'statements', width);
    await shoot(heard, '/a/earning-and-learning/statements', 'statements-answered', width, async (page) => {
      await page.getByRole('button', { name: 'Agree', exact: true }).first().click();
      await page.getByRole('heading', { name: 'How others answered' }).waitFor();
    });
    await shoot(heard, `/a/earning-and-learning/statements/${st('s2')}`, 'statement', width);
    await heard.close();

    const fresh = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 } });
    await shoot(fresh, '/a/earning-and-learning/picture', 'picture-not-heard', width);
    await shoot(fresh, '/listening', 'listening-not-heard', width);
    await fresh.close();

    const steward = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 } });
    await steward.request.post(`${base}/api/role`, { data: { role: 'steward', code: config.stewardCode } });
    await shoot(steward, '/a/earning-and-learning/picture', 'picture-steward', width);
    await shoot(steward, `/a/earning-and-learning/statements/${st('s1')}`, 'statement-steward', width);
    await steward.close();
  }
} finally {
  await browser.close();
  server.close();
  await deps.store.close();
}
console.log(`Screenshots in ${OUT}`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
}
