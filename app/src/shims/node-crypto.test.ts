// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The node:crypto browser shim must be BYTE-IDENTICAL to Node's createHash for
// the exact call shape solid-vc uses (`createHash("sha256").update(s, "utf8")
// .digest()`), and fail loud on anything outside that surface — a silently
// wrong digest would corrupt every Data Integrity signature the app verifies.
// (The trust suite also exercises the shim end-to-end via the vitest plugin.)

// The shim plugin is IMPORTER-scoped (federation-trust only), so this import
// resolves to the REAL Node module — exactly what parity needs.
import { createHash as nodeCreateHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createHash, randomUUID } from "./node-crypto.js";

const CASES = [
  "",
  "abc",
  "the quick brown fox jumps over the lazy dog",
  "multi-byte: ünïcödé — 統一 🕊️",
  "a".repeat(100_000), // multi-block input
  '<urn:x> <urn:y> "z" .\n', // N-Quads-shaped (the real payload class)
];

describe("node:crypto shim — sha256 byte-parity with Node", () => {
  it("digests strings (utf8) byte-identically to Node's createHash", () => {
    for (const input of CASES) {
      const ours = createHash("sha256").update(input, "utf8").digest();
      const nodes = new Uint8Array(nodeCreateHash("sha256").update(input, "utf8").digest());
      expect(Buffer.from(ours).toString("hex")).toBe(Buffer.from(nodes).toString("hex"));
    }
  });

  it("digests Uint8Array input identically, and supports chained updates", () => {
    const bytes = new TextEncoder().encode("chunked ");
    const ours = createHash("sha256").update(bytes).update("input", "utf8").digest();
    const nodes = new Uint8Array(
      nodeCreateHash("sha256").update(bytes).update("input", "utf8").digest(),
    );
    expect(Buffer.from(ours).toString("hex")).toBe(Buffer.from(nodes).toString("hex"));
  });

  it("FAILS LOUD outside the supported surface (never a wrong hash)", () => {
    expect(() => createHash("sha1")).toThrow(/unsupported hash algorithm/);
    expect(() => createHash("md5")).toThrow(/unsupported hash algorithm/);
    expect(() => createHash("sha256").update("x", "base64")).toThrow(/input encoding/);
    expect(() =>
      createHash("sha256")
        .update("x", "utf8")
        .digest("hex" as never),
    ).toThrow(/raw .* digests/);
  });

  it("randomUUID returns RFC 4122 v4 uuids, unique per call", () => {
    const a = randomUUID();
    const b = randomUUID();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
