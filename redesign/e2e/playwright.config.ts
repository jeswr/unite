import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the built app (`pnpm e2e` builds first): one server process serving the
 * web app and the API, on an in-memory store, seeded in demo mode, in scripted mode, with the clock
 * fixed at the seed's reference date.
 */
const PORT = Number(process.env.E2E_PORT ?? 4399);
const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  outputDir: path.join(import.meta.dirname, 'results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: 'pnpm --filter @unite/server start',
    cwd: root,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      UNITE_DATA_DIR: 'memory',
      UNITE_DEMO: '1',
      UNITE_NOW: '2026-11-13T09:00:00Z',
      ANTHROPIC_API_KEY: '',
      NODE_ENV: 'test',
    },
  },
});
