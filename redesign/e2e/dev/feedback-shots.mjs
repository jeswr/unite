// Screenshots of the feedback pages at 375, 768 and 1280 wide, for looking at by eye.
// Run from redesign/ after `pnpm build`:  node e2e/dev/feedback-shots.mjs
// Boots the built app on a memory store (demo mode, fixed clock), adds feedback through the API,
// and saves PNGs into e2e/shots/feedback/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'e2e/shots/feedback');
fs.mkdirSync(out, { recursive: true });
const PORT = Number(process.env.SHOTS_PORT ?? 4397);
const base = `http://localhost:${PORT}`;

// tsx directly (not through pnpm), so stopping it stops the server.
const server = spawn(process.execPath, [path.join(root, 'apps/server/node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], {
  cwd: path.join(root, 'apps/server'),
  env: { ...process.env, PORT: String(PORT), UNITE_DATA_DIR: 'memory', UNITE_DEMO: '1', UNITE_NOW: '2026-11-13T09:00:00Z', ANTHROPIC_API_KEY: '', NODE_ENV: 'test' },
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: true,
});
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already stopped */
  }
};

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('The server did not start.');
}

async function call(method, url, body, cookie) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return { body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

try {
  await waitUp();
  // Fixture: one sent piece of feedback, planned by a steward with a reason, with an agreed public summary.
  const { body: started } = await call('POST', '/api/feedback', { path: '/a/earning-and-learning/picture', mode: 'guided' });
  const token = started.token;
  for (const t of [
    'I wanted to see whether anyone else worries about evening classes.',
    'The picture loaded, but I could not tell which theme my point went into. Details at https://example.org/x',
    'The word "statement" took me a while.',
  ])
    await call('POST', `/api/feedback/${token}/turns`, { text: t });
  const { body: previewed } = await call('PATCH', `/api/feedback/${token}`, { name: 'Sam', publicIssue: { state: 'previewed' } });
  await call('PATCH', `/api/feedback/${token}`, { publicIssue: { state: 'agreed', text: previewed.feedback.publicIssue.text } });
  await call('POST', `/api/feedback/${token}/submit`);
  const { cookie } = await call('POST', '/api/role', { role: 'steward', code: 'steward' });
  const { body: list } = await call('GET', '/api/steward/feedback', undefined, cookie);
  await call('PATCH', `/api/steward/feedback/${list.items[0].id}`, { status: 'planned', reason: 'Your own points will be marked "you said this" on the picture in the next version.' }, cookie);

  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
  const problems = [];
  for (const width of [375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 800 : 900 } });
    page.setDefaultTimeout(15_000);
    page.on('console', (m) => m.type() === 'error' && problems.push(`${width}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${width}: ${e.message}`));
    const shot = async (name) => {
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (sideways) problems.push(`${width}: ${name} scrolls sideways`);
      await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
    };

    await page.goto(`${base}/feedback?from=${encodeURIComponent('/a/earning-and-learning/picture')}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shot('feedback-ways-in');

    await page.getByRole('button', { name: 'Answer a few questions, about eight minutes' }).click();
    const box = page.getByRole('textbox', { name: 'Your answer', exact: true });
    await box.waitFor();
    await shot('feedback-chat-start');
    for (const t of ['I was trying to react to the statements about evening classes.', 'It worked, but I did not see how many people agreed until I answered.']) {
      await box.fill(t);
      await page.getByRole('button', { name: 'Send' }).click();
      await page.getByText(t).first().waitFor();
      await page.getByText('Thinking about the next question…').waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: 'Show me the summary' }).click();
    await page.getByTestId('public-summary').waitFor();
    await shot('feedback-chat-answers');
    await page.getByRole('button', { name: /Change your answer to: What were you trying/ }).click();
    await shot('feedback-editing');

    await page.goto(`${base}/feedback/${token}`);
    try {
      await page.getByText('Planned').first().waitFor();
    } catch (e) {
      await page.screenshot({ path: path.join(out, `failed-${width}.png`) });
      throw e;
    }
    await shot('feedback-status');

    await page.goto(`${base}/feedback/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    await page.getByRole('heading', { name: 'We could not find this feedback' }).waitFor();
    await shot('feedback-status-missing');

    await page.goto(`${base}/changes`);
    await page.getByRole('heading', { name: 'Version 0.1.0' }).waitFor();
    await shot('changes');
    await page.close();
  }
  await browser.close();
  // The missing-feedback page logs its own 404 as a console error; that one is expected.
  const real = problems.filter((p) => !/404/.test(p));
  console.log(real.length ? `Problems:\n${real.join('\n')}` : `Saved screenshots to ${out}`);
  process.exitCode = real.length ? 1 : 0;
} finally {
  stopServer();
}
