/* eslint-disable @typescript-eslint/no-explicit-any -- the tests reach into private state */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BudgetExceeded, estimateSeconds, Voice } from '../lib/tts.ts';

describe('voice requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ELEVENLABS_OUTPUT_FORMAT;
  });

  it('retries when the connection drops while the body is read', async () => {
    Voice.retryBaseMs = 1;
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      if (calls === 1) return { ok: true, status: 200, json: async () => Promise.reject(new TypeError('terminated')) };
      return { ok: true, status: 200, json: async () => ({ audio_base64: 'AA==' }) };
    });
    const v = new Voice({ provider: 'elevenlabs' }, '/tmp/unused');
    const out = await (v as any).post('https://example.invalid', {}, 'test', (r: Response) => r.json());
    expect(out).toEqual({ audio_base64: 'AA==' });
    expect(calls).toBe(2);
  });

  it('gives up on client errors without retrying', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return { ok: false, status: 401, text: async () => 'bad key' };
    });
    const v = new Voice({ provider: 'elevenlabs' }, '/tmp/unused');
    await expect((v as any).post('https://example.invalid', {}, 'test', (r: Response) => r.json())).rejects.toThrow(/401 bad key/);
    expect(calls).toBe(1);
  });
});

describe('voice cache and budget', () => {
  const dir = () => mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  const req = (text: string, previous?: string, next?: string) => ({ text, previous, next });
  const touch = (file: string) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '');
  };

  it('keys a clip by its own words, so editing a neighbour reuses it', () => {
    const v = new Voice({ provider: 'elevenlabs' }, dir());
    touch((v as any).fileFor(req('Hello.', 'Before.', 'After.')));
    expect(v.needsVoicing(req('Hello.', 'Changed before.', 'Changed after.'))).toBe(false);
    expect(v.needsVoicing(req('Hello, edited.', 'Before.', 'After.'))).toBe(true);
  });

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    vi.unstubAllGlobals();
  });

  const elevenlabs = (budget?: number) => {
    const v = new Voice({ provider: 'elevenlabs' }, dir());
    v.budget = budget;
    return v;
  };

  it('refuses a batch over the budget before sending anything', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return { ok: false, status: 500, text: async () => '' };
    });
    const reqs = [req('a'.repeat(600)), req('b'.repeat(600))];
    expect(() => elevenlabs(1000).checkBudget(reqs)).toThrow(/1,200 new characters.*budget of 1,000\. Nothing was sent/);
    expect(elevenlabs(1200).checkBudget(reqs)).toBe(1200);
    expect(elevenlabs(undefined).checkBudget(reqs)).toBe(1200);
    expect(calls).toBe(0);
  });

  it('counts only paragraphs that are not cached, and nothing for free voices', () => {
    const v = elevenlabs(10);
    touch((v as any).fileFor(req('cached paragraph')));
    expect(v.checkBudget([req('cached paragraph'), req('new one')])).toBe(7);
    const free = new Voice({ provider: 'silent' }, dir());
    free.budget = 10;
    expect(free.checkBudget([req('x'.repeat(5000))])).toBe(0);
  });

  // Retries used to be free as far as the budget knew, so one paragraph could be sent
  // (and billed) four times under a budget that allowed it once.
  it('charges every attempt, and stops retrying when the budget runs out', async () => {
    Voice.retryBaseMs = 1;
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return { ok: false, status: 503, text: async () => 'busy' };
    });
    const v = elevenlabs(2500);
    await expect(v.synth(req('p'.repeat(1000)))).rejects.toBeInstanceOf(BudgetExceeded);
    expect(calls).toBe(2); // the third attempt would have passed 2,500
    expect(v.spent).toBe(2000);
  });

  it('refuses at send time when a clip that was cached has gone', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return { ok: false, status: 500, text: async () => '' };
    });
    const v = elevenlabs(100);
    const big = req('q'.repeat(500));
    const file = (v as any).fileFor(big);
    touch(file);
    expect(v.checkBudget([big])).toBe(0); // cached when checked…
    rmSync(file); // …and gone by the time it is needed
    await expect(v.synth(big)).rejects.toThrow(/500 new characters.*budget of 100/);
    expect(calls).toBe(0);
  });

  it('reads the account’s characters left and refuses if a run would not fit', async () => {
    let sends = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/v1/user/subscription')) return new Response(JSON.stringify({ character_count: 26_000, character_limit: 30_000, next_character_count_reset_unix: 1_800_000_000 }));
      sends++;
      return new Response('', { status: 500 });
    });
    const v = elevenlabs(9000);
    expect(await v.quota()).toMatchObject({ used: 26_000, limit: 30_000 });
    await expect(v.checkQuota(3000)).resolves.toMatchObject({ used: 26_000 });
    await expect(v.checkQuota(3700)).rejects.toThrow(/4,000 characters left.*not enough for 3,700.*Nothing was sent/); // 3,700 + 10% > 4,000
    expect(sends).toBe(0);
  });

  it('goes on under the run budget when the key cannot read usage', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"detail":"missing_permissions"}', { status: 401 }));
    await expect(elevenlabs(2500).checkQuota(2000)).resolves.toBeUndefined();
  });

  // An outage used to look like a key without permission, so the run went on unchecked.
  it('refuses when usage can’t be read for any other reason than the key’s permissions', async () => {
    let sends = 0;
    const replies: (() => Promise<Response>)[] = [
      async () => new Response('busy', { status: 503 }),
      async () => new Response('{"tier":"starter"}'),
      async () => new Response('<html>', { status: 200 }),
      async () => {
        throw new TypeError('fetch failed');
      },
    ];
    for (const reply of replies) {
      vi.stubGlobal('fetch', async (url: string) => {
        if (url.endsWith('/v1/user/subscription')) return reply();
        sends++;
        return new Response('', { status: 500 });
      });
      await expect(elevenlabs(2500).checkQuota(2000)).rejects.toThrow(/Couldn't read ElevenLabs usage.*Nothing was sent/);
    }
    expect(sends).toBe(0);
  });
});

describe('the silent voice', () => {
  it('times a clip from its word count, at about 155 words a minute', () => {
    expect(estimateSeconds('one two three four five six seven eight nine ten eleven twelve thirteen')).toBeCloseTo(5, 5);
    expect(estimateSeconds(Array.from({ length: 155 }, () => 'word').join(' '))).toBeCloseTo(59.6, 1);
    // A clip is never shorter than 0.6 s, so a one-word caption is still readable.
    expect(estimateSeconds('Hi.')).toBe(0.6);
  });

  it('is free, and writes silence of the estimated length', async () => {
    const v = new Voice({ provider: 'silent' }, mkdtempSync(path.join(os.tmpdir(), 'voice-')));
    expect(v.paid).toBe(false);
    const text = 'Six words of silence for this test.';
    const clip = await v.synth({ text });
    expect(clip.cached).toBe(false);
    expect(clip.duration).toBeCloseTo(estimateSeconds(text), 1);
    expect((await v.synth({ text })).cached).toBe(true);
  });
});
