/**
 * Text to speech for the narration, with a disk cache so re-recording after a UI change
 * only pays for paragraphs whose words changed. A clip is keyed by its own words and the
 * voice settings, not its neighbours', so editing one paragraph re-voices only that one.
 * Paid voices also have a character budget per run (VOICE_CHAR_BUDGET, or --voice-budget),
 * checked before anything is sent.
 *
 * Providers:
 *   elevenlabs  ElevenLabs (eleven_multilingual_v2). Natural long-form narration that
 *               stitches paragraphs together using the text either side.  ELEVENLABS_API_KEY
 *   say         macOS `say`, for quick local drafts
 *   silent      No voice: silence sized to the words, for drafts and CI
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type ProviderName = 'elevenlabs' | 'say' | 'silent';

export const PROVIDERS: ProviderName[] = ['elevenlabs', 'say', 'silent'];

export interface VoiceOptions {
  provider: ProviderName;
  /** Provider-specific voice id or name. */
  voice?: string;
  /** Provider-specific model. */
  model?: string;
  /** Speaking rate multiplier where supported (1 = normal). */
  rate?: number;
}

export interface Clip {
  file: string;
  /** Seconds. */
  duration: number;
  cached: boolean;
  /** Start time (seconds) of each character of the spoken text, when the provider reports it. */
  charStarts?: number[];
}

/**
 * ElevenLabs output format. Only MP3 formats are accepted, because clips are stored and
 * probed as MP3. 128 kbps works on every plan; 192 kbps needs Creator or above.
 */
export const ELEVENLABS_FORMATS = ['mp3_22050_32', 'mp3_44100_32', 'mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192'];
const ELEVENLABS_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';
/** A fixed seed makes ElevenLabs more repeatable (it does not guarantee identical audio). */
const ELEVENLABS_SEED = 4242;
/** Voice settings sent with every ElevenLabs request (speed is added from the rate). */
const ELEVENLABS_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true };

export const DEFAULTS: Record<ProviderName, { voice?: string; model?: string; key?: string }> = {
  // "George": a warm, mid-paced British narrator from ElevenLabs' default voice library.
  elevenlabs: { voice: 'JBFqnCBsd6RMkjVDRZzb', model: 'eleven_multilingual_v2', key: 'ELEVENLABS_API_KEY' },
  say: { voice: 'Daniel' },
  silent: {},
};

/** The environment variable a provider's key comes from, if it needs one. */
export function needsKey(p: ProviderName) {
  return DEFAULTS[p].key;
}

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`Could not read the duration of ${file}`);
  return d;
}

/** Estimated speaking time, used for silent drafts: about 155 words a minute. */
export function estimateSeconds(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.6, words / 2.6);
}

/** The account's usage couldn't be read for a reason other than the key's permissions. */
export class QuotaUnknown extends Error {}

/** A send that would pass the run's character budget; nothing was sent. */
export class BudgetExceeded extends Error {}

export interface SynthRequest {
  text: string;
  /** Neighbouring paragraphs, so the voice keeps a natural flow across clips. */
  previous?: string;
  next?: string;
}

export class Voice {
  /** First retry delay; doubles each time. */
  static retryBaseMs = 1500;

  constructor(
    readonly opts: VoiceOptions,
    readonly cacheDir: string,
  ) {
    if (opts.provider === 'elevenlabs' && !ELEVENLABS_FORMATS.includes(ELEVENLABS_FORMAT))
      throw new Error(`ELEVENLABS_OUTPUT_FORMAT must be one of ${ELEVENLABS_FORMATS.join(', ')} (got "${ELEVENLABS_FORMAT}")`);
  }

  get label() {
    const d = DEFAULTS[this.opts.provider];
    return `${this.opts.provider}${this.opts.provider === 'silent' ? '' : ` (${this.opts.voice ?? d.voice}${this.opts.model || d.model ? `, ${this.opts.model ?? d.model}` : ''})`}`;
  }

