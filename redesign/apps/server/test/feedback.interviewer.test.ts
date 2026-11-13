import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiResponse } from '../src/ai/client.js';
import {
  CHANGES_ELSE_QUESTION,
  CLOSING_MESSAGE,
  DEFENSIVE_PHRASES,
  checkFeedbackReply,
  findDefensivePhrases,
} from '../src/ai/feedback.js';
import { FEEDBACK_FREE_QUESTION, FEEDBACK_SYSTEM, FEEDBACK_TOPICS } from '../src/ai/prompts.js';
import { changesSince, loadReleases } from '../src/services/feedback/releases.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';

const reply = (r: { acknowledgement?: string; question: string; follow_up: boolean; answer?: string }): AiResponse => ({
  stop_reason: 'end_turn',
  parsed_output: { acknowledgement: '', answer: '', ...r },
  usage: { input_tokens: 100, output_tokens: 20 },
});

let env: TestEnv | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});

async function start(mode: string, extra: Record<string, unknown> = {}) {
  const res = await request(env!.app).post('/api/feedback').send({ path: '/a/earning-and-learning', mode, ...extra });
  expect(res.status).toBe(201);
  return res.body as { token: string; question: string; feedback: { answers: { key: string; question: string; answer: string }[] } };
}
const say = (token: string, text: string) => request(env!.app).post(`/api/feedback/${token}/turns`).send({ text });

describe('the defensive-phrase check', () => {
  it('finds each phrase, case-insensitively and on word boundaries', () => {
    for (const p of DEFENSIVE_PHRASES) expect(findDefensivePhrases(`Well, ${p.toUpperCase()} it is fine.`)).toContain(p);
    expect(findDefensivePhrases('That’s because the page loads slowly.')).toEqual(["that's because"]);
    expect(findDefensivePhrases('That is because of the design.')).toEqual(["that's because"]);
    expect(findDefensivePhrases('What did you actually expect?')).toEqual(['actually']);
    expect(findDefensivePhrases('What happened factually?')).toEqual([]);
  });

  it('refuses more than one question, over 50 words, or defending the product', () => {
    expect(checkFeedbackReply('Thank you. What did you expect to happen?').ok).toBe(true);
    expect(checkFeedbackReply('What happened? And then what?').ok).toBe(false);
    expect(checkFeedbackReply(`${'word '.repeat(50)}why?`).ok).toBe(false);
    expect(checkFeedbackReply('That works as intended. What else?').failures.join()).toMatch(/argues or defends/);
    expect(checkFeedbackReply('We already have that. What else?').ok).toBe(false);
  });
});

