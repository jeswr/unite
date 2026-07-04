// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The participant-listing seam. StaticRegistry validates its config loudly (a
// misconfiguration is a bug, not a silently-dropped participant).

import { describe, expect, it } from "vitest";
import { isValidBase, StaticRegistry } from "./registry.js";

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

// Regression (missed sibling of the pod.ts 7c0af10 fix): `isValidBase` must
// validate the PARSED `pathname`, not the raw `base` string — a raw-string
// `base.endsWith("/")` check is fooled by a slashless path whose query/fragment
// happens to end in "/". `isValidBase` gates which containers get
// HEAD-polled / WebSocket-watched (hooks.ts -> notifications.ts) for a
// participant base supplied via the user-editable Join form, so a malformed
// slashless base must not be accepted as a valid container.
describe("isValidBase", () => {
  it("rejects a slashless-path base whose query ends in '/'", () => {
    expect(isValidBase("https://x/mal?q=/")).toBe(false);
  });

  it("rejects a slashless-path base whose fragment ends in '/'", () => {
    expect(isValidBase("https://x/mal#/")).toBe(false);
  });

  it("accepts a real container base", () => {
    expect(isValidBase("https://x/mal/")).toBe(true);
  });

  it("rejects a non-https base", () => {
    expect(isValidBase("http://x/mal/")).toBe(false);
  });

  it("rejects an unparseable base", () => {
    expect(isValidBase("not a url")).toBe(false);
  });
});

describe("StaticRegistry — rejects the smuggled-base attack surface", () => {
  it("rejects a participant base with a slashless path smuggled via a query string", () => {
    expect(
      () => new StaticRegistry(DELIB, [{ webId: OK.webId, base: "https://alice.example/mal?x=/" }]),
    ).toThrow(/invalid participant base/);
  });

  it("rejects a participant base with a slashless path smuggled via a fragment", () => {
    expect(
      () => new StaticRegistry(DELIB, [{ webId: OK.webId, base: "https://alice.example/mal#/" }]),
    ).toThrow(/invalid participant base/);
  });
});
