import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { HOST_INTAKE_SYSTEM, HOST_INTAKE_TOPICS } from '../src/ai/prompts.js';
import { checkLeadingFallback } from '../src/services/host/checkLeading.js';
import { draftFromAnswers, findDate } from '../src/services/host/intake.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { deliveryFixture, IDS, PLEDGE, roleCookie } from './delivery.fixtures.js';

let env: TestEnv;
let open = false;
const boot = async (opts?: Parameters<typeof testEnv>[0]) => {
  env = await testEnv(opts);
  open = true;
};
afterEach(async () => {
  if (open) await env.close();
  open = false;
});

const ANSWERS = [
  'How should the town spend its evening bus budget?',
  'Night workers, students, carers, and people over 70',
  'The evening timetable and the routes we subsidise.',
  '£120,000 a year for three years.',
  'Fares, because the operator sets them under its licence.',
  'What people decide will be carried out within the budget.',
  'We will answer by 18 December 2026.',
];

const intake = (cookie: string[]) => request(env.app).post('/api/host/intake').set('Cookie', cookie);
const turn = (cookie: string[], id: string, text: string) => request(env.app).post(`/api/host/intake/${id}/turns`).set('Cookie', cookie).send({ text });

describe('host intake', () => {
  it('is for hosts only', async () => {
    await boot();
    expect((await request(env.app).post('/api/host/intake')).status).toBe(403);
  });

  it('scripted: asks the seven fixed questions in order and ends with a draft pledge in the host’s words', async () => {
    await boot();
    const host = await roleCookie(env, 'host');
    const start = await intake(host);
    expect(start.status).toBe(201);
    expect(start.body.question).toBe(HOST_INTAKE_TOPICS[0]!.question);
    const id = start.body.intake.id;
    let last = start;
    for (const [i, text] of ANSWERS.entries()) {
      last = await turn(host, id, text);
      expect(last.status).toBe(200);
      if (i < ANSWERS.length - 1) {
        expect(last.body.question).toBe(HOST_INTAKE_TOPICS[i + 1]!.question);
        expect(last.body.done).toBe(false);
      }
    }
    expect(last.body.done).toBe(true);
    expect(last.body.question).toBeNull();
    expect(last.body.draft).toMatchObject({
      question: ANSWERS[0],
      groups: ['Night workers', 'students', 'carers', 'people over 70'],
      kind: 'codecided',
      pledge: { remit: ANSWERS[2], setAside: ANSWERS[3], offTable: ANSWERS[4], replyBy: '2026-12-18', groupThreshold: 0.6, checkBody: 'panel' },
    });
    expect(last.body.intake.messages).toHaveLength(14);
    expect((await turn(host, id, 'more')).status).toBe(409);
    const stored = await env.deps.store.get('intakes', id);
    expect(stored?.draftPledge?.remit).toBe(ANSWERS[2]);
  });

  it('with the AI: asks at most one follow-up per topic, then moves on', async () => {
    const fake = fakeRunner((req) => {
      const data = JSON.parse(String(req.messages[0]!.content));
      const follow = data.topic_just_asked === HOST_INTAKE_TOPICS[3]!.question;
      return {
        stop_reason: 'end_turn',
        parsed_output: follow ? { follow_up: true, question: 'How much, and in which budget year?' } : { follow_up: false, question: data.next_topic ?? 'Thank you?' },
        usage: { input_tokens: 10, output_tokens: 10 },
      };
    });
    await boot({ config: { anthropicKey: 'test-key' }, runner: fake.runner });
    const host = await roleCookie(env, 'host');
    const id = (await intake(host)).body.intake.id;
    for (const text of ANSWERS.slice(0, 3)) await turn(host, id, text);
    const vague = await turn(host, id, 'Some money.');
    expect(vague.body.question).toBe('How much, and in which budget year?');
    expect(vague.body.source).toBe('ai');
    const after = await turn(host, id, '£120,000 a year from 2027.');
    expect(after.body.question).toBe(HOST_INTAKE_TOPICS[4]!.question);
    expect(fake.requests.every((r) => r.system === HOST_INTAKE_SYSTEM)).toBe(true);
    // No model call for the answer to a follow-up.
    expect(fake.requests).toHaveLength(4);
    for (const text of ANSWERS.slice(4)) await turn(host, id, text);
    const done = (await env.deps.store.get('intakes', id))!;
    expect(done.status).toBe('complete');
    expect(done.answers.find((a) => a.key === 'setAside')?.answer).toBe('Some money.\n£120,000 a year from 2027.');
  });

  it('finds dates in plain words', () => {
    expect(findDate('By 18 December 2026')).toBe('2026-12-18');
    expect(findDate('the 3rd of March 2027 at the latest')).toBe('2027-03-03');
    expect(findDate('December 1, 2026')).toBe('2026-12-01');
    expect(findDate('2027-01-31')).toBe('2027-01-31');
    expect(findDate('soon')).toBeUndefined();
    expect(draftFromAnswers([{ key: 'rule', question: '', answer: 'We will take advice and answer it.' }]).kind).toBe('advisory');
  });
});