describe('guided feedback', () => {
  it('asks the ten topics in order in scripted mode, with no follow-ups, storing the words unedited', async () => {
    env = await testEnv();
    const s = await start('guided');
    expect(s.question).toContain(FEEDBACK_TOPICS[0]!.question);
    for (let i = 0; i < 10; i++) {
      const res = await say(s.token, `  answer ${i}, with https://x.example/ kept as said  `);
      expect(res.status).toBe(200);
      if (i < 9) expect(res.body.reply).toBe(FEEDBACK_TOPICS[i + 1]!.question);
      else {
        expect(res.body.reply).toBe(CLOSING_MESSAGE);
        expect(res.body.done).toBe(true);
      }
    }
    const fb = (await request(env.app).get(`/api/feedback/${s.token}`)).body.feedback;
    expect(fb.answers.map((a: { key: string }) => a.key)).toEqual(FEEDBACK_TOPICS.map((t) => t.key));
    expect(fb.answers[3].answer).toBe('answer 3, with https://x.example/ kept as said');
    expect(fb.done).toBe(true);
  });

  it('lets the model ask at most one follow-up per topic, and sends the never-argue rule', async () => {
    const fake = fakeRunner([
      reply({ acknowledgement: 'You were looking for the picture.', question: 'Where were you when you looked?', follow_up: true }),
      // A second follow-up on the same topic is not allowed: the fixed next question is used.
      reply({ question: 'And what then?', follow_up: true }),
      reply({ acknowledgement: 'It was slow.', question: 'Was anything confusing?', follow_up: false }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const s = await start('guided');
    const a = await say(s.token, 'I wanted to see the picture');
    expect(a.body.reply).toBe('You were looking for the picture. Where were you when you looked?');
    const b = await say(s.token, 'On the bus');
    expect(b.body.reply).toBe(FEEDBACK_TOPICS[1]!.question);
    const c = await say(s.token, 'It loaded slowly');
    expect(c.body.reply).toBe('It was slow. Was anything confusing?');
    expect(fake.requests).toHaveLength(3);
    for (const req of fake.requests) {
      expect(req.system).toBe(FEEDBACK_SYSTEM);
      expect(req.system).toContain('Never argue with feedback or defend the product.');
    }
    const answers = c.body.feedback.answers;
    expect(answers.slice(0, 3)).toEqual([
      { key: 'trying', question: FEEDBACK_TOPICS[0]!.question, answer: 'I wanted to see the picture' },
      { key: 'trying', question: 'Where were you when you looked?', answer: 'On the bus' },
      { key: 'happened', question: FEEDBACK_TOPICS[1]!.question, answer: 'It loaded slowly' },
    ]);
  });

  it('refuses a defensive reply and uses the fixed question instead', async () => {
    const fake = fakeRunner([
      reply({ acknowledgement: 'Actually, the picture is by design.', question: 'What did you expect?', follow_up: true }),
      reply({ acknowledgement: 'That is because the page is new.', question: 'What happened?', follow_up: false }),
      reply({ question: 'Was it confusing? Or slow?', follow_up: false }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const s = await start('guided');
    expect((await say(s.token, 'The picture was confusing')).body.reply).toBe(FEEDBACK_TOPICS[1]!.question);
    expect((await say(s.token, 'Nothing loaded')).body.reply).toBe(FEEDBACK_TOPICS[2]!.question);
    expect((await say(s.token, 'Yes')).body.reply).toBe(FEEDBACK_TOPICS[3]!.question);
  });

  it('falls back to the fixed question when the model gives no usable answer', async () => {
    const fake = fakeRunner([{ stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 1 } }]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const s = await start('guided');
    expect((await say(s.token, 'Something')).body.reply).toBe(FEEDBACK_TOPICS[1]!.question);
  });
});

describe('free feedback', () => {
  it('asks one open question in scripted mode and then closes', async () => {
    env = await testEnv();
    const s = await start('free');
    expect(s.question).toContain(FEEDBACK_FREE_QUESTION);
    const r = await say(s.token, 'The register is hard to find');
    expect(r.body).toMatchObject({ reply: CLOSING_MESSAGE, done: true });
  });

  it('allows at most two follow-ups', async () => {
    const fake = fakeRunner([
      reply({ question: 'Where did you look for it?', follow_up: true }),
      reply({ question: 'What did you expect to find there?', follow_up: true }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const s = await start('free');
    expect((await say(s.token, 'The register is hard to find')).body.reply).toBe('Where did you look for it?');
    expect((await say(s.token, 'In the menu')).body.reply).toBe('What did you expect to find there?');
    // No follow-up left and no next topic: the model is not asked again.
    const last = await say(s.token, 'A list of decisions');
    expect(last.body).toMatchObject({ reply: CLOSING_MESSAGE, done: true });
    expect(fake.requests).toHaveLength(2);
    expect(last.body.feedback.answers.map((a: { answer: string }) => a.answer)).toEqual(['The register is hard to find', 'In the menu', 'A list of decisions']);
    // Words said after the end are added to the last answer.
    const more = await say(s.token, 'Also the colours');
    expect(more.body.done).toBe(true);
    expect(more.body.feedback.answers[2].answer).toBe('A list of decisions\n\nAlso the colours');
  });
});

describe('what has changed', () => {
  it('lists the changes, asks each change’s own question, then anything else', async () => {
    env = await testEnv();
    const changes = changesSince(loadReleases());
    const asked = changes.filter((c) => c.question);
    const s = await start('changes');
    for (const c of changes) expect(s.question).toContain(c.text);
    expect(s.question).toContain(asked[0]!.question!);
    for (let i = 1; i < asked.length; i++) expect((await say(s.token, `about change ${i}`)).body.reply).toBe(asked[i]!.question);
    expect((await say(s.token, 'last change')).body.reply).toBe(CHANGES_ELSE_QUESTION);
    expect((await say(s.token, 'no')).body).toMatchObject({ reply: CLOSING_MESSAGE, done: true });
  });

  it('lists only changes after sinceVersion', async () => {
    env = await testEnv();
    const latest = loadReleases()[0]!.version;
    const s = await start('changes', { sinceVersion: latest });
    expect(s.question).toContain(`Nothing has changed since version ${latest}`);
    expect(s.feedback.answers[0]!.question).toBe(FEEDBACK_FREE_QUESTION);
  });
});
