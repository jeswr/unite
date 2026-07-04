import { defineConfig } from "vitest/config";

// AUTHORED-BY Claude Fable 5 (PSS agent)
// The exhaustive suite is on the pure data layer (src/lib), which runs under the
// default node environment. UI hook tests opt into jsdom per-file via a
// `// @vitest-environment jsdom` comment at the top of the file.
//
// node:crypto note — under vitest, node builtins are externalized BEFORE
// plugin resolution, so federation-trust's `node:crypto` imports run against
// the REAL Node module here (the reference implementation). The BROWSER build
// swaps them for src/shims/node-crypto.ts via node-crypto-shim-plugin.ts in
// vite.config.ts (verified: the shim's strings are the only node:crypto
// occurrences in the bundle), and src/shims/node-crypto.test.ts proves the
// shim byte-identical to the Node reference for the exact call shape used.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