describe('opening an assembly and rule 6: no pledge, no assembly', () => {
  const create = (cookie: string[], body: object) => request(env.app).post('/api/host/assemblies').set('Cookie', cookie).send(body);

  it('creates in proposed, cannot publish without a complete pledge, and locks once published', async () => {
    await boot();
    const host = await roleCookie(env, 'host');
    expect((await create([], { question: 'Q?', hostName: 'H' })).status).toBe(403);
    const made = await create(host, { title: 'Evening buses', question: 'How should the town spend its evening bus budget?', hostName: 'Riverside Transport Board', kind: 'codecided' });
    expect(made.status).toBe(201);
    expect(made.body.assembly).toMatchObject({ slug: 'evening-buses', stage: 'proposed', hostSlug: 'riverside-transport-board', pledge: null, isExample: false });

    // No pledge: refused.
    let stage = await request(env.app).post('/api/assemblies/evening-buses/stage').set('Cookie', host);
    expect(stage.status).toBe(409);
    expect(stage.body.error.details.unmet.map((i: { key: string }) => i.key)).toContain('pledge_complete');

    // An incomplete pledge: still refused.
    const incomplete = await request(env.app).patch('/api/host/assemblies/evening-buses').set('Cookie', host).send({ pledge: { ...PLEDGE, remit: '', replyBy: '2027-01-31' } });
    expect(incomplete.status).toBe(200);
    stage = await request(env.app).post('/api/assemblies/evening-buses/stage').set('Cookie', host);
    expect(stage.status).toBe(409);
    expect(stage.body.error.details.unmet[0].detail).toMatch(/what the host can act on/);

    // Complete: it publishes.
    await request(env.app).patch('/api/host/assemblies/evening-buses').set('Cookie', host).send({ pledge: { ...PLEDGE, replyBy: '2027-01-31' } });
    stage = await request(env.app).post('/api/assemblies/evening-buses/stage').set('Cookie', host);
    expect(stage.status).toBe(200);
    expect(stage.body.assembly.stage).toBe('pledged');

    const late = await request(env.app).patch('/api/host/assemblies/evening-buses').set('Cookie', host).send({ question: 'Something else?' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('already_published');
  });

  it('refuses a leading question at publication', async () => {
    await boot();
    const host = await roleCookie(env, 'host');
    await create(host, { title: 'Parks', question: "Wouldn't you agree the park needs more lights?", hostName: 'Parks Trust', pledge: PLEDGE });
    const stage = await request(env.app).post('/api/assemblies/parks/stage').set('Cookie', host);
    expect(stage.status).toBe(409);
    expect(stage.body.error.details.unmet.map((i: { key: string }) => i.key)).toEqual(['not_leading']);
  });

  it('edits probes, groups and about questions; keeps groups tied to an answer; gives unique slugs; accepts a theme it answers', async () => {
    await boot();
    await deliveryFixture(env);
    const host = await roleCookie(env, 'host');
    const a = await create(host, { title: 'Volunteering tool', question: 'Q?', hostName: 'Someone', fromThemeId: IDS.theme });
    expect(a.body.assembly.slug).toBe('volunteering-tool');
    expect(a.body.assembly.fromThemeId).toBe(IDS.theme);
    expect((await create(host, { title: 'Volunteering tool', question: 'Q?', hostName: 'Someone' })).body.assembly.slug).toBe('volunteering-tool-2');
    expect((await create(host, { question: 'Q?', hostName: 'Someone', fromThemeId: 'thm_AAAAAAAAAAAA' })).status).toBe(400);
    const about = [{ key: 'group', label: 'Which of these describes you?', options: ['Night workers', 'Carers'] }];
    const ok = await request(env.app)
      .patch('/api/host/assemblies/volunteering-tool')
      .set('Cookie', host)
      .send({ probes: ['What gets in the way at night?'], aboutQuestions: about, affectedGroups: [{ key: 'night', label: 'Night workers', aboutKey: 'group', aboutValue: 'Night workers', target: 10 }] });
    expect(ok.status).toBe(200);
    expect(ok.body.assembly.probes).toEqual(['What gets in the way at night?']);
    const bad = await request(env.app)
      .patch('/api/host/assemblies/volunteering-tool')
      .set('Cookie', host)
      .send({ affectedGroups: [{ key: 'x', label: 'Students', aboutKey: 'group', aboutValue: 'Students', target: 5 }] });
    expect(bad.status).toBe(400);
    expect((await request(env.app).patch('/api/host/assemblies/volunteering-tool').set('Cookie', host).send({ probes: ['a', 'b', 'c', 'd'] })).status).toBe(400);
  });

  it('makes invitation codes that let people join as invited', async () => {
    await boot();
    const host = await roleCookie(env, 'host');
    await create(host, { title: 'Parks', question: 'What should the park be like?', hostName: 'Parks Trust' });
    const inv = await request(env.app).post('/api/host/assemblies/parks/invites').set('Cookie', host).send({ label: 'Allotment holders' });
    expect(inv.status).toBe(201);
    expect(inv.body.invite.code).toMatch(/^[A-Z2-9]{8}$/);
    const list = await request(env.app).get('/api/host/assemblies/parks/invites').set('Cookie', host);
    expect(list.body.invites.map((i: { label: string }) => i.label)).toEqual(['Allotment holders']);
    expect((await request(env.app).get('/api/host/assemblies/parks/invites')).status).toBe(403);
    const join = await request(env.app).post('/api/assemblies/parks/join').send({ inviteCode: inv.body.invite.code });
    expect(join.body.membership.invited).toBe(true);
  });
});

describe('the leading-wording check', () => {
  it('flags phrases from the list and suggests a plainer wording', async () => {
    await boot();
    const host = await roleCookie(env, 'host');
    const res = await request(env.app).post('/api/check-leading').set('Cookie', host).send({ text: "Wouldn't you agree that buses should run later?" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ leading: true, suggestion: 'Buses should run later?' });
    expect(res.body.why).toMatch(/wouldn't you agree/);
    expect(checkLeadingFallback('What would help you get home at night?')).toEqual({ leading: false, why: 'No leading wording was found.', suggestion: 'What would help you get home at night?' });
    expect((await request(env.app).post('/api/check-leading').send({ text: 'x' })).status).toBe(403);
  });
});
