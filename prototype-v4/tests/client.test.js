// Checks on the browser code that can run without a browser: syntax, the
// module import graph, the absence of HTML-parsing sinks, and pure helpers.
// Rendering and interaction still need browser acceptance.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
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
