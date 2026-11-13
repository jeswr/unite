import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = path.join(import.meta.dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [375, 768, 1280];
const PAGES: { path: string; name: string; heading: RegExp }[] = [
  { path: '/', name: 'home', heading: /good ordinary life/ },
  { path: '/assemblies', name: 'assemblies', heading: /^Assemblies$/ },
  { path: '/a/earning-and-learning', name: 'assembly', heading: /keep earning and keep learning/ },
  { path: '/a/earning-and-learning/pledge', name: 'pledge', heading: /^The pledge$/ },
  { path: '/how', name: 'how', heading: /^How Unite works$/ },
];

/** Collects console errors and failed page loads. */
function watch(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function noSidewaysScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'the page scrolls sideways').toBeLessThanOrEqual(client);
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width < 700 ? 800 : 900 } });
    for (const p of PAGES) {
      test(`${p.name} loads cleanly`, async ({ page }) => {
        const errors = watch(page);
        await page.goto(p.path);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.heading);
        await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Give feedback' })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await noSidewaysScroll(page);
        await page.screenshot({ path: path.join(SHOTS, `smoke-${p.name}-${width}.png`), fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  });
}

test('the example banner shows on an example assembly', async ({ page }) => {
  await page.goto('/a/earning-and-learning');
  await expect(page.getByText('The people and the host in this assembly are invented')).toBeVisible();
  await page.goto('/a/making-unite-better');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What would make Unite work better for you?');
  await expect(page.getByText('The people and the host in this assembly are invented')).toHaveCount(0);
});

test('the how page stays under 500 words', async ({ page }) => {
  await page.goto('/how');
  const words = (await page.locator('main').innerText()).split(/\s+/).filter(Boolean).length;
  expect(words).toBeLessThan(500);
});

test('focus moves to the heading on navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'How it works' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});
