import { expect, noSidewaysScroll, test } from './helpers.js';

/** Rule 1 for a fresh visitor: refused plainly, offered a conversation, and let in only on an example after choosing to look around. */
test('a fresh visitor is refused the group’s work until heard, except by looking around an example', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const pages = [
    ['picture', 'The picture'],
    ['statements', 'Statements'],
    ['rooms', 'Rooms'],
    ['priorities', 'Which three matter most to you?'],
  ] as const;
  for (const [path, title] of pages) {
    await page.goto(`/a/earning-and-learning/${path}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Have your own conversation first' })).toBeVisible();
    await expect(page.getByText(/once you have been heard/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start my conversation' })).toHaveAttribute('href', '/a/earning-and-learning/talk');
    await noSidewaysScroll(page);
  }

  // On an example, looking around first lets the visitor in, and the page says so.
  await page.getByRole('button', { name: 'Look around the example first' }).click();
  await expect(page.getByRole('heading', { name: 'Have your own conversation first' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The list so far' })).toBeVisible();
  await page.goto('/a/earning-and-learning/picture');
  await expect(page.getByRole('heading', { name: 'What matters' })).toBeVisible();
  await page.goto('/a/earning-and-learning');
  await expect(page.getByText('You chose to look around the example first.')).toBeVisible();

  // The real assembly offers no way round rule 1, and the server refuses one.
  await page.goto('/a/making-unite-better/picture');
  await expect(page.getByRole('heading', { name: 'Have your own conversation first' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Look around the example first' })).toHaveCount(0);
  const join = await page.request.post('/api/assemblies/making-unite-better/join', { data: { lookAroundFirst: true } });
  expect(join.status()).toBe(400);
  expect((await join.json()).error.message).toMatch(/only possible in example assemblies/);
  expect((await page.request.get('/api/assemblies/making-unite-better/picture')).status()).toBe(403);
  await noSidewaysScroll(page);
});
