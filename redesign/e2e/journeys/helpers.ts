import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared pieces for the journey tests. Journeys run in one server on the full seed with a fixed
 * clock, one after another in file order, so a journey may see what an earlier one wrote.
 */

/** The seed's invitation codes (apps/server/src/seed/assemblies.ts, INVITE_CODES). */
export const INVITE = { earning: 'RIVERBEND-2026', volunteering: 'NORTHERN-VOLUNTEERS', aiAndCare: 'CARE-FUTURES' } as const;

/** Raw ids must never be shown to people. */
export const RAW_ID = /\b(per|asm|stm|thm|pt|dec|room|con|mem|fb|chk)_[A-Za-z0-9_-]{6,}/;

let nextAddress = 1;

/**
 * Each test is a different visitor on a different address, so the per-address write limits apply
 * to each person as they would in real use rather than to the whole suite at once.
 */
export const test = base.extend<{ problems: string[]; allowStatuses: number[] }>({
  allowStatuses: [[401, 403, 404], { option: true }],
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take their dependencies as an object pattern.
  extraHTTPHeaders: async ({}, use) => {
    const n = nextAddress++;
    await use({ 'X-Forwarded-For': `10.20.${Math.floor(n / 250)}.${(n % 250) + 1}` });
  },
  problems: [
    async ({ page, allowStatuses }, use) => {
    const problems: string[] = [];
    const allowed = new RegExp(`status of (${allowStatuses.join('|')})\\b`);
    page.on('console', (m) => {
      if (m.type() === 'error' && !allowed.test(m.text())) problems.push(`console: ${m.text()} (${page.url()})`);
    });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message} (${page.url()})`));
    await use(problems);
    expect(problems, 'page errors or console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The page does not scroll sideways. */
export async function noSidewaysScroll(page: Page, what = page.url()) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `${what} scrolls sideways`).toBeLessThanOrEqual(client);
}

/** Checks the page at 375 px for sideways scrolling, then puts the viewport back. */
export async function checkPhoneWidth(page: Page) {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(100);
  await noSidewaysScroll(page);
  if (size) await page.setViewportSize(size);
}

/** Switches role with the demo passcodes, as the demo bar does. */
export async function asRole(request: APIRequestContext, role: 'host' | 'steward' | 'participant') {
  const res = role === 'participant' ? await request.delete('/api/role') : await request.post('/api/role', { data: { role, code: role } });
  expect(res.ok(), `switch to ${role}`).toBe(true);
}

/** Uses the demo bar to view as a role. */
export async function viewAs(page: Page, label: 'Participant' | 'Host' | 'Steward') {
  const bar = page.getByRole('group', { name: 'Demo. View as:' });
  await bar.getByRole('button', { name: label }).click();
  await expect(bar.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
}

/** Signs in as an existing person (a test-only route, present only when NODE_ENV is "test"). */
export async function signInAs(request: APIRequestContext, personId: string) {
  const res = await request.post('/api/test/sign-in', { data: { personId } });
  expect(res.ok(), `sign in as ${personId}`).toBe(true);
}

/** Waits for the page to settle after navigation or an action. */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

/** Realistic answers for the fixed questions, one per turn, reused in order. */
export const ANSWERS = [
  'Yesterday I started at six at the depot, loading vans until two, then picked my son up from school and did tea.',
  'The best bit was the hour after school when he told me about his science project. That is what I work for.',
  'The hardest part was the evening course I signed up for. It starts at six, and I cannot get there from the depot in time.',
  'I would like to learn bookkeeping, because the warehouse is bringing in scanners and I think my job will change.',
  'A good ordinary day a few years from now: a steady job, home by five, and one evening a week at a class near home.',
  'What gets in the way is money. If I take a course in the day I lose a day of pay, and we cannot afford that.',
  'If I could change one thing it would be courses at the depot itself, straight after a shift, with childcare.',
  'I would give up some overtime to learn, but not my weekends with my son. That time is not for sale.',
  'I am not sure the college understands shift work. Every course seems to assume you work nine to five.',
  'Nothing more to add, thank you. It was good to be asked.',
];
