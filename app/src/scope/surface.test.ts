// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// resolveSurface — pure, fail-closed, precedence-exact (design/v2 07 §2).
// The V0 acceptance's first half: the v2 surface activates ONLY on an
// explicit, valid selector; everything else — including every input the
// existing v1 deploys produce — resolves to v1.

import { describe, expect, it } from "vitest";
import { DEFAULT_SURFACE, isSurfaceId, resolveSurface, SURFACES, surfaceHref } from "./surface.js";

describe("resolveSurface", () => {
  it("defaults to v1 with no input at all", () => {
    expect(resolveSurface().id).toBe("v1");
    expect(resolveSurface({}).id).toBe("v1");
    expect(DEFAULT_SURFACE).toBe("v1");
  });

  it("resolves v1 for every input the existing deploys produce", () => {
    // The live v1 hostnames (scope hosts select SCOPES, never a surface).
    for (const hostname of [
      "unite.jeswr.org",
      "apps.unite.jeswr.org",
      "infra.unite.jeswr.org",
      "society.unite.jeswr.org",
      "localhost",
    ]) {
      expect(resolveSurface({ hostname }).id).toBe("v1");
    }
    // A scope query is not a surface query.
    expect(resolveSurface({ search: "?scope=society" }).id).toBe("v1");
  });

  it("selects v2 from the ?surface= query", () => {
    expect(resolveSurface({ search: "?surface=v2" }).id).toBe("v2");
    expect(resolveSurface({ search: "surface=v2" }).id).toBe("v2");
    expect(resolveSurface({ search: "?scope=society&surface=v2" }).id).toBe("v2");
    expect(resolveSurface({ search: "?surface=V2" }).id).toBe("v2"); // case-lenient
    expect(resolveSurface({ search: "?surface= v2 " }).id).toBe("v2"); // whitespace-lenient
  });

  it("selects v2 from the env pin", () => {
    expect(resolveSurface({ env: "v2" }).id).toBe("v2");
    expect(resolveSurface({ env: "V2" }).id).toBe("v2");
  });

  it("selects v2 from the hostname first label (chat / v2)", () => {
    expect(resolveSurface({ hostname: "chat.unite.jeswr.org" }).id).toBe("v2");
    expect(resolveSurface({ hostname: "v2.unite.jeswr.org" }).id).toBe("v2");
    expect(resolveSurface({ hostname: "CHAT.unite.jeswr.org" }).id).toBe("v2");
  });

  it("matches the FIRST hostname label only", () => {
    expect(resolveSurface({ hostname: "unite.chat.example" }).id).toBe("v1");
    expect(resolveSurface({ hostname: "notchat.unite.jeswr.org" }).id).toBe("v1");
  });

  it("precedence: query beats env beats hostname", () => {
    expect(
      resolveSurface({ search: "?surface=v1", env: "v2", hostname: "chat.unite.jeswr.org" }).id,
    ).toBe("v1");
    expect(resolveSurface({ env: "v1", hostname: "chat.unite.jeswr.org" }).id).toBe("v1");
    expect(resolveSurface({ search: "?surface=v2", hostname: "unite.jeswr.org" }).id).toBe("v2");
  });

  it("fails closed on malformed / hostile input (falls through, never throws)", () => {
    expect(resolveSurface({ search: "?surface=admin" }).id).toBe("v1");
    expect(resolveSurface({ search: "?surface=" }).id).toBe("v1");
    expect(resolveSurface({ search: `?surface=${"x".repeat(5000)}` }).id).toBe("v1");
    expect(resolveSurface({ search: "x".repeat(5000) }).id).toBe("v1"); // over-long search
    expect(resolveSurface({ hostname: "x".repeat(300) }).id).toBe("v1"); // over-long host
    expect(resolveSurface({ hostname: "" }).id).toBe("v1");
    expect(resolveSurface({ env: "chat" }).id).toBe("v1"); // env takes ids, not host labels
    expect(resolveSurface({ search: null, env: null, hostname: null }).id).toBe("v1");
  });

  it("v2 forces the society scope; v1 forces nothing (07 §2)", () => {
    expect(SURFACES.v2.forcesScope).toBe("society");
    expect(SURFACES.v1.forcesScope).toBeNull();
  });
});

describe("isSurfaceId", () => {
  it("accepts exactly the two ids", () => {
    expect(isSurfaceId("v1")).toBe(true);
    expect(isSurfaceId("v2")).toBe(true);
    expect(isSurfaceId("v3")).toBe(false);
    expect(isSurfaceId("")).toBe(false);
    expect(isSurfaceId(undefined)).toBe(false);
    expect(isSurfaceId(2)).toBe(false);
  });
});

describe("surfaceHref", () => {
  it("sets the surface param, preserving other params and the hash", () => {
    expect(surfaceHref("v2", "?scope=society", "#/commons")).toBe(
      "?scope=society&surface=v2#/commons",
    );
    expect(surfaceHref("v1")).toBe("?surface=v1");
  });

  it("degrades a malformed search to just the surface param", () => {
    expect(surfaceHref("v2", "x".repeat(5000), "not-a-hash")).toBe("?surface=v2");
  });

  it("pins the scope when given (a v2→v1 link must carry society)", () => {
    expect(surfaceHref("v1", null, "#/deck", "society")).toBe("?surface=v1&scope=society#/deck");
    // An existing scope param is overwritten to the pinned one.
    expect(surfaceHref("v1", "?scope=apps", "#/bridge", "society")).toBe(
      "?scope=society&surface=v1#/bridge",
    );
    // An invalid/absent scope is ignored (fail-safe — no bogus scope param).
    expect(surfaceHref("v1", null, "#/deck", null)).toBe("?surface=v1#/deck");
    expect(surfaceHref("v1", null, "#/deck")).toBe("?surface=v1#/deck");
  });
});
