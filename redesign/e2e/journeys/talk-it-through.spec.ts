import type { StatementDetail } from '../../packages/shared/src/index.js';
import { stableId } from '../../packages/shared/src/ids.js';
import { expect, noSidewaysScroll, RAW_ID, settle, signInAs, test } from './helpers.js';

/** Sam took part in the earning example and has not answered the statement about who chooses the courses. */
const SAM = stableId('per', 'earning/sam');
const LIAM = stableId('per', 'earning/liam');
const S7 = stableId('st', 'earning/S7');
const STATEMENT = `/a/earning-and-learning/statements/${S7}`;

/** Answers for the fixed questions, step by step. */
const STEPS: Record<number, string[]> = {
  1: [
    'The courses at the college never matched the jobs at the depot, so people finished them and still could not get work.',
    'My cousin did a year of a course and nobody was hiring for it.',
  ],
  2: ['It is true that employers only ask for what they need this year.', 'They leave out the people who want the course to lead to a job here.'],
  3: ['Employers and learners should choose the courses together.', 'Employers and the people learning should choose the courses together.'],
  4: ['Which employers would promise to interview people who finish?'],
};

/**
 * A participant answers a statement, talks it through on fixed questions (there is no AI key),
 * approves what was heard, and sees their reason on the statement. A second person cannot open
 * the first one's conversation.
 */
test('a participant talks a statement through in their own time', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 800 });
  await signInAs(page.request, SAM);

  // Answer the statement; the card appears once answered.
  await page.goto(STATEMENT);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Talk it through' })).toHaveCount(0);
  await page.getByRole('group', { name: 'Your answer' }).getByRole('button', { name: 'Agree', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Talk it through' })).toBeVisible();
  await expect(page.getByText(/about five minutes/)).toBeVisible();
  await noSidewaysScroll(page);
  await page.getByRole('link', { name: 'Talk it through' }).click();

  // The introduction, then fixed questions, one at a time.
  await expect(page.getByRole('heading', { level: 1, name: 'Talk it through' })).toBeVisible();
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('This conversation uses fixed questions. The AI interviewer is not switched on.')).toBeVisible();
  await expect(page.getByText('Step 1 of 4:')).toBeVisible();

  const box = page.getByRole('textbox', { name: 'Your answer' });
  const send = async (text: string) => {
    const before = await page.getByText('The AI', { exact: true }).count();
    await box.fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(async () => {
      const moved = (await page.getByRole('heading', { level: 1, name: 'Here is what I heard' }).count()) > 0 || (await page.getByText('The AI', { exact: true }).count()) > before;
      expect(moved).toBe(true);
    }).toPass({ timeout: 15_000 });
  };
  for (const text of STEPS[1]!) await send(text);

  // Step 2: reasons from people who answered differently, shown as quotations.
  await expect(page.getByText('Step 2 of 4:')).toBeVisible();
  const quotes = page.getByRole('region', { name: 'Reasons from people who answered differently' });
  await expect(quotes).toBeVisible();
  expect(await quotes.locator('blockquote').count()).toBeGreaterThan(0);
  await noSidewaysScroll(page);
  // The newest question sits above the message box, not behind it.
  const lastQuestion = page.getByText('The AI', { exact: true }).last();
  const boxTop = (await page.locator('.fixed.bottom-0').boundingBox())!.y;
  const q = (await lastQuestion.boundingBox())!;
  const questionBottom = q.y + q.height;
  expect(questionBottom).toBeLessThan(boxTop);

  for (const text of [...STEPS[2]!, ...STEPS[3]!, ...STEPS[4]!]) await send(text);

  // The review: what was heard, in the person's own words.
  await expect(page.getByRole('heading', { level: 1, name: 'Here is what I heard' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your reason, in your words' })).toHaveValue(STEPS[1]![0]!);
  await expect(page.getByRole('radio', { name: 'For the statement' })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Your wording, in your words' })).toHaveValue(STEPS[3]![1]!);
  await expect(page.getByRole('textbox', { name: 'Your question, in your words' })).toHaveValue(STEPS[4]![0]!);
  await noSidewaysScroll(page);
  expect(await page.locator('main').innerText()).not.toMatch(RAW_ID);
  await page.getByRole('button', { name: 'These are right' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Thank you' })).toBeVisible();
  await expect(page.getByText('What you added')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the statement' }).click();

  // The reason is on the statement, with everyone else's.
  await expect(page.getByText(STEPS[1]![0]!)).toBeVisible();
  await expect(page.getByText('Your reason', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'See what you added' })).toBeVisible();
  await settle(page);

  // A second person cannot open Sam's conversation.
  const detail = (await (await page.request.get(`/api/statements/${S7}`)).json()) as StatementDetail;
  const id = detail.mediation.mine?.id;
  expect(id).toBeTruthy();
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': '10.99.0.1' } });
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage.request, LIAM);
    const refused = await otherPage.request.get(`/api/mediations/${id}`);
    expect(refused.status()).toBe(403);
    await otherPage.goto(`${STATEMENT}/talk`);
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Talk it through' })).toBeVisible();
    await expect(otherPage.getByText(STEPS[2]![0]!)).toHaveCount(0);
  } finally {
    await other.close();
  }
});
