/**
 * The clock every timestamp comes from. Injected everywhere, so tests and the video can fix the
 * time (UNITE_NOW) and get the same records every run.
 */
export interface Clock {
  now(): Date;
  /** `now()` as an ISO string. */
  iso(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  iso: () => new Date().toISOString(),
};

export interface FixedClock extends Clock {
  /** Move this clock forward (tests). */
  advance(ms: number): void;
  set(iso: string): void;
}

/** A clock that stands still at `iso` until it is moved. */
export function fixedClock(iso: string): FixedClock {
  let t = new Date(iso).getTime();
  if (Number.isNaN(t)) throw new Error(`Not a date-time: ${iso}`);
  return {
    now: () => new Date(t),
    iso: () => new Date(t).toISOString(),
    advance(ms: number) {
      t += ms;
    },
    set(next: string) {
      t = new Date(next).getTime();
    },
  };
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** `iso` plus a number of days, as an ISO date-time. */
export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}
