import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookiesOf, testEnv, type TestEnv } from './helpers.js';

describe('session and role cookies', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await testEnv({ config: { demo: true } });
  });
  afterEach(() => env.close());

  it('GET /api/me with no cookie has no person and creates none', async () => {
    const res = await request(env.app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ person: null, memberships: [], role: 'participant', demo: true });
    expect(cookiesOf(res)).toEqual([]);
    expect(await env.deps.store.count('persons')).toBe(0);
  });

  it('creates the person on the first write, in a signed http-only cookie', async () => {
    const res = await request(env.app).patch('/api/me').send({ displayName: 'Amina', about: { age: 'Under 25' } });
    expect(res.status).toBe(200);
    expect(res.body.person).toMatchObject({ displayName: 'Amina', about: { age: 'Under 25' }, isExample: false, locale: 'en-GB' });
    const raw = String(res.headers['set-cookie']);
    expect(raw).toMatch(/unite_sid=s%3Aper_/);
    expect(raw).toMatch(/HttpOnly/);
    const cookie = cookiesOf(res);
    const me = await request(env.app).get('/api/me').set('Cookie', cookie);
    expect(me.body.person.id).toBe(res.body.person.id);
    const again = await request(env.app).patch('/api/me').set('Cookie', cookie).send({ locale: 'cy' });
    expect(again.body.person).toMatchObject({ id: res.body.person.id, displayName: 'Amina', locale: 'cy' });
    expect(await env.deps.store.count('persons')).toBe(1);
  });

  it('ignores a cookie that is not signed by this server', async () => {
    const res = await request(env.app).get('/api/me').set('Cookie', 'unite_sid=per_AAAAAAAAAAAA');
    expect(res.body.person).toBeNull();
  });

  it('refuses bad input in plain words', async () => {
    const res = await request(env.app).patch('/api/me').send({ displayName: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('sets and clears the role with the passcode', async () => {
    const wrong = await request(env.app).post('/api/role').send({ role: 'host', code: 'nope' });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('wrong_code');
    const ok = await request(env.app).post('/api/role').send({ role: 'steward', code: 'steward' });
    expect(ok.status).toBe(200);
    expect(String(ok.headers['set-cookie'])).toMatch(/unite_role=s%3Asteward.*HttpOnly/);
    const me = await request(env.app).get('/api/me').set('Cookie', cookiesOf(ok));
    expect(me.body.role).toBe('steward');
    const cleared = await request(env.app).delete('/api/role').set('Cookie', cookiesOf(ok));
    expect(cleared.body.role).toBe('participant');
    expect(String(cleared.headers['set-cookie'])).toMatch(/unite_role=.*Expires=Thu, 01 Jan 1970/);
    // A forged role cookie counts for nothing.
    const forged = await request(env.app).get('/api/me').set('Cookie', 'unite_role=host');
    expect(forged.body.role).toBe('participant');
  });
});
