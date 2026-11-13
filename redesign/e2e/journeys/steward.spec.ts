import type { DecisionsResponse, StatementsResponse } from '@unite/shared';
import { stableId } from '../../packages/shared/src/ids';
import { asRole, checkPhoneWidth, expect, signInAs, test, viewAs } from './helpers';

/** Liam took part in the earning example (apps/server/src/seed/content/earningDebate.ts). */
const LIAM = stableId('per', 'earning/liam');
const SLUG = 'earning-and-learning';

// Refused steps the page explains (an update with nothing new, a stage that is not ready) are 409 answers.
test.use({ allowStatuses: [401, 403, 404, 409] });

/**
 * The steward's jobs against the real endpoints: a report and an objection from a participant are
 * answered; the picture jobs say what happened; the top priorities become decisions; the host
 * answers one; a plan is proposed, chosen, and confirmed faithful.
 */
test('a steward answers reports and objections, writes up decisions, and confirms a chosen plan', async ({ page }) => {
  // A participant reports the picture and objects to a statement.
  await signInAs(page.request, LIAM);
  await page.goto(`/a/${SLUG}/picture`);
  await page.getByRole('button', { name: 'This is not what was said' }).first().click();
  await page.getByRole('radio', { name: 'Something is missing' }).check();
  const report = 'Nobody mentions the night bus. Without it the evening classes are no use to me.';
  await page.getByRole('textbox', { name: 'Say what was said, or what is wrong' }).fill(report);
  await page.getByRole('button', { name: 'Send to a steward' }).click();
  await expect(page.getByText('Thank you. A steward will look at this and say what they decided, here.')).toBeVisible();

  const { statements } = (await (await page.request.get(`/api/assemblies/${SLUG}/statements`)).json()) as StatementsResponse;
  await page.goto(`/a/${SLUG}/statements/${statements[0]!.id}`);
  const objection = 'This leaves out people on zero-hours contracts, who cannot plan a course a term ahead.';
  await page.getByRole('textbox', { name: 'Raise an objection' }).fill(objection);
  await page.getByRole('button', { name: 'Raise my objection' }).click();
  await expect(page.getByText(objection)).toBeVisible();

  // The steward's console.
  await page.goto('/steward');
  await viewAs(page, 'Steward');
  await page.getByRole('button', { name: 'See the jobs for Earning and learning in Riverbend' }).click();
  const job = (title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, level: 3 }) });

  const reports = job('Reports that the picture is wrong');
  await expect(reports.getByText('1 open')).toBeVisible();
  await reports.getByRole('button', { name: 'Open the reports' }).click();
  await expect(reports.getByText(report)).toBeVisible();
  await expect(reports.getByRole('button', { name: 'Uphold it', exact: true })).toBeDisabled();
  await reports.getByRole('textbox', { name: 'What you found' }).fill('The night bus came up in eleven conversations. It is added to the theme on getting there.');
  await reports.getByRole('button', { name: 'Uphold it', exact: true }).click();
  await expect(reports.getByText('No report is waiting.')).toBeVisible();

  const objections = job('Objections');
  await objections.getByRole('button', { name: 'Open the objections' }).click();
  await expect(objections.getByText(objection)).toBeVisible();
  await objections.getByRole('textbox', { name: 'Your reply' }).fill('Fair point. The statement says “people in work”, which includes zero-hours contracts; the room will look at term dates.');
  await objections.getByRole('button', { name: 'Send the reply' }).click();
  await expect(objections.getByText('No objection is waiting for a reply.')).toBeVisible();

  // The picture jobs say what happened, in words.
  const update = job('Update the picture');
  await update.getByRole('button', { name: 'Update the picture' }).click();
  await expect(update.getByRole('status').or(update.locator('[aria-live] > *')).first()).toBeVisible();
  const draft = job('Draft statements');
  await draft.getByRole('button', { name: 'Draft statements' }).click();
  await expect(draft.locator('[aria-live] > *').first()).toBeVisible();

  // The top priorities become decisions.
  const decide = job('Turn priorities into decisions');
  await decide.getByRole('button', { name: 'Prepare the decisions' }).click();
  const drafts = decide.getByRole('group', { name: /^Decision \d+$/ });
  await expect(drafts.first()).toBeVisible();
  const count = await drafts.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);
  await decide.getByRole('button', { name: 'Write up the decisions' }).click();
  await expect(decide.getByText('This is needed.').first()).toBeVisible();
  for (let i = 0; i < count; i++) {
    const d = drafts.nth(i);
    await d.getByRole('textbox', { name: 'Why' }).fill('Most people in every group agreed, and it came up in conversations about shifts and childcare.');
    await d.getByRole('textbox', { name: 'Tests for “done”' }).fill('A course is offered at a time shift workers named.\nThe course page says who can go and what it costs.');
    await d.getByRole('checkbox', { name: 'A social arrangement' }).check();
  }
  await decide.getByRole('button', { name: 'Write up the decisions' }).click();
  await expect(decide.getByText(/written up and waiting for the host’s answer\.$/)).toBeVisible();
  await checkPhoneWidth(page);

  // The host accepts the first decision on its page.
  const list = (await (await page.request.get(`/api/assemblies/${SLUG}/decisions`)).json()) as DecisionsResponse;
  expect(list.decisions.length).toBe(count);
  const first = list.decisions.find((d) => d.number === 1)!;
  expect(first.status).toBe('awaiting_answer');
  await page.goto(`/a/${SLUG}/decisions/${first.id}`);
  await viewAs(page, 'Host');
  await page.getByRole('radio', { name: /^Accepted/ }).check();
  await page.getByRole('textbox', { name: 'Your reasons' }).fill('We can run two evening courses at the depot from January within the budget we set aside.');
  await page.getByRole('button', { name: 'Send the answer' }).click();
  await expect(page.getByRole('heading', { name: 'Their reasons' })).toBeVisible();

  // Someone who took part proposes how to build it.
  await asRole(page.request, 'participant');
  await page.reload();
  await page.getByText('Propose how to build it').click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Liam');
  await page.getByRole('textbox', { name: 'What you do' }).fill('Forklift driver at the depot');
  await page.getByRole('textbox', { name: 'Your plan in one or two sentences' }).fill('Run the course in the depot canteen straight after the early shift.');
  await page.getByRole('textbox', { name: 'The plan' }).fill('The college sends a tutor on Tuesdays and Thursdays at two. The depot lends the canteen. Sign-up is on the staff board.');
  const coverage = page.getByRole('textbox', { name: /^Test \d+: / });
  for (let i = 0; i < (await coverage.count()); i++) await coverage.nth(i).fill('The early shift ends at two, so the time is the one shift workers asked for.');
  await page.getByRole('button', { name: 'Send the proposal' }).click();
  await expect(page.getByRole('heading', { name: 'Run the course in the depot canteen straight after the early shift.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Your proposal is sent.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('');

  // The host chooses it; the steward confirms it is faithful from the console.
  await viewAs(page, 'Host');
  await page.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(page.getByText('Chosen plan', { exact: true })).toBeVisible();
  await page.goto('/steward');
  await viewAs(page, 'Steward');
  await page.getByRole('button', { name: 'See the jobs for Earning and learning in Riverbend' }).click();
  const confirm = job('Confirm a plan is faithful');
  await expect(confirm.getByText('1 waiting')).toBeVisible();
  await confirm.getByRole('button', { name: 'Confirm it is faithful' }).click();
  await expect(confirm.getByText('No chosen plan is waiting.')).toBeVisible();
  await page.goto(`/a/${SLUG}/decisions/${first.id}`);
  await expect(page.getByText('Confirmed faithful to the decision')).toBeVisible();
  await checkPhoneWidth(page);
});
