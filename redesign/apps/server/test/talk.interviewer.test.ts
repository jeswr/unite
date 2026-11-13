import { afterEach, describe, expect, it } from 'vitest';
import { interviewerTurn, type InterviewerInput } from '../src/ai/interviewer.js';
import { DISTRESS_MESSAGE, IDENTIFYING_NOTE, INTERVIEWER_SYSTEM, SCRIPTED_QUESTIONS } from '../src/ai/prompts.js';
import { fakeRunner, testEnv, type TestEnv } from './helpers.js';
import { reply } from './talk.helpers.js';

const input = (over: Partial<InterviewerInput> = {}): InterviewerInput => ({
  mode: 'claude',
  stage: 3,
  turns: [
    { role: 'interviewer', text: 'Was there something you wanted to do and could not?' },
    { role: 'person', text: 'I wanted to go to the evening class but it is too expensive.' },
  ],
  personTurnsInStage: 1,
  assemblyQuestion: 'What would let people here keep earning and keep learning?',
  ...over,
});

const userText = (req: { messages: { content: unknown }[] }) =>
  JSON.stringify(req.messages.map((m) => m.content));

describe('the interviewer (rule 9)', () => {
  let env: TestEnv;
  afterEach(() => env.close());

  it('sends INTERVIEWER_SYSTEM, with the abstraction rule, and the stage message with the assembly question', async () => {
    const f = fakeRunner([reply({ acknowledgement: 'Too expensive.', question: 'When did that last get in your way?' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await interviewerTurn(env.deps, input());
    expect(r).toMatchObject({ text: 'Too expensive. When did that last get in your way?', safety: 'ok', stageComplete: false });
    expect(r.meta).toBeUndefined();
    const req = f.requests[0]!;
    expect(req.system).toBe(INTERVIEWER_SYSTEM);
    expect(req.system).toMatch(/general word without a concrete moment/);
    expect(req.system).toMatch(/money, expensive, afford, the system, the government, the council, the economy, society, or AI/);
    expect(req.system).toMatch(/down: when it last got in their way/);
    expect(req.system).toMatch(/up: if that were sorted, what it would let them do/);
    expect(req.output_config.effort).toBe('low');
    const text = userText(req);
    expect(text).toContain('Current stage: What got in the way.');
    expect(text).toContain('keep earning and keep learning');
    expect(text).toContain('it is too expensive');
    expect(text).not.toContain('previous reply was not shown');
  });

  it('refuses a reply with two questions, then one with "many people", then one over the word limit, and falls back to the scripted question', async () => {
    const long = Array.from({ length: 75 }, () => 'word').join(' ');
    const f = fakeRunner([
      reply({ question: 'What happened? And who was there?' }),
      reply({ acknowledgement: 'Many people say that.', question: 'What stops it?' }),
      reply({ acknowledgement: long, question: 'What stops it?' }),
    ]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await interviewerTurn(env.deps, input());
    expect(f.requests).toHaveLength(3);
    expect(r.text).toBe(SCRIPTED_QUESTIONS[3]![1]);
    expect(r.meta).toEqual({ regenerated: 2, fallback: true });
    // The failure is named on each retry.
    expect(userText(f.requests[1]!)).toMatch(/previous reply was not shown because it broke a rule: the question must contain exactly one question mark \(it has 2\)/);
    expect(userText(f.requests[2]!)).toMatch(/words that judge or steer: \\"many people\\"/);
    expect(userText(f.requests[0]!)).not.toMatch(/previous reply/);
  });

  it('uses a retried reply when it passes, and records how many times it was asked again', async () => {
    const f = fakeRunner([reply({ acknowledgement: 'That is great.', question: 'What stops it?' }), reply({ acknowledgement: 'The evening class.', question: 'What stops it?', stage_complete: true })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await interviewerTurn(env.deps, input());
    expect(r).toMatchObject({ text: 'The evening class. What stops it?', stageComplete: true, meta: { regenerated: 1 } });
  });

  it('shows the fixed distress message instead of the question', async () => {
    const f = fakeRunner([reply({ question: 'Tell me more?', safety: 'distress' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await interviewerTurn(env.deps, input());
    expect(r).toEqual({ text: DISTRESS_MESSAGE, stageComplete: false, safety: 'distress' });
    expect(DISTRESS_MESSAGE).toMatch(/local emergency number/);
  });

  it('appends the note about identifying details', async () => {
    const f = fakeRunner([reply({ acknowledgement: 'The class.', question: 'What stops it?', safety: 'identifying' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    const r = await interviewerTurn(env.deps, input());
    expect(r.text).toBe(`The class. What stops it? ${IDENTIFYING_NOTE}`);
    expect(r.safety).toBe('identifying');
  });

  it('uses the scripted question when no AI is switched on, and says the AI is unavailable', async () => {
    const f = fakeRunner([]);
    env = await testEnv({ runner: f.runner });
    const r = await interviewerTurn(env.deps, input({ personTurnsInStage: 0 }));
    expect(r).toMatchObject({ text: SCRIPTED_QUESTIONS[3]![0], unavailable: true, meta: { fallback: true } });
    expect(f.requests).toHaveLength(0);
  });

  it('asks a due host probe in scripted mode as the host wrote it', async () => {
    env = await testEnv();
    const r = await interviewerTurn(env.deps, input({ mode: 'scripted', stage: 7, probe: 'Who should run the classes?' }));
    expect(r.text).toBe('Who should run the classes?');
  });

  it('passes the probe to the model in stage 7', async () => {
    const f = fakeRunner([reply({ question: 'Who should run the classes?' })]);
    env = await testEnv({ config: { anthropicKey: 'k' }, runner: f.runner });
    await interviewerTurn(env.deps, input({ stage: 7, probe: 'Who should run the classes?' }));
    expect(userText(f.requests[0]!)).toContain("Host's question: \\\"Who should run the classes?\\\"");
  });
});
