// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The v1 SNAPSHOT GUARD (design/v2 07 §1 rule 2): v1 stays byte-identical when
// the v2 surface is off. Three machine-checkable halves:
//
//   1. DEPENDENCY DIRECTION — no v1 module (src/ui, src/lib, src/scope,
//      src/demo) imports from src/v2, except the ONE sanctioned mount point:
//      ui/main.tsx's DYNAMIC import, which is never evaluated under the v1
//      surface. v2 may import v1 (shared engine + shell); never the reverse.
//   2. ROUTER ISOLATION — the v1 hash router does not learn the v2 routes:
//      every v2 hash still parses to the v1 default view, exactly as before
//      the v2 surface existed.
//   3. DEFAULT-OFF — with no explicit selector the surface resolves to v1
//      (covered exhaustively in scope/surface.test.ts; re-asserted here).
//
// The remaining byte-identity evidence is the UNTOUCHED v1 test suite itself:
// no v1 source file changes in the v2 phases except main.tsx's mount seam.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveSurface } from "../scope/surface.js";
import { DEFAULT_VIEW, parseViewHash } from "../ui/route.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every .ts/.tsx file under `dir`, recursively (relative to src/). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(SRC, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe("the v1 snapshot guard", () => {
  it("no v1 module imports from src/v2 (main.tsx's dynamic mount excepted)", () => {
    const offenders: string[] = [];
    for (const dir of ["ui", "lib", "scope", "demo"]) {
      for (const file of sourceFiles(dir)) {
        const text = readFileSync(join(SRC, file), "utf8");
        const staticImport =
          /from\s+["'][./]*\.\.\/v2\//.test(text) || /from\s+["']\.\/v2\//.test(text);
        const dynamicImport = /import\(\s*["'][./]*\.\.\/v2\//.test(text);
        if (relative(".", file) === join("ui", "main.tsx")) {
          // The one sanctioned coupling: the DYNAMIC surface mount only.
          if (staticImport) offenders.push(`${file} (static import of v2)`);
          continue;
        }
        if (staticImport || dynamicImport) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the v1 router does not learn the v2 routes", () => {
    for (const hash of [
      "#/commons",
      "#/circle/maple-mornings",
      "#/notebook",
      "#/how",
      "#/story/crossing",
      "#/circles",
      "#/arc",
      "#/curtain",
      "#/join-us",
    ]) {
      expect(parseViewHash(hash)).toBe(DEFAULT_VIEW);
    }
  });

  it("the surface is off by default (v1 renders)", () => {
    expect(resolveSurface({}).id).toBe("v1");
    expect(
      resolveSurface({ hostname: "unite.jeswr.org", search: "?scope=society", env: undefined }).id,
    ).toBe("v1");
  });
});
