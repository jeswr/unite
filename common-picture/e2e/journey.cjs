// End-to-end walk through the whole demonstration, driven by role and text, on the built site (vite preview).
// Usage: pnpm build && node e2e/journey.cjs   (screenshots go to SHOTS_DIR, default /home/user/shots-global)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 4318;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS_DIR || '/home/user/shots-global';
fs.mkdirSync(SHOTS, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

async function waitForServer(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const server = spawn(path.join(root, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  const errors = [];
  let browser;
  try {
    await waitForServer(BASE);
    browser = await chromium.launch();

    // ---------------------------------------------------------------- desktop journey
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const allowed = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !allowed.some((a) => m.text().includes(a))) errors.push(`[desktop] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[desktop pageerror] ${e.message}`));
    const shot = async (name) => (await page.waitForTimeout(450), page.screenshot({ path: path.join(SHOTS, `${name}-1280.png`), fullPage: true }));

    // Home
    await page.goto(BASE + '/');
    await page.getByRole('heading', { level: 1, name: /standing, public picture/ }).waitFor();
    assert(await page.getByText('Demonstration on invented examples. No real people, places’ views or results.').first().isVisible(), 'example strip');
    assert(await page.getByText('‘The Common Picture’ is a working name.').isVisible(), 'working name note');
    await shot('01-home');

    // Listen: web route with example answers
    await page.getByRole('link', { name: /Have the conversation/ }).click();
    await page.getByRole('heading', { level: 1, name: 'The conversation' }).waitFor();
    await page.getByRole('radio', { name: /Kiswahili/ }).check();
    await page.getByRole('radio', { name: /Type or speak on the web/ }).check();
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.getByText('Tuanze na siku halisi.').waitFor();
    let sawFollowUp = false;
    for (let i = 0; i < 10; i++) {
      if (await page.getByRole('heading', { name: 'Here is what I heard' }).isVisible()) break;
      await page.getByRole('button', { name: 'Use an example answer' }).click();
      if (await page.getByText('You said “money”. Can you tell me about a time that showed up in your day?').isVisible()) sawFollowUp = true;
    }
    assert(sawFollowUp, 'interviewer followed "money" down to an event');
    await page.getByRole('heading', { name: 'Here is what I heard' }).waitFor();
    await shot('02-listen-heard');
    await page.getByRole('button', { name: 'Change point 2' }).click();
    await page.getByLabel('Change point 2 to say').fill('The bus fare went up again last Tuesday and I lost an hour of selling.');
    await page.getByRole('button', { name: 'Drop point 5' }).click();
    assert((await page.getByRole('button', { name: 'Keep point 1' }).getAttribute('aria-pressed')) === 'true', 'point 1 kept');
    await page.getByRole('button', { name: /Continue with 4 kept points/ }).click();
    await page.getByRole('heading', { name: 'Adding to the picture' }).waitFor();
    await page.getByRole('checkbox', { name: 'Add my kept points to the picture for Kisumu, Kenya' }).check();
    await shot('03-listen-consent');
    await page.getByRole('button', { name: 'Add my points' }).click();
    await page.getByText('In this demonstration nothing is stored.').waitFor();
    await shot('04-listen-done');

    // Listen: phone mock-up
    await page.goto(BASE + '/listen');
    await page.getByRole('radio', { name: /Polski/ }).check();
    await page.getByRole('radio', { name: /An ordinary phone call/ }).check();
    await page.getByRole('button', { name: 'Begin' }).click();
    await page.getByText('The phone route does not work in this demonstration.').waitFor();
    await shot('05-listen-phone');

    // Picture
    await page.getByRole('link', { name: 'Picture', exact: true }).click();
    await page.getByRole('heading', { level: 2, name: 'The world picture' }).waitFor();
    assert(await page.getByText('61% of people').first().isVisible(), '61% of people on world finding');
    assert(await page.getByText('6 of 6 places and circles').first().isVisible(), 'second count shown');
    await shot('06-picture-world');
    await page.getByRole('button', { name: 'Which themes?' }).click();
    await page.getByText(/folded into "A fair price for a harvest"/).waitFor();
    await page.getByRole('button', { name: 'Kisumu', exact: true }).click();
    await page.getByRole('heading', { level: 2, name: 'Kisumu, Kenya' }).waitFor();
    await page.getByRole('button', { name: 'Drawn sample', exact: true }).click();
    await page.getByRole('button', { name: 'Open door', exact: true }).click();
    await page.getByRole('button', { name: 'Both doors, side by side' }).click();
    await page.getByRole('button', { name: /Show the words behind this/ }).first().click();
    await page.getByText('Translated from Kiswahili').first().waitFor();
    await page.getByText('Right of reply from an invented market traders’ group in Kisumu').waitFor();
    await page.getByRole('button', { name: 'This is not what was said' }).first().click();
    await page.getByRole('button', { name: 'Send challenge' }).click();
    await page.getByText('In this demonstration nothing was sent.').waitFor();
    await shot('07-picture-kisumu');
    await page.getByRole('button', { name: 'Quechua-speaking circle' }).click();
    await page.getByText('Standing statement · shown whole, never summarised').waitFor();
    await shot('08-picture-circle');

    // Days
    await page.goto(BASE + '/days');
    await page.getByRole('heading', { level: 1, name: 'Good days from elsewhere' }).waitFor();
    await page.getByRole('button', { name: 'Care', exact: true }).click();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await shot('09-days');

    // Room
    await page.getByRole('link', { name: 'Room', exact: true }).click();
    await page.getByRole('heading', { name: 'Write where you stand before you read the others' }).waitFor();
    assert(!(await page.getByText('Seat 7 · Dhaka').isVisible()), 'others hidden before posting');
    await page.getByRole('button', { name: 'Use an example answer' }).click();
    await page.getByText('Seat 7 · Dhaka').waitFor();
    await page.getByRole('button', { name: 'Talk it through' }).click();
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.getByText('What, if anything, is true in this for you?').first().waitFor();
    await page.getByRole('button', { name: 'Use an example answer' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.getByText('nothing from Talk it through is shared').waitFor();
    await shot('10-room');

    // Answers
    await page.getByRole('link', { name: 'Answers', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: 'Pledges and the register' }).waitFor();
    assert(await page.getByText('Late · 14 days').isVisible(), 'late answer counted from 13 November 2026');
    await shot('11-answers');

    // Route, editions
    await page.goto(BASE + '/route');
    await page.getByRole('heading', { level: 1, name: 'One person’s route' }).waitFor();
    await shot('12-route');
    await page.goto(BASE + '/editions');
    await page.getByRole('heading', { level: 1, name: 'Each statement carries its history' }).waitFor();
    await shot('13-editions');

    // About
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await page.getByText('A demonstration of method and nothing more.').first().waitFor();
    await shot('14-about');

    // Feedback: guided path, partial answers accepted, submit with mocked function
    let posted = null;
    await page.route('**/api/feedback', async (route) => {
      posted = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.getByRole('banner').getByRole('link', { name: 'Give feedback' }).click();
    await page.getByRole('heading', { level: 1, name: 'Give feedback' }).waitFor();
    assert(await page.getByText(/the people building this demonstration can read everything you send/i).first().isVisible(), 'who reads notice');
    await shot('15-feedback-choose');
    await page.getByRole('button', { name: /A few guided questions/ }).click();
    await page.getByRole('radio', { name: 'A funder' }).check();
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByLabel('What was clearest?').fill('The five parts of the picture.');
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByLabel('What was most confusing?').fill('The two doors at first.');
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByRole('radio', { name: '4' }).check();
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByRole('radio', { name: 'Perhaps' }).check();
    await page.getByLabel('Why?').fill('If the drawn sample were real and checked.');
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.getByLabel('Is anything missing?').fill('How operators are chosen.');
    await page.getByLabel('Name').fill('A test reader');
    await shot('16-feedback-last');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await page.getByRole('heading', { name: 'Thank you' }).waitFor();
    assert(posted && posted.kind === 'guided' && posted.answers.role === 'A funder' && posted.page === '/about', 'posted JSON');
    await shot('17-feedback-thanks');
    await page.getByRole('button', { name: 'Tell us something else' }).click();
    await page.getByRole('button', { name: /Just tell us something/ }).waitFor();
    await ctx.close();

    // ---------------------------------------------------------------- failure path and partial send (no storage: 503)
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push(`[mobile pageerror] ${e.message}`));
    p2.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('503')) errors.push(`[mobile] ${m.text()}`);
    });
    await p2.route('**/api/feedback', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
    await p2.goto(BASE + '/feedback?from=%2Fpicture');
    await p2.getByRole('button', { name: /A few guided questions/ }).click();
    await p2.getByRole('radio', { name: 'Research or a university' }).check();
    await p2.getByRole('button', { name: 'Send what I’ve said so far' }).click();
    await p2.getByText('Your feedback could not be sent.').waitFor();
    assert(await p2.getByRole('button', { name: 'Copy my text' }).isVisible(), 'copy offered');
    await p2.screenshot({ path: path.join(SHOTS, '18-feedback-failed-390.png'), fullPage: true });

    // ---------------------------------------------------------------- every page at phone and tablet widths
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
    ]) {
      await p2.setViewportSize({ width: w, height: h });
      const pages = ['/', '/listen', '/picture', '/days', '/room', '/answers', '/route', '/editions', '/about', '/feedback'];
      for (const [i, url] of pages.entries()) {
        await p2.goto(BASE + url);
        await p2.getByRole('heading', { level: 1 }).first().waitFor();
        if (url === '/picture') await p2.getByRole('button', { name: /Show the words behind this/ }).first().click();
        if (url === '/room') await p2.getByRole('button', { name: 'Use an example answer' }).click();
        await p2.waitForTimeout(450);
        const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(overflow <= 0, `no horizontal scroll at ${w} on ${url} (overflow ${overflow}px)`);
        const name = `m${String(i + 1).padStart(2, '0')}-${url === '/' ? 'home' : url.slice(1)}-${w}.png`;
        if (w === 390 || ['/', '/picture', '/answers'].includes(url)) await p2.screenshot({ path: path.join(SHOTS, name), fullPage: true });
      }
    }
    await ctx2.close();

    assert(errors.length === 0, 'no console errors:\n' + errors.join('\n'));
    console.log('e2e journey: all checks passed; screenshots in', SHOTS);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
