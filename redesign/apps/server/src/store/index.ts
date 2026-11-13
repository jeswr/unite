import type { Clock } from '@unite/shared';
import type { Config } from '../config.js';
import { SqlStore } from './sql.js';
import type { Store } from './types.js';

export * from './types.js';
export { SqlStore } from './sql.js';

/** Postgres when DATABASE_URL is set; otherwise PGlite at UNITE_DATA_DIR, or in memory. */
export async function openStore(config: Pick<Config, 'databaseUrl' | 'dataDir'>, clock: Clock): Promise<Store> {
  if (config.databaseUrl) {
    const { postgresDriver } = await import('./postgres.js');
    return SqlStore.open(await postgresDriver(config.databaseUrl), clock);
  }
  const { pgliteDriver } = await import('./pglite.js');
  return SqlStore.open(await pgliteDriver(config.dataDir), clock);
}

/** A fresh in-memory store, for tests. */
export function memoryStore(clock: Clock): Promise<Store> {
  return openStore({ dataDir: 'memory' }, clock);
}
