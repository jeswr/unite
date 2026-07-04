// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Browser-bundle shim for `node:crypto`, wired by node-crypto-shim-plugin.ts
// (vite.config.ts) — importer-scoped to the bundled `@jeswr/federation-trust`
// dist, whose inlined `@jeswr/solid-vc` imports exactly two things from
// `node:crypto`:
//
//   • `createHash("sha256").update(text, "utf8").digest()` — the Data
//     Integrity hash over RDFC-1.0 canonical N-Quads;
//   • `randomUUID()` — `urn:uuid:` credential ids.
//
// We map them onto AUDITED, platform equivalents — `@noble/hashes` (the
// vetted, zero-dependency JS SHA-256; WebCrypto's subtle.digest is async and
// cannot back Node's sync createHash) and `globalThis.crypto.randomUUID` — and
// FAIL LOUD on anything outside that exact surface, so a future upstream
// change cannot silently get a wrong or weak digest. No crypto is hand-rolled
// here; this file only adapts call shapes. Under vitest, node builtins are
// externalized before plugins run, so tests execute the REAL Node module;
// node-crypto.test.ts proves this shim byte-identical to it.
//
// Upstream follow-up (filed): solid-vc should use Web-platform crypto itself,
// making this shim unnecessary.

import { sha256 } from "@noble/hashes/sha2.js";

/** The `.update()`/`.digest()` subset of Node's Hash that solid-vc uses. */
export interface ShimHash {
  update(data: string | Uint8Array, encoding?: string): ShimHash;
  digest(encoding?: string): Uint8Array;
}

/**
 * Node-compatible `createHash` for exactly `"sha256"` — any other algorithm,
 * input encoding, or digest encoding throws (fail-loud, never a wrong hash).
 */
export function createHash(algorithm: string): ShimHash {
  if (algorithm !== "sha256") {
    throw new Error(`node:crypto shim: unsupported hash algorithm "${algorithm}"`);
  }
  const hasher = sha256.create();
  const shim: ShimHash = {
    update(data, encoding) {
      if (typeof data === "string") {
        if (encoding !== undefined && encoding !== "utf8" && encoding !== "utf-8") {
          throw new Error(`node:crypto shim: unsupported input encoding "${encoding}"`);
        }
        hasher.update(new TextEncoder().encode(data));
      } else {
        hasher.update(data);
      }
      return shim;
    },
    digest(encoding) {
      if (encoding !== undefined) {
        throw new Error(`node:crypto shim: only raw (Uint8Array) digests are supported`);
      }
      return hasher.digest();
    },
  };
  return shim;
}

/** RFC 4122 v4 UUID from the Web platform (browsers + Node ≥ 19). */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}
