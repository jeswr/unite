// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The participant-listing seam. StaticRegistry validates its config loudly (a
// misconfiguration is a bug, not a silently-dropped participant).

import { describe, expect, it } from "vitest";
import { StaticRegistry } from "./registry.js";

const DELIB = "https://community.example/d1";
const OK = { webId: "https://alice.example/#me", base: "https://alice.example/u/d1/" };

describe("StaticRegistry", () => {
  it("lists validated participants", async () => {
    const reg = new StaticRegistry(DELIB, [OK]);
    expect(reg.deliberation).toBe(DELIB);
    expect(await reg.listParticipants()).toEqual([OK]);
  });

  it("returns a defensive copy (mutating the result cannot corrupt the registry)", async () => {
    const reg = new StaticRegistry(DELIB, [OK]);
    const first = await reg.listParticipants();
    first.push({ webId: "https://x/#me", base: "https://x/" });
    expect(await reg.listParticipants()).toHaveLength(1);
  });

  it("rejects a non-https WebID", () => {
    expect(() => new StaticRegistry(DELIB, [{ webId: "http://a/#me", base: OK.base }])).toThrow();
  });

  it("rejects a base without a trailing slash", () => {
    expect(
      () => new StaticRegistry(DELIB, [{ webId: OK.webId, base: "https://a.example/u/d1" }]),
    ).toThrow();
  });

  it("rejects a non-https base", () => {
    expect(
      () => new StaticRegistry(DELIB, [{ webId: OK.webId, base: "http://a.example/u/d1/" }]),
    ).toThrow();
  });

  it("rejects a non-http(s) deliberation IRI", () => {
    expect(() => new StaticRegistry("urn:x", [OK])).toThrow();
  });
});
