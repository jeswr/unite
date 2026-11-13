import type { Room } from '../../packages/shared/src/index.js';
import { asRole, checkPhoneWidth, expect, INVITE, noSidewaysScroll, signInAs, test, viewAs } from './helpers.js';

/**
 * A steward draws a room on a statement where people differ, opens it, a member talks and answers
 * privately, a visitor who is not in the room is kept out, and once closed only totals show.
 */
test('a room is drawn, talked in, kept private and closed with totals only', async ({ page, browser }) => {
  await page.goto('/steward');
  await viewAs(page, 'Steward');
  await page.getByRole('button', { name: 'See the jobs for Earning and learning in Riverbend' }).click();
  await expect(page.getByRole('heading', { name: /^Jobs for / })).toBeVisible();

  const job = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Draw a room' }) });
  await job.getByRole('textbox', { name: 'What the room will work on' }).fill('Should employers give paid time off to learn?');
  const statement = job.getByRole('combobox', { name: 'The statement (optional)' });
  const differ = statement.getByRole('option', { name: /^Where we differ: / }).first();
  await statement.selectOption((await differ.getAttribute('value'))!);
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/assemblies\/[^/]+\/rooms$/.test(r.url()));
  await job.getByRole('button', { name: 'Draw the room' }).click();
  const { room } = (await (await created).json()) as { room: Room };
  expect(room.memberIds.length).toBeGreaterThanOrEqual(5);

  await job.getByRole('link', { name: 'Go to the room to open it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Should employers give paid time off to learn?' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the room' }).click();
  await expect(page.getByRole('button', { name: 'Close the room' })).toBeVisible();

  // A member of the room talks in it.
  await asRole(page.request, 'participant');
  await signInAs(page.request, room.memberIds[0]!);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The conversation' })).toBeVisible();
  const said = 'If the time off is paid, I can go. If not, I cannot, however much I want to.';
  await page.getByRole('textbox', { name: 'Your message' }).fill(said);
  await page.getByRole('button', { name: 'Send' }).click();
  const mine = page.locator('[data-author="me"]').filter({ hasText: said });
  await expect(mine).toBeVisible();
  await expect(mine.getByText('You', { exact: true })).toBeVisible();
  // The composer stays below the messages, and the page fits a phone.
  await page.setViewportSize({ width: 375, height: 740 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await mine.boundingBox();
  const box = await page.getByRole('textbox', { name: 'Your message' }).boundingBox();
  expect(last!.y + last!.height, 'the last message sits above the composer').toBeLessThanOrEqual(box!.y);
  expect(box!.y + box!.height, 'the composer is on screen').toBeLessThanOrEqual(740);
  await noSidewaysScroll(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // The fixed clock means time never runs out here, so the member answers through the API.
  const answer = await page.request.post(`/api/rooms/${room.id}/answer`, { data: { value: 'agree' } });
  expect(answer.ok()).toBe(true);

  // Someone who is not in the room sees that, and cannot read the messages.
  const visitor = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.1' } });
  const other = await visitor.newPage();
  const errors: string[] = [];
  other.on('pageerror', (e) => errors.push(e.message));
  await other.goto(`/a/earning-and-learning?invite=${INVITE.earning}`);
  await other.request.post('/api/assemblies/earning-and-learning/join', { data: { lookAroundFirst: true } });
  await other.goto(`/a/earning-and-learning/rooms/${room.id}`);
  await expect(other.getByRole('heading', { name: 'You are not in this room' })).toBeVisible();
  await expect(other.getByText(said)).toHaveCount(0);
  expect((await other.request.get(`/api/rooms/${room.id}/messages`)).status()).toBe(403);
  expect((await other.request.post(`/api/rooms/${room.id}/close`)).status()).toBe(403);
  expect(errors).toEqual([]);
  await visitor.close();

  // The steward closes it: the reasons and the totals show, never who said what.
  await asRole(page.request, 'steward');
  await page.reload();
  await page.getByRole('button', { name: 'Close the room' }).click();
  await expect(page.getByRole('heading', { name: 'What the room found' })).toBeVisible();
  await expect(page.getByText('Each final answer was private. Only these totals are shown.')).toBeVisible();
  await expect(page.getByText('Final answers: 1 agree, 0 disagree, 0 not sure.')).toBeVisible();
  await checkPhoneWidth(page);
});
