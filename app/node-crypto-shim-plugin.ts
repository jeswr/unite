// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Vite build plugin: resolve `node:crypto` to the browser shim
// (src/shims/node-crypto.ts) ONLY when imported by the bundled
// @jeswr/federation-trust dist (its inlined @jeswr/solid-vc uses the sync
// `createHash("sha256")` + `randomUUID`). Scoped by IMPORTER on purpose — a
// blanket alias would also rewrite `node:crypto` inside packages that need the
// real module elsewhere; in the browser build jose et al. resolve their
// browser export conditions and never import node:crypto at all. (Under
// vitest this plugin cannot engage — builtins externalize before plugin
// resolution — so tests run federation-trust against the REAL node:crypto and
// src/shims/node-crypto.test.ts proves the shim byte-identical.) Upstream
// follow-up filed: solid-vc should use Web-platform crypto itself, retiring
// this shim.

import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const SHIM = fileURLToPath(new URL("./src/shims/node-crypto.ts", import.meta.url));

export function nodeCryptoShimPlugin(): Plugin {
  return {
    name: "unite:node-crypto-shim-for-federation-trust",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "node:crypto" && importer?.includes("@jeswr/federation-trust")) {
        return SHIM;
      }
      return null;
    },
  };
}