  private key(req: SynthRequest) {
    const o = this.opts;
    const d = DEFAULTS[o.provider];
    // Everything that changes the audio is part of its identity, except the neighbouring
    // paragraphs: they only smooth the joins, and keying on them would re-voice a
    // paragraph whenever the one before or after it changed.
    const eleven = o.provider === 'elevenlabs' ? [ELEVENLABS_FORMAT, ELEVENLABS_SEED, ELEVENLABS_SETTINGS] : null;
    const material = JSON.stringify([o.provider, o.voice ?? d.voice, o.model ?? d.model, o.rate ?? 1, req.text, eleven]);
    return createHash('sha256').update(material).digest('hex').slice(0, 24);
  }

  private ext() {
    return this.opts.provider === 'say' ? 'aiff' : this.opts.provider === 'silent' ? 'wav' : 'mp3';
  }

  private fileFor(req: SynthRequest) {
    return path.join(this.cacheDir, this.opts.provider, `${this.key(req)}.${this.ext()}`);
  }

  /** Whether voicing this paragraph would cost anything: a paid voice with no cached clip. */
  needsVoicing(req: SynthRequest) {
    return this.paid && !existsSync(this.fileFor(req));
  }

  /** Whether this voice is a paid service (ElevenLabs, not say or silent). */
  get paid() {
    return this.opts.provider === 'elevenlabs';
  }

  /** Characters sent to a paid voice so far in this run. */
  spent = 0;
  /** Most characters this run may send to a paid voice; undefined means no limit. */
  budget?: number;

  private overBudget(cost: number, before = false) {
    return new BudgetExceeded(
      `Voicing this would send ${cost.toLocaleString('en')} new characters to ${this.opts.provider}` +
        (this.spent ? ` on top of the ${this.spent.toLocaleString('en')} already sent` : '') +
        `, over this run's budget of ${this.budget!.toLocaleString('en')}.${before ? ' Nothing was sent.' : ''} Raise VOICE_CHAR_BUDGET (or --voice-budget; 0 means no limit) if that is intended.`,
    );
  }

  /**
   * Counts characters about to be sent, refusing (before the send) if that would pass the
   * budget. Called for every attempt, retries included: each one may be billed.
   */
  private charge(chars: number) {
    if (!this.paid) return;
    if (this.budget && this.spent + chars > this.budget) throw this.overBudget(chars);
    this.spent += chars;
  }

  /**
   * Refuses, before anything is sent, a batch of paragraphs that would take this run past
   * its budget. Returns how many characters the batch will cost.
   */
  checkBudget(reqs: SynthRequest[]) {
    const cost = this.cost(reqs);
    if (this.budget && this.spent + cost > this.budget) throw this.overBudget(cost, true);
    return cost;
  }

  /** Characters a batch of paragraphs would send: the ones not cached, for a paid voice. */
  cost(reqs: SynthRequest[]) {
    return reqs.filter((r) => this.needsVoicing(r)).reduce((a, r) => a + r.text.length, 0);
  }

  /**
   * The ElevenLabs account's characters used and allowed this billing period, or
   * undefined when the key isn't allowed to read them (a key restricted to text to
   * speech). Any other failure (an outage, a timeout, an odd reply) throws, because
   * then nobody knows whether the run fits. Reading it costs nothing.
   */
  async quota(): Promise<{ used: number; limit: number; resetsAt?: string } | undefined> {
    if (this.opts.provider !== 'elevenlabs') return undefined;
    const unchecked = (why: string) => new QuotaUnknown(`Couldn't read ElevenLabs usage (${why}), so it isn't known whether this run fits. Nothing was sent.`);
    let res: Response;
    try {
      res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': this.secret('ELEVENLABS_API_KEY') }, signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      throw unchecked((e as Error).name === 'TimeoutError' ? 'no reply in 15 s' : (e as Error).message);
    }
    if (res.status === 401 || res.status === 403) return undefined;
    if (!res.ok) throw unchecked(`HTTP ${res.status}`);
    const j = (await res.json().catch(() => ({}))) as { character_count?: number; character_limit?: number; next_character_count_reset_unix?: number };
    if (typeof j.character_count !== 'number' || typeof j.character_limit !== 'number') throw unchecked('the reply had no character counts');
    return { used: j.character_count, limit: j.character_limit, resetsAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : undefined };
  }

