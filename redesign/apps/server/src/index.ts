import { createApp } from './app.js';
import { boot } from './boot.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const deps = await boot(config);
const app = createApp(deps);
const server = app.listen(config.port, () => {
  const store = config.databaseUrl ? 'Postgres' : config.dataDir === 'memory' ? 'PGlite in memory' : `PGlite at ${config.dataDir}`;
  console.log(`Unite is listening on http://localhost:${config.port} (${store}${config.demo ? ', demo' : ''}${deps.ai.enabled ? '' : ', scripted mode'})`);
});

const stop = () => {
  server.close();
  deps.store.close().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
