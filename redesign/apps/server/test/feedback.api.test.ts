import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_SCREENSHOT_CHARS } from '@unite/shared';
import { CSV_HEADER } from '../src/services/feedback/index.js';
import { HOUR_MS, MINUTE_MS } from '../src/services/feedback/limits.js';
import { loadReleases } from '../src/services/feedback/releases.js';
import { cookiesOf, testEnv, type TestEnv } from './helpers.js';

const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64');
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]).toString('base64');

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
});
afterEach(() => env.close());

const from = (ip: string) => ({ 'X-Forwarded-For': ip });
let ipCount = 0;
/** A new address for each start, so the hourly limit only applies in its own tests. */
const nextIp = () => `10.9.${Math.floor(++ipCount / 250)}.${ipCount % 250}`;

async function start(body: Record<string, unknown> = { path: '/register', mode: 'guided' }, ip = nextIp()) {
  const res = await request(env.app).post('/api/feedback').set(from(ip)).send(body);
  expect(res.status).toBe(201);
  return res.body.token as string;
}
const say = (token: string, text: string, ip = '10.0.0.1') => request(env.app).post(`/api/feedback/${token}/turns`).set(from(ip)).send({ text });
const patch = (token: string, body: object) => request(env.app).patch(`/api/feedback/${token}`).send(body);
const get = (token: string) => request(env.app).get(`/api/feedback/${token}`);

async function asSteward() {
  const res = await request(env.app).post('/api/role').send({ role: 'steward', code: 'steward' });
  return cookiesOf(res);
}

describe('starting feedback', () => {
  it('needs no sign-in and creates no person', async () => {
    const res = await request(env.app).post('/api/feedback').send({ path: '/a/earning-and-learning/picture', mode: 'free' });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(res.body.question).toMatch(/What would you like to tell us about Unite\?/);
    expect(cookiesOf(res)).toEqual([]);
    expect(await env.deps.store.count('persons')).toBe(0);
    const [fb] = await env.deps.store.list('feedback');
    expect(fb).toMatchObject({ path: '/a/earning-and-learning/picture', mode: 'free', status: 'draft' });
    expect(fb!.personId).toBeUndefined();
    // The person's view never includes the record id or a person id.
    expect(res.body.feedback.id).toBeUndefined();
    expect(res.body.feedback.personId).toBeUndefined();
  });

  it('attaches the person only when a session already exists', async () => {
    const me = await request(env.app).patch('/api/me').send({ displayName: 'Ama' });
    const res = await request(env.app).post('/api/feedback').set('Cookie', cookiesOf(me)).send({ path: '/', mode: 'free' });
    const [fb] = await env.deps.store.list('feedback');
    expect(fb!.personId).toBe(me.body.person.id);
    expect(res.status).toBe(201);
  });

  it('keeps only paths inside Unite, and gives each record its own token', async () => {
    const a = await start({ path: 'https://elsewhere.example/', mode: 'free' });
    const b = await start({ path: '//elsewhere.example', mode: 'free' });
    expect(a).not.toBe(b);
    expect((await get(a)).body.feedback.path).toBe('/');
    expect((await get(b)).body.feedback.path).toBe('/');
  });

  it('refuses an unknown mode or a malformed version in plain words', async () => {
    expect((await request(env.app).post('/api/feedback').send({ mode: 'loud' })).status).toBe(400);
    const v = await request(env.app).post('/api/feedback').send({ mode: 'changes', sinceVersion: 'latest' });
    expect(v.status).toBe(400);
    expect(v.body.error.message).toMatch(/version like 0.1.0/);
  });

  it('answers 404 for a token that does not exist', async () => {
    expect((await get('A'.repeat(32))).status).toBe(404);
    expect((await get('short')).status).toBe(404);
    expect((await say('A'.repeat(32), 'hello')).status).toBe(404);
  });
});

