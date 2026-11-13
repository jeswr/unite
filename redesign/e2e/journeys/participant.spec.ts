import { ANSWERS, asRole, checkPhoneWidth, expect, INVITE, noSidewaysScroll, settle, test } from './helpers';

/**
 * A new participant: joins with an invitation, has the conversation with the interviewer (fixed
 * questions, since there is no AI key), checks their points, sees the picture, answers
 * statements, adds a reason, chooses priorities, and follows a point on their own page.
 */
test('a participant is heard, then takes part in everything after', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 800 });

  // The invitation link: joins, says so, and takes the code out of the address.
  await page.goto(`/a/earning-and-learning?invite=${INVITE.earning}`);
  await expect(page.getByText('Your invitation has been accepted.')).toBeVisible();
  await expect(page).toHaveURL(/\/a\/earning-and-learning$/);
  await noSidewaysScroll(page);

  // Start the conversation with the AI interviewer route (fixed questions without a key).
  await page.getByRole('link', { name: 'Start my conversation' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Start a conversation' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Talk with the AI interviewer/ })).toBeChecked();
  await expect(page.getByLabel('Language')).toHaveValue('en');
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'I understand. Start' }).click();
  await expect(page).toHaveURL(/\/talk\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your conversation' })).toBeVisible();
  await noSidewaysScroll(page);

  // Answer every stage until the conversation moves to the review.
  const box = page.getByRole('textbox', { name: 'Your answer' });
  for (let i = 0; i < 40 && !/\/review$/.test(page.url()); i++) {
    const interviewerTurns = await page.getByText('Interviewer', { exact: true }).count();
    await box.fill(ANSWERS[i % ANSWERS.length]!);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(async () => {
      const moved = /\/review$/.test(page.url()) || (await page.getByText('Interviewer', { exact: true }).count()) > interviewerTurns;
      expect(moved).toBe(true);
    }).toPass({ timeout: 15_000 });
  }
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Here is what I heard' })).toBeVisible();
  await noSidewaysScroll(page);

  // Edit one point, scrap one, and choose how one is shown.
  const points = page.getByRole('list', { name: 'Your points' }).getByRole('listitem').filter({ has: page.getByRole('textbox') });
  expect(await points.count()).toBeGreaterThanOrEqual(2);
  const edited = 'Evening courses start before I can get there from the depot after my shift.';
  const first = page.getByRole('textbox', { name: 'Point 1, in your words' });
  await first.fill(edited);
  await first.blur();
  await settle(page);
  await points.nth(0).getByRole('radio', { name: /Shown without your name/ }).check();
  await settle(page);
  await points.nth(1).getByRole('button', { name: 'Scrap this point' }).click();
  await expect(page.getByText('Scrapped. This point will not be shared.')).toBeVisible();
  // A point of my own, close to what others said, so the picture can place it in their theme.
  const own = 'Every course I looked at is on when I am at work or asleep.';
  await page.getByRole('button', { name: 'Add a point of your own' }).click();
  await page.getByLabel('What kind of point is it?').selectOption({ label: 'What gets in the way' });
  await page.getByRole('textbox', { name: /Your point/ }).fill(own);
  await page.getByRole('button', { name: 'Add this point' }).click();
  await expect(page.getByRole('textbox', { name: /in your words/ }).last()).toHaveValue(own);
  await page.getByRole('button', { name: 'These are right' }).click();

  // The two exit questions, then the picture.
  await expect(page.getByText('Do these points sound like you?')).toBeVisible();
  await page.getByRole('radio', { name: 'Mostly like me' }).check();
  await page.getByRole('group', { name: /push you in any direction/ }).getByRole('radio', { name: 'No' }).check();
  await page.getByRole('button', { name: 'Send my answers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thank you' })).toBeVisible();
  await page.getByRole('link', { name: 'See the picture' }).click();

  // Rule 1: the picture now opens, and shows my words where I chose to be quoted.
  await expect(page.getByRole('heading', { level: 1, name: 'The picture' })).toBeVisible();
  await expect(page.getByText(edited).first()).toBeVisible();
  await expect(page.getByText('You said this').first()).toBeVisible();
  await noSidewaysScroll(page);

  // Rule 5: answer statements one at a time, and see totals only after answering.
  await page.goto('/a/earning-and-learning/statements');
  const card = page.locator('section').filter({ has: page.getByRole('group', { name: 'Your answer' }) }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/people have answered/)).toHaveCount(0);
  await expect(page.getByText(/^(Common ground|Where we differ|Not enough voices yet)$/)).toHaveCount(0);
  await card.getByRole('button', { name: 'Agree', exact: true }).click();
  const result = page.getByRole('heading', { name: 'How others answered' });
  await expect(result).toBeVisible();
  await expect(page.getByText(/people have answered/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next statement' }).click();
  const second = page.locator('section').filter({ has: page.getByRole('group', { name: 'Your answer' }) }).first();
  await expect(second.getByText(/people have answered/)).toHaveCount(0);
  await second.getByRole('button', { name: 'Disagree' }).click();
  await expect(result).toBeVisible();
  await noSidewaysScroll(page);

  // Add a reason on the statement just answered.
  await page.getByRole('link', { name: 'Reasons and details' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'A statement' })).toBeVisible();
  await page.getByRole('radio', { name: 'A reason against' }).check();
  const reason = 'Courses at the depot would only work if the shift pattern stays the same each week.';
  await page.getByRole('textbox', { name: 'Your reason' }).fill(reason);
  await page.getByRole('button', { name: 'Add my reason' }).click();
  await expect(page.getByText(reason)).toBeVisible();
  await expect(page.getByText('Your reason', { exact: true }).last()).toBeVisible();
  await noSidewaysScroll(page);

  // Choose three priorities and see the list.
  await page.goto('/a/earning-and-learning/priorities');
  await expect(page.getByRole('heading', { level: 1, name: 'Which three matter most to you?' })).toBeVisible();
  const boxes = page.getByRole('checkbox');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await expect(page.getByText('3 of 3 chosen')).toBeVisible();
  await page.getByRole('button', { name: 'Save my choices' }).click();
  await expect(page.getByText('Your choices are saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The list so far' })).toBeVisible();
  await noSidewaysScroll(page);

  // A steward updates the picture, so the new points join themes.
  const steward = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders: { 'X-Forwarded-For': '10.99.0.1' } });
  await asRole(steward.request, 'steward');
  expect((await steward.request.post('/api/assemblies/earning-and-learning/picture/update')).ok()).toBe(true);
  await steward.close();

  // /me traces the point to its theme and the statements that rest on it.
  await page.goto('/me');
  await expect(page.getByRole('heading', { level: 1, name: 'What happened to what I said' })).toBeVisible();
  const trace = page.getByRole('listitem').filter({ has: page.getByRole('blockquote').filter({ hasText: edited }) });
  await expect(trace).toBeVisible();
  await expect(trace.getByText('In the picture')).toBeVisible();
  await expect(trace.getByText(/Part of the theme/)).toBeVisible();
  // My own point joined a theme people had already raised, so it leads to the statements on it.
  const ownTrace = page.getByRole('listitem').filter({ has: page.getByRole('blockquote').filter({ hasText: own }) });
  await expect(ownTrace.getByText(/Part of the theme/)).toBeVisible();
  await expect(ownTrace.getByText('Statements that rest on it')).toBeVisible();
  await expect(ownTrace.getByRole('link', { name: /night|shift|course/i }).first()).toBeVisible();
  await checkPhoneWidth(page);
});
