import { asRole, checkPhoneWidth, expect, test } from './helpers.js';

/** Two feedback records in all: a guided one sent half way, and a short free one. */
test('feedback: half a guided conversation is sent, followed on its own page, and answered by a steward', async ({ page }) => {
  await page.goto('/a/earning-and-learning');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Give feedback' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Give feedback' })).toBeVisible();
  await expect(page.getByText('About: /a/earning-and-learning')).toBeVisible();
  await checkPhoneWidth(page);

  await page.getByRole('button', { name: 'Answer a few questions, about eight minutes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'A few questions about Unite' })).toBeVisible();
  const said = ['I came to see what my neighbours said about evening classes.', 'The picture page was long on my phone but the quotes were the best part.'];
  for (const text of said) {
    await page.getByRole('textbox', { name: 'Your answer' }).fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('Thinking about the next question…')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Your answers' }).getByText(text)).toBeVisible();
  }

  // The public summary is shown before anything is agreed.
  await page.getByRole('button', { name: 'Show me the summary' }).click();
  await expect(page.getByText('It would be published exactly like this:')).toBeVisible();
  await expect(page.getByTestId('public-summary')).toContainText(said[0]!);
  await page.getByRole('button', { name: 'Yes, publish this summary' }).click();
  await expect(page.getByText('You agreed to publish this summary:')).toBeVisible();

  await page.getByRole('button', { name: 'Submit what I have said so far' }).click();
  await expect(page.getByText('Thank you. We have received your feedback.')).toBeVisible();
  await expect(page.getByText('This feedback has been sent. You can still correct your answers.')).toBeVisible();
  await checkPhoneWidth(page);

  // Its own page.
  await page.getByRole('link', { name: 'See your feedback' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your feedback' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /What is happening with it/ })).toContainText('Received');
  await expect(page.getByRole('region', { name: 'What you told us' }).getByText(said[1]!)).toBeVisible();
  await expect(page.getByText('You agreed to publish this summary.', { exact: false })).toBeVisible();
  const token = page.url();
  await checkPhoneWidth(page);

  // A steward plans it, with a reason the person sees.
  await asRole(page.request, 'steward');
  await page.goto('/steward');
  await expect(page.getByRole('heading', { name: 'Feedback on Unite' })).toBeVisible();
  await expect(page.getByText(/\d+ pieces? of feedback (has|have) been sent\./)).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: said[1]! });
  await expect(card.getByText('Agreed public summary')).toBeVisible();
  await card.getByRole('button', { name: 'Save the status' }).click();
  await expect(card.getByText('Give a reason. The person who sent this will see it.')).toBeVisible();
  await card.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Planned' });
  const reason = 'We will fold the picture quotes on phones in the next release.';
  await card.getByRole('textbox', { name: 'Reason' }).fill(reason);
  await card.getByRole('button', { name: 'Save the status' }).click();
  await expect(card.getByText(`Reason given: ${reason}`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download as CSV' })).toHaveAttribute('href', /format=csv/);
  const csv = await page.request.get('/api/steward/feedback/export?format=csv');
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain(said[1]!);

  // The person sees the change and the reason.
  await asRole(page.request, 'participant');
  await page.goto(token);
  await expect(page.getByRole('heading', { name: /What is happening with it/ })).toContainText('Planned');
  await expect(page.getByText(`Why: ${reason}`)).toBeVisible();
});

test('feedback: just tell us something', async ({ page }) => {
  await page.goto('/feedback');
  await page.getByRole('button', { name: 'Just tell us something' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tell us something' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your answer' }).fill('The language list was easy. I found Polish straight away.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Thinking about the next question…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit what I have said so far' }).click();
  await expect(page.getByText('Thank you. We have received your feedback.')).toBeVisible();
  await checkPhoneWidth(page);
});
