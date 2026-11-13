// `pnpm seed`: writes the examples into the configured store (idempotent).
import { clockFromConfig } from '../clock.js';
import { loadConfig } from '../config.js';
import { openStore } from '../store/index.js';
import { seed } from './index.js';

const config = loadConfig();
if (config.dataDir === 'memory' && !config.databaseUrl) {
  console.error('UNITE_DATA_DIR=memory: nothing would be kept. Seeding happens at start-up in demo mode instead.');
  process.exit(1);
}
const store = await openStore(config, clockFromConfig(config));
await seed({ store });
console.log(`Seeded: ${await store.count('assemblies')} assemblies, ${await store.count('persons')} people.`);
await store.close();
