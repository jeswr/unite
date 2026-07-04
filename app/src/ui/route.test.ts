// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The hash router parse helpers: fail-closed to the default view, canonical
// hashes round-trip.

import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, parseViewHash, viewHash } from "./route.js";

describe("parseViewHash", () => {
  it("parses the canonical forms", () => {
    expect(parseViewHash("#/overview")).toBe("overview");
    expect(parseViewHash("#/compose")).toBe("compose");
    expect(parseViewHash("#/board")).toBe("board");
    expect(parseViewHash("#/bridge")).toBe("bridge");
  });

  it("tolerates missing slash and trailing junk", () => {
    expect(parseViewHash("#board")).toBe("board");
    expect(parseViewHash("#/board/extra")).toBe("board");
    expect(parseViewHash("#/board?x=1")).toBe("board");
  });

  it("fails closed to the default view", () => {
    expect(parseViewHash("")).toBe(DEFAULT_VIEW);
    expect(parseViewHash(null)).toBe(DEFAULT_VIEW);
    expect(parseViewHash(undefined)).toBe(DEFAULT_VIEW);
    expect(parseViewHash("#/nope")).toBe(DEFAULT_VIEW);
    expect(parseViewHash(`#/${"x".repeat(500)}`)).toBe(DEFAULT_VIEW);
  });

  it("round-trips every canonical hash", () => {
    for (const v of ["overview", "compose", "board", "bridge"] as const) {
      expect(parseViewHash(viewHash(v))).toBe(v);
    }
  });
});
