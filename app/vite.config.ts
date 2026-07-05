import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  nodeCryptoShimPlugin,
  nodeZlibShimPlugin,
  taskShapeNodeShimPlugin,
} from "./node-crypto-shim-plugin.js";

// AUTHORED-BY Claude Fable 5 (PSS agent)

/** Short git SHA for the FeedbackButton version tag; git-failure-safe. */
function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  // The shim plugin maps federation-trust's `node:crypto` imports onto the
  // browser shim (see node-crypto-shim-plugin.ts); vitest.config.ts carries
  // the SAME plugin so the tests execute the exact bytes the SPA ships.
  plugins: [
    nodeCryptoShimPlugin(),
    nodeZlibShimPlugin(),
    taskShapeNodeShimPlugin(),
    react(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
  },
  resolve: {
    // A nested second React instance triggers invalid-hook-call; dedupe the
    // shared singletons the app + the app-shell/solid-elements chrome all use.
    dedupe: ["react", "react-dom"],
    alias: [
      // `@jeswr/solid-vc` lazily `import("@jeswr/guarded-fetch/node")` to build a
      // default DNS-pinned WebID-resolution fetch — a node-only path (node:dns +
      // undici) that the browser can never bundle AND that the Build channel
      // never hits (the read view injects its own resolveKey, no default fetch).
      // Point the node subpath at the BROWSER guarded-fetch build so the bundle
      // resolves; the node-only `createNodeGuardedFetch` export is simply absent
      // (inert — never called in the browser). solid-vc should be browser-first
      // here (upstream follow-up, mirroring the node-crypto/zlib shims).
      { find: "@jeswr/guarded-fetch/node", replacement: "@jeswr/guarded-fetch" },
    ],
  },
});
