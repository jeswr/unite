// Checks on the browser code that can run without a browser: syntax, the
// module import graph, the absence of HTML-parsing sinks, and pure helpers.
// Rendering and interaction still need browser acceptance.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { connectLive } from '../public/js/api.js';
import { excerpt, relTime } from '../public/js/dom.js';

const root = fileURLToPath(new URL('../public', import.meta.url));
const scripts = [];
const walk = (dir) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full);
    else if (name.name.endsWith('.js')) scripts.push(full);
  }
};
walk(root);

describe('browser modules', () => {
  it('all parse as JavaScript', () => {
    for (const file of scripts) execFileSync(process.execPath, ['--check', file]);
    assert.ok(scripts.length >= 10);
  });

  it('import only files that exist', () => {
    for (const file of scripts) {
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
        assert.ok(existsSync(resolve(dirname(file), spec)), `${file} imports missing ${spec}`);
      }
    }
  });

  it('never use HTML-parsing sinks or inline handlers', () => {
    for (const file of scripts) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, file);
    }
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /\son[a-z]+=/i);
    assert.doesNotMatch(html, /<style|style=/i);
    assert.doesNotMatch(html, /https?:\/\//, 'no remote assets');
  });
});

describe('source guards (not a substitute for browser checks)', () => {
  it('keeps the native hidden attribute effective over component display rules', () => {
    const css = readFileSync(join(root, 'css', 'app.css'), 'utf8');
    assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  });

  it('presents the public-service model as one interpretation and local say as a design choice', () => {
    const source = readFileSync(join(root, 'js', 'views', 'futures.js'), 'utf8');
    assert.doesNotMatch(source, /Founder's proposal|Weak: set centrally/);
    assert.match(source, /one proposed interpretation/i);
    assert.match(source, /constitutional devolution/);
  });
});

// Drives connectLive with stand-ins for the document, window and
// EventSource, using short timings.
describe('live connection', () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function harness({ hidden = false, focused = true } = {}) {
    const streams = [];
    class FakeEventSource extends EventTarget {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 0;
        streams.push(this);
      }
      open() {
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
      }
      sync(rev) {
        const event = new Event('sync');
        event.data = JSON.stringify({ rev, bootId: 'b', kind: 'posts' });
        this.dispatchEvent(event);
      }
      close() {
        this.readyState = 2;
        this.closed = true;
      }
    }
    const doc = Object.assign(new EventTarget(), { hidden, focused, hasFocus() { return this.focused; } });
    const win = new EventTarget();
    let rev = 7;
    const polls = [];
    const statuses = [];
    const synced = [];
    const live = connectLive({
      onSync: (data) => synced.push(data.rev),
      onStatus: (status) => statuses.push(status),
      env: {
        doc,
        win,
        EventSourceImpl: FakeEventSource,
        fetchRev: async () => { polls.push(rev); return { rev, bootId: 'b' }; },
        timing: { openTimeoutMs: 40, blurGraceMs: 40, pollMs: 15, retryMs: 15 },
      },
    });
    const setHidden = (value) => {
      doc.hidden = value;
      doc.dispatchEvent(new Event('visibilitychange'));
    };
    return { streams, doc, win, live, polls, statuses, synced, setHidden, bump: () => { rev += 1; } };
  }

  it('closes the stream while hidden and resyncs on a fresh stream when shown', async () => {
    const t = harness();
    try {
      t.streams[0].open();
      t.streams[0].sync(8);
      assert.equal(t.statuses.at(-1), 'live');
      t.setHidden(true);
      assert.equal(t.streams[0].closed, true);
      assert.equal(t.statuses.at(-1), 'paused');
      await sleep(60);
      assert.equal(t.streams.length, 1, 'no stream or poll while hidden');
      assert.equal(t.polls.length, 0);
      t.setHidden(false);
      assert.equal(t.streams.length, 2);
      t.streams[1].open();
      t.streams[1].sync(12); // the server's hello frame carries the current revision
      assert.deepEqual(t.synced, [8, 12]);
      t.streams[0].sync(99); // a closed stream's late event is ignored
      assert.deepEqual(t.synced, [8, 12]);
    } finally {
      t.live.stop();
    }
  });

  it('starts paused in a hidden tab', () => {
    const t = harness({ hidden: true });
    assert.equal(t.streams.length, 0);
    assert.equal(t.statuses.at(-1), 'paused');
    t.live.stop();
  });

  it('falls back to polling when a stream cannot open (connection pool full)', async () => {
    const t = harness();
    try {
      await sleep(70);
      assert.equal(t.streams[0].closed, true);
      assert.equal(t.live.mode, 'poll');
      assert.equal(t.statuses.includes('limited'), true);
      assert.ok(t.polls.length >= 1);
      assert.equal(t.synced[0], 7, 'resyncs immediately');
      t.bump();
      await sleep(40);
      assert.ok(t.synced.includes(8), 'later changes arrive by polling');
    } finally {
      t.live.stop();
    }
  });

  it('lets an unfocused visible window give up its stream, and takes it back on focus', async () => {
    const t = harness();
    try {
      t.streams[0].open();
      t.doc.focused = false;
      t.win.dispatchEvent(new Event('blur'));
      await sleep(20);
      assert.equal(t.live.mode, 'stream', 'a short blur keeps the stream');
      await sleep(50);
      assert.equal(t.live.mode, 'poll');
      assert.equal(t.streams[0].closed, true);
      assert.equal(t.statuses.at(-1), 'polling');
      t.doc.focused = true;
      t.win.dispatchEvent(new Event('focus'));
      assert.equal(t.live.mode, 'stream');
      assert.equal(t.streams.length, 2);
      t.streams[1].open();
      const before = t.polls.length;
      await sleep(60);
      assert.equal(t.polls.length, before, 'polling stopped');
      assert.equal(t.statuses.at(-1), 'live');
    } finally {
      t.live.stop();
    }
  });
});

describe('display helpers', () => {
  it('formats relative times', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    assert.equal(relTime('2026-09-26T11:59:40Z', now), 'just now');
    assert.equal(relTime('2026-09-26T11:55:00Z', now), '5 min ago');
    assert.equal(relTime('2026-09-26T09:00:00Z', now), '3 h ago');
    assert.equal(relTime('2026-09-23T12:00:00Z', now), '3 d ago');
  });

  it('shortens long text on character boundaries', () => {
    assert.equal(excerpt('short', 10), 'short');
    assert.equal(excerpt('🌍'.repeat(20), 5), `${'🌍'.repeat(4)}…`);
  });
});
