// Exercises api/feedback.mjs with a fake request and response: no token (503), mocked Blob put (200), and bad input.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler, { deps } from '../api/feedback.mjs';

function fakeReq(method, body, headers = { 'user-agent': 'test-agent' }) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.method = method;
  req.headers = headers;
  return req;
}
function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.end = (b) => (res.body = b ?? '');
  return res;
}
async function call(method, body) {
  const res = fakeRes();
  await handler(fakeReq(method, body), res);
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

const good = { kind: 'guided', partial: true, page: '/picture', answers: { clearest: 'The five parts.' }, name: 'A tester' };

delete process.env.BLOB_READ_WRITE_TOKEN;
let r = await call('POST', good);
assert.equal(r.status, 503, 'no token gives 503');
console.log('no token        ->', r.status, r.json.error);

process.env.BLOB_READ_WRITE_TOKEN = 'fake-token';
const calls = [];
deps.put = async (path, body, opts) => {
  calls.push({ path, body: JSON.parse(body), opts });
  return { url: 'https://example.invalid/' + path };
};
deps.now = () => new Date('2026-11-13T12:00:00.000Z');
deps.random = () => 'abc123';
r = await call('POST', good);
assert.equal(r.status, 200);
assert.equal(calls.length, 1);
assert.equal(calls[0].path, 'common-picture-feedback/2026-11-13T12-00-00-000Z-abc123.json');
assert.equal(calls[0].opts.access, 'private');
assert.equal(calls[0].body.page, '/picture');
assert.equal(calls[0].body.userAgent, 'test-agent');
assert.equal(calls[0].body.receivedAt, '2026-11-13T12:00:00.000Z');
assert.equal(calls[0].body.partial, true);
console.log('mocked put      ->', r.status, calls[0].path);

r = await call('POST', { message: 'x'.repeat(21 * 1024) });
assert.equal(r.status, 413);
console.log('over 20 KB      ->', r.status);
r = await call('POST', '{not json');
assert.equal(r.status, 400);
console.log('bad JSON        ->', r.status);
r = await call('POST', { message: '   ' });
assert.equal(r.status, 400);
console.log('empty           ->', r.status);
r = await call('GET');
assert.equal(r.status, 405);
console.log('GET             ->', r.status);
deps.put = async () => {
  throw new Error('down');
};
r = await call('POST', good);
assert.equal(r.status, 502);
console.log('put fails       ->', r.status);
console.log('feedback function: all checks passed');
