// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Browser stub for the `node:zlib` used by the STANDALONE `@jeswr/solid-vc` dist
// (`bitstring.ts` imports `gzipSync` / `gunzipSync` at module load for the W3C
// Bitstring Status List v1.0 GZIP codec). The Build channel (BL.2) is the first
// browser consumer of solid-vc's commission/quorum verify path, which pulls the
// whole solid-vc index — including bitstring — even though the read-only view
// never verifies a revocation STATUS list (no `credentialStatus`, no
// `resolveStatus` seam), so the codec is never invoked at runtime. These stubs
// therefore make the module bundle without changing behaviour on the path BL.2
// exercises; if a browser caller ever DID decode a status list they fail LOUD
// rather than silently wrong.
//
// Scoped by IMPORTER in node-crypto-shim-plugin.ts (only solid-vc's `node:zlib`
// resolves here). Under vitest builtins externalise before plugin resolution, so
// tests run against REAL `node:zlib`. Upstream follow-up (mirrors the node-crypto
// shim note): solid-vc should use a Web-platform (or dependency-injected) codec
// for the bitstring status list so no `node:zlib` reaches the browser bundle.

const UNSUPPORTED =
  "node:zlib is not available in the browser build — the Bitstring Status List " +
  "GZIP codec is server-only (unused on the read-only Build channel path)";

/** `zlib.gzipSync` — never invoked on the BL.2 path; fail LOUD if it ever is. */
export function gzipSync(): never {
  throw new Error(UNSUPPORTED);
}

/** `zlib.gunzipSync` — never invoked on the BL.2 path; fail LOUD if it ever is. */
export function gunzipSync(): never {
  throw new Error(UNSUPPORTED);
}

export default { gzipSync, gunzipSync };
