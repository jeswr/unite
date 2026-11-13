import type { DecisionsResponse } from '@unite/shared';
import { asRole, checkPhoneWidth, expect, test, viewAs } from './helpers';

/** Decisions are public: anyone can read what was decided and what happened. Only a check, never the host, says it was delivered. */
test('decisions, a decision record, a check by a steward and the register', async ({ page }) => {
  await page.goto('/a/volunteering-tool/decisions');
  await expect(page.getByRole('heading', { level: 1, name: 'Decisions' })).toBeVisible();
  const cards = page.getByRole('listitem').filter({ hasText: /^Decision \d/ });
  await expect(cards).toHaveCount(5);
  await checkPhoneWidth(page);

  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1, name: 'The register' })).toBeVisible();
  const sentence = page.getByText(/^\d+ decisions: .*In progress is not counted as done\.$/);
  const before = (await sentence.textContent())!;
  const delivered = (s: string) => Number(/(\d+) delivered with small changes/.exec(s)?.[1] ?? 0);
  const inProgress = (s: string) => Number(/(\d+) in progress/.exec(s)?.[1] ?? 0);
  await page.getByRole('combobox', { name: 'Assembly' }).selectOption({ label: 'A shared volunteering tool' });
  await expect(page).toHaveURL(/assembly=volunteering-tool/);
  await checkPhoneWidth(page);

  // Find a decision in progress.
  const list = (await (await page.request.get('/api/assemblies/volunteering-tool/decisions')).json()) as DecisionsResponse;
  const target = list.decisions.find((d) => d.status === 'in_progress')!;
  expect(target).toBeTruthy();

  await page.goto(`/a/volunteering-tool/decisions/${target.id}`);
  await expect(page.getByRole('heading', { level: 1, name: target.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tests for “done”' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where this came from' })).toBeVisible();
  await expect(page.getByText(/^Not checked yet\./)).toBeVisible();
  await expect(page.getByText('Record the check', { exact: false })).toHaveCount(0);

  // The host may not check its own work.
  await asRole(page.request, 'host');
  const refused = await page.request.post(`/api/decisions/${target.id}/check`, {
    data: { results: [{ n: 1, met: true, note: '' }], classification: 'as_decided', summary: 'Done.', panel: ['Someone'] },
  });
  expect(refused.status()).toBe(403);

  // A steward records the check through the form.
  await viewAs(page, 'Steward');
  await page.getByText('Record the check (steward)').click();
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Record the check' }) });
  // Submitting empty explains what is missing.
  await form.getByRole('button', { name: 'Record the check' }).click();
  await expect(form.getByText('Mark this test met or not met.').first()).toBeVisible();
  const tests = form.getByRole('group', { name: /^Test \d+:/ });
  const n = await tests.count();
  for (let i = 0; i < n; i++) {
    await tests.nth(i).getByRole('radio', { name: i === n - 1 ? 'Not met' : 'Met', exact: true }).check();
    await tests.nth(i).getByRole('textbox').fill(i === n - 1 ? 'Still waiting for the Welsh version.' : 'Seen working at the drop-in.');
  }
  // A contradiction is caught before it is sent.
  await form.getByRole('combobox', { name: 'What the panel found' }).selectOption({ label: 'Delivered as decided' });
  await expect(form.getByText('“Delivered as decided” needs every test to be met.')).toBeVisible();
  await form.getByRole('combobox', { name: 'What the panel found' }).selectOption({ label: 'Delivered with small changes' });
  await form.getByRole('textbox', { name: 'The panel’s summary' }).fill('Most of it works as decided. One test is not met yet.');
  await form.getByRole('textbox', { name: 'Who was on the panel' }).fill('Ama Owusu, Rhys Price');
  await form.getByRole('button', { name: 'Record the check' }).click();

  await expect(page.getByRole('heading', { name: 'What the panel said' })).toBeVisible();
  await expect(page.getByText('On the panel: Ama Owusu, Rhys Price.')).toBeVisible();
  await expect(page.getByText(`Test ${n}: not met.`)).toBeVisible();
  await checkPhoneWidth(page);

  // The register counts it as delivered with small changes, and one fewer in progress.
  await page.goto('/register');
  await expect(sentence).not.toHaveText(before);
  const after = (await sentence.textContent())!;
  expect(delivered(after)).toBe(delivered(before) + 1);
  expect(inProgress(after)).toBe(inProgress(before) - 1);
});
