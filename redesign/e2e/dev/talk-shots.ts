/**
 * Screenshots of the talk lane's pages at 375, 768 and 1280 wide, into e2e/shots/talk/.
 * Boots the built app in this process on a memory store (demo seed, scripted mode, fixed clock),
 * walks through a conversation in the browser, and adds a theme, statement and decision for the
 * trace on /me. Run from redesign/ after `pnpm build`:
 *
 *   pnpm --filter @unite/server exec tsx ../../e2e/dev/talk-shots.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { createApp } from '../../apps/server/src/app.js';
import { boot } from '../../apps/server/src/boot.js';
import { loadConfig } from '../../apps/server/src/config.js';
import { makeDecision, makeStatement, makeTheme } from '../../apps/server/src/seed/builders.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../shots/talk');
fs.mkdirSync(out, { recursive: true });

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  UNITE_DATA_DIR: 'memory',
  UNITE_DEMO: '1',
  UNITE_NOW: '2026-11-13T09:00:00Z',
  ANTHROPIC_API_KEY: '',
  UNITE_RATE_LIMITS: '0',
});
const deps = await boot(config);
const server = createApp(deps).listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://localhost:${(server.address() as { port: number }).port}`;
const WIDTHS = [375, 768, 1280];
const problems: string[] = [];

async function shoot(page: Page, name: string) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w === 375 ? 740 : 900 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) problems.push(`${name} at ${w}: sideways scroll`);
    await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({ path: path.join(out, `${name}-${w}-viewport.png`) });
  }
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));

  // Start, in an assembly.
  await page.goto(`${base}/a/earning-and-learning/talk`);
  await page.getByRole('button', { name: 'I understand. Start' }).waitFor();
  await shoot(page, 'start-assembly');
  await page.goto(`${base}/talk`);
  await page.getByRole('button', { name: 'I understand. Start' }).waitFor();
  await shoot(page, 'start-open');

  // The AI route (scripted mode, as no key is set).
  await page.goto(`${base}/a/earning-and-learning/talk`);
  await page.getByRole('button', { name: 'I understand. Start' }).click();
  await page.getByLabel('Your answer').waitFor();
  await shoot(page, 'conversation-first');
  const answers = [
    'I finished my night shift at the care home at seven. Then I took the bus home and slept until two.',
    'I picked my daughter up from school and we made tea together. Then I went back to work at nine.',
    'Making tea with her mattered. It is the only time in the day we talk properly.',
    'Because I miss most of her week, and I want her to know I am there.',
  ];
  for (const a of answers) {
    await page.getByLabel('Your answer').fill(a);
    await page.getByLabel('Your answer').press('Enter');
    await page.waitForFunction((t) => document.body.innerText.includes(t), a.slice(0, 30));
    await page.waitForTimeout(200);
  }
  await shoot(page, 'conversation');
  const conversationUrl = page.url();

  await page.getByRole('button', { name: 'Stop here and review' }).click();
  await shoot(page, 'conversation-stop-dialog');
  await page.getByRole('button', { name: 'Stop and see my points' }).click();
  await page.getByRole('heading', { name: 'Here is what I heard' }).waitFor();
  await page.getByText('From what you said').first().click();
  await shoot(page, 'review');
  await page.getByRole('button', { name: 'Scrap this point' }).last().click();
  await page.getByText('Scrapped. This point will not be shared.').waitFor();
  await page.getByRole('button', { name: 'Add a point of your own' }).click();
  await page.getByRole('textbox', { name: 'Your point' }).fill('Evening classes that end before my shift starts');
  await shoot(page, 'review-editing');
  await page.getByRole('button', { name: 'Add this point' }).click();
  await page.getByRole('button', { name: 'These are right' }).click();
  await page.getByText('Do these points sound like you?').waitFor();
  await shoot(page, 'exit-questions');
  await page.getByLabel('Mostly like me').check();
  await page.getByLabel('No', { exact: true }).check();
  await page.getByRole('button', { name: 'Send my answers' }).click();
  await page.getByRole('link', { name: 'See the picture' }).waitFor();
  await shoot(page, 'thanks');

  // Something to trace: a theme, a statement and a decision resting on the first point.
  const conversationId = conversationUrl.split('/').pop()!;
  const conv = (await deps.store.get('conversations', conversationId))!;
  const [first] = await deps.store.list('points', { conversationId, status: 'approved' });
  const sctx = { store: deps.store, clock: deps.clock };
  const theme = 'thm_shotsteaAAAA';
  const st = 'st_shotsteaAAAA';
  await makeTheme(sctx, { id: theme, assemblyId: conv.assemblyId, kind: 'day', name: 'Time with my family', pointIds: [first!.id] });
  await makeStatement(sctx, { id: st, assemblyId: conv.assemblyId, text: 'Classes should end in time for parents to see their children.', pointIds: [first!.id], themeIds: [theme], status: 'common_ground' });
  await makeDecision(sctx, { id: 'dec_shotsteaAAAA', assemblyId: conv.assemblyId, statementId: st, number: 4, title: 'Evening classes end by six', tests: [], rank: 4, dueDate: '2026-12-18', reviewDate: '2027-12-18' });
  await page.goto(`${base}/me`);
  await page.getByText('Time with my family').first().waitFor();
  await shoot(page, 'me');
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await shoot(page, 'me-delete-dialog');
  await page.keyboard.press('Escape');

  // Written questions and free writing, in open listening.
  await page.goto(`${base}/talk`);
  await page.getByLabel(/Answer written questions/).check();
  await page.getByRole('button', { name: 'I understand. Start' }).click();
  await page.getByRole('button', { name: 'Next' }).waitFor();
  await shoot(page, 'questions');
  await page.goto(`${base}/talk`);
  await page.getByLabel(/Write freely/).check();
  await page.getByRole('button', { name: 'I understand. Start' }).click();
  await page.getByRole('button', { name: 'I have finished' }).waitFor();
  await shoot(page, 'freetext');

  // The host route's one-time link, opened by someone new.
  const host = await browser.newContext();
  const hostPage = await host.newPage();
  await hostPage.goto(base);
  await hostPage.request.post(`${base}/api/role`, { data: { role: 'host', code: 'host' } });
  const created = await hostPage.request.post(`${base}/api/conversations`, {
    data: { assemblySlug: 'earning-and-learning', route: 'host', language: 'en-GB', points: [{ type: 'barrier', text: 'The bus does not run after ten, so I cannot get to evening classes' }, { type: 'idea', text: 'Classes in the community hall on my estate' }] },
  });
  const { approvePath } = (await created.json()) as { approvePath: string };
  const fresh = await browser.newContext();
  const linkPage = await fresh.newPage();
  linkPage.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  await linkPage.goto(`${base}${approvePath}`);
  await linkPage.getByRole('button', { name: 'These are right' }).waitFor({ timeout: 5000 }).catch(() => problems.push('approve link page did not render (route not in routes.tsx yet?)'));
  await shoot(linkPage, 'approve-link');
} finally {
  await browser.close();
  server.close();
  await deps.store.close();
}
console.log(problems.length ? `Problems:\n${problems.join('\n')}` : 'No sideways scroll and no console errors.');
console.log(`Screenshots in ${out}`);