describe('submitting and editing', () => {
  it('submits with nothing said, and with part of the questions answered', async () => {
    const empty = await start();
    const s0 = await request(env.app).post(`/api/feedback/${empty}/submit`);
    expect(s0.status).toBe(200);
    expect(s0.body.feedback).toMatchObject({ status: 'received', statusLabel: 'Received', submittedAt: env.clock.iso() });

    const partial = await start();
    await say(partial, 'I was looking for the register');
    await say(partial, 'I found it in the end');
    const s1 = await request(env.app).post(`/api/feedback/${partial}/submit`);
    expect(s1.body.feedback.status).toBe('received');
    expect(s1.body.feedback.answers.filter((a: { answer: string }) => a.answer)).toHaveLength(2);
    // No more turns once sent, but answers can still be corrected.
    expect((await say(partial, 'more')).status).toBe(409);
    expect((await patch(partial, { answers: [{ index: 1, answer: 'I found it after a while' }] })).status).toBe(200);
  });

  it('edits any recorded answer, the name and the contact', async () => {
    const t = await start();
    await say(t, 'I wanted to react to statements');
    await say(t, 'It worked');
    const res = await patch(t, { answers: [{ index: 0, answer: 'I wanted to react to two statements' }], name: 'Ama', contact: 'ama@example.org' });
    expect(res.status).toBe(200);
    expect(res.body.feedback.answers[0].answer).toBe('I wanted to react to two statements');
    expect(res.body.feedback.answers[1].answer).toBe('It worked');
    expect(res.body.feedback).toMatchObject({ name: 'Ama', contact: 'ama@example.org' });
    const cleared = await patch(t, { name: '', contact: null });
    expect(cleared.body.feedback.name).toBeUndefined();
    expect(cleared.body.feedback.contact).toBeUndefined();
    expect((await patch(t, { answers: [{ index: 9, answer: 'x' }] })).status).toBe(400);
  });
});

describe('screenshots', () => {
  it('takes a PNG or a JPEG and removes it on request', async () => {
    const t = await start();
    expect((await patch(t, { screenshot: PNG })).body.feedback.screenshot).toBe(PNG);
    expect((await patch(t, { screenshot: JPEG })).body.feedback.screenshot).toBe(JPEG);
    expect((await patch(t, { screenshot: null })).body.feedback.screenshot).toBeUndefined();
  });

  it('refuses anything over 400 KB, any other type, or bytes that are not the image they claim', async () => {
    const t = await start();
    const big = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(MAX_SCREENSHOT_CHARS)]).toString('base64').slice(0, MAX_SCREENSHOT_CHARS);
    const tooBig = await patch(t, { screenshot: big });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.message).toMatch(/at most 400 KB/);
    for (const bad of [
      'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PGgxPmhpPC9oMT4=',
      'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'),
      JPEG.replace('image/jpeg', 'image/png'),
      'not a data url',
    ]) {
      const res = await patch(t, { screenshot: bad });
      expect(res.status, bad).toBe(400);
      expect(res.body.error.code).toBe('bad_screenshot');
    }
    expect((await get(t)).body.feedback.screenshot).toBeUndefined();
  });
});

describe('the public summary', () => {
  it('is shown exactly as it would be published, with links and emails taken out, and kept only on agreement', async () => {
    const t = await start({ path: '/', mode: 'free' });
    await say(t, 'The page at https://unite.example/a/x broke. Write to me at sam@example.org');
    const preview = await patch(t, { publicIssue: { state: 'previewed' } });
    const text = preview.body.feedback.publicIssue.text as string;
    expect(preview.body.feedback.publicIssue.state).toBe('previewed');
    expect(text).toBe('What would you like to tell us about Unite?\nThe page at [link removed] broke. Write to me at [email removed]');

    // Agreeing needs the exact text that was shown.
    expect((await patch(t, { publicIssue: { state: 'agreed', text: 'something else' } })).status).toBe(409);
    const agreed = await patch(t, { publicIssue: { state: 'agreed', text } });
    expect(agreed.body.feedback.publicIssue).toEqual({ state: 'agreed', text });

    // Changing an answer changes the text, so it must be agreed again.
    const edited = await patch(t, { answers: [{ index: 0, answer: 'The picture page broke.' }] });
    expect(edited.body.feedback.publicIssue).toEqual({ state: 'previewed', text: 'What would you like to tell us about Unite?\nThe picture page broke.' });
    const again = await patch(t, { publicIssue: { state: 'agreed', text: edited.body.feedback.publicIssue.text } });
    expect(again.body.feedback.publicIssue.state).toBe('agreed');

    const withdrawn = await patch(t, { publicIssue: { state: 'withdrawn' } });
    expect(withdrawn.body.feedback.publicIssue).toEqual({ state: 'withdrawn' });
  });

  it('cannot be agreed without being previewed, and "keep it private" stores nothing', async () => {
    const t = await start({ path: '/', mode: 'free' });
    expect((await patch(t, { publicIssue: { state: 'previewed' } })).status).toBe(400);
    await say(t, 'Fine');
    expect((await patch(t, { publicIssue: { state: 'agreed', text: 'x' } })).status).toBe(409);
    await patch(t, { publicIssue: { state: 'previewed' } });
    const no = await patch(t, { publicIssue: { state: 'none' } });
    expect(no.body.feedback.publicIssue).toEqual({ state: 'none' });
  });
});

