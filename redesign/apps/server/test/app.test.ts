import request from 'supertest';
import { INTERVIEW_STAGES } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as prompts from '../src/ai/prompts.js';
import { testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
});
afterEach(() => env.close());

describe('app', () => {
  it('answers /healthz', async () => {
    expect((await request(env.app).get('/healthz')).body).toEqual({ ok: true });
  });

  it('answers unknown API paths with the error shape', async () => {
    const res = await request(env.app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('answers unreadable JSON in plain words', async () => {
    const res = await request(env.app).patch('/api/me').set('content-type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_json');
  });

  it.each([
    ['post', '/api/conversations'],
    ['get', '/api/assemblies/x/picture'],
    ['get', '/api/assemblies/x/statements'],
    ['get', '/api/listening'],
    ['get', '/api/rooms/x'],
    ['put', '/api/assemblies/x/priorities'],
    ['get', '/api/decisions/x'],
    ['get', '/api/register'],
    ['post', '/api/host/intake'],
    ['get', '/api/steward/feedback'],
    ['post', '/api/feedback'],
    ['get', '/api/me/export'],
    ['delete', '/api/me'],
    ['get', '/api/assemblies/x/export'],
  ] as const)('%s %s is mounted and not built yet', async (method, path) => {
    const res = await request(env.app)[method](path);
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('not_built');
  });
});

describe('how', () => {
  it('publishes the prompt version, the model and every export of prompts.ts', async () => {
    const res = await request(env.app).get('/api/how/prompts');
    expect(res.body.promptVersion).toBe(prompts.PROMPT_VERSION);
    expect(res.body.model).toBe('claude-opus-5-5');
    expect(res.body.mode).toBe('scripted');
    const names = res.body.prompts.map((p: { name: string }) => p.name).sort();
    expect(names).toEqual(Object.keys(prompts).filter((k) => k !== 'PROMPT_VERSION').sort());
    const system = res.body.prompts.find((p: { name: string }) => p.name === 'INTERVIEWER_SYSTEM');
    expect(system.text).toBe(prompts.INTERVIEWER_SYSTEM);
  });

  it('publishes the ten rules and the decision levels', async () => {
    const res = await request(env.app).get('/api/how/rules');
    expect(res.body.rules).toHaveLength(10);
    expect(res.body.rules[5].title).toBe('No pledge, no assembly');
    expect(res.body.levels.map((l: { name: string }) => l.name)).toEqual(['Do', 'No objection', 'Consent', 'Deliberated supermajority', 'Constitutional']);
  });

  it('the shared stage titles match the prompts', () => {
    for (let n = 1; n <= 8; n++) {
      expect(INTERVIEW_STAGES[n]!.key).toBe(prompts.STAGE_GOALS[n]!.key);
      expect(INTERVIEW_STAGES[n]!.title).toBe(prompts.STAGE_GOALS[n]!.title);
    }
  });
});

describe('rate limits', () => {
  it('allows 60 writes a minute per session and address, then answers 429', async () => {
    const limited = await testEnv({ config: { rateLimits: true } });
    try {
      for (let i = 0; i < 60; i++) expect((await request(limited.app).post('/api/role').send({ role: 'host', code: 'x' })).status).toBe(403);
      const res = await request(limited.app).post('/api/role').send({ role: 'host', code: 'x' });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('too_many');
      expect((await request(limited.app).get('/api/me')).status).toBe(200); // reads are not limited
    } finally {
      await limited.close();
    }
  });
});