  /**
   * Refuses, before anything is sent, if the account hasn't `cost` characters left (with a
   * margin for retries). Returns what it saw, for the log.
   */
  async checkQuota(cost: number, margin = 0.1) {
    const q = cost > 0 ? await this.quota() : undefined;
    if (q && q.limit - q.used < Math.ceil(cost * (1 + margin)))
      throw new BudgetExceeded(
        `ElevenLabs has ${(q.limit - q.used).toLocaleString('en')} characters left this period (${q.used.toLocaleString('en')} of ${q.limit.toLocaleString('en')} used), not enough for ${cost.toLocaleString('en')} plus a margin for retries. Nothing was sent.`,
      );
    return q;
  }

  async synth(req: SynthRequest): Promise<Clip> {
    const ext = this.ext();
    const file = this.fileFor(req);
    const timing = `${file}.timing.json`;
    const readTiming = async () => (existsSync(timing) ? (JSON.parse(await readFile(timing, 'utf8')) as number[]) : undefined);
    if (existsSync(file)) return { file, duration: await probeDuration(file), cached: true, charStarts: await readTiming() };
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.part.${ext}`;
    switch (this.opts.provider) {
      case 'elevenlabs': {
        const r = await this.elevenlabs(req);
        await writeFile(tmp, r.audio);
        if (r.charStarts) await writeFile(timing, JSON.stringify(r.charStarts));
        break;
      }
      case 'say':
        await run('say', ['-v', this.opts.voice ?? DEFAULTS.say.voice!, '-r', String(Math.round(175 * (this.opts.rate ?? 1))), '-o', tmp, req.text]);
        break;
      case 'silent':
        await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', estimateSeconds(req.text).toFixed(2), tmp]);
        break;
    }
    await rename(tmp, file);
    return { file, duration: await probeDuration(file), cached: false, charStarts: await readTiming() };
  }

  private secret(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
  }

  /**
   * POSTs and reads the whole response with `read`, retrying timeouts, dropped
   * connections (including mid-body), rate limits and server errors.
   */
  private async post<T>(url: string, init: RequestInit, what: string, read: (res: Response) => Promise<T>, chars = 0): Promise<T> {
    const wait = (attempt: number) => new Promise((r) => setTimeout(r, Voice.retryBaseMs * 2 ** attempt));
    for (let attempt = 1; ; attempt++) {
      // Outside the try: going over the budget is never retried.
      this.charge(chars);
      let res: Response;
      try {
        // The timeout covers the body too: the signal stays live until read() finishes.
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
        if (res.ok) return await read(res);
      } catch (err) {
        if (attempt < 4) {
          await wait(attempt);
          continue;
        }
        throw new Error(`${what} failed: ${(err as Error).message}`, { cause: err });
      }
      const body = await res.text().catch(() => '');
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await wait(attempt);
        continue;
      }
      throw new Error(`${what} failed: ${res.status} ${body.slice(0, 300)}`);
    }
  }

  private async elevenlabs(req: SynthRequest) {
    const voice = this.opts.voice ?? DEFAULTS.elevenlabs.voice;
    // The with-timestamps endpoint also returns when each character is spoken, for captions.
    const j = await this.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=${ELEVENLABS_FORMAT}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': this.secret('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
        body: JSON.stringify({
          text: req.text,
          seed: ELEVENLABS_SEED,
          model_id: this.opts.model ?? DEFAULTS.elevenlabs.model,
          previous_text: req.previous,
          next_text: req.next,
          voice_settings: { ...ELEVENLABS_SETTINGS, speed: this.opts.rate ?? 1 },
        }),
      },
      'ElevenLabs',
      async (res) => (await res.json()) as { audio_base64: string; alignment?: { characters: string[]; character_start_times_seconds: number[] } },
      req.text.length,
    );
    const starts = j.alignment?.character_start_times_seconds;
    return { audio: Buffer.from(j.audio_base64, 'base64'), charStarts: starts && starts.length === req.text.length ? starts : undefined };
  }
}
