import { fixedClock, systemClock, type Clock } from '@unite/shared';
import type { Config } from './config.js';

/** The server's clock: fixed at UNITE_NOW when it is set, otherwise the system clock. */
export function clockFromConfig(config: Pick<Config, 'now'>): Clock {
  return config.now ? fixedClock(config.now) : systemClock;
}
