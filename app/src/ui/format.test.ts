// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Presentation helpers: deterministic, safe on junk input.

import { describe, expect, it } from "vitest";
import { avatarColor, formatDate, initials } from "./format.js";

describe("initials", () => {
  it("takes first letters of up to two words, uppercased", () => {
    expect(initials("Amara")).toBe("A");
    expect(initials("amara okafor")).toBe("AO");
    expect(initials("a b c")).toBe("AC");
    expect(initials("  ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("is deterministic and always returns a palette value", () => {
    expect(avatarColor("https://a.example/#me")).toBe(avatarColor("https://a.example/#me"));
    expect(avatarColor("x")).toMatch(/^var\(--u-/);
    expect(avatarColor("")).toMatch(/^var\(--u-/);
  });
});

describe("formatDate", () => {
  const now = new Date("2026-07-04T00:00:00Z");
  it("renders day + month within the current year", () => {
    expect(formatDate("2026-06-02T09:15:00Z", now)).toBe("2 Jun");
  });
  it("adds the year for other years", () => {
    expect(formatDate("2025-06-02T09:15:00Z", now)).toContain("2025");
  });
  it("returns empty for junk", () => {
    expect(formatDate("not-a-date", now)).toBe("");
  });
});
