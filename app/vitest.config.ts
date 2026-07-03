import { defineConfig } from "vitest/config";

// AUTHORED-BY Claude Fable 5 (PSS agent)
// The exhaustive suite is on the pure data layer (src/lib), which runs under the
// default node environment. UI hook tests opt into jsdom per-file via a
// `// @vitest-environment jsdom` comment at the top of the file.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
