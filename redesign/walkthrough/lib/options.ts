/**
 * The recorder's command line, checked before anything starts: a publish run that can't
 * succeed is refused here, before the app boots or a character is sent.
 */
import { parseArgs } from 'node:util';
import { parseBudget } from './budget.ts';
import { needsKey, PROVIDERS, type ProviderName } from './tts.ts';

export interface Options {
  mode: 'draft' | 'publish' | 'record';
  strict: boolean;
  provider: ProviderName;
  voiceId?: string;
  model?: string;
  rate?: number;
  only?: string[];
  budget: number | undefined;
  out?: string;
  headed: boolean;
  /** Draw the captions into the picture. On by default when there is no voice, since a silent video needs them. */
  burnCaptions: boolean;
  listActions: boolean;
  help: boolean;
}

export function parseOptions(args: string[], env: NodeJS.ProcessEnv = process.env): Options {
  const { values: v } = parseArgs({
    args,
    options: {
      draft: { type: 'boolean' },
      publish: { type: 'boolean' },
      strict: { type: 'boolean' },
      voice: { type: 'string' },
      'voice-id': { type: 'string' },
      model: { type: 'string' },
      rate: { type: 'string' },
      only: { type: 'string' },
      'voice-budget': { type: 'string' },
      out: { type: 'string' },
      headed: { type: 'boolean' },
      'burn-captions': { type: 'boolean' },
      'soft-captions': { type: 'boolean' },
      'list-actions': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (v.draft && v.publish) throw new Error('--publish records the real thing: drop --draft');
  const mode = v.publish ? 'publish' : v.draft ? 'draft' : 'record';
  const asked = v.voice as ProviderName | undefined;
  if (asked && !PROVIDERS.includes(asked)) throw new Error(`Unknown voice "${asked}". Use ${PROVIDERS.join(', ')}.`);
  if (mode === 'draft' && asked && asked !== 'silent') throw new Error('--draft always uses the silent voice: drop --voice');
  const provider: ProviderName = mode === 'draft' ? 'silent' : (asked ?? (mode === 'publish' ? 'elevenlabs' : 'silent'));
  const budget = parseBudget(v['voice-budget'] ?? env.VOICE_CHAR_BUDGET);
  if (mode === 'publish') {
    if (provider !== 'elevenlabs') throw new Error(`--publish needs a real narration voice (--voice elevenlabs), not "${provider}"`);
  }
  // A paid voice never starts without its key, and never asks for it: set it in the environment.
  const key = needsKey(provider);
  if (key && !env[key]?.trim()) throw new Error(`${key} is not set. --voice ${provider} needs it in the environment; nothing was started.`);
  if (v['burn-captions'] && v['soft-captions']) throw new Error('Choose one of --burn-captions and --soft-captions');
  const rate = v.rate === undefined ? undefined : Number(v.rate);
  if (rate !== undefined && !(rate > 0.5 && rate < 2)) throw new Error(`--rate must be between 0.5 and 2 (got "${v.rate}")`);
  return {
    mode,
    // A release video must be exactly what the script claims, or nothing at all.
    strict: mode === 'publish' || !!v.strict,
    provider,
    voiceId: v['voice-id'],
    model: v.model,
    rate,
    only: v.only
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    budget,
    out: v.out,
    headed: !!v.headed,
    burnCaptions: v['burn-captions'] ? true : v['soft-captions'] ? false : provider === 'silent',
    listActions: !!v['list-actions'],
    help: !!v.help,
  };
}
