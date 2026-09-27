import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openEvents, startServer } from './helpers.js';

describe('HTTP service', () => {
  let app;
  before(async () => { app = await startServer(); });
  after(() => app.close());

  describe('static files', () => {
    it('serves the app with a restrictive CSP and no wildcard CORS', async () => {
      const res = await app.get('/');
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/html/);
      assert.match(res.headers['content-security-policy'], /default-src 'self'/);
      assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
      assert.doesNotMatch(res.headers['content-security-policy'], /unsafe-inline|unsafe-eval/);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });

    it('serves only the exact file list and resists traversal', async () => {
      assert.equal((await app.get('/js/app.js')).status, 200);
      for (const path of ['/../server/app.js', '/js/../../server/store.js', '/%2e%2e/server/app.js', '/js/%2e%2e/%2e%2e/package.json', '/package.json', '/server/app.js', '/js/']) {
        const res = await app.get(path);
        assert.equal(res.status, 404, path);
        assert.doesNotMatch(res.text, /createUniteServer|export class/);
      }
    });

    it('rejects unexpected Host headers (DNS rebinding) and foreign origins', async () => {
      assert.equal((await app.get('/', { Host: 'evil.example' })).status, 421);
      assert.equal((await app.get('/api/state', { Host: `attacker.test:${app.port}` })).status, 421);
      assert.equal((await app.get('/api/state', { Origin: 'http://evil.example' })).status, 403);
      assert.equal((await app.get('/api/state', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
      assert.equal((await app.get('/api/state', { Host: `localhost:${app.port}` })).status, 200);
    });
  });

  describe('mutations', () => {
    it('requires Origin, the client header and JSON', async () => {
      const { token } = await app.join('Ada');
      const body = { roomId: 'work', text: 'Hello' };
      assert.equal((await app.post('/api/posts', body, { token, headers: { Origin: 'http://evil.example' } })).status, 403);
      const noOrigin = await app.raw({
        method: 'POST', path: '/api/posts', body: JSON.stringify(body),
        headers: { Host: `127.0.0.1:${app.port}`, 'X-Unite-Client': '1', 'Content-Type': 'application/json', 'X-Unite-Session': token },
      });
      assert.equal(noOrigin.status, 403);
      assert.equal((await app.post('/api/posts', body, { token, headers: { 'X-Unite-Client': '0' } })).status, 403);
      assert.equal((await app.post('/api/posts', body, { token, headers: { 'Content-Type': 'text/plain' } })).status, 415);
      assert.equal((await app.post('/api/posts', body, { token })).status, 200);
    });

    it('rejects mutations without a valid session', async () => {
      const body = { roomId: 'work', text: 'Anonymous' };
      assert.equal((await app.post('/api/posts', body)).status, 401);
      assert.equal((await app.post('/api/posts', body, { token: 'not-a-token' })).status, 401);
      assert.equal((await app.post('/api/posts', body, { token: 'A'.repeat(43) })).status, 401);
      assert.equal((await app.post('/api/rooms/work/stance', { stance: 'support', expectedVersion: 1 })).status, 401);
    });

    it('rejects oversized bodies, malformed JSON and unknown fields', async () => {
      const { token } = await app.join('Bea');
      const huge = await app.post('/api/posts', { roomId: 'work', text: 'x'.repeat(20_000) }, { token });
      assert.equal(huge.status, 413);
      assert.equal((await app.post('/api/posts', '{"roomId":', { token })).status, 400);
      assert.equal((await app.post('/api/posts', '[]', { token })).status, 400);
      const proto = await app.post('/api/posts', '{"roomId":"work","text":"hi","__proto__":{"admin":true}}', { token });
      assert.equal(proto.status, 400);
      assert.match(proto.json.error, /Unknown field "__proto__"/);
      const sessionId = await app.post('/api/posts', { roomId: 'work', text: 'hi', sessionId: 'x' }, { token });
      assert.equal(sessionId.status, 400);
      const withdraw = await app.post('/api/posts/p_abcdefgh/withdraw', { force: true }, { token });
      assert.equal(withdraw.status, 400);
    });

    it('enforces post ownership over HTTP', async () => {
      const a = await app.join('Cat');
      const b = await app.join('Dev');
      const created = await app.post('/api/posts', { roomId: 'care', text: 'Mine' }, { token: a.token });
      assert.equal((await app.post(`/api/posts/${created.json.id}/withdraw`, {}, { token: b.token })).status, 403);
      assert.equal((await app.post(`/api/posts/${created.json.id}/withdraw`, {}, { token: a.token })).status, 200);
      assert.equal((await app.post('/api/posts/..%2F..%2Fetc/withdraw', {}, { token: a.token })).status, 400);
    });

    it('keeps two participants\' stances separate and changeable', async () => {
      const a = await app.join('Eve');
      const b = await app.join('Fin');
      const version = (await app.get('/api/state')).json.grounds.places.current.version;
      await app.post('/api/rooms/places/stance', { stance: 'support', expectedVersion: version }, { token: a.token });
      await app.post('/api/rooms/places/stance', { stance: 'support', expectedVersion: version }, { token: b.token });
      await app.post('/api/rooms/places/stance', { stance: 'abstain', expectedVersion: version }, { token: a.token });
      const ground = (await app.get('/api/state')).json.grounds.places;
      assert.deepEqual(ground.tally, { support: 1, concern: 0, abstain: 1 });
      assert.equal(ground.stances.length, 2);
    });

    it('rate-limits writes per participant', async () => {
      const limited = await startServer({ limits: { writesPerMinute: 2 } });
      try {
        const { token } = await limited.join('Gus');
        const body = { roomId: 'work', text: 'Again' };
        assert.equal((await limited.post('/api/posts', body, { token })).status, 200);
        assert.equal((await limited.post('/api/posts', body, { token })).status, 200);
        assert.equal((await limited.post('/api/posts', body, { token })).status, 429);
      } finally {
        await limited.close();
      }
    });

    it('holds an action for owner review over HTTP and refuses a review of a context that has since changed', async () => {
      const owner = await app.join('Oda');
      const critic = await app.join('Pip');
      const ground = (await app.get('/api/state')).json.grounds.care;
      const version = ground.current.version;
      await app.post('/api/rooms/care/stance', { stance: 'concern', reason: 'Carers were not asked.', expectedVersion: version }, { token: critic.token });
      const created = await app.post('/api/actions', {
        roomId: 'care', expectedVersion: version, title: 'Respite rota', firstStep: 'Ask three carers what would help',
        ownership: 'me', checkIn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), effort: 1, impact: 2, urgency: 2, scope: 'community',
      }, { token: owner.token });
      assert.equal(created.status, 200, created.text);
      const find = async () => (await app.get('/api/state')).json.actions.find((a) => a.id === created.json.id);
      const seen = (await find()).context.id;
      assert.equal((await app.post(`/api/actions/${created.json.id}/status`, { status: 'ready' }, { token: owner.token })).status, 409);
      await app.post('/api/rooms/care/stance', { stance: 'concern', reason: 'Carers were not asked, and respite needs cover.', expectedVersion: version }, { token: critic.token });
      const stale = await app.post(`/api/actions/${created.json.id}/review`, { contextId: seen, text: 'Carers will be asked first.' }, { token: owner.token });
      assert.equal(stale.status, 409);
      const fresh = (await find()).context.id;
      assert.notEqual(fresh, seen);
      assert.equal((await app.post(`/api/actions/${created.json.id}/review`, { contextId: fresh, text: 'I read it: ask carers.' }, { token: critic.token })).status, 403);
      assert.equal((await app.post(`/api/actions/${created.json.id}/review`, { contextId: fresh, text: 'Carers will be asked first.' }, { token: owner.token })).status, 200);
      assert.equal((await app.post(`/api/actions/${created.json.id}/status`, { status: 'ready' }, { token: owner.token })).status, 200);
    });

    it('accepts optional intended everyday-life changes on actions over HTTP and serves them in state and export', async () => {
      const { token } = await app.join('Tove');
      const version = (await app.get('/api/state')).json.grounds.places.current.version;
      const body = {
        roomId: 'places', expectedVersion: version, title: 'Shade on Mill Street', firstStep: 'Ask neighbours where they sit on hot evenings',
        ownership: 'me', checkIn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), effort: 2, impact: 2, urgency: 3, scope: 'community',
      };
      const tooLong = await app.post('/api/actions', { ...body, lifeSigns: 'x'.repeat(501) }, { token });
      assert.equal(tooLong.status, 400);
      assert.match(tooLong.json.error, /at most 500/);
      const plain = await app.post('/api/actions', body, { token });
      assert.equal(plain.status, 200, plain.text);
      const created = await app.post('/api/actions', { ...body, lifeChange: 'Neighbours can sit outside somewhere cool.', lifeSigns: '<b>They</b> say evenings are easier.' }, { token });
      assert.equal(created.status, 200, created.text);
      const actions = (await app.get('/api/state')).json.actions;
      const find = (id) => actions.find((a) => a.id === id);
      assert.equal(find(plain.json.id).lifeChange, null);
      assert.equal(find(created.json.id).lifeChange, 'Neighbours can sit outside somewhere cool.');
      assert.equal(find(created.json.id).lifeSigns, '<b>They</b> say evenings are easier.');
      const exported = (await app.get('/api/export')).json.actions.find((a) => a.id === created.json.id);
      assert.equal(exported.lifeSigns, '<b>They</b> say evenings are easier.');
    });

    it('serves cached public state with the current AI status, and a small revision endpoint', async () => {
      const state = await app.get('/api/state');
      assert.equal(state.json.ai.enabled, false);
      assert.equal(typeof state.json.rev, 'number');
      assert.ok(Array.isArray(state.json.posts));
      const rev = await app.get('/api/rev');
      assert.deepEqual(Object.keys(rev.json).sort(), ['bootId', 'rev']);
      assert.equal(rev.json.rev, state.json.rev);
    });

    it('applies aggregate write, read and export limits across participants', async () => {
      const limited = await startServer({ limits: { globalWritesPerMinute: 2, readsPerMinute: 2, exportsPerMinute: 1 } });
      try {
        const a = await limited.join('Qin');
        const b = await limited.join('Ren');
        const body = { roomId: 'work', text: 'Hello' };
        assert.equal((await limited.post('/api/posts', body, { token: a.token })).status, 200);
        assert.equal((await limited.post('/api/posts', body, { token: b.token })).status, 200);
        assert.equal((await limited.post('/api/posts', body, { token: b.token })).status, 429);
        assert.equal((await limited.get('/api/state')).status, 200);
        assert.equal((await limited.get('/api/state')).status, 200);
        assert.equal((await limited.get('/api/state')).status, 429);
        assert.equal((await limited.get('/api/export')).status, 200);
        assert.equal((await limited.get('/api/export')).status, 429);
      } finally {
        await limited.close();
      }
    });

    it('returns session details only to the token holder and never tokens in public state', async () => {
      const { token, participant } = await app.join('Hal');
      const me = await app.get('/api/session', { 'X-Unite-Session': token });
      assert.equal(me.json.participant.id, participant.id);
      assert.equal((await app.get('/api/session')).status, 401);
      const state = await app.get('/api/state');
      const exported = await app.get('/api/export');
      for (const res of [state, exported]) {
        assert.ok(!res.text.includes(token), 'token leaked');
        assert.doesNotMatch(res.text, /"token"/);
      }
      assert.match(exported.headers['content-disposition'], /attachment; filename="unite-public-\d{4}-\d{2}-\d{2}\.json"/);
      assert.equal(exported.json.format, 'unite-v4-public-export');
    });
  });

  describe('live events', () => {
    it('broadcasts public changes to every connected stream without private data', async () => {
      const one = await openEvents(app.port);
      const two = await openEvents(app.port);
      try {
        assert.equal(one.status, 200);
        assert.match(one.headers['content-type'], /text\/event-stream/);
        await one.next(1);
        await two.next(1);
        const { token } = await app.join('Ivy');
        await app.post('/api/posts', { roomId: 'future', text: 'Broadcast me' }, { token });
        const [, , posted] = await one.next(3);
        const seen = await two.next(3);
        assert.equal(posted.kind, 'posts');
        assert.equal(seen[2].rev, posted.rev);
        assert.deepEqual(Object.keys(posted).sort(), ['bootId', 'kind', 'rev']);
      } finally {
        one.close();
        two.close();
      }
    });

    it('sends the current revision on reconnect so missed changes are fetched', async () => {
      const first = await openEvents(app.port);
      const [hello] = await first.next(1);
      first.close();
      const { token } = await app.join('Jo');
      await app.post('/api/posts', { roomId: 'work', text: 'While you were away' }, { token });
      const again = await openEvents(app.port, { 'Last-Event-ID': String(hello.rev) });
      try {
        const [latest] = await again.next(1);
        assert.ok(latest.rev > hello.rev);
        assert.equal(latest.bootId, hello.bootId);
        const state = await app.get('/api/state');
        assert.equal(state.json.rev, latest.rev);
        assert.ok(state.json.posts.some((p) => p.text === 'While you were away'));
      } finally {
        again.close();
      }
    });

    it('caps the number of event streams', async () => {
      const { EventHub } = await import('../server/events.js');
      const capped = await startServer({ hub: new EventHub({ maxClients: 1 }) });
      const first = await openEvents(capped.port);
      try {
        const second = await openEvents(capped.port);
        assert.equal(second.status, 503);
        second.close();
      } finally {
        first.close();
        await capped.close();
      }
    });
  });
});
