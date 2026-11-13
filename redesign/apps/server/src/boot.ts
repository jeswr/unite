import { createAi } from './ai/client.js';
import { clockFromConfig } from './clock.js';
import type { Config } from './config.js';
import type { Deps } from './deps.js';
import { seedIfEmpty } from './seed/index.js';
import { openStore } from './store/index.js';

/** Opens the store, builds the dependencies, and seeds the examples on an empty store in demo mode. */
export async function boot(config: Config): Promise<Deps> {
  const clock = clockFromConfig(config);
  const store = await openStore(config, clock);
  const ai = createAi({ config, store, clock });
  const deps: Deps = { store, clock, ai, config };
  if (config.demo) await seedIfEmpty(deps);
  return deps;
}