describe('limits', () => {
  it('allows 5 new feedback records an hour from one address, using the injected clock', async () => {
    for (let i = 0; i < 5; i++) await start({ mode: 'free' }, '10.1.1.1');
    const sixth = await request(env.app).post('/api/feedback').set(from('10.1.1.1')).send({ mode: 'free' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('too_many');
    // Another address is not affected.
    await start({ mode: 'free' }, '10.2.2.2');
    env.clock.advance(HOUR_MS - 1);
    expect((await request(env.app).post('/api/feedback').set(from('10.1.1.1')).send({ mode: 'free' })).status).toBe(429);
    env.clock.advance(2);
    await start({ mode: 'free' }, '10.1.1.1');
  });

  it('allows 20 turns a minute on one feedback, even from different addresses', async () => {
    const t = await start({ mode: 'guided' }, '10.3.0.1');
    for (let i = 0; i < 20; i++) expect((await say(t, `turn ${i}`, `10.3.1.${i}`)).status).toBe(200);
    expect((await say(t, 'one more', '10.3.2.1')).status).toBe(429);
    env.clock.advance(MINUTE_MS);
    expect((await say(t, 'after a minute', '10.3.2.1')).status).toBe(200);
  });

  it('allows 20 turns a minute from one address, across feedback records', async () => {
    const a = await start({ mode: 'guided' }, '10.4.0.1');
    const b = await start({ mode: 'guided' }, '10.4.0.2');
    for (let i = 0; i < 12; i++) expect((await say(a, `a ${i}`, '10.4.4.4')).status).toBe(200);
    for (let i = 0; i < 8; i++) expect((await say(b, `b ${i}`, '10.4.4.4')).status).toBe(200);
    expect((await say(b, 'one more', '10.4.4.4')).status).toBe(429);
    expect((await say(b, 'from elsewhere', '10.4.5.5')).status).toBe(200);
    env.clock.advance(MINUTE_MS);
    expect((await say(a, 'later', '10.4.4.4')).status).toBe(200);
  });
});

describe('the steward', () => {
  async function sent(mode = 'guided', answers: string[] = ['I wanted to see the picture', 'It took a long time']) {
    const t = await start({ path: '/a/earning-and-learning/picture', mode });
    for (const a of answers) await say(t, a);
    await request(env.app).post(`/api/feedback/${t}/submit`);
    return t;
  }

  it('only a steward can see or change feedback', async () => {
    expect((await request(env.app).get('/api/steward/feedback')).status).toBe(403);
    expect((await request(env.app).get('/api/steward/feedback/export?format=csv')).status).toBe(403);
    expect((await request(env.app).patch('/api/steward/feedback/fb_AAAAAAAAAAAA').send({ status: 'done', reason: 'x' })).status).toBe(403);
  });

  it('lists sent feedback with counts and themes whose every line has its source, and never shows tokens or person ids', async () => {
    const me = await request(env.app).patch('/api/me').send({ displayName: 'Ama' });
    const personId = me.body.person.id as string;
    const t1 = await (async () => {
      const res = await request(env.app).post('/api/feedback').set('Cookie', cookiesOf(me)).send({ path: '/', mode: 'guided' });
      await say(res.body.token, 'React to statements');
      await request(env.app).post(`/api/feedback/${res.body.token}/submit`);
      return res.body.token as string;
    })();
    const t2 = await sent();
    await sent('free', ['The register is great']);
    await start(); // a draft: counted, not listed
    const cookie = await asSteward();
    const res = await request(env.app).get('/api/steward/feedback').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.counts).toEqual({
      total: 3,
      byStatus: { draft: 1, received: 3, planned: 0, done: 0, declined: 0 },
      byMode: { guided: 2, free: 1, changes: 0 },
    });
    const ids = new Set(res.body.items.map((i: { id: string }) => i.id));
    const trying = res.body.themes.find((t: { key: string }) => t.key === 'trying');
    expect(trying.question).toBe('What were you trying to do in Unite today?');
    expect(trying.answers.map((a: { answer: string }) => a.answer).sort()).toEqual(['I wanted to see the picture', 'React to statements']);
    for (const theme of res.body.themes) for (const a of theme.answers) expect(ids.has(a.feedbackId)).toBe(true);
    expect(res.body.themes.map((t: { key: string }) => t.key)).toEqual(['trying', 'happened', 'free']);

    for (const body of [JSON.stringify(res.body), (await request(env.app).get('/api/steward/feedback/export?format=csv').set('Cookie', cookie)).text, JSON.stringify((await request(env.app).get('/api/steward/feedback/export?format=json').set('Cookie', cookie)).body)]) {
      expect(body).not.toContain(t1);
      expect(body).not.toContain(t2);
      expect(body).not.toContain(personId);
      expect(body).not.toMatch(/"token"|"personId"/);
    }
  });

  it('changes a status with a reason, and the person sees both', async () => {
    const t = await sent();
    const cookie = await asSteward();
    const [item] = (await request(env.app).get('/api/steward/feedback').set('Cookie', cookie)).body.items;
    const noReason = await request(env.app).patch(`/api/steward/feedback/${item.id}`).set('Cookie', cookie).send({ status: 'planned', reason: ' ' });
    expect(noReason.status).toBe(400);
    const res = await request(env.app)
      .patch(`/api/steward/feedback/${item.id}`)
      .set('Cookie', cookie)
      .send({ status: 'planned', reason: 'We will make the picture load faster in the next release.' });
    expect(res.status).toBe(200);
    const mine = (await get(t)).body.feedback;
    expect(mine).toMatchObject({ status: 'planned', statusLabel: 'Planned', statusText: 'We plan to act on it.', statusReason: 'We will make the picture load faster in the next release.' });

    const draft = await start();
    const [d] = await env.deps.store.list('feedback', { token: draft });
    expect((await request(env.app).patch(`/api/steward/feedback/${d!.id}`).set('Cookie', cookie).send({ status: 'done', reason: 'x' })).status).toBe(409);
    expect((await request(env.app).patch('/api/steward/feedback/fb_AAAAAAAAAAAA').set('Cookie', cookie).send({ status: 'done', reason: 'x' })).status).toBe(404);
  });

  it('exports CSV with one row per answer, including the agreed public text', async () => {
    const t = await start({ path: '/register', mode: 'free' });
    await say(t, 'Say "hello", then =SUM(A1)');
    await patch(t, { name: 'Ama', contact: 'ama@example.org', screenshot: PNG });
    const shown = (await patch(t, { publicIssue: { state: 'previewed' } })).body.feedback.publicIssue.text;
    await patch(t, { publicIssue: { state: 'agreed', text: shown } });
    await request(env.app).post(`/api/feedback/${t}/submit`);
    await sent('guided', ['one', 'two', 'three']);
    const empty = await start();
    await request(env.app).post(`/api/feedback/${empty}/submit`);

    const cookie = await asSteward();
    const res = await request(env.app).get('/api/steward/feedback/export?format=csv').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="?unite-feedback-2026-11-13.csv"?/);
    const lines = res.text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    // 1 answer + 3 answers + 1 row for the record with none.
    expect(lines).toHaveLength(1 + 1 + 3 + 1);
    const freeRow = lines.find((l) => l.includes(',free,'))!;
    expect(freeRow).toContain('"Say ""hello"", then =SUM(A1)"');
    expect(freeRow).toContain('Ama,ama@example.org,,yes,free,');
    expect(freeRow).toContain('"What would you like to tell us about Unite?\nSay ""hello"", then =SUM(A1)"');
    expect(res.text).not.toContain('data:image');

    const json = await request(env.app).get('/api/steward/feedback/export?format=json').set('Cookie', cookie);
    expect(json.body.items).toHaveLength(3);
    expect(json.body.items.find((i: { mode: string }) => i.mode === 'free')).toMatchObject({ hasScreenshot: true, publicSummary: shown });
    expect(JSON.stringify(json.body)).not.toContain('data:image');
    expect((await request(env.app).get('/api/steward/feedback/export?format=xml').set('Cookie', cookie)).status).toBe(400);
  });
});

describe('releases', () => {
  it('serves RELEASES.json newest first, with 0.1.0 describing this build', async () => {
    const res = await request(env.app).get('/api/releases');
    expect(res.status).toBe(200);
    expect(res.body.releases).toEqual(loadReleases());
    const first = res.body.releases.find((r: { version: string }) => r.version === '0.1.0');
    expect(first.date).toBe('2026-11-13');
    expect(first.changes.length).toBeGreaterThanOrEqual(8);
    expect(first.changes.length).toBeLessThanOrEqual(10);
    expect(first.changes.filter((c: { question?: string }) => c.question)).toHaveLength(3);
    for (const c of first.changes) expect(c.affects.length).toBeGreaterThan(0);
  });
});
