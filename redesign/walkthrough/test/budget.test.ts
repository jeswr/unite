import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE_BUDGET, parseBudget } from '../lib/budget.ts';
import { BudgetExceeded, Voice } from '../lib/tts.ts';

describe('the run budget', () => {
  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    vi.unstubAllGlobals();
  });

  it('defaults to 2,500 characters, with 0 for no limit', () => {
    expect(DEFAULT_VOICE_BUDGET).toBe(2500);
    expect(parseBudget(undefined)).toBe(2500);
    expect(parseBudget('')).toBe(2500);
    expect(parseBudget('4000')).toBe(4000);
    expect(parseBudget('0')).toBeUndefined();
    expect(() => parseBudget('lots')).toThrow(/whole number/);
    expect(() => parseBudget('-1')).toThrow(/whole number/);
    expect(() => parseBudget('2.5')).toThrow(/whole number/);
  });

  it('refuses a script over the budget before anything is sent', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return new Response('', { status: 500 });
    });
    const voice = new Voice({ provider: 'elevenlabs' }, mkdtempSync(path.join(os.tmpdir(), 'voice-')));
    voice.budget = parseBudget('1000');
    const script = [{ text: 'a'.repeat(700) }, { text: 'b'.repeat(400) }];
    expect(() => voice.checkBudget(script)).toThrow(BudgetExceeded);
    expect(() => voice.checkBudget(script)).toThrow(/1,100 new characters.*budget of 1,000\. Nothing was sent/);
    expect(voice.spent).toBe(0);
    expect(calls).toBe(0);
  });

  it('lets a script through when the budget is off', () => {
    const voice = new Voice({ provider: 'elevenlabs' }, mkdtempSync(path.join(os.tmpdir(), 'voice-')));
    voice.budget = parseBudget('0');
    expect(voice.checkBudget([{ text: 'c'.repeat(50_000) }])).toBe(50_000);
  });
});
