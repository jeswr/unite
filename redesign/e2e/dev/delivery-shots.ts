/**
 * Screenshots of the delivery pages (decisions, register, host record, host and steward consoles)
 * at 375, 768 and 1280 wide, into e2e/shots/delivery/. Boots the built app in this process on a
 * memory store in demo mode with the clock fixed, adds its own fixture data, and does not depend on
 * the seed's content.
 *
 *   pnpm --filter @unite/web build
 *   pnpm --filter @unite/server exec tsx ../../e2e/dev/delivery-shots.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type Page } from '@playwright/test';
import { stableId } from '../../packages/shared/src/index.js';
import { createApp } from '../../apps/server/src/app.js';
import { boot } from '../../apps/server/src/boot.js';
import { loadConfig } from '../../apps/server/src/config.js';
import {
  makeAssembly,
  makeCheck,
  makeConversationWithPoints,
  makeDecision,
  makeDeliveryItem,
  makeProposal,
  makeStatement,
  makeTheme,
  type SeedCtx,
} from '../../apps/server/src/seed/builders.js';

const OUT = path.resolve(import.meta.dirname, '../shots/delivery');
const WIDTHS = [375, 768, 1280];

const config = loadConfig({ ...process.env, UNITE_DATA_DIR: 'memory', UNITE_DEMO: '1', UNITE_NOW: '2026-11-13T09:00:00Z', ANTHROPIC_API_KEY: '', NODE_ENV: 'test', UNITE_RATE_LIMITS: '0' });
const deps = await boot(config);
const ctx: SeedCtx = { store: deps.store, clock: deps.clock };

/* ------------------------------------------------------------- fixture data */

const A = stableId('asm', 'shots/tool');
const S = stableId('st', 'shots/s');
const T = [stableId('thm', 'shots/t1'), stableId('thm', 'shots/t2')];
await makeAssembly(ctx, {
  id: A,
  slug: 'shots-tool',
  title: 'Shared volunteering tool',
  question: 'What should a shared volunteering tool do for volunteers and the groups they help?',
  kind: 'technology',
  scale: 'sector',
  hostName: 'Northern Volunteer Centres Network',
  hostSlug: 'northern-volunteer-centres-network',
  hostDescription: 'A network of volunteer centres across the north (invented for this example).',
  stage: 'delivering',
  isExample: true,
  pledge: { setAside: 'A build budget of £80,000.', remit: 'What the tool does.', offTable: 'Funding of member groups.', decisionLevel: 2, groupThreshold: 0.6, minParticipants: 20, capacity: 5, replyBy: '2026-11-01', checkBody: 'panel', reviewAfterDays: 365 },
});
const pts: string[] = [];
for (let i = 0; i < 23; i++) {
  const id = stableId('pt', `shots/p${i}`);
  pts.push(id);
  await makeConversationWithPoints(ctx, { id: stableId('con', `shots/c${i}`), personId: stableId('per', `shots/per${i}`), assemblyId: A, points: [{ id, type: 'barrier', text: `Proving who I am again for each group, time ${i}.` }] });
  await deps.store.put('persons', { id: stableId('per', `shots/per${i}`), createdAt: deps.clock.iso(), isExample: true, about: {}, locale: 'en-GB' });
}
await makeTheme(ctx, { id: T[0]!, assemblyId: A, kind: 'barrier', name: 'Proving who I am again and again', pointIds: pts.slice(0, 15) });
await makeTheme(ctx, { id: T[1]!, assemblyId: A, kind: 'idea', name: 'One check I carry with me', pointIds: pts.slice(15) });
await makeStatement(ctx, { id: S, assemblyId: A, text: 'A volunteer proves who they are once and can share that proof with any group they choose.', themeIds: T, pointIds: pts, status: 'decided' });

