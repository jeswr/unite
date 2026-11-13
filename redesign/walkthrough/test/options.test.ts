import { describe, expect, it } from 'vitest';
import { parseOptions } from '../lib/options.ts';
import { serverEnv } from '../lib/servers.ts';

describe('the command line', () => {
  it('drafts with the silent voice, and lets pending actions through unless --strict', () => {
    expect(parseOptions(['--draft'], {})).toMatchObject({ mode: 'draft', provider: 'silent', strict: false });
    expect(parseOptions(['--draft', '--strict'], {})).toMatchObject({ mode: 'draft', provider: 'silent', strict: true });
    expect(() => parseOptions(['--draft', '--voice', 'elevenlabs'], {})).toThrow(/silent voice/);
  });

  it('records a subset of scenes with --only', () => {
    expect(parseOptions(['--draft', '--only', 'intro, pledge'], {}).only).toEqual(['intro', 'pledge']);
  });

  it('refuses --publish without ELEVENLABS_API_KEY, before anything starts', () => {
    expect(() => parseOptions(['--publish', '--voice', 'elevenlabs'], {})).toThrow(/ELEVENLABS_API_KEY is not set.*nothing was started/);
    expect(() => parseOptions(['--publish', '--voice', 'elevenlabs'], { ELEVENLABS_API_KEY: '  ' })).toThrow(/ELEVENLABS_API_KEY is not set/);
    // The default voice for a publish run is ElevenLabs, so leaving --voice out doesn't dodge the check.
    expect(() => parseOptions(['--publish'], {})).toThrow(/ELEVENLABS_API_KEY/);
  });

  it('refuses --publish with a voice that is not a real narrator, or with --draft', () => {
    expect(() => parseOptions(['--publish', '--voice', 'silent'], {})).toThrow(/needs a real narration voice/);
    expect(() => parseOptions(['--publish', '--voice', 'say'], {})).toThrow(/needs a real narration voice/);
    expect(() => parseOptions(['--publish', '--draft'], { ELEVENLABS_API_KEY: 'k' })).toThrow(/drop --draft/);
  });

  it('makes a publish run strict, with the budget from the environment or the flag', () => {
    const env = { ELEVENLABS_API_KEY: 'k', VOICE_CHAR_BUDGET: '9000' };
    expect(parseOptions(['--publish', '--voice', 'elevenlabs'], env)).toMatchObject({ mode: 'publish', provider: 'elevenlabs', strict: true, budget: 9000 });
    expect(parseOptions(['--publish', '--voice-budget', '0'], env).budget).toBeUndefined();
    expect(parseOptions(['--publish'], { ELEVENLABS_API_KEY: 'k' }).budget).toBe(2500);
  });

  it('rejects unknown voices', () => {
    expect(() => parseOptions(['--voice', 'openai'], {})).toThrow(/Unknown voice/);
  });
});

describe('the recorded server', () => {
  it('runs on a memory store in demo mode, with the clock fixed and no AI key', () => {
    const env = serverEnv(4555, { ANTHROPIC_API_KEY: 'secret', NODE_ENV: 'production', DATABASE_URL: 'postgres://x', PATH: '/bin' });
    expect(env).toMatchObject({ PORT: '4555', UNITE_DATA_DIR: 'memory', UNITE_DEMO: '1', UNITE_NOW: '2026-11-13T09:00:00Z', ANTHROPIC_API_KEY: '', PATH: '/bin' });
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.NODE_OPTIONS).toMatch(/--import file:.*deterministic\.mjs$/);
  });
});
