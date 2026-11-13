import type { Clock } from '@unite/shared';

/**
 * A sliding-window limit that reads the time from the injected clock, so tests can move it.
 * Kept in memory, per server process.
 */
export class WindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly clock: Clock,
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const kept = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (kept.length) this.hits.set(key, kept);
    else this.hits.delete(key);
    return kept;
  }

  /** True when another hit is allowed under every key now. */
  allows(...keys: string[]): boolean {
    const now = this.clock.now().getTime();
    return keys.every((k) => this.recent(k, now).length < this.limit);
  }

  /** Records one hit against each key. */
  record(...keys: string[]): void {
    const now = this.clock.now().getTime();
    for (const k of keys) this.hits.set(k, [...this.recent(k, now), now]);
    if (this.hits.size > 10_000) for (const k of [...this.hits.keys()]) this.recent(k, now);
  }

  /** Checks and records in one step: true when allowed (and counted). */
  take(...keys: string[]): boolean {
    if (!this.allows(...keys)) return false;
    this.record(...keys);
    return true;
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/** Section 7 and the brief: turns 20 a minute per feedback and per address; 5 new feedback records an hour per address. */
export function feedbackLimiters(clock: Clock) {
  return {
    turns: new WindowLimiter(clock, 20, MINUTE_MS),
    starts: new WindowLimiter(clock, 5, HOUR_MS),
  };
}