const reasons = (t: string) => ({ reasons: t, answeredAt: '2026-10-28T10:00:00.000Z', answeredBy: 'Northern Volunteer Centres Network' });
const base = { assemblyId: A, statementId: S, reviewDate: '2027-11-01', dueDate: '2026-11-01', delivery: ['technology' as const] };
const D = [1, 2, 3, 4, 5, 6].map((n) => stableId('dec', `shots/d${n}`));
await makeDecision(ctx, {
  ...base,
  id: D[0]!,
  number: 1,
  rank: 1,
  title: 'A volunteer proves who they are once and can share that proof with any group they choose.',
  why: 'People told us that repeating the same identity check for every group was the main reason they stopped volunteering with more than one.',
  options: ['One check shared between groups, held by the volunteer', 'Each group keeps its own check, as now', 'A national register run by the network'],
  dissent: 'Two small groups want to keep doing their own check for work with children.',
  tests: [
    { n: 1, text: 'A volunteer checked by one group can start with a second group without a new identity check.' },
    { n: 2, text: 'The volunteer can see which groups have looked at their record.' },
    { n: 3, text: 'The volunteer can withdraw a group’s access at any time.' },
  ],
  status: 'delivered_minor_changes',
  answer: { kind: 'accepted', ...reasons('We have the build budget for this and it sits squarely inside the remit we pledged. Work starts in September.') },
});
await makeProposal(ctx, {
  id: stableId('prop', 'shots/p1'),
  decisionId: D[0]!,
  assemblyId: A,
  proposerName: 'Priya Natarajan',
  proposerRole: 'Developer at a volunteer centre',
  summary: 'A check record the volunteer holds and chooses who to share with.',
  plan: 'Build a record of each completed check, owned by the volunteer. Groups ask to see it; the volunteer agrees or not.',
  cost: '£34,000',
  testCoverage: [
    { n: 1, how: 'The second group sees the existing record and does not start a new check.' },
    { n: 2, how: 'Every look at the record is logged and shown to the volunteer.' },
    { n: 3, how: 'A button on the volunteer’s page ends a group’s access straight away.' },
  ],
  status: 'chosen',
  faithfulConfirmedAt: '2026-09-02T10:00:00.000Z',
});
await makeProposal(ctx, { id: stableId('prop', 'shots/p2'), decisionId: D[0]!, assemblyId: A, proposerName: 'Tom Ellis', proposerRole: 'Volunteer coordinator', summary: 'A printed card with a code.', plan: 'Print cards.', testCoverage: [{ n: 1, how: 'Show the card.' }, { n: 2, how: 'A stamp on the card.' }, { n: 3, how: 'Cancel the code.' }], status: 'not_chosen' });
for (const [i, title] of ['The volunteer’s check record', 'Sharing and withdrawing access', 'Access log on the volunteer’s page'].entries())
  await makeDeliveryItem(ctx, { id: stableId('dlv', `shots/i${i}`), decisionId: D[0]!, assemblyId: A, title, kind: 'technology', owner: 'Dana Okafor, product owner', dueDate: '2026-10-15', status: 'done', updates: [{ at: '2026-09-20T10:00:00.000Z', text: 'Work started.' }, { at: '2026-10-14T10:00:00.000Z', text: 'Live for every member group.' }] });
await makeCheck(ctx, {
  id: stableId('chk', 'shots/c1'),
  decisionId: D[0]!,
  assemblyId: A,
  checkBody: 'The check panel',
  panel: ['Amaka', 'Bilal', 'Carys', 'Dorota', 'Eamon'],
  results: [
    { n: 1, met: true, note: 'Two panel members started with a second group with no new check.' },
    { n: 2, met: false, note: 'Shows which groups looked, but not yet which member of staff.' },
    { n: 3, met: true, note: 'Withdrawing access worked at once.' },
  ],
  classification: 'minor_changes',
  summary: 'Test 2 is met for groups but not yet for individual staff. The panel counts this as a small change.',
});
await makeDecision(ctx, { ...base, id: D[1]!, number: 2, rank: 2, title: 'Hours given are recorded by the volunteer, confirmed by the group, and belong to the volunteer.', tests: [{ n: 1, text: 'A volunteer can download their hours.' }], status: 'in_progress', answer: { kind: 'accepted', ...reasons('This is inside our remit and the budget covers it.') } });
await makeDeliveryItem(ctx, { id: stableId('dlv', 'shots/i9'), decisionId: D[1]!, assemblyId: A, title: 'Hours record', kind: 'technology', owner: 'Dana Okafor', dueDate: '2027-02-01', status: 'in_progress', updates: [{ at: '2026-11-01T10:00:00.000Z', text: 'Design agreed with three groups.' }] });
await makeDecision(ctx, { ...base, id: D[2]!, number: 3, rank: 3, title: 'A group with no paid staff can start using it in ten minutes without training.', tests: [{ n: 1, text: 'A new group is set up in ten minutes.' }], status: 'changed', answer: { kind: 'changed', changedTo: 'The phone version first, the desktop version next spring.', ...reasons('Most small groups told us they run everything from a phone, so we will build that first.') } });
await makeDecision(ctx, { ...base, id: D[3]!, number: 4, rank: 4, title: 'The tool works in Welsh, Urdu and Polish from the first release.', tests: [{ n: 1, text: 'Every page is available in the three languages.' }], status: 'delayed', answer: { kind: 'delayed', delayedUntil: '2027-03-01', ...reasons('We could not book translators before the first release. They start in January.') } });
await makeDecision(ctx, { ...base, id: D[4]!, number: 5, rank: 5, title: 'The network pays volunteers’ travel costs through the tool.', tests: [{ n: 1, text: 'Travel costs are paid within a week.' }], status: 'refused', answer: { kind: 'refused', ...reasons('There is no budget line for travel and it is outside the remit we pledged. Instead we will publish each group’s travel policy in the tool.') } });
await makeDecision(ctx, { ...base, id: D[5]!, number: 6, rank: 6, title: 'Groups can see which volunteers are free this week.', tests: [{ n: 1, text: 'A group sees who is free.' }], dueDate: '2026-11-01' });

