// Entry point: `node server/main.js`. Binds to loopback only.
//   UNITE_PORT=8769           port (default 8769)
//   UNITE_AI=claude-cli       opt in to the Claude Code CLI bridge (default off)
//   UNITE_CLAUDE_BIN=/abs/path   CLI location if `claude` is not on PATH

import { rmSync } from 'node:fs';
import { ClaudeBridge, findExecutable } from './ai.js';
import { createUniteServer } from './app.js';

const port = Number(process.env.UNITE_PORT ?? 8769);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('UNITE_PORT must be a port number.');
  process.exit(1);
}

const aiRequested = process.env.UNITE_AI === 'claude-cli';
const binSetting = process.env.UNITE_CLAUDE_BIN;
if (binSetting && !binSetting.startsWith('/')) {
  console.error('UNITE_CLAUDE_BIN must be an absolute path.');
  process.exit(1);
}
const bridge = new ClaudeBridge({
  enabled: aiRequested,
  command: aiRequested ? findExecutable(binSetting ?? 'claude') : null,
});

const server = createUniteServer({ bridge });
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} on 127.0.0.1 is already in use. Stop the other process or set UNITE_PORT.`
    : `Could not start the server (${error.code ?? error.name}).`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Unite local demo: http://127.0.0.1:${port}/`);
  console.log('Public data lives in memory only and is lost when this process stops.');
  console.log(bridge.enabled
    ? 'AI conversation: ON (Claude Code CLI, model claude-opus-5-5). Each call needs participant consent in the browser.'
    : `AI conversation: OFF. ${bridge.status().reason}`);
});

const shutdown = () => {
  server.close(() => {
    if (bridge.cwd) rmSync(bridge.cwd, { recursive: true, force: true });
    process.exit(0);
  });
  server.closeAllConnections(); // includes open event streams
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
