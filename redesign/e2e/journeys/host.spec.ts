import { checkPhoneWidth, expect, test, viewAs } from './helpers.js';

const INTAKE = [
  'Don’t you think the library in Millbrook should open on Sundays?',
  'Families with young children, shift workers, older people who live alone, and teenagers revising for exams.',
  'We can change the opening hours, move staff rotas, and decide what the rooms are used for at weekends.',
  'We have set aside forty thousand pounds from next year’s library budget and two extra staff posts.',
  'Building work is off the table, because the council has no capital budget for libraries until 2029.',
  'We will take advice and answer every priority in public, with our reasons.',
  'We will answer every priority by 30 April 2027.',
];

// A refused publish and a refused move are 409 answers the page explains.
test.use({ allowStatuses: [401, 403, 404, 409] });

/** A host opens an assembly: the intake, the pledge editor, a refused publish that says what is missing, a published pledge, an invitation. */
test('a host opens an assembly, publishes its pledge and makes an invitation', async ({ page }) => {
  await page.goto('/host');
  await viewAs(page, 'Host');
  await expect(page.getByRole('heading', { level: 1, name: 'For hosts' })).toBeVisible();
  await page.getByRole('button', { name: 'Open a new assembly' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Open a new assembly' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seven questions before the pledge' })).toBeVisible();

  // The intake: answer until the pledge appears (the interviewer may ask one follow-up on a topic).
  const editor = page.getByRole('heading', { name: 'The pledge', level: 2, exact: true });
  for (let i = 0; i < 16 && !(await editor.isVisible()); i++) {
    const box = page.getByRole('textbox', { name: 'Your answer' });
    await box.fill(INTAKE[Math.min(i, INTAKE.length - 1)]!);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(box.or(editor).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sending…' })).toHaveCount(0);
  }
  await expect(editor).toBeVisible();
  await expect(page.getByText(/^Filled in from your answers, in your own words\./)).toBeVisible();
  const question = page.getByRole('textbox', { name: 'The question people will be asked' });
  await expect(question).toHaveValue(INTAKE[0]!);
  await expect(page.getByRole('textbox', { name: 'What you have set aside' })).toHaveValue(INTAKE[3]!);
  await expect(page.getByRole('textbox', { name: 'The date you will answer by' })).toHaveValue('2027-04-30');
  await checkPhoneWidth(page);

  // The leading-wording check runs when the question is left.
  await question.focus();
  await page.getByRole('textbox', { name: 'A short title' }).focus();
  await expect(page.getByText('This may lead people toward an answer.')).toBeVisible();

  // Publishing is refused, and the page says what is still needed.
  await page.getByRole('textbox', { name: 'The organisation hosting it' }).fill('Millbrook Libraries');
  await page.getByRole('textbox', { name: 'A short title' }).fill('Sunday opening in Millbrook');
  await page.getByRole('button', { name: 'Publish the pledge' }).click();
  await expect(page.getByText('The pledge cannot be published yet. Still needed:')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'do not lead people toward an answer' })).toBeVisible();

  // A plain question passes, and the pledge is published.
  await question.fill('What would make the Millbrook library worth visiting on a Sunday?');
  await page.getByRole('textbox', { name: 'A short title' }).focus();
  await expect(page.getByText('This wording does not lead people toward an answer.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish the pledge' }).click();
  await expect(page.getByText('“Sunday opening in Millbrook” is published.', { exact: false })).toBeVisible();

  // Manage it: it cannot move on before the challenge period ends; an invitation gives a code and a link.
  await page.getByRole('button', { name: 'Manage Sunday opening in Millbrook' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sunday opening in Millbrook' })).toBeVisible();
  await page.getByRole('button', { name: 'Move on' }).click();
  await expect(page.getByText('This assembly cannot move on yet. Still needed:')).toBeVisible();
  await expect(page.getByRole('listitem').getByText('The challenge period has ended', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Who this invitation is for' }).fill('Weekend staff at the leisure centre');
  await page.getByRole('button', { name: 'Make an invitation' }).click();
  const invite = page.getByRole('listitem').filter({ hasText: 'Weekend staff at the leisure centre' });
  await expect(invite.getByText(/^Code: /)).toBeVisible();
  await expect(invite.getByText(/\/a\/[a-z0-9-]+\?invite=[A-Z0-9-]+$/)).toBeVisible();
  await checkPhoneWidth(page);

  // The public page shows the published pledge.
  await page.getByRole('link', { name: 'Open the public page' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What would make the Millbrook library worth visiting on a Sunday?');
  await checkPhoneWidth(page);
});
