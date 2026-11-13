import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Clock, Spend } from '@unite/shared';
import type { z } from 'zod';
import type { Config } from '../config.js';
import type { Store } from '../store/types.js';

/**
 * Every AI call goes through `withAi(name, fn, fallback)` (section 6). It checks that a key is set
 * and that today's and this month's estimated spend are under the caps, records the estimated
 * cost of each response, and returns the fallback on any failure. Tests inject a runner, so no
 * test ever reaches the network.
 */

/** US dollars per million tokens. */
export const PRICE_PER_MILLION = { input: 4, output: 20 } as const;

/** Exactly the request shape section 6 allows: nothing else is ever sent. */
export interface AiRequest {
  model: string;
  max_tokens: number;
  output_config: { effort: 'low' | 'medium'; format: ReturnType<typeof zodOutputFormat> };
  system: string;
  messages: Anthropic.MessageParam[];
}

export interface AiResponse {
  stop_reason: string | null;
  parsed_output?: unknown;
  usage: { input_tokens: number; output_tokens: number };
}

/** Sends one request. The default sends it to Claude; tests pass a fake. */
export type AiRunner = (request: AiRequest) => Promise<AiResponse>;

/** The real runner: the Anthropic SDK, called exactly as section 6 shows. */
export const anthropicRunner: AiRunner = async (request) => {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: request.model,
    max_tokens: request.max_tokens,
    output_config: request.output_config,
    system: request.system,
    messages: request.messages,
  });
  return response as unknown as AiResponse;
};

export interface ParseArgs<S extends z.ZodType> {
  schema: S;
  system: string;
  messages: Anthropic.MessageParam[];
  /** "low" for the interviewer and other turns, "medium" for synthesis. */
  effort?: 'low' | 'medium';
}

/** What `fn` gets inside `withAi`: one way to call the model. */
export interface AiCaller {
  /** Calls the model and returns its parsed output; throws on a refusal or output that does not fit. */
  parse<S extends z.ZodType>(args: ParseArgs<S>): Promise<z.infer<S>>;
  readonly model: string;
}

export type AiOutcome<T> =
  | { value: T; source: 'ai' }
  | { value: T; source: 'fallback'; reason: 'no_key' | 'cap' | 'refusal' | 'error' };

export interface Ai {
  /** True when a key is set (calls may still fall back if a cap is reached or a call fails). */
  readonly enabled: boolean;
  readonly model: string;
  withAi<T>(name: string, fn: (ai: AiCaller) => Promise<T>, fallback: () => T | Promise<T>): Promise<AiOutcome<T>>;
  /** Today's and this month's estimated spend, with the caps. */
  spending(): Promise<{ today: number; month: number; dailyCap: number; monthlyCap: number }>;
}

/** The model's answer could not be used (a refusal, or output that did not fit the schema). */
export class AiUnusableError extends Error {}

export function costOf(usage: { input_tokens: number; output_tokens: number }): number {
  return ((usage.input_tokens ?? 0) * PRICE_PER_MILLION.input + (usage.output_tokens ?? 0) * PRICE_PER_MILLION.output) / 1e6;
}

export interface AiOptions {
  config: Pick<Config, 'anthropicKey' | 'model' | 'aiDailyUsd' | 'aiMonthlyUsd'>;
  store: Store;
  clock: Clock;
  runner?: AiRunner;
}

export function createAi({ config, store, clock, runner = anthropicRunner }: AiOptions): Ai {
  const day = () => clock.iso().slice(0, 10);

  async function spending() {
    const today = day();
    const month = today.slice(0, 7);
    const all = await store.list('spend');
    return {
      today: all.find((s) => s.id === today)?.usd ?? 0,
      month: all.filter((s) => s.id.startsWith(month)).reduce((n, s) => n + s.usd, 0),
      dailyCap: config.aiDailyUsd,
      monthlyCap: config.aiMonthlyUsd,
    };
  }

  async function record(usd: number) {
    const id = day();
    await store.transaction(async (tx) => {
      const now: Spend = (await tx.get('spend', id)) ?? { id, usd: 0, calls: 0 };
      await tx.put('spend', { id, usd: now.usd + usd, calls: now.calls + 1 });
    });
  }

  const caller: AiCaller = {
    model: config.model,
    async parse({ schema, system, messages, effort = 'low' }) {
      const response = await runner({
        model: config.model,
        max_tokens: 16000,
        output_config: { effort, format: zodOutputFormat(schema) },
        system,
        messages,
      });
      await record(costOf(response.usage));
      if (response.stop_reason === 'refusal' || !response.parsed_output) throw new AiUnusableError('The model gave no usable answer');
      return response.parsed_output as z.infer<typeof schema>;
    },
  };

  return {
    enabled: !!config.anthropicKey,
    model: config.model,
    spending,
    async withAi<T>(name: string, fn: (ai: AiCaller) => Promise<T>, fallback: () => T | Promise<T>): Promise<AiOutcome<T>> {
      if (!config.anthropicKey) return { value: await fallback(), source: 'fallback', reason: 'no_key' };
      try {
        const s = await spending();
        if (s.today >= s.dailyCap || s.month >= s.monthlyCap) {
          console.warn(`[ai:${name}] spending cap reached, using the scripted path`);
          return { value: await fallback(), source: 'fallback', reason: 'cap' };
        }
        return { value: await fn(caller), source: 'ai' };
      } catch (err) {
        if (err instanceof AiUnusableError) {
          console.warn(`[ai:${name}] ${err.message}, using the scripted path`);
          return { value: await fallback(), source: 'fallback', reason: 'refusal' };
        }
        if (err instanceof Anthropic.RateLimitError) console.warn(`[ai:${name}] rate limited, using the scripted path`);
        else if (err instanceof Anthropic.APIError) console.warn(`[ai:${name}] API error ${err.status ?? ''}: ${err.message}`);
        else console.warn(`[ai:${name}] ${(err as Error)?.message ?? err}`);
        return { value: await fallback(), source: 'fallback', reason: 'error' };
      }
    },
  };
}
