import http from 'node:http';
import { createUniteServer } from '../server/app.js';
import { Store } from '../server/store.js';

export async function startServer(options = {}) {
  const store = options.store ?? new Store(options.storeOptions);
  const server = createUniteServer({ ...options, store });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const client = {
    port,
    origin,
    store,
    server,
    close: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
    raw: (opts) => rawRequest(port, opts),
    get: (path, headers = {}) => rawRequest(port, { path, headers: { Host: `127.0.0.1:${port}`, ...headers } }),
    post: (path, body, { token, headers = {} } = {}) => rawRequest(port, {
      method: 'POST',
      path,
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: origin,
        'X-Unite-Client': '1',
        'Content-Type': 'application/json',
        ...(token ? { 'X-Unite-Session': token } : {}),
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    async join(displayName) {
      const res = await client.post('/api/session', { displayName });
      if (res.status !== 201) throw new Error(`join failed: ${res.status} ${res.text}`);
      return res.json;
    },
  };
  return client;
}

export function rawRequest(port, { method = 'GET', path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers, setHost: !('Host' in headers) }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// Opens an event stream and collects parsed `sync` events.
export function openEvents(port, headers = {}) {
  return new Promise((resolve, reject) => {
    const events = [];
    const waiters = [];
    const req = http.get({ host: '127.0.0.1', port, path: '/api/events', headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const data = frame.split('\n').find((line) => line.startsWith('data: '));
          if (data) {
            events.push(JSON.parse(data.slice(6)));
            for (const waiter of waiters.splice(0)) waiter();
          }
        }
      });
      resolve({
        status: res.statusCode,
        headers: res.headers,
        events,
        next: (count) => new Promise((done, fail) => {
          const timer = setTimeout(() => fail(new Error(`timed out waiting for ${count} events, got ${events.length}`)), 2000);
          const check = () => {
            if (events.length >= count) {
              clearTimeout(timer);
              done(events);
            } else waiters.push(check);
          };
          check();
        }),
        close: () => req.destroy(),
      });
    });
    req.on('error', (error) => {
      if (error.code !== 'ECONNRESET') reject(error);
    });
  });
}

export function fixedClock(iso = '2026-09-26T10:00:00Z') {
  let t = Date.parse(iso);
  const now = () => new Date(t);
  now.advance = (ms) => { t += ms; };
  return now;
}
