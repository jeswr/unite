import type { MessagesResponse, Room } from '../../packages/shared/src/index.js';
import { asRole, checkPhoneWidth, expect, noSidewaysScroll, RAW_ID, signInAs, test, viewAs } from './helpers.js';

/**
 * A steward draws a slow room and opens it. A member who has not written sees the write-first
 * notice with how many people have written, but none of their words; once they write, they see
 * the others (section 12.2).
 */
test('a slow room: write where you stand, then read the others', async ({ page }) => {
  await page.goto('/steward');
  await viewAs(page, 'Steward');
  await page.getByRole('button', { name: 'See the jobs for Earning and learning in Riverbend' }).click();
  await expect(page.getByRole('heading', { name: /^Jobs for / })).toBeVisible();

  const job = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Draw a room' }) });
  await job.getByRole('textbox', { name: 'What the room will work on' }).fill('Should the college pay for courses people choose themselves?');
  const statement = job.getByRole('combobox', { name: 'The statement (optional)' });
  const differ = statement.getByRole('option', { name: /^Where we differ: / }).first();
  await statement.selectOption((await differ.getAttribute('value'))!);
  await expect(job.getByRole('radio', { name: /Live, for 45 minutes/ })).toBeChecked();
  await job.getByRole('radio', { name: /Slow, for 5 days/ }).check();
  await job.getByRole('spinbutton', { name: 'How long, in days' }).fill('3');
  await expect(job.getByRole('radio', { name: /Slow, for 3 days/ })).toBeChecked();
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/assemblies\/[^/]+\/rooms$/.test(r.url()));
  await job.getByRole('button', { name: 'Draw the room' }).click();
  const { room } = (await (await created).json()) as { room: Room };
  expect(room).toMatchObject({ pace: 'slow', minutes: 3 * 1440 });
  expect(room.memberIds.length).toBeGreaterThanOrEqual(5);

  await job.getByRole('link', { name: 'Go to the room to open it' }).click();
  const title = 'Should the college pay for courses people choose themselves?';
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('This is a slow room. It will be open for 3 days once it opens.')).toBeVisible();
  await page.getByRole('button', { name: 'Open the room' }).click();
  await expect(page.getByText('This is a slow room. It is open until 16 November 2026. Write when you can, and come back to read the others.')).toBeVisible();
  await expect(page.getByText('3 days left')).toBeVisible();

  // Two members write first, each before reading anyone else.
  await asRole(page.request, 'participant');
  const others = [
    { id: room.memberIds[1]!, text: 'I said agree. The courses employers ask for are the ones that get people hired here.' },
    { id: room.memberIds[2]!, text: 'I said disagree. I want to train as a nurse, and no employer round here asked for that.' },
  ];
  for (const o of others) {
    await signInAs(page.request, o.id);
    const before = (await (await page.request.get(`/api/rooms/${room.id}/messages`)).json()) as MessagesResponse;
    expect(before.mustWriteFirst).toBe(true);
    expect(before.messages.every((m) => m.authorType !== 'person')).toBe(true);
    expect((await page.request.post(`/api/rooms/${room.id}/messages`, { data: { text: o.text } })).ok()).toBe(true);
  }

  // A third member has not written: the notice, the count, and nobody's words.
  await signInAs(page.request, room.memberIds[0]!);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The conversation' })).toBeVisible();
  await expect(page.getByText('2 people have written. You will see what they wrote once you have written where you stand.')).toBeVisible();
  await expect(page.locator('[data-author="facilitator"]').filter({ hasText: 'This room is open for 3 days.' })).toBeVisible();
  for (const o of others) await expect(page.getByText(o.text)).toHaveCount(0);
  const held = (await (await page.request.get(`/api/rooms/${room.id}/messages`)).json()) as MessagesResponse;
  expect(held).toMatchObject({ mustWriteFirst: true, hiddenCount: 2, hiddenPeople: 2 });
  const detail = await (await page.request.get(`/api/rooms/${room.id}`)).text();
  for (const o of others) expect(detail).not.toContain(o.text);

  await page.setViewportSize({ width: 375, height: 740 });
  await noSidewaysScroll(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // They write where they stand, and then the others' words appear.
  const said = 'I am not sure. Employers should be asked, but people should be able to choose too.';
  await page.getByRole('textbox', { name: 'Your message' }).fill(said);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('[data-author="me"]').filter({ hasText: said })).toBeVisible();
  for (const o of others) await expect(page.locator('[data-author="person"]').filter({ hasText: o.text })).toBeVisible();
  await expect(page.getByText(/people have written/)).toHaveCount(0);
  expect(await page.locator('main').textContent()).not.toMatch(RAW_ID);
  await checkPhoneWidth(page);

  // The rooms list labels it a slow room, with its time left in days.
  await page.goto('/a/earning-and-learning/rooms');
  const mine = page.getByRole('region', { name: 'Your room' });
  await expect(mine.getByText('Slow room')).toBeVisible();
  await expect(mine.getByText(/Open now\. 3 days left\./)).toBeVisible();
  await checkPhoneWidth(page);

  // The steward closes it, so later journeys find the same people free.
  await asRole(page.request, 'steward');
  expect((await page.request.post(`/api/rooms/${room.id}/close`)).ok()).toBe(true);
});
