/**
 * Screenshots of every page on the worked examples, for a design review (not a test).
 * Needs the built app running on the full seed in demo mode:
 *
 *   PORT=4399 UNITE_DATA_DIR=memory UNITE_DEMO=1 UNITE_NOW=2026-11-13T09:00:00Z pnpm start
 *   apps/server/node_modules/.bin/tsx e2e/dev/tour-shots.ts [outDir] [widths]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.TOUR_BASE ?? 'http://localhost:4399';
const OUT = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../shots/tour'));
const WIDTHS = (process.argv[3] ?? '375,1280').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
const problems: string[] = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, baseURL: BASE });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/403|404|401/.test(m.text())) problems.push(`${width} ${page.url()} console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${width} ${page.url()} error: ${e.message}`));

  const shot = async (name: string, url?: string) => {
    if (url) await page.goto(url);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(300);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (wide) problems.push(`${width} ${name}: scrolls sideways`);
    await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
  };
  const get = async <T,>(url: string): Promise<T> => (await page.request.get(url)).json() as Promise<T>;

  await shot('01-home', '/');
  await shot('02-assemblies', '/assemblies');
  await shot('03-earning', '/a/earning-and-learning');
  await shot('04-pledge', '/a/earning-and-learning/pledge');
  await shot('05-picture-not-heard', '/a/earning-and-learning/picture');

  // Look around the two examples.
  for (const slug of ['earning-and-learning', 'volunteering-tool', 'open'])
    await page.request.post(`/api/assemblies/${slug}/join`, { data: { lookAroundFirst: true } });
  await shot('06-earning-looking', '/a/earning-and-learning');
  await shot('07-picture', '/a/earning-and-learning/picture');
  await shot('08-statements', '/a/earning-and-learning/statements');
  const st = await get<{ statements?: { id: string; text: string }[] }>('/api/assemblies/earning-and-learning/statements');
  const list = st.statements ?? [];
  const differ = list.find((s) => /lose pay/.test(s.text)) ?? list[0];
  if (differ) await shot('09-statement', `/a/earning-and-learning/statements/${differ.id}`);
  await shot('10-rooms', '/a/earning-and-learning/rooms');
  const rooms = await get<{ rooms?: { id: string; status: string }[] }>('/api/assemblies/earning-and-learning/rooms');
  const closed = (rooms.rooms ?? []).find((r) => r.status === 'closed');
  if (closed) await shot('11-room-closed', `/a/earning-and-learning/rooms/${closed.id}`);
  await shot('12-priorities', '/a/earning-and-learning/priorities');
  await shot('13-volunteering', '/a/volunteering-tool');
  await shot('14-decisions', '/a/volunteering-tool/decisions');
  const ds = await get<{ decisions?: { id: string; number?: number }[] }>('/api/assemblies/volunteering-tool/decisions');
  const d = ds.decisions ?? [];
  if (d[0]) await shot('15-decision-1', `/a/volunteering-tool/decisions/${d[0].id}`);
  if (d[4]) await shot('16-decision-5', `/a/volunteering-tool/decisions/${d[4].id}`);
  await shot('17-register', '/register');
  await shot('18-host-record', '/hosts/northern-volunteer-centres-network');
  await shot('19-listening', '/listening');
  await shot('20-open', '/a/open');
  await shot('21-ai-and-care', '/a/ai-and-care');
  await shot('22-ai-and-care-pledge', '/a/ai-and-care/pledge');
  await shot('23-making-unite-better', '/a/making-unite-better');
  await shot('24-volunteering-picture', '/a/volunteering-tool/picture');
  await shot('25-feedback', '/feedback');
  await shot('26-changes', '/changes');
  await shot('27-how', '/how');
  await shot('28-rules', '/how/rules');
  await shot('29-prompts', '/how/prompts');
  await shot('30-me', '/me');
  await shot('31-talk-start', '/a/earning-and-learning/talk');
  await shot('32-host', '/host');
  await shot('33-steward', '/steward');
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
