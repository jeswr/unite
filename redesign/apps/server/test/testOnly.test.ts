import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { makePerson } from '../src/seed/builders.js';
import { testEnv, type TestEnv } from './helpers.js';

let env: TestEnv | undefined;
afterEach(async () => {
  await env?.close();
  env = undefined;
});

const PERSON = stableId('per', 'test/seeded');

describe('the test-only sign-in route', () => {
  it('is switched on only when NODE_ENV is test', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).testRoutes).toBe(true);
    expect(loadConfig({}).testRoutes).toBe(false);
    expect(loadConfig({ NODE_ENV: 'development' }).testRoutes).toBe(false);
  });

  it('signs in as an existing person when switched on', async () => {
    env = await testEnv();
    await makePerson({ store: env.deps.store, clock: env.clock }, { id: PERSON, displayName: 'Seeded', about: {} });
    const res = await request(env.app).post('/api/test/sign-in').send({ personId: PERSON });
    expect(res.status).toBe(200);
    const me = await request(env.app).get('/api/me').set('Cookie', res.headers['set-cookie'] as unknown as string[]);
    expect(me.body.person.id).toBe(PERSON);
    expect((await request(env.app).post('/api/test/sign-in').send({ personId: stableId('per', 'nobody') })).status).toBe(404);
  });

  it('does not exist when switched off', async () => {
    env = await testEnv({ config: { testRoutes: false } });
    await makePerson({ store: env.deps.store, clock: env.clock }, { id: PERSON, displayName: 'Seeded', about: {} });
    const res = await request(env.app).post('/api/test/sign-in').send({ personId: PERSON });
    expect(res.status).toBe(404);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
