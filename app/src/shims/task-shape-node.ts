// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Browser stub for the `node:fs` + `node:url` calls in
// `@jeswr/solid-task-model`'s `shape.js` (the SHACL-shape loader). That module
// is pulled into the browser bundle transitively — `@jeswr/solid-chat-interop`'s
// `vocab.js` imports the wf:Task overlay constants from the task-model's BARE
// index, whose `index.js` re-exports `shape.js`, and `shape.js` evaluates
// `fileURLToPath(new URL(...))` + `readFileSync(...)` at MODULE LOAD to expose
// the shape-file path/text. The chat channel (BL.1 `aggregateChannel` →
// `parseAs2Message`) needs those overlay constants but NEVER the SHACL shape
// bytes (validation is not on the parse/serialise path), so returning inert
// values here is behaviour-preserving for the browser: the `TASK_SHAPE_PATH` /
// `taskShapeTtl` exports become empty and are simply never read.
//
// Scoped by IMPORTER in node-crypto-shim-plugin.ts (only the task-model shape
// module resolves `node:fs`/`node:url` here) so no other package's real
// `node:fs`/`node:url` is rewritten. Under vitest builtins externalise before
// plugin resolution, so tests run against the REAL Node modules (shape.js works
// there) — this stub only engages in the browser build.

/** `node:fs` — the shape loader only calls `readFileSync`; return empty bytes/text. */
export function readFileSync(): string {
  return "";
}

/** `node:url` — resolve a file URL to a plain path string (no filesystem access). */
export function fileURLToPath(input: string | URL): string {
  try {
    return typeof input === "string" ? input : input.pathname;
  } catch {
    return "";
  }
}

// A default export too, so a `import fs from "node:fs"` style importer also works.
export default { readFileSync, fileURLToPath };