/* ------------------------------------------------------------- shots */

const server = createApp(deps).listen(0);
const port = (server.address() as AddressInfo).port;
const url = (p: string) => `http://localhost:${port}${p}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
const problems: string[] = [];

async function shoot(page: Page, name: string, width: number) {
  await page.waitForLoadState('networkidle');
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (scroll > client) problems.push(`${name} at ${width}px scrolls sideways (${scroll} > ${client})`);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
}

for (const width of WIDTHS) {
  for (const role of ['participant', 'host', 'steward'] as const) {
    const context = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 } });
    const page = await context.newPage();
    page.on('console', (m) => m.type() === 'error' && !/501|409|Not Implemented|Conflict/.test(m.text()) && problems.push(`${role} ${width}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${role} ${width}: ${e.message}`));
    if (role !== 'participant') {
      await page.goto(url(`/${role}`));
      await shoot(page, `${role}-gate`, width);
      await page.request.post(url('/api/role'), { data: { role, code: role } });
    }
    if (role === 'participant') {
      for (const [name, p] of [
        ['decisions', '/a/shots-tool/decisions'],
        ['decision-checked', `/a/shots-tool/decisions/${D[0]}`],
        ['decision-refused', `/a/shots-tool/decisions/${D[4]}`],
        ['decision-late', `/a/shots-tool/decisions/${D[5]}`],
        ['register', '/register'],
        ['register-filtered', '/register?status=in_progress'],
        ['host-record', '/hosts/northern-volunteer-centres-network'],
      ] as const) {
        await page.goto(url(p));
        await shoot(page, name, width);
      }
    }
    if (role === 'host') {
      await page.goto(url('/host'));
      await shoot(page, 'host-list', width);
      await page.goto(url(`/a/shots-tool/decisions/${D[5]}`));
      await shoot(page, 'host-decision-answer', width);
      await page.goto(url(`/a/shots-tool/decisions/${D[1]}`));
      await page.getByText('Add delivery work').click();
      await shoot(page, 'host-decision-delivery', width);
      await page.goto(url('/host'));
      await page.getByRole('button', { name: 'Open a new assembly' }).click();
      const answers = [
        'How should the town spend its evening bus budget?',
        'Night workers, students, carers, and people over 70',
        'The evening timetable and the routes we pay for.',
        '£120,000 a year for three years.',
        'Fares, because the operator sets them.',
        'We will take advice and answer it.',
      ];
      for (const a of answers) {
        await page.getByLabel('Your answer').fill(a);
        await Promise.all([page.waitForResponse(/\/turns$/), page.getByRole('button', { name: 'Send', exact: true }).click()]);
      }
      await shoot(page, 'host-intake', width);
      await page.getByLabel('Your answer').fill('By 31 January 2027.');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByLabel('The question people will be asked').waitFor();
      await page.getByLabel('Your own question 1 (optional)').fill("Obviously the late buses matter, don't you think?");
      await page.getByLabel('The organisation hosting it').click();
      await page.getByText('This may lead people toward an answer.').waitFor();
      await shoot(page, 'host-editor', width);
      await page.getByLabel('The organisation hosting it').fill(`Riverside Transport Board ${width}`);
      await page.getByLabel('What you can act on').fill('');
      await page.getByRole('button', { name: 'Publish the pledge' }).click();
      await page.getByText(/Still needed/).waitFor();
      await shoot(page, 'host-publish-refused', width);
      await page.goto(url('/host'));
      await page.getByRole('button', { name: 'Manage Shared volunteering tool', exact: true }).click();
      await page.getByText('Where it is').waitFor();
      await shoot(page, 'host-assembly', width);
    }
    if (role === 'steward') {
      await page.goto(url('/steward'));
      await shoot(page, 'steward-list', width);
      await page.getByRole('button', { name: 'See the jobs for Shared volunteering tool', exact: true }).click();
      await page.getByRole('heading', { name: /Jobs for/ }).waitFor();
      await page.getByRole('button', { name: 'Update the picture' }).click();
      await page.getByText('This part is not switched on yet.').first().waitFor();
      await shoot(page, 'steward-jobs', width);
      await page.goto(url(`/a/shots-tool/decisions/${D[1]}`));
      await page.getByText('(steward)').first().click();
      await shoot(page, 'steward-check', width);
    }
    await context.close();
  }
}

await browser.close();
server.close();
await deps.store.close();
console.log(`Screenshots in ${OUT}`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
}
