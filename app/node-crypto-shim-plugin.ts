// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Vite build plugins: resolve the `node:` builtins that the bundled
// @jeswr/federation-trust + @jeswr/solid-vc dists import onto inert browser
// shims — the sync `createHash("sha256")` + `randomUUID` (node:crypto), and
// solid-vc's Bitstring Status List GZIP codec (node:zlib). Scoped by IMPORTER on
// purpose — a blanket alias would also rewrite these builtins inside packages
// that need the real module elsewhere; in the browser build jose et al. resolve
// their browser export conditions and never import them. federation-trust
// INLINES the parts of solid-vc it uses (node:crypto only); the Build channel
// (BL.2) is the first browser consumer of the STANDALONE @jeswr/solid-vc dist
// (commission/quorum verify), which pulls the whole index — including bitstring
// (node:zlib) — hence the widened scope + the zlib stub. (Under vitest these
// plugins cannot engage — builtins externalize before plugin resolution — so
// tests run against the REAL node modules and src/shims/node-crypto.test.ts
// proves the crypto shim byte-identical.) Upstream follow-up: solid-vc should use
// Web-platform crypto + a dependency-injected status codec itself, retiring these.

import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const SHIM = fileURLToPath(new URL("./src/shims/node-crypto.ts", import.meta.url));

/** Packages whose `node:crypto` is the sync `createHash`/`randomUUID` the shim covers. */
function needsNodeCryptoShim(importer: string | undefined): boolean {
  return (
    importer !== undefined &&
    (importer.includes("@jeswr/federation-trust") || importer.includes("@jeswr/solid-vc"))
  );
}

export function nodeCryptoShimPlugin(): Plugin {
  return {
    name: "unite:node-crypto-shim-for-federation-trust",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "node:crypto" && needsNodeCryptoShim(importer)) {
        return SHIM;
      }
      return null;
    },
  };
}

const ZLIB_SHIM = fileURLToPath(new URL("./src/shims/node-zlib.ts", import.meta.url));

// Resolve `node:zlib` to an inert browser stub ONLY for `@jeswr/solid-vc`'s
// bitstring status-list codec (gzipSync/gunzipSync). Never invoked on the
// read-only Build channel verify path (no credentialStatus / resolveStatus), so
// the stub is behaviour-preserving. Scoped by IMPORTER. See src/shims/node-zlib.ts.
export function nodeZlibShimPlugin(): Plugin {
  return {
    name: "unite:node-zlib-shim-for-solid-vc",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "node:zlib" && importer?.includes("@jeswr/solid-vc")) {
        return ZLIB_SHIM;
      }
      return null;
    },
  };
}

const SHAPE_SHIM = fileURLToPath(new URL("./src/shims/task-shape-node.ts", import.meta.url));

// Resolve `node:fs` / `node:url` to an inert browser stub ONLY for
// `@jeswr/solid-task-model`'s `shape.js` (the SHACL-shape loader). The Build
// channel (BL.1 `aggregateChannel` → `@jeswr/solid-chat-interop`) is the first
// browser consumer of the chat vocab, whose bare task-model index re-exports
// `shape.js`, which evaluates `readFileSync`/`fileURLToPath` at module load. The
// parse path never reads the shape bytes, so the stub is behaviour-preserving.
// Scoped by IMPORTER (only the shape module) so no other package's real
// `node:fs`/`node:url` is rewritten. See src/shims/task-shape-node.ts.
export function taskShapeNodeShimPlugin(): Plugin {
  return {
    name: "unite:task-shape-node-shim",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        (source === "node:fs" || source === "node:url") &&
        importer?.includes("solid-task-model") &&
        importer.includes("shape")
      ) {
        return SHAPE_SHIM;
      }
      return null;
    },
  };
}
