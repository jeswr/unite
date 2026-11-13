import { ANSWERS, checkPhoneWidth, expect, noSidewaysScroll, test } from './helpers.js';

async function start(page: import('@playwright/test').Page, route: RegExp) {
  await page.goto('/a/earning-and-learning/talk');
  await page.getByRole('radio', { name: route }).check();
  await page.getByRole('button', { name: 'I understand. Start' }).click();
  await expect(page).toHaveURL(/\/talk\/[^/]+$/);
}

test('the written questions end in a review with points', async ({ page }) => {
  await start(page, /Answer written questions/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your answers' })).toBeVisible();
  for (let stage = 0; stage < 12 && !/\/review$/.test(page.url()); stage++) {
    const boxes = page.getByRole('textbox');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).fill(ANSWERS[(stage + i) % ANSWERS.length]!);
    const next = page.getByRole('button', { name: /^(Next|Finish and see my points)$/ });
    const before = page.url();
    await next.click();
    await expect(async () => {
      expect(/\/review$/.test(page.url()) || before !== page.url() || (await page.getByRole('textbox').first().inputValue()) === '').toBe(true);
    }).toPass();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Here is what I heard' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Point 1, in your words$/ })).toBeVisible();
  await noSidewaysScroll(page);
  await checkPhoneWidth(page);
});

test('free writing ends in a review with points', async ({ page }) => {
  await start(page, /Write freely/);
  await expect(page.getByRole('heading', { level: 1, name: 'Write freely' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Write about a real, recent day' }).fill(ANSWERS.slice(0, 7).join('\n\n'));
  await page.getByRole('button', { name: 'I have finished' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Here is what I heard' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Point 1, in your words$/ })).toBeVisible();
  await checkPhoneWidth(page);
});
