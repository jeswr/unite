import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Each test file builds its own database with the worked examples; more workers than this runs out of memory.
    maxWorkers: 4,
  },
});
