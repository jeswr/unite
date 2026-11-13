import type { Clock } from '@unite/shared';
import type { Ai } from './ai/client.js';
import type { Config } from './config.js';
import type { Store } from './store/types.js';

/**
 * What every route factory and service receives. Built once in index.ts (or by a test, with an
 * in-memory store, a fixed clock and a fake AI runner) and passed to `createApp(deps)`, which
 * hands it to each router: `export function fooRouter(deps: Deps): Router`.
 */
export interface Deps {
  store: Store;
  clock: Clock;
  ai: Ai;
  config: Config;
}
